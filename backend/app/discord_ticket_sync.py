from __future__ import annotations

import hmac
import os
import secrets
from datetime import datetime, timezone

from fastapi import HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session


def register_discord_ticket_sync(app, engine, User, record_audit=None):
    expected_secret = os.getenv('DISCORD_BOT_SECRET', '').strip()

    def authenticate(request: Request):
        if not expected_secret:
            raise HTTPException(status_code=503, detail='Discord bot administration is not configured.')
        provided = request.headers.get('X-Discord-Bot-Secret', '')
        if not hmac.compare_digest(provided, expected_secret):
            raise HTTPException(status_code=401, detail='Invalid bot authentication.')

    class CreateTicketBody(BaseModel):
        discord_id: str = Field(min_length=2, max_length=32)
        discord_username: str = Field(default='Discord User', min_length=1, max_length=128)
        subject: str = Field(default='Discord Support Ticket', min_length=3, max_length=120)
        body: str = Field(min_length=1, max_length=4000)

    class ReplyBody(BaseModel):
        ticket_id: int = Field(ge=1)
        body: str = Field(min_length=1, max_length=4000)
        author_name: str = Field(default='Discord Staff', min_length=1, max_length=64)

    class StatusBody(BaseModel):
        ticket_id: int = Field(ge=1)
        discord_thread_id: str | None = Field(default=None, max_length=64)

    class CloseBody(BaseModel):
        ticket_id: int = Field(ge=1)

    @app.post('/api/discord/tickets', status_code=201)
    def create_discord_ticket(body: CreateTicketBody, request: Request):
        authenticate(request)
        from app.discord_auth_routes import DiscordAccount
        from app.ticket_routes import Ticket, TicketMessage
        discord_id = body.discord_id.strip()
        discord_username = body.discord_username.strip() or 'Discord User'
        now = datetime.now(timezone.utc)
        with Session(engine) as db:
            linked = db.scalar(select(DiscordAccount).where(DiscordAccount.discord_id == discord_id))
            user = db.get(User, linked.user_id) if linked else None
            if linked and user is None:
                raise HTTPException(status_code=500, detail='The linked website account no longer exists.')
            if user is None:
                base = ''.join(ch for ch in discord_username.lower().replace(' ', '_') if ch.isalnum() or ch == '_')[:24] or 'discord_user'
                username = base
                counter = 1
                while db.scalar(select(User).where(User.username == username)):
                    counter += 1
                    username = f'{base[:20]}_{counter}'
                email = f'discord-{discord_id}@discord.local'
                while db.scalar(select(User).where(User.email == email)):
                    email = f'discord-{discord_id}-{secrets.token_hex(3)}@discord.local'
                user = User(username=username, email=email, password_hash=secrets.token_hex(32))
                db.add(user)
                db.flush()
                db.add(DiscordAccount(user_id=user.id, discord_id=discord_id, discord_username=discord_username[:128], created_at=now, updated_at=now))
            elif linked:
                linked.discord_username = discord_username[:128]
                linked.updated_at = now

            ticket = Ticket(user_id=user.id, subject=body.subject.strip(), status='open')
            db.add(ticket)
            db.flush()
            db.add(TicketMessage(ticket_id=ticket.id, author_user_id=user.id, author_name=discord_username[:64], body=body.body.strip(), source='discord'))
            db.commit()
            db.refresh(ticket)
            return {
                'id': ticket.id,
                'userId': ticket.user_id,
                'subject': ticket.subject,
                'status': ticket.status,
                'discordThreadId': ticket.discord_thread_id,
                'createdAt': ticket.created_at.replace(tzinfo=timezone.utc).isoformat() if ticket.created_at.tzinfo is None else ticket.created_at.isoformat(),
                'updatedAt': ticket.updated_at.replace(tzinfo=timezone.utc).isoformat() if ticket.updated_at.tzinfo is None else ticket.updated_at.isoformat(),
            }

    @app.get('/api/discord/tickets/{ticket_id}')
    def get_discord_ticket(ticket_id: int, request: Request, after_id: int = 0):
        authenticate(request)
        from app.ticket_routes import Ticket, TicketMessage
        if after_id < 0:
            raise HTTPException(status_code=422, detail='Invalid message cursor.')
        with Session(engine) as db:
            ticket = db.get(Ticket, ticket_id)
            if not ticket:
                raise HTTPException(status_code=404, detail='Ticket not found.')
            messages = db.scalars(select(TicketMessage).where(TicketMessage.ticket_id == ticket_id, TicketMessage.id > after_id).order_by(TicketMessage.id.asc())).all()
            return {
                'ticket': {
                    'id': ticket.id,
                    'userId': ticket.user_id,
                    'subject': ticket.subject,
                    'status': ticket.status,
                    'discordThreadId': ticket.discord_thread_id,
                    'createdAt': ticket.created_at.replace(tzinfo=timezone.utc).isoformat() if ticket.created_at.tzinfo is None else ticket.created_at.isoformat(),
                    'updatedAt': ticket.updated_at.replace(tzinfo=timezone.utc).isoformat() if ticket.updated_at.tzinfo is None else ticket.updated_at.isoformat(),
                },
                'messages': [
                    {
                        'id': item.id,
                        'ticketId': item.ticket_id,
                        'authorUserId': item.author_user_id,
                        'authorName': item.author_name,
                        'body': item.body,
                        'source': item.source,
                        'createdAt': item.created_at.replace(tzinfo=timezone.utc).isoformat() if item.created_at.tzinfo is None else item.created_at.isoformat(),
                    }
                    for item in messages
                ],
            }

    @app.get('/api/discord/tickets')
    def list_discord_tickets(request: Request):
        authenticate(request)
        from app.ticket_routes import Ticket
        with Session(engine) as db:
            rows = db.scalars(select(Ticket).where(Ticket.discord_thread_id.is_not(None), Ticket.status != 'closed').order_by(Ticket.updated_at.desc())).all()
            return {'tickets': [{'id': row.id, 'discordThreadId': row.discord_thread_id, 'status': row.status} for row in rows]}

    @app.post('/api/discord/tickets/reply')
    def reply_discord_ticket(body: ReplyBody, request: Request):
        authenticate(request)
        from app.ticket_routes import Ticket, TicketMessage
        with Session(engine) as db:
            ticket = db.get(Ticket, body.ticket_id)
            if not ticket:
                raise HTTPException(status_code=404, detail='Ticket not found.')
            if ticket.status == 'closed':
                raise HTTPException(status_code=409, detail='This ticket is closed.')
            message = TicketMessage(ticket_id=ticket.id, author_user_id=1, author_name=body.author_name.strip()[:64], body=body.body.strip(), source='discord')
            ticket.updated_at = datetime.now(timezone.utc)
            db.add(message)
            db.commit()
            db.refresh(message)
            return {'id': message.id, 'ticketId': message.ticket_id, 'authorName': message.author_name, 'body': message.body, 'source': message.source}

    @app.post('/api/discord/tickets/status')
    def set_discord_ticket_status(body: StatusBody, request: Request):
        authenticate(request)
        from app.ticket_routes import Ticket
        with Session(engine) as db:
            ticket = db.get(Ticket, body.ticket_id)
            if not ticket:
                raise HTTPException(status_code=404, detail='Ticket not found.')
            ticket.discord_thread_id = body.discord_thread_id
            ticket.updated_at = datetime.now(timezone.utc)
            db.commit()
            return {'success': True, 'id': ticket.id, 'discordThreadId': ticket.discord_thread_id, 'status': ticket.status}

    @app.post('/api/discord/tickets/close')
    def close_discord_ticket(body: CloseBody, request: Request):
        authenticate(request)
        from app.ticket_routes import Ticket
        with Session(engine) as db:
            ticket = db.get(Ticket, body.ticket_id)
            if not ticket:
                raise HTTPException(status_code=404, detail='Ticket not found.')
            ticket.status = 'closed'
            ticket.updated_at = datetime.now(timezone.utc)
            db.commit()
            if record_audit:
                record_audit(engine, 1, 'discord_ticket_closed', 'ticket', ticket.id, 'Discord ticket closed.')
            return {'success': True, 'id': ticket.id, 'status': ticket.status}
