from __future__ import annotations

import hashlib
import os
import secrets
import smtplib
import ssl
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

from argon2 import PasswordHasher
from fastapi import HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, DateTime, Integer, String, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column


class PasswordResetBase(DeclarativeBase):
    pass


class PasswordReset(PasswordResetBase):
    __tablename__ = "password_resets"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    used: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class ForgotPasswordBody(BaseModel):
    email: str = Field(min_length=3, max_length=320)


class ResetPasswordBody(BaseModel):
    token: str = Field(min_length=20, max_length=256)
    password: str = Field(min_length=12, max_length=128)


def register_password_reset_routes(app, engine, User, rate_limit, record_audit=None):
    PasswordResetBase.metadata.create_all(engine)
    password_hasher = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)

    def sha(value: str) -> str:
        return hashlib.sha256(value.encode("utf-8")).hexdigest()

    def cfg(name: str, default: str = "") -> str:
        return os.getenv(name, default).strip()

    def send_reset_email(to_email: str, username: str, reset_url: str) -> bool:
        host = cfg("SMTP_HOST")
        username_cfg = cfg("SMTP_USERNAME")
        password = cfg("SMTP_PASSWORD")
        sender = cfg("SMTP_FROM") or username_cfg
        if not host or not sender:
            return False
        port = int(cfg("SMTP_PORT", "587"))
        message = EmailMessage()
        message["Subject"] = "Reset your NoContext password"
        message["From"] = sender
        message["To"] = to_email
        message.set_content(
            f"Hello {username},\n\n"
            f"Use the following link to reset your NoContext password:\n{reset_url}\n\n"
            "This link expires in 30 minutes and can only be used once.\n\n"
            "If you did not request this, you can ignore this email."
        )
        context = ssl.create_default_context()
        with smtplib.SMTP(host, port, timeout=10) as smtp:
            smtp.starttls(context=context)
            if username_cfg:
                smtp.login(username_cfg, password)
            smtp.send_message(message)
        return True

    @app.post("/api/auth/forgot-password")
    def forgot_password(body: ForgotPasswordBody, request: Request):
        rate_limit(request, "password-reset", 5)
        email = body.email.strip().lower()
        generic = {"success": True, "message": "If that email belongs to an account, a password reset link has been sent."}
        with Session(engine) as db:
            user = db.scalar(select(User).where(User.email == email))
            if not user:
                return generic
            now = datetime.now(timezone.utc)
            token = secrets.token_urlsafe(48)
            db.query(PasswordReset).filter(PasswordReset.user_id == user.id, PasswordReset.used.is_(False)).update({"used": True})
            db.add(PasswordReset(token_hash=sha(token), user_id=user.id, expires_at=now + timedelta(minutes=30), used=False, created_at=now))
            db.commit()
            username = user.username
            user_email = user.email
        frontend = cfg("FRONTEND_ORIGIN", "https://nappygorilla.github.io").rstrip("/")
        reset_url = f"{frontend}/NoContext-website/reset-password/?token={token}"
        try:
            sent = send_reset_email(user_email, username, reset_url)
        except Exception:
            sent = False
        if sent and record_audit:
            record_audit(engine, user.id, "password_reset_requested", "user", user.id, "Password reset email requested.")
        return generic

    @app.post("/api/auth/reset-password")
    def reset_password(body: ResetPasswordBody, request: Request):
        token = body.token.strip()
        now = datetime.now(timezone.utc)
        with Session(engine) as db:
            reset = db.scalar(select(PasswordReset).where(PasswordReset.token_hash == sha(token), PasswordReset.used.is_(False)))
            if not reset:
                raise HTTPException(status_code=400, detail="That password reset link is invalid or expired.")
            expires = reset.expires_at.replace(tzinfo=timezone.utc) if reset.expires_at.tzinfo is None else reset.expires_at
            if expires <= now:
                reset.used = True
                db.commit()
                raise HTTPException(status_code=400, detail="That password reset link is invalid or expired.")
            user = db.get(User, reset.user_id)
            if not user:
                raise HTTPException(status_code=400, detail="That password reset link is invalid.")
            user.password_hash = password_hasher.hash(body.password)
            reset.used = True
            db.commit()
            user_id = user.id
            db.execute("DELETE FROM sessions WHERE user_id=:user_id", {"user_id": user_id})
            db.commit()
        if record_audit:
            record_audit(engine, user_id, "password_reset_completed", "user", user_id, "Password was reset; active sessions were revoked.")
        return {"success": True, "message": "Password updated. Please sign in with your new password."}
