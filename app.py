"""Vercel entrypoint for the NoContext FastAPI application."""
from backend.app.main import app

__all__ = ["app"]
