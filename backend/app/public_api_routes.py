from __future__ import annotations

import hashlib
import os
import secrets
from datetime import datetime, timezone

from fastapi import HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import Integer, String, DateTime, select
from sqlalchemy.orm import Session, DeclarativeBase, Mapped, mapped_column

PUBLIC_API_KEY_PREFIX = "nc_dev_"
PUBLIC_API_KEY_PEPPER = os.getenv("PUBLIC_API_KEY_PEPPER", "").strip()


class DeveloperApiBase(DeclarativeBase):
    pass


class DeveloperApiKey(DeveloperApiBase):
    __tablename__ = "developer_api_keys"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    key_prefix: Mapped[str] = mapped_column(String(32), index=True)
    name: Mapped[str] = mapped_column(String(80))
    owner_user_id: Mapped[int] = mapped_column(Integer, index=True)
    active: Mapped[bool] = mapped_column(default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CreateDeveloperKeyBody(BaseModel):
    name: str = Field(default="My application", min_length=2, max_length=80)


def _sha(value: str) -> str:
    return hashlib.sha256((PUBLIC_API_KEY_PEPPER + value).encode("utf-8")).hexdigest()


def _new_key() -> str:
    return PUBLIC_API_KEY_PREFIX + secrets.token_urlsafe(32)


def register_public_api_routes(app, engine, session_from_request, require_csrf, User, rate_limit, record_audit=None):
    DeveloperApiBase.metadata.create_all(engine)

    def browser_user(request: Request):
        auth = session_from_request(request)
        if not auth:
            raise HTTPException(status_code=401, detail="Not signed in.")
        return auth

    def developer_api_key(request: Request):
        raw = request.headers.get("X-NoContext-API-Key", "").strip()
        if not raw.startswith(PUBLIC_API_KEY_PREFIX) or len(raw) > 256:
            raise HTTPException(status_code=401, detail="Valid NoContext API key required.")
        with Session(engine) as db:
            row = db.scalar(select(DeveloperApiKey).where(DeveloperApiKey.key_hash == _sha(raw), DeveloperApiKey.active.is_(True)))
            if not row:
                raise HTTPException(status_code=401, detail="Invalid or revoked NoContext API key.")
            row.last_used_at = datetime.now(timezone.utc)
            db.commit()
            owner = db.get(User, row.owner_user_id)
            if not owner:
                raise HTTPException(status_code=401, detail="API key owner not found.")
            return row, owner

    @app.get("/api/v1")
    def public_api_index():
        return {
            "name": "NoContext Developer API",
            "version": "1",
            "status": "active",
            "authentication": "X-NoContext-API-Key",
            "endpoints": {
                "me": "GET /api/v1/me",
                "keys": "GET /api/v1/keys",
                "license_validate": "POST /api/v1/licenses/validate",
            },
        }

    @app.get("/api/v1/me")
    def public_api_me(request: Request):
        row, owner = developer_api_key(request)
        return {"user": {"id": owner.id, "username": owner.username}, "apiKey": {"id": row.id, "name": row.name, "prefix": row.key_prefix, "createdAt": row.created_at.replace(tzinfo=timezone.utc).isoformat() if row.created_at.tzinfo is None else row.created_at.astimezone(timezone.utc).isoformat(), "lastUsedAt": None if row.last_used_at is None else (row.last_used_at.replace(tzinfo=timezone.utc).isoformat() if row.last_used_at.tzinfo is None else row.last_used_at.astimezone(timezone.utc).isoformat())}}

    @app.get("/api/v1/keys")
    def public_api_keys(request: Request):
        _, owner = developer_api_key(request)
        with Session(engine) as db:
            rows = db.scalars(select(DeveloperApiKey).where(DeveloperApiKey.owner_user_id == owner.id).order_by(DeveloperApiKey.id.desc())).all()
            return {"keys": [{"id": row.id, "name": row.name, "prefix": row.key_prefix, "active": row.active} for row in rows]}

    @app.post("/api/v1/licenses/validate")
    def public_api_validate_license(request: Request, body: dict):
        developer_api_key(request)
        key = str(body.get("key", "")).strip()
        product = str(body.get("product", "NoContext External")).strip() or "NoContext External"
        if len(key) < 16 or len(key) > 128:
            raise HTTPException(status_code=422, detail="Invalid license key format.")
        from app.main import License, token_hash, utc_datetime, now
        with Session(engine) as db:
            license_row = db.scalar(select(License).where(License.key_hash == token_hash(key)))
            if not license_row or license_row.product != product:
                raise HTTPException(status_code=404, detail="License not found.")
            expires = utc_datetime(license_row.expires_at)
            if license_row.status != "active" or expires <= now():
                raise HTTPException(status_code=403, detail="License is expired or inactive.")
            return {"valid": True, "product": license_row.product, "expiresAt": expires.isoformat()}

    @app.post("/api/developer/keys", status_code=201)
    def create_developer_key(body: CreateDeveloperKeyBody, request: Request):
        _, owner = require_csrf(request)
        rate_limit(request, "developer-api-key-create", 5)
        raw = _new_key()
        key_prefix = raw[:20]
        with Session(engine) as db:
            row = DeveloperApiKey(key_hash=_sha(raw), key_prefix=key_prefix, name=body.name.strip(), owner_user_id=owner.id, active=True)
            db.add(row)
            db.commit()
            db.refresh(row)
            result = {"id": row.id, "name": row.name, "apiKey": raw, "prefix": row.key_prefix}
        if record_audit:
            record_audit(engine, owner.id, "developer_api_key_created", "developer_api_key", result["id"], f"Created developer API key '{body.name.strip()}'.")
        return result

    @app.get("/api/developer/keys")
    def list_developer_keys(request: Request):
        _, owner = browser_user(request)
        with Session(engine) as db:
            rows = db.scalars(select(DeveloperApiKey).where(DeveloperApiKey.owner_user_id == owner.id).order_by(DeveloperApiKey.id.desc())).all()
            return {"keys": [{"id": row.id, "name": row.name, "prefix": row.key_prefix, "active": row.active, "createdAt": row.created_at.isoformat(), "lastUsedAt": row.last_used_at.isoformat() if row.last_used_at else None} for row in rows]}

    @app.post("/api/developer/keys/{key_id}/revoke")
    def revoke_developer_key(key_id: int, request: Request):
        _, owner = require_csrf(request)
        with Session(engine) as db:
            row = db.get(DeveloperApiKey, key_id)
            if not row or row.owner_user_id != owner.id:
                raise HTTPException(status_code=404, detail="API key not found.")
            row.active = False
            db.commit()
        if record_audit:
            record_audit(engine, owner.id, "developer_api_key_revoked", "developer_api_key", key_id, "Revoked developer API key.")
        return {"success": True, "keyId": key_id, "active": False}
