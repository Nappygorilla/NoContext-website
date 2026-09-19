from __future__ import annotations

import hashlib
import os
import secrets
from datetime import datetime, timezone

from fastapi import HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, DateTime, Integer, String, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

PREFIX = "nc_dev_"
PEPPER = os.getenv("PUBLIC_API_KEY_PEPPER", "").strip()
OWNER_ID = 1

class DeveloperBase(DeclarativeBase):
    pass

class DeveloperKey(DeveloperBase):
    __tablename__ = "developer_api_keys"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    key_prefix: Mapped[str] = mapped_column(String(32), index=True)
    name: Mapped[str] = mapped_column(String(80))
    owner_user_id: Mapped[int] = mapped_column(Integer, index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class CreateDeveloperKeyBody(BaseModel):
    name: str = Field(default="My application", min_length=2, max_length=80)


def _hash(raw: str) -> str:
    return hashlib.sha256((PEPPER + raw).encode("utf-8")).hexdigest()


def _new_key() -> str:
    return PREFIX + secrets.token_urlsafe(32)


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def register_developer_api_routes(app, engine, session_from_request, require_csrf, User, rate_limit, record_audit=None):
    DeveloperBase.metadata.create_all(engine)
    from app.account_admin_routes import register_account_admin_routes
    register_account_admin_routes(app, engine, session_from_request, require_csrf, User, record_audit)
    from app.bot_command_routes import register_bot_command_routes
    register_bot_command_routes(app, engine, User, record_audit)

    def owner(request: Request):
        auth = session_from_request(request)
        if not auth:
            raise HTTPException(status_code=401, detail="Not signed in.")
        _, user = auth
        return user

    def owner_write(request: Request):
        _, user = require_csrf(request)
        if user.id != OWNER_ID:
            raise HTTPException(status_code=403, detail="Owner access required.")
        return user

    def api_key(request: Request):
        raw = request.headers.get("X-Luna-API-Key", "").strip()
        if not raw.startswith(PREFIX) or len(raw) > 256:
            raise HTTPException(status_code=401, detail="Valid luna.win API key required.")
        with Session(engine) as db:
            key = db.scalar(select(DeveloperKey).where(DeveloperKey.key_hash == _hash(raw), DeveloperKey.active.is_(True)))
            if not key:
                raise HTTPException(status_code=401, detail="Invalid or revoked luna.win API key.")
            key.last_used_at = datetime.now(timezone.utc)
            db.commit()
            user = db.get(User, key.owner_user_id)
            if not user:
                raise HTTPException(status_code=401, detail="API key owner not found.")
            return key, user

    @app.get("/api/v1")
    def api_root():
        return {"name": "luna.win Developer API", "version": "1", "status": "active", "authentication": "X-Luna-API-Key", "endpoints": {"me": "/api/v1/me", "licenseValidate": "/api/v1/licenses/validate"}}

    @app.get("/api/v1/me")
    def api_me(request: Request):
        key, user = api_key(request)
        return {"user": {"id": user.id, "username": user.username}, "apiKey": {"id": key.id, "name": key.name, "prefix": key.key_prefix, "createdAt": _iso(key.created_at), "lastUsedAt": _iso(key.last_used_at)}}

    @app.post("/api/v1/licenses/validate")
    def api_validate_license(request: Request, body: dict):
        api_key(request)
        raw_license = str(body.get("key", "")).strip()
        product = str(body.get("product", "luna.win External")).strip() or "luna.win External"
        if len(raw_license) < 16 or len(raw_license) > 128:
            raise HTTPException(status_code=422, detail="Invalid license key format.")
        from app.main import License, now, token_hash, utc_datetime
        with Session(engine) as db:
            row = db.scalar(select(License).where(License.key_hash == token_hash(raw_license)))
            if not row or row.product != product:
                raise HTTPException(status_code=404, detail="License not found.")
            expires = utc_datetime(row.expires_at)
            if row.status != "active" or expires <= now():
                raise HTTPException(status_code=403, detail="License is expired or inactive.")
            return {"valid": True, "product": row.product, "expiresAt": expires.isoformat()}

    @app.post("/api/developer/keys", status_code=201)
    def create_key(body: CreateDeveloperKeyBody, request: Request):
        _, user = require_csrf(request)
        rate_limit(request, "developer-key-create", 5)
        raw = _new_key()
        with Session(engine) as db:
            key = DeveloperKey(key_hash=_hash(raw), key_prefix=raw[:20], name=body.name.strip(), owner_user_id=user.id, active=True)
            db.add(key)
            db.commit()
            db.refresh(key)
            result = {"id": key.id, "name": key.name, "apiKey": raw, "prefix": key.key_prefix}
        if record_audit:
            record_audit(engine, user.id, "developer_api_key_created", "developer_api_key", key.id, f"Created developer API key '{key.name}'.")
        return result

    @app.get("/api/developer/keys")
    def list_keys(request: Request):
        _, user = owner(request)
        with Session(engine) as db:
            rows = db.scalars(select(DeveloperKey).where(DeveloperKey.owner_user_id == user.id).order_by(DeveloperKey.id.desc())).all()
            return {"keys": [{"id": row.id, "name": row.name, "prefix": row.key_prefix, "active": row.active, "createdAt": _iso(row.created_at), "lastUsedAt": _iso(row.last_used_at)} for row in rows]}

    @app.post("/api/developer/keys/{key_id}/revoke")
    def revoke_key(key_id: int, request: Request):
        _, user = require_csrf(request)
        with Session(engine) as db:
            row = db.get(DeveloperKey, key_id)
            if not row or row.owner_user_id != user.id:
                raise HTTPException(status_code=404, detail="API key not found.")
            row.active = False
            db.commit()
        if record_audit:
            record_audit(engine, user.id, "developer_api_key_revoked", "developer_api_key", key_id, "Revoked developer API key.")
        return {"success": True, "keyId": key_id, "active": False}

    @app.post("/api/admin/users/{user_id}/delete")
    def delete_account(user_id: int, request: Request):
        actor = owner_write(request)
        if user_id == actor.id:
            raise HTTPException(status_code=400, detail="The owner account cannot be deleted from this endpoint.")

        from app.account_admin_routes import DeleteAccountBody, delete_account_impl
        body = DeleteAccountBody.model_validate({"reason": "Account deleted by owner."})
        return delete_account_impl(engine, User, user_id, actor, body, record_audit)
