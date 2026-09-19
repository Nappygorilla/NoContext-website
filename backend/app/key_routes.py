from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request
from sqlalchemy import Boolean, DateTime, Integer, String, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column


WORKINK_DEFAULT_URL = "https://work.ink/2WZq/no-context-key"
WORKINK_DEFAULT_LINK_ID = "2WZq"


class KeyBase(DeclarativeBase):
    pass


class FreeKey(KeyBase):
    __tablename__ = "free_keys"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    key_prefix: Mapped[str] = mapped_column(String(24), index=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True)
    product: Mapped[str] = mapped_column(String(64), default="luna.win External")
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


class WorkInkGrant(KeyBase):
    __tablename__ = "workink_grants"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    grant_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    used: Mapped[bool] = mapped_column(Boolean, default=False, index=True)


def register_key_routes(app, engine, require_csrf, session_from_request, User):
    KeyBase.metadata.create_all(engine)

    def now():
        return datetime.now(timezone.utc)

    def token_hash(value: str) -> str:
        return hashlib.sha256(value.encode()).hexdigest()

    def new_key() -> str:
        return "LUNA-" + "-".join(secrets.token_hex(4).upper() for _ in range(4))

    def workink_url() -> str:
        return os.getenv("WORKINK_LINK_URL", "").strip() or WORKINK_DEFAULT_URL

    def workink_link_id() -> str:
        return os.getenv("WORKINK_LINK_ID", "").strip() or WORKINK_DEFAULT_LINK_ID

    def discord_configured() -> bool:
        return all(os.getenv(name, "").strip() for name in ("DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DISCORD_GUILD_ID", "DISCORD_BOT_TOKEN", "DISCORD_REDIRECT_URI"))

    def discord_request(url: str, method: str = "GET", data: bytes | None = None, headers: dict | None = None):
        request = urllib.request.Request(url, data=data, method=method, headers=headers or {})
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception as exc:
            raise HTTPException(status_code=502, detail="Discord verification is temporarily unavailable.") from exc

    def workink_request(token: str):
        safe_token = urllib.parse.quote(token.strip(), safe="")
        url = f"https://work.ink/_api/v2/token/isValid/{safe_token}?deleteToken=1"
        request = urllib.request.Request(url, method="GET", headers={"Accept": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                payload = response.read().decode("utf-8")
                return json.loads(payload)
        except urllib.error.HTTPError as exc:
            raise HTTPException(status_code=502, detail="Work.ink rejected the verification request. Please complete the Free Key link again.") from exc
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise HTTPException(status_code=502, detail="Work.ink verification is temporarily unavailable. Please try again.") from exc

    def verify_workink_token(token: str):
        token = str(token or "").strip()
        if not token or len(token) > 256:
            raise HTTPException(status_code=400, detail="A valid Work.ink completion token is required.")
        result = workink_request(token)
        if not isinstance(result, dict) or not result.get("valid"):
            raise HTTPException(status_code=403, detail="Your Work.ink completion could not be verified. Please complete the Free Key link again.")
        # Work.ink exposes the link's internal ID as info.linkId. The public short
        # URL slug (2WZq) may not equal that internal numeric ID, so only enforce
        # the comparison when the configured ID is explicitly numeric.
        expected_link = workink_link_id()
        actual_link = str((result.get("info") or {}).get("linkId") or "")
        if expected_link.isdigit() and actual_link != expected_link:
            raise HTTPException(status_code=403, detail="That Work.ink token belongs to a different link.")
        return result

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

    def refresh_booster_status(db: Session, user_id: int) -> bool:
        """Refresh the user's current Discord server boost status when possible."""
        verification = get_verification(db, user_id)
        if verification is None:
            return False
        if not discord_configured():
            return bool(verification.booster)
        guild_id = os.getenv("DISCORD_GUILD_ID", "").strip()
        bot_token = os.getenv("DISCORD_BOT_TOKEN", "").strip()
        if not guild_id or not bot_token or not verification.discord_id:
            return bool(verification.booster)
        try:
            member = discord_request(
                f"https://discord.com/api/guilds/{guild_id}/members/{verification.discord_id}",
                headers={"Authorization": f"Bot {bot_token}"},
            )
            verification.booster = bool(member and member.get("premium_since"))
        except HTTPException:
            # Keep the last known status if Discord is temporarily unavailable.
            pass
        verification.checked_at = now()
        db.commit()
        return bool(verification.booster)

    @app.get("/api/keys/workink/start")
    def workink_start(request: Request):
        auth = session_from_request(request)
        if not auth:
            raise HTTPException(status_code=401, detail="Please sign in before getting a free key.")
        from fastapi.responses import RedirectResponse
        return RedirectResponse(workink_url(), status_code=302)

    @app.post("/api/keys/workink/authorize")
    def workink_authorize(body: dict, request: Request):
        _, user = require_csrf(request)
        result = verify_workink_token(body.get("token"))
        grant = secrets.token_urlsafe(32)
        current = now()
        with Session(engine) as db:
            db.add(WorkInkGrant(grant_hash=token_hash(grant), user_id=user.id, created_at=current, expires_at=current + timedelta(minutes=10), used=False))
            db.commit()
        return {"authorized": True, "grant": grant, "expiresAt": (current + timedelta(minutes=10)).isoformat(), "linkId": (result.get("info") or {}).get("linkId")}

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
        product = str(body.get("product") or "luna.win External").strip()
        grant_token = str(body.get("grant") or "").strip()
        if len(product) > 64:
            raise HTTPException(status_code=400, detail="Invalid product.")
        if not grant_token or len(grant_token) > 256:
            raise HTTPException(status_code=403, detail="Complete the Free Key Work.ink link before generating a key.")
        current = now()
        with Session(engine) as db:
            grant = db.scalar(select(WorkInkGrant).where(WorkInkGrant.grant_hash == token_hash(grant_token), WorkInkGrant.user_id == user.id, WorkInkGrant.used.is_(False), WorkInkGrant.expires_at > current))
            if not grant:
                raise HTTPException(status_code=403, detail="Your Work.ink authorization is missing or expired. Complete the Free Key link again.")
            booster = refresh_booster_status(db, user.id)
            active = db.scalar(select(FreeKey).where(FreeKey.user_id == user.id, FreeKey.expires_at > current).order_by(FreeKey.expires_at.desc()))
            if active:
                raise HTTPException(status_code=409, detail=f"You already have an active key. It expires {active.expires_at.isoformat()}.")
            duration = timedelta(days=7 if booster else 3)
            plain_key = new_key()
            expires = current + duration
            grant.used = True
            db.add(FreeKey(key_hash=token_hash(plain_key), key_prefix=plain_key[:11], user_id=user.id, product=product, booster=booster, created_at=current, expires_at=expires))
            db.commit()
        # Push the new short-duration license to the matching GitHub section immediately.
        try:
            from app.key_repo_sync import sync_license_repo
            sync_license_repo(engine)
        except Exception:
            # The database remains the source of truth if GitHub sync is unavailable.
            pass
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
        return RedirectResponse(frontend + "/NoContext-website/key/?discord=" + ("verified" if booster else "not_boosting"), status_code=302)
