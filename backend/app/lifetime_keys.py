from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.main import License

# Stored as SHA-256 hashes so the plaintext license keys are never committed to the website repo.
LIFETIME_KEYS = (
    ("NC-090DC9B5", "f402344a562103cbbf75cc9ff6ceeaffd93a85976e12731266c830399d2df5d3"),
    ("NC-435ED141", "0fa6eedbdb5e92e6eb884c9723dda1fd6b2557bb2a79714ff8fd708196d33d5e"),
    ("NC-A56A3081", "25c5ce81a6ffb38fde515ca3f2b8549f253f2be39a414b284e059bfb4d5c3f42"),
    ("NC-A5C6ED5C", "1db0876764c3a1fc19e605f4358a16a056325c1de8a31aa44c75efd560052510"),
    ("NC-2C54D884", "77aab1100bb7db55b48ee328c0da26f7bd66f3270d7b55eb0fb45a3f1d359bc7"),
    ("NC-F6A605C9", "99c8a0d9208010fad368344cd477d9a0a4ad440e45617405adfa4b6afaf350c9"),
    ("NC-C87A7DC7", "43c3e1f96d3424e42bf6aa8bc41767488bdca203ec551b46bd6518514c86c2a3"),
    ("NC-81DC4FE6", "e308e7a5eca86127d9c3a84913faa284fcb36c31c5800ac331cc06af5482ed6d"),
    ("NC-BE681C29", "1fc08d68d503942e707b54b1651701ff953bf4b4aa641ab5d5a8fe40a1e2ae6a"),
    ("NC-A9E6F6F4", "3d7396951780df00d7d9b51d8e2f6c80479d13f85193dc210610390c2a498686"),
    ("NC-7B81C5BF", "9f4d8c2a43fb1c9197f3d470acaac68e761aa3089a95f64bf3cbf2c72f561fa6"),
    ("NC-7FD58853", "932975b02807f3fddf364c16c84e2a212b2a31a23f6f86f09b97dd4f77c88129"),
    ("NC-FE0A01CF", "507f2bf302f171955b09cbbd352609ffd170a6e7039ed6a1277db8eb859435df"),
    ("NC-2F616A11", "2579fd848f9d83bd13f389e6eff7dbd596c9b8ab311b8259f6f5213b67cc19c3"),
    ("NC-58C25D36", "22c734e21a3c46f15cef61b67e49b644cbe9e2fac5237d5ecd95a426fb057431"),
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
                    product="NoContext External",
                    status="active",
                    created_at=current,
                    expires_at=LIFETIME_EXPIRES_AT,
                )
            )
            created += 1
        db.commit()
    return created
