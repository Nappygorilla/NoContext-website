from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request


BASE_URL = os.getenv("KEYAUTH_SELLER_URL", "https://keyauth.win/api/seller/").strip() or "https://keyauth.win/api/seller/"
SELLER_KEY = os.getenv("KEYAUTH_SELLER_KEY", "").strip()
EXTERNAL_LEVEL = os.getenv("KEYAUTH_EXTERNAL_LEVEL", "1").strip() or "1"
EXECUTOR_LEVEL = os.getenv("KEYAUTH_EXECUTOR_LEVEL", "2").strip() or "2"


def _request(params: dict[str, object]) -> dict:
    if not SELLER_KEY:
        raise RuntimeError("KEYAUTH_SELLER_KEY is not configured on the backend.")

    query = {"sellerkey": SELLER_KEY, **params}
    url = BASE_URL + ("&" if "?" in BASE_URL else "?") + urllib.parse.urlencode(query)
    request = urllib.request.Request(url, method="GET", headers={"Accept": "application/json", "User-Agent": "NoContext-KeyAuth-Bridge/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        try:
            detail = exc.read().decode("utf-8")[:500]
        except Exception:
            detail = ""
        raise RuntimeError(f"KeyAuth returned HTTP {exc.code}. {detail}".strip()) from exc
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise RuntimeError("KeyAuth is temporarily unavailable.") from exc

    if not isinstance(payload, dict) or not payload.get("success"):
        message = str((payload or {}).get("message") or "KeyAuth rejected the request.")
        raise RuntimeError(message)
    return payload


def _level_for_product(product: str) -> str:
    value = product.strip().lower()
    if "executor" in value:
        return EXECUTOR_LEVEL
    return EXTERNAL_LEVEL


def create_license(duration: str, product: str, note: str = "") -> dict:
    expiry = {"3d": "3", "7d": "7", "lifetime": "0"}.get(duration)
    if expiry is None:
        raise RuntimeError("Unsupported KeyAuth duration.")

    result = _request({
        "type": "add",
        "expiry": expiry,
        "level": _level_for_product(product),
        "amount": "1",
        "note": note[:500],
    })
    key = str(result.get("key") or "").strip()
    if not key:
        raise RuntimeError("KeyAuth created the license but did not return a key.")
    return {"key": key, "level": _level_for_product(product), "response": result}


def verify_license(key: str) -> bool:
    result = _request({"type": "verify", "key": key.strip()})
    return bool(result.get("success"))
