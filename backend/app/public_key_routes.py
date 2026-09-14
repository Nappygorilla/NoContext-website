from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, Integer, String, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

FREE_KEY_DAYS = int(os.getenv("FREE_KEY_DAYS", "3"))
BOOSTER_KEY_DAYS = int(os.getenv("BOOSTER_KEY_DAYS", "7"))
CLAIM_COOKIE = "__Host-nocontext_claim"
OAUTH_STATE_COOKIE = "__Host-nocontext_discord_state"
DISCORD_CLIENT_ID = os.getenv("DISCORD_CLIENT_ID", "").strip()
DISCORD_CLIENT_SECRET = os.getenv("DISCORD_CLIENT_SECRET", "").strip()
DISCORD_GUILD_ID = os.getenv("DISCORD_GUILD_ID", "").strip()
DISCORD_BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN", "").strip()
DISCORD_REDIRECT_URI = os.getenv("DISCORD_REDIRECT_URI", "").strip()
OAUTH_STATE_SECRET = os.getenv("OAUTH_STATE_SECRET", "").strip()
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://nappygorilla.github.io/NoContext-website/key.html").strip()


class PublicKeyBase(DeclarativeBase):
    pass


class PublicClaim(PublicKeyBase):
    __tablename__ = "public_key_claims"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    claim_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    ip_hash: Mapped[str] = mapped_column(String(64), index=True)
    discord_user_id: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    booster_verified: Mapped[bool] = mapped_column(default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PublicLicense(PublicKeyBase):
    __tablename__ = "public_licenses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    key_prefix: Mapped[str] = mapped_column(String(24), index=True)
    claim_hash: Mapped[str] = mapped_column(String(64), index=True)
    ip_hash: Mapped[str] = mapped_column(String(64), index=True)
    discord_user_id: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    product: Mapped[str] = mapped_column(String(64), default="NoContext External")
    status: Mapped[str] = mapped_column(String(16), default="active", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ClaimBody(BaseModel):
    product: str = Field(default="NoContext External", min_length=1, max_length=64)


class ValidateBody(BaseModel):
    key: str = Field(min_length=16, max_length=128)
    product: str = Field(default="NoContext External", min_length=1, max_length=64)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _sha(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _new_key() -> str:
    return "NC-" + "-".join(secrets.token_hex(4).upper() for _ in range(4))


def _client_ip(request: Request) -> str:
    return request.headers.get("CF-Connecting-IP") or (request.client.host if request.client else "unknown")


def _claim_token(request: Request, response: Response) -> tuple[str, str]:
    raw = request.cookies.get(CLAIM_COOKIE)
    if not raw or len(raw) > 256:
        raw = secrets.token_urlsafe(32)
        response.set_cookie(CLAIM_COOKIE, raw, max_age=60 * 60 * 24 * 365, secure=True, httponly=True, samesite="lax", path="/")
    return raw, _sha(raw)


def _oauth_state(claim_hash: str, nonce: str) -> str:
    payload = f"{claim_hash}:{nonce}".encode()
    secret = OAUTH_STATE_SECRET.encode()
    sig = hmac.new(secret, payload, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(payload + b":" + sig).decode().rstrip("=")


def _decode_oauth_state(value: str) -> tuple[str, str] | None:
    if not OAUTH_STATE_SECRET:
        return None
    try:
        padded = value + "=" * (-len(value) % 4)
        raw = base64.urlsafe_b64decode(padded.encode())
        claim_hash_b, nonce_b, sig = raw.split(b":", 2)
        claim_hash = claim_hash_b.decode()
        nonce = nonce_b.decode()
        expected = hmac.new(OAUTH_STATE_SECRET.encode(), f"{claim_hash}:{nonce}".encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(sig, expected):
            return None
        return claim_hash, nonce
    except Exception:
        return None


def _discord_request(url: str, data: dict[str, str] | None = None, headers: dict[str, str] | None = None) -> dict:
    body = None
    request_headers = {"User-Agent": "NoContext-License/1.0"}
    if data is not None:
        body = urllib.parse.urlencode(data).encode()
        request_headers["Content-Type"] = "application/x-www-form-urlencoded"
    if headers:
        request_headers.update(headers)
    try:
        request = urllib.request.Request(url, data=body, headers=request_headers)
        with urllib.request.urlopen(request, timeout=10) as result:
            return json.loads(result.read().decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Discord verification is temporarily unavailable.") from exc


def register_public_key_routes(app, engine, rate_limit, enforce_origin):
    PublicKeyBase.metadata.create_all(engine)

    @app.get("/api/keys/session")
    def key_session(request: Request, response: Response):
        raw, claim_hash = _claim_token(request, response)
        ip_hash = _sha(_client_ip(request))
        with Session(engine) as db:
            claim = db.scalar(select(PublicClaim).where(PublicClaim.claim_hash == claim_hash))
            if claim is None:
                claim = PublicClaim(claim_hash=claim_hash, ip_hash=ip_hash)
                db.add(claim)
                db.commit()
            active = db.scalar(select(PublicLicense).where(PublicLicense.claim_hash == claim_hash, PublicLicense.status == "active", PublicLicense.expires_at > _now()).order_by(PublicLicense.expires_at.desc()))
            return {
                "boosterVerified": bool(claim.booster_verified),
                "active": active is not None,
                "expiresAt": _utc(active.expires_at).isoformat() if active else None,
                "claimToken": raw,
            }

    @app.post("/api/keys/claim", status_code=201)
    def claim_key(body: ClaimBody, request: Request, response: Response):
        enforce_origin(request)
        rate_limit(request, "public-key-claim", 6)
        _, claim_hash = _claim_token(request, response)
        ip_hash = _sha(_client_ip(request))
        product = body.product.strip()
        with Session(engine) as db:
            claim = db.scalar(select(PublicClaim).where(PublicClaim.claim_hash == claim_hash))
            if claim is None:
                claim = PublicClaim(claim_hash=claim_hash, ip_hash=ip_hash)
                db.add(claim)
                db.flush()
            active = db.scalar(select(PublicLicense).where(PublicLicense.claim_hash == claim_hash, PublicLicense.status == "active", PublicLicense.expires_at > _now()).order_by(PublicLicense.expires_at.desc()))
            if active:
                raise HTTPException(status_code=409, detail=f"You already have an active key. It expires {active.expires_at.astimezone(timezone.utc).isoformat()}.")
            plain_key = _new_key()
            days = BOOSTER_KEY_DAYS if claim.booster_verified else FREE_KEY_DAYS
            expires = _now() + timedelta(days=days)
            db.add(PublicLicense(key_hash=_sha(plain_key), key_prefix=plain_key[:11], claim_hash=claim_hash, ip_hash=ip_hash, discord_user_id=claim.discord_user_id, product=product, status="active", expires_at=expires))
            db.commit()
            return {"success": True, "key": plain_key, "product": product, "days": days, "booster": bool(claim.booster_verified), "expiresAt": expires.isoformat()}

    @app.post("/api/keys/validate")
    def validate_public_key(body: ValidateBody, request: Request):
        enforce_origin(request)
        with Session(engine) as db:
            license = db.scalar(select(PublicLicense).where(PublicLicense.key_hash == _sha(body.key.strip())))
            if not license or license.product != body.product.strip():
                raise HTTPException(status_code=404, detail="License not found.")
            current = _now()
            expires = _utc(license.expires_at)
            if license.status != "active" or expires <= current:
                if license.status == "active":
                    license.status = "expired"
                    db.commit()
                raise HTTPException(status_code=403, detail="License is expired or inactive.")
            license.last_seen_at = current
            db.commit()
            return {"valid": True, "product": license.product, "expiresAt": expires.isoformat(), "status": "active"}

    @app.get("/api/keys/discord/start")
    def discord_start(request: Request, response: Response):
        if not all([DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_GUILD_ID, DISCORD_BOT_TOKEN, DISCORD_REDIRECT_URI, OAUTH_STATE_SECRET]):
            raise HTTPException(status_code=503, detail="Discord booster verification is not configured.")
        _, claim_hash = _claim_token(request, response)
        nonce = secrets.token_urlsafe(16)
        state = _oauth_state(claim_hash, nonce)
        authorize = "https://discord.com/oauth2/authorize?" + urllib.parse.urlencode({
            "client_id": DISCORD_CLIENT_ID,
            "redirect_uri": DISCORD_REDIRECT_URI,
            "response_type": "code",
            "scope": "identify",
            "state": state,
            "prompt": "consent",
        })
        redirect = RedirectResponse(authorize, status_code=302)
        redirect.set_cookie(OAUTH_STATE_COOKIE, state, max_age=600, secure=True, httponly=True, samesite="lax", path="/")
        return redirect

    @app.get("/api/keys/discord/callback")
    def discord_callback(request: Request, code: str, state: str):
        decoded = _decode_oauth_state(state)
        if not decoded or request.cookies.get(OAUTH_STATE_COOKIE) != state:
            raise HTTPException(status_code=400, detail="Invalid Discord verification state.")
        claim_hash, _ = decoded
        if not all([DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_GUILD_ID, DISCORD_BOT_TOKEN, DISCORD_REDIRECT_URI]):
            raise HTTPException(status_code=503, detail="Discord booster verification is not configured.")
        token = _discord_request("https://discord.com/api/v10/oauth2/token", {
            "client_id": DISCORD_CLIENT_ID,
            "client_secret": DISCORD_CLIENT_SECRET,
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": DISCORD_REDIRECT_URI,
        })
        user = _discord_request("https://discord.com/api/v10/users/@me", headers={"Authorization": f"Bearer {token.get('access_token', '')}"})
        user_id = str(user.get("id", ""))
        if not user_id:
            raise HTTPException(status_code=400, detail="Discord account verification failed.")
        member = _discord_request(f"https://discord.com/api/v10/guilds/{DISCORD_GUILD_ID}/members/{user_id}", headers={"Authorization": f"Bot {DISCORD_BOT_TOKEN}"})
        boosted = bool(member.get("premium_since"))
        with Session(engine) as db:
            claim = db.scalar(select(PublicClaim).where(PublicClaim.claim_hash == claim_hash))
            if claim is None:
                raise HTTPException(status_code=400, detail="Key claim session expired. Start again.")
            claim.discord_user_id = user_id
            claim.booster_verified = boosted
            claim.verified_at = _now()
            db.commit()
        target = FRONTEND_URL + ("&" if "?" in FRONTEND_URL else "?") + ("booster=1" if boosted else "booster=0")
        return RedirectResponse(target, status_code=302)
