from __future__ import annotations

import hashlib
import hmac
import os
from datetime import datetime, timezone

from fastapi import HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, Integer, String, delete, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

OWNER_ID = 1
TOMBSTONE_SECRET = os.getenv("ACCOUNT_TOMBSTONE_SECRET", "").strip()
if not TOMBSTONE_SECRET:
    TOMBSTONE_SECRET = os.getenv("PUBLIC_API_KEY_PEPPER", "").strip()
if os.getenv("ENVIRONMENT", "development").strip().lower() == "production" and not TOMBSTONE_SECRET:
    raise RuntimeError("ACCOUNT_TOMBSTONE_SECRET is required in production")


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


def register_account_admin_routes(app, engine, session_from_request, require_csrf, User, record_audit=None):
    AccountAdminBase.metadata.create_all(engine)

    def owner_write(request: Request):
        _, user = require_csrf(request)
        if user.id != OWNER_ID:
            raise HTTPException(status_code=403, detail="Owner access required.")
        return user

    @app.post("/api/admin/users/{user_id}/delete")
    def delete_account(user_id: int, body: DeleteAccountBody, request: Request):
        actor = owner_write(request)
        if user_id == actor.id:
            raise HTTPException(status_code=400, detail="The owner account cannot be deleted from this endpoint.")

        with Session(engine) as db:
            user = db.get(User, user_id)
            if not user:
                raise HTTPException(status_code=404, detail="Account not found.")

            fingerprint = _fingerprint_email(user.email)
            existing = db.scalar(select(DeletedAccountTombstone).where(DeletedAccountTombstone.account_id == user.id))
            if existing:
                raise HTTPException(status_code=409, detail="Account has already been deleted.")

            tombstone = DeletedAccountTombstone(
                account_id=user.id,
                email_fingerprint=fingerprint,
                deleted_at=datetime.now(timezone.utc),
                deleted_by=actor.id,
                reason=body.reason.strip(),
            )
            db.add(tombstone)

            # Invalidate every login/API session and remove account-owned credentials/data.
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

    @app.get("/api/admin/users/{user_id}/deletion-status")
    def deletion_status(user_id: int, request: Request):
        owner_write(request)
        with Session(engine) as db:
            tombstone = db.scalar(select(DeletedAccountTombstone).where(DeletedAccountTombstone.account_id == user_id))
            return {"deleted": bool(tombstone), "accountIdRetired": bool(tombstone), "deletedAt": tombstone.deleted_at.isoformat() if tombstone else None}
