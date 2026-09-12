"""Vercel entrypoint for the NoContext FastAPI backend."""
from backend.app.main import app

__all__ = ["app"]
