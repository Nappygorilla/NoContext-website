from __future__ import annotations

import hashlib
import json
import os
import secrets
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import Boolean, DateTime, Integer, String, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column


class WorkInkCallbackBase(DeclarativeBase):
    pass


class WorkInkCallbackGrant(WorkInkCallbackBase):
    __tablename__ = "workink_grants"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    grant_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    used: Mapped[bool] = mapped_column(Boolean, default=False, index=True)


class WorkInkFlow(WorkInkCallbackBase):
    __tablename__ = "workink_flows"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    flow_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    used: Mapped[bool] = mapped_column(Boolean, default=False, index=True)


def register_workink_callback(app, engine, session_from_request):
    WorkInkCallbackBase.metadata.create_all(engine)

    def now():
        return datetime.now(timezone.utc)

    def token_hash(value: str) -> str:
        return hashlib.sha256(value.encode()).hexdigest()

    def workink_link_url() -> str:
        return os.getenv("WORKINK_LINK_URL", "").strip() or "https://work.ink/2WZq/no-context-key"

    def verify_workink_token(token: str):
        token = str(token or "").strip()
        if not token or len(token) > 256:
            raise HTTPException(status_code=400, detail="A valid Work.ink completion token is required.")
        safe_token = urllib.parse.quote(token, safe="")
        url = f"https://work.ink/_api/v2/token/isValid/{safe_token}?deleteToken=1"
        request = urllib.request.Request(url, method="GET", headers={"Accept": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                result = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            raise HTTPException(status_code=502, detail="Work.ink rejected the verification request. Please complete the Free Key link again.") from exc
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise HTTPException(status_code=502, detail="Work.ink verification is temporarily unavailable. Please try again.") from exc
        if not isinstance(result, dict) or not result.get("valid"):
            raise HTTPException(status_code=403, detail="Your Work.ink completion could not be verified. Please complete the Free Key link again.")
        configured_link_id = os.getenv("WORKINK_LINK_ID", "").strip()
        actual_link_id = str((result.get("info") or {}).get("linkId") or "")
        if configured_link_id.isdigit() and actual_link_id != configured_link_id:
            raise HTTPException(status_code=403, detail="That Work.ink token belongs to a different link.")
        return result

    def create_flow(user_id: int) -> str:
        flow = secrets.token_urlsafe(32)
        current = now()
        with Session(engine) as db:
            db.add(WorkInkFlow(
                flow_hash=token_hash(flow),
                user_id=user_id,
                created_at=current,
                expires_at=current + timedelta(minutes=15),
                used=False,
            ))
            db.commit()
        return flow

    def override_destination(flow: str) -> str:
        callback = "https://nocontext.onrender.com/api/keys/worklink/callback"
        destination = f"{callback}?flow={urllib.parse.quote(flow)}&token={{TOKEN}}"
        query = urllib.parse.urlencode({"destination": destination})
        request = urllib.request.Request(
            f"https://work.ink/_api/v2/override?{query}",
            method="GET",
            headers={"Accept": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                result = json.loads(response.read().decode("utf-8"))
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise HTTPException(status_code=502, detail="Unable to prepare the Work.ink account link. Please try again.") from exc
        sr = str(result.get("sr") or "").strip() if isinstance(result, dict) else ""
        if not sr:
            raise HTTPException(status_code=502, detail="Work.ink did not return a valid redirect configuration.")
        return sr

    @app.get("/api/keys/workink/start-linked")
    def workink_start_linked(request: Request):
        auth = session_from_request(request)
        if not auth:
            raise HTTPException(status_code=401, detail="Please sign in before getting a free key.")
        _, user = auth
        flow = create_flow(user.id)
        sr = override_destination(flow)
        link = workink_link_url()
        separator = "&" if "?" in link else "?"
        return RedirectResponse(link + separator + "sr=" + urllib.parse.quote(sr), status_code=302)

    def handle_callback(token: str, request: Request, flow: str | None):
        selected_user_id = None
        if flow:
            flow_value = str(flow).strip()
            if len(flow_value) > 256:
                raise HTTPException(status_code=400, detail="Invalid Work.ink flow.")
            current = now()
            with Session(engine) as db:
                flow_row = db.scalar(
                    select(WorkInkFlow).where(
                        WorkInkFlow.flow_hash == token_hash(flow_value),
                        WorkInkFlow.used.is_(False),
                        WorkInkFlow.expires_at > current,
                    )
                )
                if not flow_row:
                    raise HTTPException(status_code=403, detail="Your Work.ink account link expired. Please start the Free Key process again.")
                selected_user_id = flow_row.user_id
                flow_row.used = True
                db.commit()

        if selected_user_id is None:
            auth = session_from_request(request)
            if not auth:
                frontend = os.getenv("FRONTEND_ORIGIN", "https://nappygorilla.github.io").rstrip("/")
                return RedirectResponse(frontend + "/NoContext-website/login/?next=/NoContext-website/key/", status_code=302)
            _, user = auth
            selected_user_id = user.id

        verify_workink_token(token)
        grant = secrets.token_urlsafe(32)
        current = now()
        with Session(engine) as db:
            db.add(WorkInkCallbackGrant(
                grant_hash=token_hash(grant),
                user_id=selected_user_id,
                created_at=current,
                expires_at=current + timedelta(minutes=10),
                used=False,
            ))
            db.commit()

        frontend = os.getenv("FRONTEND_ORIGIN", "https://nappygorilla.github.io").rstrip("/")
        return RedirectResponse(
            frontend + "/NoContext-website/key.html?grant=" + urllib.parse.quote(grant),
            status_code=302,
        )

    @app.get("/api/keys/workink/callback")
    def workink_callback(token: str, request: Request, flow: str | None = None):
        return handle_callback(token, request, flow)

    @app.get("/api/keys/worklink/callback")
    def worklink_callback(token: str, request: Request, flow: str | None = None):
        return handle_callback(token, request, flow)
