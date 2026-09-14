from __future__ import annotations

import hashlib
import json
import os
import secrets
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from fastapi import HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import DateTime, Integer, String, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column


class DiscordAuthBase(DeclarativeBase):
    pass


class DiscordAccount(DiscordAuthBase):
    __tablename__ = "discord_accounts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, unique=True, index=True)
    discord_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    discord_username: Mapped[str] = mapped_column(String(128), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class DiscordAuthState(DiscordAuthBase):
    __tablename__ = "discord_auth_states"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    state_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


def register_discord_auth_routes(app, engine, set_session, User):
    DiscordAuthBase.metadata.create_all(engine)

    def config(name: str) -> str:
        return os.getenv(name, "").strip()

    def require_config():
        missing = [name for name in ("DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET") if not config(name)]
        if missing:
            raise HTTPException(status_code=503, detail="Discord login is not configured yet.")

    def hash_value(value: str) -> str:
        return hashlib.sha256(value.encode("utf-8")).hexdigest()

    def discord_request(url: str, method: str = "GET", data: bytes | None = None, headers: dict | None = None):
        request = urllib.request.Request(url, data=data, method=method, headers=headers or {})
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                return json.loads(response.read().decode("utf-8"))
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise HTTPException(status_code=502, detail="Discord authentication is temporarily unavailable.") from exc

    def redirect_uri() -> str:
        configured = config("DISCORD_LOGIN_REDIRECT_URI")
        if configured:
            return configured
        return f"https://nocontext.onrender.com/api/auth/discord/callback"

    def frontend() -> str:
        return config("FRONTEND_ORIGIN") or "https://nappygorilla.github.io"

    @app.get("/api/auth/discord/start")
    def discord_login_start():
        require_config()
        state = secrets.token_urlsafe(32)
        current = datetime.now(timezone.utc)
        with Session(engine) as db:
            db.add(DiscordAuthState(
                state_hash=hash_value(state),
                created_at=current,
                expires_at=current.replace(microsecond=0),
            ))
            row = db.scalar(select(DiscordAuthState).where(DiscordAuthState.state_hash == hash_value(state)))
            if row:
                from datetime import timedelta
                row.expires_at = current + timedelta(minutes=10)
            db.commit()
        query = urllib.parse.urlencode({
            "client_id": config("DISCORD_CLIENT_ID"),
            "redirect_uri": redirect_uri(),
            "response_type": "code",
            "scope": "identify email",
            "state": state,
            "prompt": "consent",
        })
        return RedirectResponse("https://discord.com/oauth2/authorize?" + query, status_code=302)

    @app.get("/api/auth/discord/callback")
    def discord_login_callback(code: str, state: str):
        require_config()
        state_hash = hash_value(state.strip())
        current = datetime.now(timezone.utc)
        with Session(engine) as db:
            saved = db.scalar(select(DiscordAuthState).where(DiscordAuthState.state_hash == state_hash))
            if not saved or (saved.expires_at.replace(tzinfo=timezone.utc) if saved.expires_at.tzinfo is None else saved.expires_at) <= current:
                raise HTTPException(status_code=400, detail="Your Discord login session expired. Please try again.")
            db.delete(saved)
            db.commit()

        token_body = urllib.parse.urlencode({
            "client_id": config("DISCORD_CLIENT_ID"),
            "client_secret": config("DISCORD_CLIENT_SECRET"),
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri(),
        }).encode()
        token_payload = discord_request(
            "https://discord.com/api/oauth2/token",
            method="POST",
            data=token_body,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        access_token = str(token_payload.get("access_token") or "")
        if not access_token:
            raise HTTPException(status_code=400, detail="Discord did not return an access token.")

        identity = discord_request(
            "https://discord.com/api/users/@me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        discord_id = str(identity.get("id") or "").strip()
        discord_username = str(identity.get("global_name") or identity.get("username") or "Discord User").strip()[:128]
        discord_email = str(identity.get("email") or "").strip().lower()
        if not discord_id:
            raise HTTPException(status_code=400, detail="Discord account could not be identified.")

        with Session(engine) as db:
            linked = db.scalar(select(DiscordAccount).where(DiscordAccount.discord_id == discord_id))
            if linked:
                user = db.get(User, linked.user_id)
                linked.discord_username = discord_username
                linked.updated_at = current
                db.commit()
            else:
                user = None
                if discord_email:
                    user = db.scalar(select(User).where(User.email == discord_email))
                if user is None:
                    base = ''.join(ch for ch in discord_username.lower().replace(' ', '_') if ch.isalnum() or ch == '_')[:24] or 'discord_user'
                    username = base
                    suffix = 1
                    while db.scalar(select(User).where(User.username == username)):
                        suffix += 1
                        username = f"{base[:20]}_{suffix}"
                    email = discord_email or f"discord-{discord_id}@discord.local"
                    while db.scalar(select(User).where(User.email == email)):
                        email = f"discord-{discord_id}-{secrets.token_hex(3)}@discord.local"
                    random_password = secrets.token_urlsafe(48)
                    password_hash = hashlib.sha256(random_password.encode()).hexdigest()
                    user = User(username=username, email=email, password_hash=password_hash)
                    db.add(user)
                    db.commit()
                    db.refresh(user)
                db.add(DiscordAccount(user_id=user.id, discord_id=discord_id, discord_username=discord_username, created_at=current, updated_at=current))
                db.commit()

            user_id = user.id

        response = RedirectResponse(frontend() + "/NoContext-website/account-dashboard.html?discord=connected", status_code=302)
        set_session(response, user_id)
        return response
