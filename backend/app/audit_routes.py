from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, Request
from sqlalchemy import DateTime, Integer, String, Text, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column


OWNER_ID = 1


class AuditBase(DeclarativeBase):
    pass


class AuditLog(AuditBase):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_user_id: Mapped[int] = mapped_column(Integer, index=True)
    action: Mapped[str] = mapped_column(String(80), index=True)
    target_type: Mapped[str] = mapped_column(String(32), default="")
    target_id: Mapped[str] = mapped_column(String(64), default="")
    details: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)


def _utc(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def record_audit(engine, actor_user_id: int, action: str, target_type: str = "", target_id: str = "", details: str = "") -> None:
    with Session(engine) as db:
        db.add(AuditLog(
            actor_user_id=actor_user_id,
            action=action[:80],
            target_type=target_type[:32],
            target_id=str(target_id)[:64],
            details=details[:4000],
            created_at=datetime.now(timezone.utc),
        ))
        db.commit()


def register_audit_routes(app, engine, session_from_request):
    AuditBase.metadata.create_all(engine)

    def owner(request: Request):
        auth = session_from_request(request)
        if not auth:
            raise HTTPException(status_code=401, detail="Not signed in.")
        _, user = auth
        if user.id != OWNER_ID:
            raise HTTPException(status_code=403, detail="Owner access required.")
        return user

    @app.get("/api/admin/audit-logs")
    def audit_logs(request: Request, limit: int = 100):
        owner(request)
        limit = max(1, min(limit, 200))
        with Session(engine) as db:
            rows = db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)).all()
            return {
                "logs": [{
                    "id": row.id,
                    "actorUserId": row.actor_user_id,
                    "action": row.action,
                    "targetType": row.target_type,
                    "targetId": row.target_id,
                    "details": row.details,
                    "createdAt": _utc(row.created_at),
                } for row in rows]
            }
