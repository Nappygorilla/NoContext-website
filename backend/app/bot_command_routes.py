from __future__ import annotations

import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session


def register_bot_command_routes(app, engine, User, record_audit=None):
    expected_secret = os.getenv("DISCORD_BOT_SECRET", "").strip()

    def discord_admin(request: Request):
        if not expected_secret:
            raise HTTPException(status_code=503, detail="Discord bot administration is not configured.")
        provided = request.headers.get("X-Discord-Bot-Secret", "")
        if not hmac.compare_digest(provided, expected_secret):
            raise HTTPException(status_code=401, detail="Invalid bot authentication.")
        # The Node bot checks Discord's Administrator permission before making
        # privileged requests. The backend additionally requires the private bot
        # secret, so these routes cannot be called by normal website clients.

    class CreateLicenseBody(BaseModel):
        duration: str = Field(pattern=r"^(3d|7d|lifetime)$")
        product: str = Field(default="NoContext External", min_length=1, max_length=64)
        user_id: int | None = Field(default=None, ge=1)

    class ExtendLicenseBody(BaseModel):
        days: int = Field(ge=1, le=3650)

    class CreateDeveloperBody(BaseModel):
        name: str = Field(default="Discord application", min_length=2, max_length=80)

    @app.post("/api/discord/licenses/validate")
    def bot_validate_license(body: dict, request: Request):
        discord_admin(request)
        raw = str(body.get("key", "")).strip()
        product = str(body.get("product", "NoContext External")).strip() or "NoContext External"
        from app.main import License, now, token_hash, utc_datetime
        if len(raw) < 16 or len(raw) > 128:
            raise HTTPException(status_code=422, detail="Invalid license key format.")
        with Session(engine) as db:
            row = db.scalar(select(License).where(License.key_hash == token_hash(raw)))
            if not row or row.product != product:
                raise HTTPException(status_code=404, detail="License not found.")
            expires = utc_datetime(row.expires_at)
            if row.status != "active" or expires <= now():
                raise HTTPException(status_code=403, detail="License is expired or inactive.")
            row.last_seen_at = now()
            db.commit()
            return {"valid": True, "id": row.id, "keyPrefix": row.key_prefix, "product": row.product, "status": row.status, "expiresAt": expires.isoformat()}

    @app.post("/api/discord/licenses", status_code=201)
    def bot_create_license(body: CreateLicenseBody, request: Request):
        discord_admin(request)
        from app.main import License, token_hash
        current = datetime.now(timezone.utc)
        expires = current + timedelta(days=3) if body.duration == "3d" else current + timedelta(days=7) if body.duration == "7d" else datetime(9999, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
        raw = "NC-" + "-".join(secrets.token_hex(4).upper() for _ in range(4))
        target_user_id = body.user_id or 1
        with Session(engine) as db:
            if not db.get(User, target_user_id):
                raise HTTPException(status_code=404, detail="User not found.")
            row = License(key_hash=token_hash(raw), key_prefix=raw[:11], user_id=target_user_id, product=body.product.strip(), status="active", expires_at=expires)
            db.add(row)
            db.commit()
            db.refresh(row)
        if record_audit:
            record_audit(engine, 1, "discord_license_created", "license", row.id, f"Discord admin created a {body.duration} license.")
        return {"id": row.id, "key": raw, "userId": target_user_id, "product": row.product, "duration": body.duration, "expiresAt": expires.isoformat()}

    @app.get("/api/discord/licenses")
    def bot_list_licenses(request: Request):
        discord_admin(request)
        from app.main import License
        with Session(engine) as db:
            rows = db.scalars(select(License).order_by(License.id.desc()).limit(100)).all()
            return {"licenses": [{"id": row.id, "keyPrefix": row.key_prefix, "userId": row.user_id, "product": row.product, "status": row.status, "createdAt": row.created_at.replace(tzinfo=timezone.utc).isoformat() if row.created_at.tzinfo is None else row.created_at.isoformat(), "expiresAt": row.expires_at.replace(tzinfo=timezone.utc).isoformat() if row.expires_at.tzinfo is None else row.expires_at.isoformat()} for row in rows]}

    @app.get("/api/discord/licenses/{license_id}")
    def bot_license_info(license_id: int, request: Request):
        discord_admin(request)
        from app.main import License
        with Session(engine) as db:
            row = db.get(License, license_id)
            if not row:
                raise HTTPException(status_code=404, detail="License not found.")
            expires = row.expires_at.replace(tzinfo=timezone.utc) if row.expires_at.tzinfo is None else row.expires_at
            created = row.created_at.replace(tzinfo=timezone.utc) if row.created_at.tzinfo is None else row.created_at
            return {"id": row.id, "keyPrefix": row.key_prefix, "userId": row.user_id, "product": row.product, "status": row.status, "createdAt": created.isoformat(), "expiresAt": expires.isoformat()}

    @app.post("/api/discord/licenses/{license_id}/revoke")
    def bot_revoke_license(license_id: int, request: Request):
        discord_admin(request)
        from app.main import License
        with Session(engine) as db:
            row = db.get(License, license_id)
            if not row:
                raise HTTPException(status_code=404, detail="License not found.")
            row.status = "revoked"
            db.commit()
        if record_audit:
            record_audit(engine, 1, "discord_license_revoked", "license", license_id, "Discord admin revoked license.")
        return {"success": True, "id": license_id, "status": "revoked"}

    @app.post("/api/discord/licenses/{license_id}/extend")
    def bot_extend_license(license_id: int, body: ExtendLicenseBody, request: Request):
        discord_admin(request)
        from app.main import License
        current = datetime.now(timezone.utc)
        with Session(engine) as db:
            row = db.get(License, license_id)
            if not row:
                raise HTTPException(status_code=404, detail="License not found.")
            expires = row.expires_at.replace(tzinfo=timezone.utc) if row.expires_at.tzinfo is None else row.expires_at
            row.expires_at = max(expires, current) + timedelta(days=body.days)
            if row.status == "revoked":
                row.status = "active"
            db.commit()
            result = row.expires_at.replace(tzinfo=timezone.utc).isoformat() if row.expires_at.tzinfo is None else row.expires_at.isoformat()
        if record_audit:
            record_audit(engine, 1, "discord_license_extended", "license", license_id, f"Discord admin extended license by {body.days} days.")
        return {"success": True, "id": license_id, "expiresAt": result, "status": "active"}

    @app.post("/api/discord/developer-keys", status_code=201)
    def bot_create_developer_key(body: CreateDeveloperBody, request: Request):
        discord_admin(request)
        from app.developer_api_routes import DeveloperKey, _hash, _new_key
        raw = _new_key()
        with Session(engine) as db:
            row = DeveloperKey(key_hash=_hash(raw), key_prefix=raw[:20], name=body.name.strip(), owner_user_id=1, active=True)
            db.add(row)
            db.commit()
            db.refresh(row)
        if record_audit:
            record_audit(engine, 1, "discord_developer_api_key_created", "developer_api_key", row.id, f"Created developer API key '{row.name}' through Discord.")
        return {"id": row.id, "name": row.name, "apiKey": raw, "prefix": row.key_prefix}

    @app.get("/api/discord/developer-keys")
    def bot_list_developer_keys(request: Request):
        discord_admin(request)
        from app.developer_api_routes import DeveloperKey
        with Session(engine) as db:
            rows = db.scalars(select(DeveloperKey).where(DeveloperKey.owner_user_id == 1).order_by(DeveloperKey.id.desc())).all()
            return {"keys": [{"id": row.id, "name": row.name, "prefix": row.key_prefix, "active": row.active, "createdAt": row.created_at.replace(tzinfo=timezone.utc).isoformat() if row.created_at.tzinfo is None else row.created_at.isoformat(), "lastUsedAt": row.last_used_at.replace(tzinfo=timezone.utc).isoformat() if row.last_used_at and row.last_used_at.tzinfo is None else row.last_used_at.isoformat() if row.last_used_at else None} for row in rows]}

    @app.get("/api/discord/developer-keys/{key_id}")
    def bot_developer_key_info(key_id: int, request: Request):
        discord_admin(request)
        from app.developer_api_routes import DeveloperKey
        with Session(engine) as db:
            row = db.get(DeveloperKey, key_id)
            if not row or row.owner_user_id != 1:
                raise HTTPException(status_code=404, detail="API key not found.")
            return {"id": row.id, "name": row.name, "prefix": row.key_prefix, "active": row.active, "createdAt": row.created_at.replace(tzinfo=timezone.utc).isoformat() if row.created_at.tzinfo is None else row.created_at.isoformat(), "lastUsedAt": row.last_used_at.replace(tzinfo=timezone.utc).isoformat() if row.last_used_at and row.last_used_at.tzinfo is None else row.last_used_at.isoformat() if row.last_used_at else None}

    @app.post("/api/discord/developer-keys/{key_id}/revoke")
    def bot_revoke_developer_key(key_id: int, request: Request):
        discord_admin(request)
        from app.developer_api_routes import DeveloperKey
        with Session(engine) as db:
            row = db.get(DeveloperKey, key_id)
            if not row or row.owner_user_id != 1:
                raise HTTPException(status_code=404, detail="API key not found.")
            row.active = False
            db.commit()
        if record_audit:
            record_audit(engine, 1, "discord_developer_api_key_revoked", "developer_api_key", key_id, "Revoked developer API key through Discord.")
        return {"success": True, "id": key_id, "active": False}
