"""Vercel entrypoint for the NoContext FastAPI application."""
from backend.app.main import app, engine, enforce_origin, rate_limit, require_csrf, session_from_request
from backend.app.ticket_routes import register_ticket_routes

register_ticket_routes(app, engine, require_csrf, session_from_request, enforce_origin, rate_limit)

__all__ = ["app"]
