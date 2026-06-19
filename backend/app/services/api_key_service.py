"""API key management service.

Generates secure API keys, stores only a prefix (for display) and bcrypt hash
(for verification). The raw key is returned exactly once at creation and never
stored in plaintext.
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime

from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.models import ApiKey

_ctx = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

KEY_PREFIX = "mcrm_"


def _generate_raw_key() -> str:
    return KEY_PREFIX + secrets.token_urlsafe(32)


def create_api_key(
    db: Session,
    org_id: str,
    name: str,
    scopes: list[str],
    user_id: str | None = None,
    expires_at: datetime | None = None,
) -> tuple[ApiKey, str]:
    """Create a new API key. Returns (ApiKey row, raw_key). Store raw_key nowhere."""
    raw = _generate_raw_key()
    prefix = raw[:12]
    key_hash = _ctx.hash(raw)

    row = ApiKey(
        organization_id=org_id,
        user_id=user_id,
        name=name,
        key_prefix=prefix,
        key_hash=key_hash,
        scopes=scopes,
        expires_at=expires_at,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row, raw


def verify_api_key(db: Session, raw_key: str) -> ApiKey | None:
    """Verify a raw key and return the ApiKey row if valid."""
    if not raw_key.startswith(KEY_PREFIX):
        return None
    prefix = raw_key[:12]
    rows = db.query(ApiKey).filter(
        ApiKey.key_prefix == prefix,
        ApiKey.active == True,
    ).all()
    for row in rows:
        if _ctx.verify(raw_key, row.key_hash):
            if row.expires_at and row.expires_at < datetime.utcnow():
                return None
            row.last_used_at = datetime.utcnow()
            db.commit()
            return row
    return None


def revoke_api_key(db: Session, key_id: str, org_id: str) -> bool:
    row = db.query(ApiKey).filter(ApiKey.id == key_id, ApiKey.organization_id == org_id).first()
    if not row:
        return False
    row.active = False
    db.commit()
    return True
