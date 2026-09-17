from __future__ import annotations

import base64
import json
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

REPO = os.getenv("NOCONTEXT_KEYS_GITHUB_REPO", "Nappygorilla/NoContext-Keys").strip()
BRANCH = os.getenv("NOCONTEXT_KEYS_GITHUB_BRANCH", "main").strip() or "main"
TOKEN = os.getenv("NOCONTEXT_KEYS_GITHUB_TOKEN", "").strip()
INTERVAL_SECONDS = max(60, int(os.getenv("NOCONTEXT_KEYS_SYNC_INTERVAL", "300")))

SECTION_FILES = {
    "3d": "keys/3-day.json",
    "7d": "keys/1-week.json",
    "lifetime": "keys/lifetime.json",
}

_sync_lock = threading.Lock()
_started = False


def _now():
    return datetime.now(timezone.utc)


def _utc(value):
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _bucket(created_at, expires_at):
    created = _utc(created_at)
    expires = _utc(expires_at)
    if created is None or expires is None:
        return None
    if expires.year >= 9999:
        return "lifetime"
    duration_days = (expires - created).total_seconds() / 86400
    if duration_days <= 4:
        return "3d"
    if duration_days <= 8:
        return "7d"
    return None


def _request(method: str, url: str, body: dict | None = None):
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {TOKEN}",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "NoContext-Key-Sync",
    }
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = response.read().decode("utf-8")
            return json.loads(payload) if payload else {}
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"GitHub API {exc.code}: {details[:300]}") from exc


def _github_url(path: str) -> str:
    encoded = "/".join(urllib.parse.quote(part, safe="") for part in path.split("/"))
    return f"https://api.github.com/repos/{REPO}/{encoded}"


def sync_license_repo(engine) -> bool:
    """Synchronize active DB license hashes into the public NoContext-Keys index."""
    if not TOKEN:
        return False
    if not REPO or "/" not in REPO:
        return False
    with _sync_lock:
        with Session(engine) as db:
            rows = db.execute(text("""
                SELECT key_hash, key_prefix, product, status, created_at, expires_at
                FROM licenses
                ORDER BY expires_at ASC, id ASC
            """)).mappings().all()

        current = _now()
        sections = {key: [] for key in SECTION_FILES}
        for row in rows:
            expires = _utc(row["expires_at"])
            if not expires or row["status"] != "active" or expires <= current:
                continue
            bucket = _bucket(row["created_at"], expires)
            if bucket is None:
                continue
            sections[bucket].append({
                "hash": row["key_hash"],
                "prefix": row["key_prefix"],
                "product": row["product"],
                "status": "active",
                "createdAt": _utc(row["created_at"]).isoformat(),
                "expiresAt": expires.isoformat(),
            })

        generated_at = current.isoformat()
        files = {}
        for bucket, path in SECTION_FILES.items():
            files[path] = json.dumps({
                "version": 1,
                "duration": bucket,
                "generatedAt": generated_at,
                "keys": sections[bucket],
            }, indent=2) + "\n"
        files["keys/index.json"] = json.dumps({
            "version": 1,
            "repository": "NoContext-Keys",
            "generatedAt": generated_at,
            "algorithm": "sha256",
            "sections": {
                bucket: {
                    "file": SECTION_FILES[bucket],
                    "activeCount": len(sections[bucket]),
                }
                for bucket in SECTION_FILES
            },
        }, indent=2) + "\n"

        ref = _request("GET", f"https://api.github.com/repos/{REPO}/git/ref/heads/{urllib.parse.quote(BRANCH, safe='')}")
        parent_sha = ref["object"]["sha"]
        parent_commit = _request("GET", f"https://api.github.com/repos/{REPO}/git/commits/{parent_sha}")
        base_tree = parent_commit["tree"]["sha"]

        tree_entries = []
        for path, content in files.items():
            blob = _request("POST", f"https://api.github.com/repos/{REPO}/git/blobs", {
                "content": base64.b64encode(content.encode("utf-8")).decode("ascii"),
                "encoding": "base64",
            })
            tree_entries.append({"path": path, "mode": "100644", "type": "blob", "sha": blob["sha"]})

        tree = _request("POST", f"https://api.github.com/repos/{REPO}/git/trees", {
            "base_tree": base_tree,
            "tree": tree_entries,
        })
        commit = _request("POST", f"https://api.github.com/repos/{REPO}/git/commits", {
            "message": "Sync active NoContext license index",
            "tree": tree["sha"],
            "parents": [parent_sha],
        })
        _request("PATCH", f"https://api.github.com/repos/{REPO}/git/refs/heads/{urllib.parse.quote(BRANCH, safe='')}", {
            "sha": commit["sha"],
            "force": False,
        })
        return True


def start_license_repo_sync(engine):
    global _started
    if _started or not TOKEN:
        return
    _started = True

    def worker():
        while True:
            try:
                sync_license_repo(engine)
            except Exception:
                # License validation remains database-backed if GitHub is unavailable.
                pass
            time.sleep(INTERVAL_SECONDS)

    thread = threading.Thread(target=worker, name="nocontext-license-sync", daemon=True)
    thread.start()
