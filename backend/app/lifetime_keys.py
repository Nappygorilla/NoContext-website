from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.main import License

# Stored as SHA-256 hashes so the plaintext license keys are never committed to the website repo.
LIFETIME_KEYS = (
    ("LUNA-090DC9B5", "36d21dbd7b7ba7c2cbd4e2c553941d1bf894179200dc0a302cbb792cfbf2363f"),
    ("LUNA-435ED141", "068c33a2db5580d1f930d1a4f0707265d3411fc2fa12fe0f182823d52d00cc6e"),
    ("LUNA-A56A3081", "caa220d923c676fb34bfa3708e729e1c385b9ad15130763fb8dd675476978b74"),
    ("LUNA-A5C6ED5C", "8d71e2727602b35a0a1759e92e75635728d57710bfc46d6fbd8012207c373bdb"),
    ("LUNA-2C54D884", "6873e80e310e5ddab8fa0591631b040f760a7b21f9b7216e13bf8c405f14f3ee"),
    ("LUNA-F6A605C9", "31716d08d12a0f3928c525c831097487ed71e2674e3e27064f1c46548d1535f3"),
    ("LUNA-C87A7DC7", "9796a071a14df740a2a24257ae8b43d7473a2d8a32265b4cac9dad4049355d8f"),
    ("LUNA-81DC4FE6", "9a8f7640b0ad43a79c08d9eadcbc90db9c4d2c86542a8b7e180da37aba986e92"),
    ("LUNA-BE681C29", "07378676ddc1607e4225417d45c53f767ac806fcefd4092c24f840fd0aa98996"),
    ("LUNA-A9E6F6F4", "3caabf0314dfbe2eee58dcf642e433ed3cb2ac09ccb891cda76aff97f0e7a61e"),
    ("LUNA-7B81C5BF", "52a2f4dfce6845018172b257301aebb162bde35f5b53a4283d49fcdca21b3bc5"),
    ("LUNA-7FD58853", "b226a328c42d96e1971b232865b86a2e66568d5e4b93ca27a991f79ea612a62d"),
    ("LUNA-FE0A01CF", "8f846d58511abd5014c6dfb62db86fe0a331687d932447cdb3497bb81465cd4e"),
    ("LUNA-2F616A11", "d44966198e28afb28860184f55a2e69bda64a89eda3a06faed1bab3ac104c7b1"),
    ("LUNA-58C25D36", "bf6232d1fdaf046d6625cceae0159ac44c1e190323e2361b4ec7a2eaed55802e"),
)

LIFETIME_EXPIRES_AT = datetime(9999, 12, 31, 23, 59, 59, tzinfo=timezone.utc)


def ensure_lifetime_keys(engine, user_id: int = 1) -> int:
    """Idempotently add missing lifetime licenses without reactivating deactivated keys."""
    created = 0
    current = datetime.now(timezone.utc)
    with Session(engine) as db:
        for prefix, key_hash in LIFETIME_KEYS:
            existing = db.scalar(select(License).where(License.key_hash == key_hash))
            if existing is not None:
                continue
            db.add(
                License(
                    key_hash=key_hash,
                    key_prefix=prefix,
                    user_id=user_id,
                    product="Luna.win External",
                    status="active",
                    created_at=current,
                    expires_at=LIFETIME_EXPIRES_AT,
                )
            )
            created += 1
        db.commit()
    return created
