from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

OWNER_ID = 1
ROLES = {"user", "staff", "moderator", "admin", "developer", "owner"}

class RoleBody(BaseModel):
    role: str = Field(min_length=4, max_length=16)


def _utc(value):
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def _sha(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def register_admin_user_routes(app, engine, require_csrf, session_from_request):
    # Safe startup migration for the existing users table.
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

    @app.middleware("http")
    async def block_banned_users(request: Request, call_next):
        path = request.url.path
        if path == "/api/auth/login" and request.method == "POST":
            body = await request.body()
            try:
                payload = json.loads(body.decode("utf-8"))
                email = str(payload.get("email", "")).strip().lower()
                with Session(engine) as db:
                    banned = db.execute(text("SELECT is_banned FROM users WHERE lower(email)=:email"), {"email": email}).scalar()
                if banned:
                    return JSONResponse(status_code=403, content={"detail": "This account has been banned."})
            except Exception:
                pass
        else:
            raw = request.cookies.get("__Host-nocontext_session")
            if raw:
                token_hash = _sha(raw)
                with Session(engine) as db:
                    banned = db.execute(text("""
                        SELECT u.is_banned
                        FROM sessions s JOIN users u ON u.id=s.user_id
                        WHERE s.token_hash=:token_hash
                          AND s.expires_at > CURRENT_TIMESTAMP
                    """), {"token_hash": token_hash}).scalar()
                if banned:
                    return JSONResponse(status_code=403, content={"detail": "This account has been banned."})
        return await call_next(request)

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
        return {
            "id": row[0],
            "username": row[1],
            "email": row[2],
            "createdAt": _utc(row[3]),
            "role": row[4] or "user",
            "banned": bool(row[5]),
        }

    @app.get("/api/admin/users")
    def admin_users(request: Request):
        owner(request)
        with Session(engine) as db:
            rows = db.execute(text("""
                SELECT id, username, email, created_at, role, is_banned
                FROM users ORDER BY id ASC
            """)).all()
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
