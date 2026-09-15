from __future__ import annotations

import hashlib
import hmac
import os
from datetime import datetime, timezone

from fastapi import HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, Integer, String, delete, event, select, text
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

OWNER_ID = 1
TOMBSTONE_SECRET = os.getenv("ACCOUNT_TOMBSTONE_SECRET", "").strip()
if len(TOMBSTONE_SECRET) < 32:
    TOMBSTONE_SECRET = os.getenv("PUBLIC_API_KEY_PEPPER", "").strip()
if len(TOMBSTONE_SECRET) < 32:
    database_secret = os.getenv("DATABASE_URL", "").strip()
    if database_secret:
        TOMBSTONE_SECRET = hashlib.sha256(("NoContext account tombstones:" + database_secret).encode("utf-8")).hexdigest()


class AccountAdminBase(DeclarativeBase):
    pass


class DeletedAccountTombstone(AccountAdminBase):
    __tablename__ = "deleted_account_tombstones"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(Integer, unique=True, index=True)
    email_fingerprint: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    deleted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    deleted_by: Mapped[int] = mapped_column(Integer, index=True)
    reason: Mapped[str] = mapped_column(String(500), default="")


class DeleteAccountBody(BaseModel):
    reason: str = Field(default="Account deleted by administrator.", min_length=1, max_length=500)


def _fingerprint_email(email: str) -> str:
    normalized = email.strip().lower().encode("utf-8")
    return hmac.new(TOMBSTONE_SECRET.encode("utf-8"), normalized, hashlib.sha256).hexdigest()


def is_email_deleted(engine, email: str) -> bool:
    fingerprint = _fingerprint_email(email)
    with Session(engine) as db:
        return db.scalar(select(DeletedAccountTombstone.id).where(DeletedAccountTombstone.email_fingerprint == fingerprint)) is not None


def delete_account_impl(engine, User, user_id: int, actor, body: DeleteAccountBody, record_audit=None):
    with Session(engine) as db:
        user = db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Account not found.")

        fingerprint = _fingerprint_email(user.email)
        existing = db.scalar(select(DeletedAccountTombstone).where(DeletedAccountTombstone.account_id == user.id))
        if existing:
            raise HTTPException(status_code=409, detail="Account has already been deleted.")

        db.add(DeletedAccountTombstone(
            account_id=user.id,
            email_fingerprint=fingerprint,
            deleted_at=datetime.now(timezone.utc),
            deleted_by=actor.id,
            reason=body.reason.strip(),
        ))

        from app.main import SessionRecord, License
        db.execute(delete(SessionRecord).where(SessionRecord.user_id == user.id))
        db.execute(delete(License).where(License.user_id == user.id))

        try:
            from app.developer_api_routes import DeveloperKey
            db.execute(delete(DeveloperKey).where(DeveloperKey.owner_user_id == user.id))
        except ImportError:
            pass

        try:
            from app.ticket_routes import Ticket, TicketMessage
            ticket_ids = list(db.scalars(select(Ticket.id).where(Ticket.user_id == user.id)).all())
            if ticket_ids:
                db.execute(delete(TicketMessage).where(TicketMessage.ticket_id.in_(ticket_ids)))
            db.execute(delete(Ticket).where(Ticket.user_id == user.id))
            db.execute(delete(TicketMessage).where(TicketMessage.author_user_id == user.id))
        except ImportError:
            pass

        try:
            from app.password_reset_routes import PasswordReset
            db.execute(delete(PasswordReset).where(PasswordReset.user_id == user.id))
        except ImportError:
            pass

        db.delete(user)
        db.commit()

    if record_audit:
        record_audit(
            engine,
            actor.id,
            "account_deleted",
            "user",
            user_id,
            f"Permanently deleted account ID {user_id}; email and ID were tombstoned. Reason: {body.reason.strip()[:500]}",
        )

    return {"success": True, "deletedAccountId": user_id, "emailReuseBlocked": True, "accountIdRetired": True}


def register_account_admin_routes(app, engine, session_from_request, require_csrf, User, record_audit=None):
    AccountAdminBase.metadata.create_all(engine)
    if getattr(User, "_nocontext_tombstone_listener", False):
        return

    @event.listens_for(User, "before_insert")
    def _block_deleted_email(mapper, connection, target):
        fingerprint = _fingerprint_email(target.email)
        found = connection.execute(
            text("SELECT 1 FROM deleted_account_tombstones WHERE email_fingerprint = :fingerprint LIMIT 1"),
            {"fingerprint": fingerprint},
        ).first()
        if found:
            raise ValueError("That email address cannot be reused.")

    User._nocontext_tombstone_listener = True
