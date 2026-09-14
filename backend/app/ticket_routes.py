from __future__ import annotations

import os
import secrets
import urllib.request
import json
from datetime import datetime, timezone

from fastapi import HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column


OWNER_ID = 1
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_TICKET_WEBHOOK_URL", "").strip()
DISCORD_BOT_SECRET = os.getenv("DISCORD_BOT_SECRET", "").strip()


class TicketBase(DeclarativeBase):
    pass


class Ticket(TicketBase):
    __tablename__ = "tickets"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True)
    subject: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)
    discord_thread_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class TicketMessage(TicketBase):
    __tablename__ = "ticket_messages"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("tickets.id", ondelete="CASCADE"), index=True)
    author_user_id: Mapped[int] = mapped_column(Integer, index=True)
    author_name: Mapped[str] = mapped_column(String(64))
    body: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(16), default="web")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class TicketCreate(BaseModel):
    subject: str = Field(min_length=3, max_length=120)
    body: str = Field(min_length=1, max_length=4000)


class TicketReply(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class BotReply(BaseModel):
    ticket_id: int
    body: str = Field(min_length=1, max_length=4000)
    author_name: str = Field(default="Discord Staff", min_length=1, max_length=64)


class BotStatus(BaseModel):
    ticket_id: int
    discord_thread_id: str | None = None


def _utc(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def _send_discord(ticket: Ticket, user_name: str, message: str, event: str) -> None:
    if not DISCORD_WEBHOOK_URL:
        return
    payload = {
        "username": "NoContext Tickets",
        "embeds": [{
            "title": f"Ticket #{ticket.id} · {event}",
            "description": message[:4000],
            "fields": [
                {"name": "Subject", "value": ticket.subject[:1024], "inline": False},
                {"name": "User", "value": f"{user_name} · ID {ticket.user_id}", "inline": True},
                {"name": "Status", "value": ticket.status, "inline": True},
            ],
            "footer": {"text": "NoContext support"},
        }],
    }
    try:
        request = urllib.request.Request(
            DISCORD_WEBHOOK_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "NoContext-Tickets/1.0"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=5):
            pass
    except Exception:
        # Ticket creation/replies must not fail just because Discord is unavailable.
        pass


def register_ticket_routes(app, engine, require_csrf, session_from_request, enforce_origin, rate_limit):
    TicketBase.metadata.create_all(engine)

    def auth(request: Request):
        result = session_from_request(request)
        if not result:
            raise HTTPException(status_code=401, detail="Not signed in.")
        return result

    def admin(request: Request):
        _, user = auth(request)
        if user.id != OWNER_ID:
            raise HTTPException(status_code=403, detail="Owner access required.")
        return user

    def ticket_json(ticket: Ticket):
        return {
            "id": ticket.id,
            "userId": ticket.user_id,
            "subject": ticket.subject,
            "status": ticket.status,
            "discordThreadId": ticket.discord_thread_id,
            "createdAt": _utc(ticket.created_at),
            "updatedAt": _utc(ticket.updated_at),
        }

    def message_json(message: TicketMessage):
        return {
            "id": message.id,
            "ticketId": message.ticket_id,
            "authorUserId": message.author_user_id,
            "authorName": message.author_name,
            "body": message.body,
            "source": message.source,
            "createdAt": _utc(message.created_at),
        }

    @app.post("/api/tickets", status_code=201)
    def create_ticket(body: TicketCreate, request: Request):
        _, user = require_csrf(request)
        rate_limit(request, "ticket-create", 5)
        subject = body.subject.strip()
        message_body = body.body.strip()
        with Session(engine) as db:
            ticket = Ticket(user_id=user.id, subject=subject, status="open")
            db.add(ticket)
            db.flush()
            db.add(TicketMessage(ticket_id=ticket.id, author_user_id=user.id, author_name=user.username, body=message_body, source="web"))
            db.commit()
            db.refresh(ticket)
            result = ticket_json(ticket)
        _send_discord(ticket, user.username, message_body, "New ticket")
        return result

    @app.get("/api/tickets")
    def list_my_tickets(request: Request):
        _, user = auth(request)
        with Session(engine) as db:
            tickets = db.scalars(select(Ticket).where(Ticket.user_id == user.id).order_by(Ticket.updated_at.desc())).all()
            return {"tickets": [ticket_json(ticket) for ticket in tickets]}

    @app.get("/api/tickets/{ticket_id}")
    def get_my_ticket(ticket_id: int, request: Request):
        _, user = auth(request)
        with Session(engine) as db:
            ticket = db.get(Ticket, ticket_id)
            if not ticket or ticket.user_id != user.id:
                raise HTTPException(status_code=404, detail="Ticket not found.")
            messages = db.scalars(select(TicketMessage).where(TicketMessage.ticket_id == ticket.id).order_by(TicketMessage.created_at.asc())).all()
            return {"ticket": ticket_json(ticket), "messages": [message_json(item) for item in messages]}

    @app.post("/api/tickets/{ticket_id}/messages")
    def reply_my_ticket(ticket_id: int, body: TicketReply, request: Request):
        _, user = require_csrf(request)
        with Session(engine) as db:
            ticket = db.get(Ticket, ticket_id)
            if not ticket or ticket.user_id != user.id:
                raise HTTPException(status_code=404, detail="Ticket not found.")
            if ticket.status == "closed":
                raise HTTPException(status_code=409, detail="This ticket is closed.")
            message = TicketMessage(ticket_id=ticket.id, author_user_id=user.id, author_name=user.username, body=body.body.strip(), source="web")
            ticket.updated_at = datetime.now(timezone.utc)
            db.add(message)
            db.commit()
            db.refresh(message)
            result = message_json(message)
        _send_discord(ticket, user.username, body.body.strip(), "Customer reply")
        return result

    @app.get("/api/admin")
    def admin_overview(request: Request):
        admin(request)
        with Session(engine) as db:
            users = db.execute(select(__import__("backend.app.main", fromlist=["User"]).User)).scalars().all()
            tickets = db.scalars(select(Ticket).order_by(Ticket.updated_at.desc())).all()
            return {
                "ownerId": OWNER_ID,
                "users": [{"id": u.id, "username": u.username, "email": u.email, "createdAt": _utc(u.created_at)} for u in users],
                "tickets": [ticket_json(ticket) for ticket in tickets],
                "discordConfigured": bool(DISCORD_WEBHOOK_URL),
            }

    @app.get("/api/admin/tickets/{ticket_id}")
    def admin_ticket(ticket_id: int, request: Request):
        admin(request)
        with Session(engine) as db:
            ticket = db.get(Ticket, ticket_id)
            if not ticket:
                raise HTTPException(status_code=404, detail="Ticket not found.")
            messages = db.scalars(select(TicketMessage).where(TicketMessage.ticket_id == ticket.id).order_by(TicketMessage.created_at.asc())).all()
            return {"ticket": ticket_json(ticket), "messages": [message_json(item) for item in messages]}

    @app.post("/api/admin/tickets/{ticket_id}/messages")
    def admin_reply(ticket_id: int, body: TicketReply, request: Request):
        user = admin(request)
        with Session(engine) as db:
            ticket = db.get(Ticket, ticket_id)
            if not ticket:
                raise HTTPException(status_code=404, detail="Ticket not found.")
            if ticket.status == "closed":
                raise HTTPException(status_code=409, detail="This ticket is closed.")
            message = TicketMessage(ticket_id=ticket.id, author_user_id=user.id, author_name=user.username, body=body.body.strip(), source="admin")
            ticket.updated_at = datetime.now(timezone.utc)
            db.add(message)
            db.commit()
            db.refresh(message)
            result = message_json(message)
        _send_discord(ticket, user.username, body.body.strip(), "Staff reply")
        return result

    @app.post("/api/admin/tickets/{ticket_id}/close")
    def admin_close(ticket_id: int, request: Request):
        admin(request)
        with Session(engine) as db:
            ticket = db.get(Ticket, ticket_id)
            if not ticket:
                raise HTTPException(status_code=404, detail="Ticket not found.")
            ticket.status = "closed"
            ticket.updated_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(ticket)
            result = ticket_json(ticket)
        _send_discord(ticket, "Owner", "Ticket closed from the NoContext admin dashboard.", "Ticket closed")
        return result

    @app.post("/api/discord/tickets/reply")
    def discord_reply(body: BotReply, request: Request):
        enforce_origin(request)
        supplied = request.headers.get("X-Discord-Bot-Secret", "")
        if not DISCORD_BOT_SECRET or not secrets.compare_digest(supplied, DISCORD_BOT_SECRET):
            raise HTTPException(status_code=401, detail="Discord bot authentication failed.")
        with Session(engine) as db:
            ticket = db.get(Ticket, body.ticket_id)
            if not ticket:
                raise HTTPException(status_code=404, detail="Ticket not found.")
            if ticket.status == "closed":
                raise HTTPException(status_code=409, detail="This ticket is closed.")
            message = TicketMessage(ticket_id=ticket.id, author_user_id=OWNER_ID, author_name=body.author_name.strip(), body=body.body.strip(), source="discord")
            ticket.updated_at = datetime.now(timezone.utc)
            db.add(message)
            db.commit()
            db.refresh(message)
            return message_json(message)

    @app.post("/api/discord/tickets/status")
    def discord_status(body: BotStatus, request: Request):
        enforce_origin(request)
        supplied = request.headers.get("X-Discord-Bot-Secret", "")
        if not DISCORD_BOT_SECRET or not secrets.compare_digest(supplied, DISCORD_BOT_SECRET):
            raise HTTPException(status_code=401, detail="Discord bot authentication failed.")
        with Session(engine) as db:
            ticket = db.get(Ticket, body.ticket_id)
            if not ticket:
                raise HTTPException(status_code=404, detail="Ticket not found.")
            ticket.discord_thread_id = body.discord_thread_id
            ticket.updated_at = datetime.now(timezone.utc)
            db.commit()
            return ticket_json(ticket)
