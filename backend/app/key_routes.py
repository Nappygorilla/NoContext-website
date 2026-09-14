from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request
from sqlalchemy import Boolean, DateTime, Integer, String, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column


class KeyBase(DeclarativeBase):
    pass


class FreeKey(KeyBase):
    __tablename__ = "free_keys"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    key_prefix: Mapped[str] = mapped_column(String(24), index=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True)
    product: Mapped[str] = mapped_column(String(64), default="NoContext External")
    booster: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class DiscordVerification(KeyBase):
    __tablename__ = "discord_verifications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, unique=True, index=True)
    discord_id: Mapped[str] = mapped_column(String(32), index=True)
    booster: Mapped[bool] = mapped_column(Boolean, default=False)
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


def register_key_routes(app, engine, require_csrf, session_from_request, User):
    KeyBase.metadata.create_all(engine)

    def now():
        return datetime.now(timezone.utc)

    def token_hash(value: str) -> str:
        return hashlib.sha256(value.encode()).hexdigest()

    def new_key() -> str:
        return "NC-" + "-".join(secrets.token_hex(4).upper() for _ in range(4))

    def discord_configured() -> bool:
        return all(os.getenv(name, "").strip() for name in ("DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DISCORD_GUILD_ID", "DISCORD_BOT_TOKEN", "DISCORD_REDIRECT_URI"))

    def discord_request(url: str, method: str = "GET", data: bytes | None = None, headers: dict | None = None):
        request = urllib.request.Request(url, data=data, method=method, headers=headers or {})
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception as exc:
            raise HTTPException(status_code=502, detail="Discord verification is temporarily unavailable.") from exc

    def state_for(user_id: int) -> str:
        secret = os.getenv("DISCORD_CLIENT_SECRET", "")
        payload = f"{user_id}:{int(time.time())}"
        signature = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
        return f"{payload}:{signature}"

    def verify_state(state: str):
        parts = state.split(":")
        if len(parts) != 3:
            raise HTTPException(status_code=400, detail="Invalid Discord verification state.")
        user_id, issued, signature = parts
        payload = f"{user_id}:{issued}"
        secret = os.getenv("DISCORD_CLIENT_SECRET", "")
        expected = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected) or abs(int(time.time()) - int(issued)) > 600:
            raise HTTPException(status_code=400, detail="Discord verification expired. Please try again.")
        return int(user_id)

    def get_verification(db: Session, user_id: int):
        return db.scalar(select(DiscordVerification).where(DiscordVerification.user_id == user_id))

    @app.get("/api/keys/session")
    def key_session(request: Request):
        auth = session_from_request(request)
        if not auth:
            raise HTTPException(status_code=401, detail="Please sign in before generating a free key.")
        _, user = auth
        current = now()
        with Session(engine) as db:
            active = db.scalar(select(FreeKey).where(FreeKey.user_id == user.id, FreeKey.expires_at > current).order_by(FreeKey.expires_at.desc()))
            verification = get_verification(db, user.id)
            booster = bool(verification and verification.booster)
            if active:
                return {"active": True, "expiresAt": active.expires_at.isoformat(), "booster": active.booster, "user": {"username": user.username}}
            return {"active": False, "booster": booster, "user": {"username": user.username}}

    @app.post("/api/keys/claim")
    def claim_key(body: dict, request: Request):
        _, user = require_csrf(request)
        product = str(body.get("product") or "NoContext External").strip()
        if len(product) > 64:
            raise HTTPException(status_code=400, detail="Invalid product.")
        current = now()
        with Session(engine) as db:
            verification = get_verification(db, user.id)
            booster = bool(verification and verification.booster)
            active = db.scalar(select(FreeKey).where(FreeKey.user_id == user.id, FreeKey.expires_at > current).order_by(FreeKey.expires_at.desc()))
            if active:
                raise HTTPException(status_code=409, detail=f"You already have an active key. It expires {active.expires_at.isoformat()}.")
            # Expired keys are retained for history but never count against the next claim.
            duration = timedelta(days=7 if booster else 3)
            plain_key = new_key()
            expires = current + duration
            db.add(FreeKey(key_hash=token_hash(plain_key), key_prefix=plain_key[:11], user_id=user.id, product=product, booster=booster, created_at=current, expires_at=expires))
            db.commit()
        return {"key": plain_key, "product": product, "booster": booster, "expiresAt": expires.isoformat(), "durationDays": 7 if booster else 3}

    @app.get("/api/keys/discord/start")
    def discord_start(request: Request):
        if not discord_configured():
            raise HTTPException(status_code=503, detail="Discord boost verification is not configured yet.")
        auth = session_from_request(request)
        if not auth:
            raise HTTPException(status_code=401, detail="Please sign in before verifying your Discord boost.")
        _, user = auth
        query = urllib.parse.urlencode({
            "client_id": os.getenv("DISCORD_CLIENT_ID"),
            "redirect_uri": os.getenv("DISCORD_REDIRECT_URI"),
            "response_type": "code",
            "scope": "identify",
            "state": state_for(user.id),
        })
        from fastapi.responses import RedirectResponse
        return RedirectResponse("https://discord.com/oauth2/authorize?" + query, status_code=302)

    @app.get("/api/keys/discord/callback")
    def discord_callback(code: str, state: str):
        if not discord_configured():
            raise HTTPException(status_code=503, detail="Discord boost verification is not configured yet.")
        user_id = verify_state(state)
        token_payload = urllib.parse.urlencode({
            "client_id": os.getenv("DISCORD_CLIENT_ID"),
            "client_secret": os.getenv("DISCORD_CLIENT_SECRET"),
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": os.getenv("DISCORD_REDIRECT_URI"),
        }).encode()
        token = discord_request("https://discord.com/api/oauth2/token", "POST", token_payload, {"Content-Type": "application/x-www-form-urlencoded"})
        access_token = token.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="Discord authorization failed.")
        identity = discord_request("https://discord.com/api/users/@me", headers={"Authorization": f"Bearer {access_token}"})
        discord_id = str(identity.get("id") or "")
        if not discord_id:
            raise HTTPException(status_code=400, detail="Discord account could not be identified.")
        guild_id = os.getenv("DISCORD_GUILD_ID")
        bot_token = os.getenv("DISCORD_BOT_TOKEN")
        member = None
        try:
            member = discord_request(f"https://discord.com/api/guilds/{guild_id}/members/{discord_id}", headers={"Authorization": f"Bot {bot_token}"})
        except HTTPException:
            member = None
        booster = bool(member and member.get("premium_since"))
        with Session(engine) as db:
            verification = get_verification(db, user_id)
            if verification is None:
                db.add(DiscordVerification(user_id=user_id, discord_id=discord_id, booster=booster, checked_at=now()))
            else:
                verification.discord_id = discord_id
                verification.booster = booster
                verification.checked_at = now()
            db.commit()
        frontend = os.getenv("FRONTEND_ORIGIN", "https://nappygorilla.github.io").rstrip("/")
        from fastapi.responses import RedirectResponse
        return RedirectResponse(frontend + "/key.html?discord=" + ("verified" if booster else "not_boosting"), status_code=302)
