from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db, set_org_context
from app.models import User, UserRole
from app.security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    user_id = decode_token(token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive or missing user")
    # Activate automatic tenant filter for the remainder of this request.
    set_org_context(user.organization_id)
    return user


def org_id(user: User = Depends(get_current_user)) -> str:
    return user.organization_id


def require_role(*roles: UserRole):
    """Parameterized dependency enforcing role-based access control.

    Usage:
        @router.delete("/{id}")
        def delete_lead(user: User = Depends(require_role(UserRole.owner, UserRole.manager))):
            ...
    """
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
