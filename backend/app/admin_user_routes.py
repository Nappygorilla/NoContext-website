from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.audit_routes import record_audit

OWNER_ID = 1
ROLES = {"user", "staff", "moderator", "admin", "developer", "media", "owner"}

class RoleBody(BaseModel):
    role: str = Field(min_length=4, max_length=16)

class ImportKeyBody(BaseModel):
    key: str = Field(min_length=16, max_length=128)
    duration: str = Field(pattern=r"^(3d|7d|lifetime)$")
    product: str = Field(default="NoContext External", min_length=1, max_length=64)
    user_id: int | None = Field(default=None, ge=1)

class ExtendKeyBody(BaseModel):
    days: int = Field(ge=1, le=3650)

class AssignKeyBody(BaseModel):
    user_id: int = Field(ge=1)


def _utc(value):
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def _sha(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


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
        actor = owner_write(request)
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
        record_audit(engine, actor.id, "role_changed", "user", user_id, f"Role changed to {role}.")
        return {"success": True, "userId": user_id, "role": role}

    @app.post("/api/admin/users/{user_id}/ban")
    def ban_user(user_id: int, request: Request):
        actor = owner_write(request)
        if user_id == OWNER_ID:
            raise HTTPException(status_code=403, detail="The primary owner account cannot be banned.")
        with Session(engine) as db:
            result = db.execute(text("UPDATE users SET is_banned=TRUE WHERE id=:user_id"), {"user_id": user_id})
            if result.rowcount != 1:
                raise HTTPException(status_code=404, detail="User not found.")
            db.execute(text("DELETE FROM sessions WHERE user_id=:user_id"), {"user_id": user_id})
            db.commit()
        record_audit(engine, actor.id, "user_banned", "user", user_id, "User banned and active sessions revoked.")
        return {"success": True, "userId": user_id, "banned": True}

    @app.post("/api/admin/users/{user_id}/unban")
    def unban_user(user_id: int, request: Request):
        actor = owner_write(request)
        with Session(engine) as db:
            result = db.execute(text("UPDATE users SET is_banned=FALSE WHERE id=:user_id"), {"user_id": user_id})
            if result.rowcount != 1:
                raise HTTPException(status_code=404, detail="User not found.")
            db.commit()
        record_audit(engine, actor.id, "user_unbanned", "user", user_id, "User unbanned.")
        return {"success": True, "userId": user_id, "banned": False}

    @app.get("/api/admin/keys")
    def admin_keys(request: Request):
        owner(request)
        with Session(engine) as db:
            rows = db.execute(text("""
                SELECT fk.id, fk.key_prefix, fk.user_id, u.username, u.email, fk.product,
                       fk.booster, fk.created_at, fk.expires_at
                FROM free_keys fk
                LEFT JOIN users u ON u.id = fk.user_id
                ORDER BY fk.expires_at DESC, fk.id DESC
            """)).all()
        now = datetime.now(timezone.utc)
        return {"provider": "KeyAuth dashboard", "keys": [{
            "id": row[0],
            "keyPrefix": row[1],
            "userId": row[2],
            "username": row[3] or "Unknown",
            "email": row[4] or "",
            "product": row[5],
            "booster": bool(row[6]),
            "createdAt": _utc(row[7]),
            "expiresAt": _utc(row[8]),
            "active": row[8] is not None and (row[8].replace(tzinfo=timezone.utc) if row[8].tzinfo is None else row[8]) > now,
        } for row in rows]}

    @app.post("/api/admin/keys")
    def import_owner_key(body: ImportKeyBody, request: Request):
        actor = owner_write(request)
        raw_key = body.key.strip()
        target_user_id = body.user_id or OWNER_ID
        from app.main import License, token_hash
        with Session(engine) as db:
            user_exists = db.execute(text("SELECT 1 FROM users WHERE id=:user_id"), {"user_id": target_user_id}).first()
            if not user_exists:
                raise HTTPException(status_code=404, detail="User not found.")
            duplicate = db.execute(text("SELECT id FROM free_keys WHERE key_hash=:key_hash"), {"key_hash": _sha(raw_key)}).first()
            if duplicate or db.scalar(select(License).where(License.key_hash == token_hash(raw_key))):
                raise HTTPException(status_code=409, detail="That KeyAuth license is already imported.")
            username = db.execute(text("SELECT username FROM users WHERE id=:user_id"), {"user_id": target_user_id}).scalar_one()

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

        with Session(engine) as db:
            db.add(License(key_hash=token_hash(raw_key), key_prefix=raw_key[:11], user_id=target_user_id, product=body.product.strip(), status="active", expires_at=expires))
            db.execute(text("""
                INSERT INTO free_keys (key_hash, key_prefix, user_id, product, booster, created_at, expires_at)
                VALUES (:key_hash, :key_prefix, :user_id, :product, FALSE, :created_at, :expires_at)
            """), {
                "key_hash": _sha(raw_key),
                "key_prefix": raw_key[:11],
                "user_id": target_user_id,
                "product": body.product.strip(),
                "created_at": now,
                "expires_at": expires,
            })
            db.commit()
        record_audit(engine, actor.id, "key_imported", "user", target_user_id, f"Imported a KeyAuth {duration_label} license for {username}.")
        return {"success": True, "key": raw_key, "duration": body.duration, "durationLabel": duration_label, "userId": target_user_id, "product": body.product.strip(), "expiresAt": expires.isoformat(), "provider": "KeyAuth dashboard", "note": "The key was created in KeyAuth and imported here. KeyAuth remains the license authority."}

    @app.post("/api/admin/keys/{key_id}/assign")
    def assign_imported_key(key_id: int, body: AssignKeyBody, request: Request):
        actor = owner_write(request)
        from app.main import License
        target_user_id = body.user_id
        with Session(engine) as db:
            target_user = db.execute(text("SELECT id, username FROM users WHERE id=:user_id"), {"user_id": target_user_id}).first()
            if not target_user:
                raise HTTPException(status_code=404, detail="User not found.")
            row = db.execute(text("""
                SELECT id, key_hash, product, user_id
                FROM free_keys
                WHERE id=:key_id
            """), {"key_id": key_id}).first()
            if not row:
                raise HTTPException(status_code=404, detail="Imported key not found.")
            if row[3] == target_user_id:
                return {"success": True, "keyId": key_id, "userId": target_user_id, "username": target_user[1], "message": "Key is already assigned to that user."}
            license_row = db.scalar(select(License).where(License.key_hash == row[1]))
            db.execute(text("UPDATE free_keys SET user_id=:user_id WHERE id=:key_id"), {"user_id": target_user_id, "key_id": key_id})
            if license_row is not None:
                license_row.user_id = target_user_id
            db.commit()
        record_audit(engine, actor.id, "key_assigned", "key", key_id, f"Assigned imported key to user #{target_user_id} ({target_user[1]}).")
        return {"success": True, "keyId": key_id, "userId": target_user_id, "username": target_user[1]}

    @app.delete("/api/admin/keys")
    def delete_all_imported_keys(request: Request):
        actor = owner_write(request)
        from app.main import License
        with Session(engine) as db:
            rows = db.execute(text("SELECT id, key_hash FROM free_keys")).all()
            if not rows:
                return {"success": True, "deleted": 0}
            key_hashes = [row[1] for row in rows if row[1]]
            db.execute(text("DELETE FROM free_keys"))
            for key_hash in key_hashes:
                license_row = db.scalar(select(License).where(License.key_hash == key_hash))
                if license_row is not None:
                    db.delete(license_row)
            db.commit()
        record_audit(engine, actor.id, "all_imported_keys_deleted", "keys", None, f"Deleted {len(rows)} imported keys.")
        return {"success": True, "deleted": len(rows)}

    @app.delete("/api/admin/keys/{key_id}")
    def delete_imported_key(key_id: int, request: Request):
        actor = owner_write(request)
        from app.main import License
        with Session(engine) as db:
            row = db.execute(text("""
                SELECT key_hash, user_id, product
                FROM free_keys
                WHERE id=:key_id
            """), {"key_id": key_id}).first()
            if not row:
                raise HTTPException(status_code=404, detail="Imported key not found.")
            db.execute(text("DELETE FROM free_keys WHERE id=:key_id"), {"key_id": key_id})
            license_row = db.scalar(select(License).where(License.key_hash == row[0]))
            if license_row is not None:
                db.delete(license_row)
            db.commit()
        record_audit(engine, actor.id, "key_deleted", "key", key_id, f"Deleted imported key for user #{row[1]} ({row[2]}).")
        return {"success": True, "keyId": key_id, "deleted": True}

    @app.post("/api/admin/keys/{key_id}/deactivate")
    def deactivate_key(key_id: int, request: Request):
        actor = owner_write(request)
        from app.main import License, token_hash
        now = datetime.now(timezone.utc)
        with Session(engine) as db:
            row = db.execute(text("SELECT key_hash, user_id, product FROM free_keys WHERE id=:key_id"), {"key_id": key_id}).first()
            if not row:
                raise HTTPException(status_code=404, detail="Imported key not found.")
            if row[0]:
                db.execute(text("UPDATE free_keys SET expires_at=:expires_at WHERE id=:key_id"), {"expires_at": now, "key_id": key_id})
                license_row = db.scalar(select(License).where(License.key_hash == row[0]))
                if license_row is not None:
                    license_row.status = "inactive"
                    license_row.expires_at = now
            else:
                db.execute(text("UPDATE free_keys SET expires_at=:expires_at WHERE id=:key_id"), {"expires_at": now, "key_id": key_id})
            db.commit()
        record_audit(engine, actor.id, "key_deactivated", "key", key_id, f"Deactivated imported key for user #{row[1]} ({row[2]}).")
        return {"success": True, "keyId": key_id, "active": False, "deactivatedAt": now.isoformat()}

    @app.post("/api/admin/keys/{key_id}/extend")
    def extend_key(key_id: int, body: ExtendKeyBody, request: Request):
        owner_write(request)
        raise HTTPException(status_code=409, detail="Create or extend the license in the KeyAuth dashboard first, then update its local record here.")
