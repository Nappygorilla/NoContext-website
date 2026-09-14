from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

OWNER_ID = 1
ROLES = {"user", "staff", "moderator", "admin", "developer", "owner"}

class RoleBody(BaseModel):
    role: str = Field(min_length=4, max_length=16)

class CreateKeyBody(BaseModel):
    duration: str = Field(pattern=r"^(3d|7d|lifetime)$")
    product: str = Field(default="NoContext External", min_length=1, max_length=64)


def _utc(value):
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def _sha(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _new_key() -> str:
    return "NC-" + "-".join(secrets.token_hex(4).upper() for _ in range(4))


def register_admin_user_routes(app, engine, require_csrf, session_from_request):
    with engine.begin() as conn:
        if engine.dialect.name == "postgresql":
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(16) NOT NULL DEFAULT 'user'"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE"))
        else:
            columns = {row[1] for row in conn.execute(text("PRAGMA table_info(users)"))}
            if "role" not in columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'user'"))
            if "is_banned" not in columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_banned BOOLEAN NOT NULL DEFAULT 0"))
        conn.execute(text("UPDATE users SET role='owner' WHERE id=:owner_id"), {"owner_id": OWNER_ID})

    def owner(request: Request):
        auth = session_from_request(request)
        if not auth:
            raise HTTPException(status_code=401, detail="Not signed in.")
        _, user = auth
        if user.id != OWNER_ID:
            raise HTTPException(status_code=403, detail="Owner access required.")
        return user

    def owner_write(request: Request):
        _, user = require_csrf(request)
        if user.id != OWNER_ID:
            raise HTTPException(status_code=403, detail="Owner access required.")
        return user

    def user_json(row):
        return {"id": row[0], "username": row[1], "email": row[2], "createdAt": _utc(row[3]), "role": row[4] or "user", "banned": bool(row[5])}

    @app.get("/api/admin/users")
    def admin_users(request: Request):
        owner(request)
        with Session(engine) as db:
            rows = db.execute(text("SELECT id, username, email, created_at, role, is_banned FROM users ORDER BY id ASC")).all()
            return {"ownerId": OWNER_ID, "roles": sorted(ROLES), "users": [user_json(row) for row in rows]}

    @app.post("/api/admin/users/{user_id}/role")
    def change_role(user_id: int, body: RoleBody, request: Request):
        owner_write(request)
        role = body.role.strip().lower()
        if role not in ROLES:
            raise HTTPException(status_code=422, detail="Invalid role.")
        if user_id == OWNER_ID and role != "owner":
            raise HTTPException(status_code=403, detail="The primary owner account cannot be demoted.")
        with Session(engine) as db:
            result = db.execute(text("UPDATE users SET role=:role WHERE id=:user_id"), {"role": role, "user_id": user_id})
            if result.rowcount != 1:
                raise HTTPException(status_code=404, detail="User not found.")
            db.commit()
        return {"success": True, "userId": user_id, "role": role}

    @app.post("/api/admin/users/{user_id}/ban")
    def ban_user(user_id: int, request: Request):
        owner_write(request)
        if user_id == OWNER_ID:
            raise HTTPException(status_code=403, detail="The primary owner account cannot be banned.")
        with Session(engine) as db:
            result = db.execute(text("UPDATE users SET is_banned=TRUE WHERE id=:user_id"), {"user_id": user_id})
            if result.rowcount != 1:
                raise HTTPException(status_code=404, detail="User not found.")
            db.execute(text("DELETE FROM sessions WHERE user_id=:user_id"), {"user_id": user_id})
            db.commit()
        return {"success": True, "userId": user_id, "banned": True}

    @app.post("/api/admin/users/{user_id}/unban")
    def unban_user(user_id: int, request: Request):
        owner_write(request)
        with Session(engine) as db:
            result = db.execute(text("UPDATE users SET is_banned=FALSE WHERE id=:user_id"), {"user_id": user_id})
            if result.rowcount != 1:
                raise HTTPException(status_code=404, detail="User not found.")
            db.commit()
        return {"success": True, "userId": user_id, "banned": False}

    @app.post("/api/admin/keys")
    def create_owner_key(body: CreateKeyBody, request: Request):
        owner_write(request)
        now = datetime.now(timezone.utc)
        if body.duration == "3d":
            expires = now + timedelta(days=3)
            duration_label = "3 days"
        elif body.duration == "7d":
            expires = now + timedelta(days=7)
            duration_label = "1 week"
        else:
            expires = datetime(9999, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
            duration_label = "Lifetime"
        plain_key = _new_key()
        with Session(engine) as db:
            db.execute(text("""
                INSERT INTO free_keys (key_hash, key_prefix, user_id, product, booster, created_at, expires_at)
                VALUES (:key_hash, :key_prefix, :user_id, :product, FALSE, :created_at, :expires_at)
            """), {"key_hash": _sha(plain_key), "key_prefix": plain_key[:11], "user_id": OWNER_ID, "product": body.product.strip(), "created_at": now, "expires_at": expires})
            db.commit()
        return {"success": True, "key": plain_key, "duration": body.duration, "durationLabel": duration_label, "product": body.product.strip(), "expiresAt": expires.isoformat()}
