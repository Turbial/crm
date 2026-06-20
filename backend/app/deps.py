from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db, set_org_context
from app.models import User, UserRole, ApiKey
from app.security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

_KEY_PREFIX = "mcrm_"


def _resolve_user_from_api_key(raw_key: str, db: Session) -> User:
    """Authenticate via API key and return a User with scope info attached."""
    from app.services.api_key_service import verify_api_key
    api_key = verify_api_key(db, raw_key)
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired API key",
        )
    # Prefer the key's bound user; fall back to the org owner.
    user: User | None = None
    if api_key.user_id:
        user = db.get(User, api_key.user_id)
    if not user:
        user = (
            db.query(User)
            .filter(
                User.organization_id == api_key.organization_id,
                User.role == UserRole.owner,
                User.is_active == True,
            )
            .first()
        )
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No active user for API key")
    # Attach scopes so downstream can call require_scope().
    user._api_key_scopes = api_key.scopes  # type: ignore[attr-defined]
    return user


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    x_api_key: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    """Accept either a JWT bearer token or an API key (header or bearer)."""
    raw = token or x_api_key or ""

    if raw.startswith(_KEY_PREFIX):
        user = _resolve_user_from_api_key(raw, db)
    else:
        if not raw:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user_id = decode_token(raw)
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        user = db.get(User, user_id)
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive or missing user")

    set_org_context(user.organization_id)
    return user


def require_scope(scope: str):
    """Dependency that enforces an API key scope when the request came via API key.

    JWT-authenticated users pass unconditionally (they have full access).
    API key users must have the scope in their key's scope list, OR an empty
    scope list (empty = unrestricted key).
    """
    def _dep(user: User = Depends(get_current_user)) -> User:
        scopes: list[str] = getattr(user, "_api_key_scopes", None)  # type: ignore[attr-defined]
        if scopes is None:
            # JWT auth — full access.
            return user
        if scopes and scope not in scopes:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"API key missing required scope: {scope}",
            )
        return user
    return _dep


def org_id(user: User = Depends(get_current_user)) -> str:
    return user.organization_id


def require_role(*roles: UserRole):
    """Parameterized dependency enforcing role-based access control."""
    def _dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role.value}' is not permitted for this action",
            )
        return user
    return _dep


# Convenience shortcuts used throughout the routers
require_owner = require_role(UserRole.owner)
require_manager = require_role(UserRole.owner, UserRole.manager)
require_staff = require_role(UserRole.owner, UserRole.manager, UserRole.employee)
