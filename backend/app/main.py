from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import time
from datetime import datetime, timedelta, timezone
from email_validator import EmailNotValidError, validate_email

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, Integer, String, create_engine, select, text
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./nocontext.db")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "https://nappygorilla.github.io/NoContext-website").rstrip("/")
SESSION_TTL_DAYS = int(os.getenv("SESSION_TTL_DAYS", "30"))
LICENSE_TTL_DAYS = int(os.getenv("LICENSE_TTL_DAYS", "30"))
SESSION_COOKIE = "__Host-nocontext_session"

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(512))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class SessionRecord(Base):
    __tablename__ = "sessions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    csrf_hash: Mapped[str] = mapped_column(String(64))
    user_id: Mapped[int] = mapped_column(Integer, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class RateLimit(Base):
    __tablename__ = "rate_limits"
    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    window_started: Mapped[int] = mapped_column(Integer)
    attempts: Mapped[int] = mapped_column(Integer, default=0)


class License(Base):
    __tablename__ = "licenses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    key_prefix: Mapped[str] = mapped_column(String(24), index=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True)
    product: Mapped[str] = mapped_column(String(64), default="NoContext External")
    status: Mapped[str] = mapped_column(String(16), default="active", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


Base.metadata.create_all(engine)
password_hasher = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)

app = FastAPI(title="NoContext API", version="1.1.0", docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRF-Token"],
)


class RegisterBody(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_]+$")
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=12, max_length=128)


class LoginBody(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=128)


class LicenseGenerateBody(BaseModel):
    product: str = Field(default="NoContext External", min_length=1, max_length=64)


class LicenseValidateBody(BaseModel):
    key: str = Field(min_length=16, max_length=128)
    product: str = Field(default="NoContext External", min_length=1, max_length=64)


def now() -> datetime:
    return datetime.now(timezone.utc)


def normalize_email(value: str) -> str:
    try:
        return validate_email(value.strip(), check_deliverability=False).normalized.lower()
    except EmailNotValidError as exc:
        raise HTTPException(status_code=400, detail="Enter a valid email address.") from exc


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def new_token() -> str:
    return secrets.token_urlsafe(32)


def new_license_key() -> str:
    parts = [secrets.token_hex(4).upper() for _ in range(4)]
    return "NC-" + "-".join(parts)


def client_ip(request: Request) -> str:
    return request.headers.get("CF-Connecting-IP") or (request.client.host if request.client else "unknown")


def enforce_origin(request: Request) -> None:
    origin = request.headers.get("Origin")
    if origin and origin.rstrip("/") != FRONTEND_ORIGIN:
        raise HTTPException(status_code=403, detail="Origin not allowed.")


def rate_limit(request: Request, bucket: str, limit: int, window: int = 900) -> None:
    key = f"{bucket}:{client_ip(request)}"
    current = int(time.time())
    with Session(engine) as db:
        row = db.get(RateLimit, key)
        if row is None or current - row.window_started >= window:
            if row is None:
                db.add(RateLimit(key=key, window_started=current, attempts=1))
            else:
                row.window_started = current
                row.attempts = 1
        else:
            row.attempts += 1
            if row.attempts > limit:
                db.commit()
                raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")
        db.commit()


def session_from_request(request: Request) -> tuple[SessionRecord, User] | None:
    raw = request.cookies.get(SESSION_COOKIE)
    if not raw or len(raw) > 256:
        return None
    with Session(engine) as db:
        record = db.scalar(select(SessionRecord).where(SessionRecord.token_hash == token_hash(raw)))
        if not record or record.expires_at <= now():
            return None
        user = db.get(User, record.user_id)
        if not user:
            return None
        return record, user


def set_session(response: Response, user_id: int) -> str:
    raw_session = new_token()
    raw_csrf = new_token()
    expires = now() + timedelta(days=SESSION_TTL_DAYS)
    with Session(engine) as db:
        db.add(SessionRecord(token_hash=token_hash(raw_session), csrf_hash=token_hash(raw_csrf), user_id=user_id, expires_at=expires))
        db.commit()
    response.set_cookie(SESSION_COOKIE, raw_session, max_age=SESSION_TTL_DAYS * 86400, expires=expires, secure=True, httponly=True, samesite="none", path="/")
    return raw_csrf


def rotate_csrf(record_id: int) -> str:
    raw_csrf = new_token()
    with Session(engine) as db:
        record = db.get(SessionRecord, record_id)
        if not record:
            raise HTTPException(status_code=401, detail="Not signed in.")
        record.csrf_hash = token_hash(raw_csrf)
        db.commit()
    return raw_csrf


def require_csrf(request: Request) -> tuple[SessionRecord, User]:
    enforce_origin(request)
    auth = session_from_request(request)
    if not auth:
        raise HTTPException(status_code=401, detail="Not signed in.")
    record, user = auth
    provided = request.headers.get("X-CSRF-Token", "")
    if not provided or not hmac.compare_digest(token_hash(provided), record.csrf_hash):
        raise HTTPException(status_code=403, detail="Invalid CSRF token.")
    return record, user


@app.get("/api/health")
def health() -> dict[str, str]:
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ok"}


@app.post("/api/auth/register", status_code=201)
def register(body: RegisterBody, request: Request, response: Response):
    enforce_origin(request)
    rate_limit(request, "register", 8)
    email = normalize_email(body.email)
    username = body.username.strip()
    with Session(engine) as db:
        exists = db.scalar(select(User).where((User.email == email) | (User.username == username)))
        if exists:
            raise HTTPException(status_code=409, detail="That account information is already in use.")
        user = User(username=username, email=email, password_hash=password_hasher.hash(body.password))
        db.add(user)
        db.commit()
        db.refresh(user)
        user_data = {"id": user.id, "username": user.username, "email": user.email}
    csrf = set_session(response, user_data["id"])
    return {"user": user_data, "csrfToken": csrf}


@app.post("/api/auth/login")
def login(body: LoginBody, request: Request, response: Response):
    enforce_origin(request)
    rate_limit(request, "login", 10)
    email = normalize_email(body.email)
    with Session(engine) as db:
        user = db.scalar(select(User).where(User.email == email))
        valid = False
        if user:
            try:
                valid = password_hasher.verify(user.password_hash, body.password)
            except (VerifyMismatchError, VerificationError):
                valid = False
        if not user or not valid:
            raise HTTPException(status_code=401, detail="Invalid email or password.")
        user_data = {"id": user.id, "username": user.username, "email": user.email}
    csrf = set_session(response, user_data["id"])
    return {"user": user_data, "csrfToken": csrf}


@app.get("/api/auth/me")
def me(request: Request):
    auth = session_from_request(request)
    if not auth:
        return {"authenticated": False}
    record, user = auth
    csrf = rotate_csrf(record.id)
    return {"authenticated": True, "user": {"id": user.id, "username": user.username, "email": user.email}, "csrfToken": csrf, "sessionExpiresAt": record.expires_at.isoformat()}


@app.post("/api/auth/logout")
def logout(request: Request, response: Response):
    record, _ = require_csrf(request)
    with Session(engine) as db:
        db.delete(record)
        db.commit()
    response.delete_cookie(SESSION_COOKIE, secure=True, httponly=True, samesite="none", path="/")
    response.headers["Clear-Site-Data"] = '"cache", "storage"'
    return {"success": True}


@app.post("/api/licenses/generate", status_code=201)
def generate_license(body: LicenseGenerateBody, request: Request):
    _, user = require_csrf(request)
    rate_limit(request, "license-generate", 5)
    plain_key = new_license_key()
    expires = now() + timedelta(days=LICENSE_TTL_DAYS)
    with Session(engine) as db:
        license_record = License(
            key_hash=token_hash(plain_key),
            key_prefix=plain_key[:11],
            user_id=user.id,
            product=body.product.strip(),
            status="active",
            expires_at=expires,
        )
        db.add(license_record)
        db.commit()
    return {
        "success": True,
        "key": plain_key,
        "product": body.product.strip(),
        "status": "active",
        "expiresAt": expires.isoformat(),
    }


@app.get("/api/licenses")
def list_licenses(request: Request):
    auth = session_from_request(request)
    if not auth:
        raise HTTPException(status_code=401, detail="Not signed in.")
    _, user = auth
    with Session(engine) as db:
        rows = db.scalars(select(License).where(License.user_id == user.id).order_by(License.id.desc())).all()
        return {
            "licenses": [
                {
                    "id": row.id,
                    "keyPrefix": row.key_prefix,
                    "product": row.product,
                    "status": "expired" if row.expires_at <= now() and row.status == "active" else row.status,
                    "createdAt": row.created_at.isoformat(),
                    "expiresAt": row.expires_at.isoformat(),
                }
                for row in rows
            ]
        }


@app.post("/api/licenses/validate")
def validate_license(body: LicenseValidateBody, request: Request):
    rate_limit(request, "license-validate", 60, 60)
    key = body.key.strip().upper()
    with Session(engine) as db:
        row = db.scalar(select(License).where(License.key_hash == token_hash(key)))
        if not row:
            raise HTTPException(status_code=404, detail="Invalid license key.")
        if row.product != body.product.strip():
            raise HTTPException(status_code=403, detail="License does not match this product.")
        if row.status != "active":
            raise HTTPException(status_code=403, detail="License is not active.")
        current = now()
        if row.expires_at <= current:
            row.status = "expired"
            db.commit()
            raise HTTPException(status_code=403, detail="License has expired.")
        if row.activated_at is None:
            row.activated_at = current
        row.last_seen_at = current
        db.commit()
        return {
            "valid": True,
            "product": row.product,
            "status": row.status,
            "expiresAt": row.expires_at.isoformat(),
            "activatedAt": row.activated_at.isoformat() if row.activated_at else None,
        }
