from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, Integer, String, Text, select, text
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column


OWNER_ID = 1
MEDIA_ROLES = {"media", "admin", "owner"}


class MediaBase(DeclarativeBase):
    pass


class MediaApplication(MediaBase):
    __tablename__ = "media_applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True)
    role: Mapped[str] = mapped_column(String(64), default="Content Creator")
    experience: Mapped[str] = mapped_column(Text, default="")
    portfolio: Mapped[str] = mapped_column(String(500), default="")
    social: Mapped[str] = mapped_column(String(500), default="")
    availability: Mapped[str] = mapped_column(String(120), default="")
    why_join: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    review_note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class MediaApplicationBody(BaseModel):
    role: str = Field(default="Content Creator", min_length=2, max_length=64)
    experience: str = Field(default="", max_length=3000)
    portfolio: str = Field(default="", max_length=500)
    social: str = Field(default="", max_length=500)
    availability: str = Field(default="", max_length=120)
    why_join: str = Field(default="", max_length=3000)


class MediaReviewBody(BaseModel):
    status: str = Field(pattern=r"^(approved|rejected|pending)$")
    review_note: str = Field(default="", max_length=1000)


def _utc(value):
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def register_media_routes(app, engine, session_from_request, require_csrf):
    MediaBase.metadata.create_all(engine)

    def require_user(request: Request):
        auth = session_from_request(request)
        if not auth:
            raise HTTPException(status_code=401, detail="Please sign in first.")
        return auth

    def require_owner(request: Request):
        auth = require_csrf(request)
        _, user = auth
        if user.id != OWNER_ID:
            raise HTTPException(status_code=403, detail="Owner access required.")
        return user

    def user_role(engine, user_id: int) -> str:
        with Session(engine) as db:
            role = db.execute(text("SELECT role FROM users WHERE id=:user_id"), {"user_id": user_id}).scalar()
            return str(role or "user").strip().lower()

    @app.get("/api/media/application")
    def media_application(request: Request):
        _, user = require_user(request)
        with Session(engine) as db:
            row = db.scalar(
                select(MediaApplication)
                .where(MediaApplication.user_id == user.id)
                .order_by(MediaApplication.created_at.desc())
            )
            return {
                "application": None if row is None else {
                    "id": row.id,
                    "role": row.role,
                    "experience": row.experience,
                    "portfolio": row.portfolio,
                    "social": row.social,
                    "availability": row.availability,
                    "whyJoin": row.why_join,
                    "status": row.status,
                    "reviewNote": row.review_note,
                    "createdAt": _utc(row.created_at),
                    "reviewedAt": _utc(row.reviewed_at),
                }
            }

    @app.post("/api/media/application", status_code=201)
    def submit_media_application(body: MediaApplicationBody, request: Request):
        _, user = require_csrf(request)
        values = body.model_dump()
        with Session(engine) as db:
            existing = db.scalar(
                select(MediaApplication)
                .where(MediaApplication.user_id == user.id, MediaApplication.status.in_(["pending", "approved"]))
                .order_by(MediaApplication.created_at.desc())
            )
            if existing:
                if existing.status == "approved":
                    raise HTTPException(status_code=409, detail="You are already part of the luna.win Media Team.")
                raise HTTPException(status_code=409, detail="You already have a pending Media Team application.")
            row = MediaApplication(
                user_id=user.id,
                role=values["role"].strip(),
                experience=values["experience"].strip(),
                portfolio=values["portfolio"].strip(),
                social=values["social"].strip(),
                availability=values["availability"].strip(),
                why_join=values["why_join"].strip(),
                status="pending",
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            return {"success": True, "status": row.status, "applicationId": row.id}

    @app.get("/api/media/session")
    def media_session(request: Request):
        _, user = require_user(request)
        role = user_role(engine, user.id)
        with Session(engine) as db:
            application = db.scalar(
                select(MediaApplication)
                .where(MediaApplication.user_id == user.id)
                .order_by(MediaApplication.created_at.desc())
            )
        approved = role in MEDIA_ROLES
        if not approved:
            return {
                "authorized": False,
                "role": role,
                "applicationStatus": application.status if application else None,
                "message": "Your Media Team access has not been approved yet.",
            }
        return {
            "authorized": True,
            "role": role,
            "applicationStatus": application.status if application else "approved",
            "user": {"id": user.id, "username": user.username, "email": user.email},
        }

    @app.get("/api/admin/media/applications")
    def admin_media_applications(request: Request):
        require_owner(request)
        with Session(engine) as db:
            rows = db.execute(
                text(
                    "SELECT a.id, a.user_id, u.username, u.email, a.role, a.experience, "
                    "a.portfolio, a.social, a.availability, a.why_join, a.status, "
                    "a.review_note, a.created_at, a.reviewed_at "
                    "FROM media_applications a JOIN users u ON u.id=a.user_id "
                    "ORDER BY a.created_at DESC"
                )
            ).all()
        return {
            "applications": [
                {
                    "id": row[0],
                    "userId": row[1],
                    "username": row[2],
                    "email": row[3],
                    "role": row[4],
                    "experience": row[5],
                    "portfolio": row[6],
                    "social": row[7],
                    "availability": row[8],
                    "whyJoin": row[9],
                    "status": row[10],
                    "reviewNote": row[11],
                    "createdAt": _utc(row[12]),
                    "reviewedAt": _utc(row[13]),
                }
                for row in rows
            ]
        }

    @app.post("/api/admin/media/applications/{application_id}")
    def review_media_application(application_id: int, body: MediaReviewBody, request: Request):
        actor = require_owner(request)
        status = body.status.strip().lower()
        with Session(engine) as db:
            row = db.get(MediaApplication, application_id)
            if row is None:
                raise HTTPException(status_code=404, detail="Media application not found.")
            row.status = status
            row.review_note = body.review_note.strip()
            row.reviewed_at = datetime.now(timezone.utc) if status != "pending" else None
            if status == "approved":
                db.execute(text("UPDATE users SET role='media' WHERE id=:user_id AND id!=:owner"), {"user_id": row.user_id, "owner": OWNER_ID})
            elif status == "rejected":
                db.execute(text("UPDATE users SET role='user' WHERE id=:user_id AND id!=:owner"), {"user_id": row.user_id, "owner": OWNER_ID})
            db.commit()
        return {"success": True, "applicationId": application_id, "status": status, "reviewedBy": actor.id}
