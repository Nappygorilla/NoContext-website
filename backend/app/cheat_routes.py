from __future__ import annotations
from datetime import datetime, timezone
from fastapi import HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, Integer, String, Text, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

OWNER_ID = 1
ALLOWED_STATUSES = {"online", "updating", "offline", "maintenance", "coming_soon"}

class CheatBase(DeclarativeBase):
    pass

class CheatStatus(CheatBase):
    __tablename__ = "cheat_statuses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(32), default="online", index=True)
    version: Mapped[str] = mapped_column(String(64), default="")
    note: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class CheatStatusUpdate(BaseModel):
    status: str = Field(min_length=2, max_length=32)
    version: str = Field(default="", max_length=64)
    note: str = Field(default="", max_length=500)

def register_cheat_routes(app, engine, session_from_request, require_csrf):
    CheatBase.metadata.create_all(engine)
    with Session(engine) as db:
        for slug, name, status in [
            ("external", "luna.win External", "online"),
            ("executor", "luna.win Executor", "coming_soon"),
        ]:
            if db.scalar(select(CheatStatus).where(CheatStatus.slug == slug)) is None:
                db.add(CheatStatus(slug=slug, name=name, status=status))
        db.commit()

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

    def as_json(item: CheatStatus):
        value = item.updated_at.replace(tzinfo=timezone.utc) if item.updated_at.tzinfo is None else item.updated_at
        return {
            "slug": item.slug,
            "name": item.name,
            "status": item.status,
            "version": item.version,
            "note": item.note,
            "updatedAt": value.astimezone(timezone.utc).isoformat(),
        }

    @app.get("/api/cheats/{slug}")
    def public_cheat_status(slug: str):
        with Session(engine) as db:
            item = db.scalar(select(CheatStatus).where(CheatStatus.slug == slug.lower().strip()))
            if not item:
                raise HTTPException(status_code=404, detail="Cheat not found.")
            return as_json(item)

    @app.get("/api/admin/cheats")
    def admin_cheats(request: Request):
        owner(request)
        with Session(engine) as db:
            items = db.scalars(select(CheatStatus).order_by(CheatStatus.id.asc())).all()
            return {
                "ownerId": OWNER_ID,
                "statuses": [as_json(item) for item in items],
                "allowedStatuses": sorted(ALLOWED_STATUSES),
            }

    @app.post("/api/admin/cheats/{slug}")
    def update_cheat_status(slug: str, body: CheatStatusUpdate, request: Request):
        owner_write(request)
        status = body.status.strip().lower()
        if status not in ALLOWED_STATUSES:
            raise HTTPException(status_code=422, detail="Invalid cheat status.")
        with Session(engine) as db:
            item = db.scalar(select(CheatStatus).where(CheatStatus.slug == slug.lower().strip()))
            if not item:
                raise HTTPException(status_code=404, detail="Cheat not found.")
            item.status = status
            item.version = body.version.strip()
            item.note = body.note.strip()
            item.updated_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(item)
            return as_json(item)

    from app.admin_user_routes import register_admin_user_routes
    register_admin_user_routes(app, engine, require_csrf, session_from_request)
    from app.workink_callback import register_workink_callback
    register_workink_callback(app, engine, session_from_request)
