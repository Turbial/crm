from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from typing import Optional
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user, require_manager
from app.models import User, Organization, UserRole
from app.schemas import OrganizationOut
from app.security import hash_password

router = APIRouter(prefix="/organizations", tags=["organizations"])

_ROLE_RANK = {UserRole.owner: 3, UserRole.manager: 2, UserRole.employee: 1, UserRole.agent: 0}


class MemberOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class MemberInvite(BaseModel):
    name: str
    email: str
    password: str
    role: str = "employee"


class MemberUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("/current", response_model=OrganizationOut)
def current_org(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.get(Organization, user.organization_id)


@router.get("/me", response_model=OrganizationOut)
def me_org(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.get(Organization, user.organization_id)


@router.get("/me/members", response_model=list[MemberOut])
def list_members(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(User)
        .filter(User.organization_id == user.organization_id)
        .order_by(User.created_at.asc())
        .all()
    )


@router.post("/me/members", response_model=MemberOut)
def invite_member(
    body: MemberInvite,
    user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(409, "A user with this email already exists")

    try:
        role = UserRole(body.role)
    except ValueError:
        raise HTTPException(422, f"Invalid role: {body.role}")

    if user.role != UserRole.owner and _ROLE_RANK.get(role, 0) >= _ROLE_RANK[UserRole.manager]:
        raise HTTPException(403, "Managers cannot invite users with manager or owner roles")

    from app.config import settings as cfg
    if len(body.password) < cfg.password_min_length:
        raise HTTPException(422, f"Password must be at least {cfg.password_min_length} characters")

    new_user = User(
        organization_id=user.organization_id,
        name=body.name,
        email=body.email,
        password_hash=hash_password(body.password),
        role=role,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.patch("/me/members/{member_id}", response_model=MemberOut)
def update_member(
    member_id: str,
    body: MemberUpdate,
    user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    member = db.query(User).filter(
        User.id == member_id,
        User.organization_id == user.organization_id,
    ).first()
    if not member:
        raise HTTPException(404, "Member not found")

    # Managers cannot modify owners or other managers
    if user.role != UserRole.owner and _ROLE_RANK.get(member.role, 0) >= _ROLE_RANK[UserRole.manager]:
        raise HTTPException(403, "Managers cannot modify owner or manager accounts")

    if body.role is not None:
        try:
            new_role = UserRole(body.role)
        except ValueError:
            raise HTTPException(422, f"Invalid role: {body.role}")
        if user.role != UserRole.owner and _ROLE_RANK.get(new_role, 0) >= _ROLE_RANK[UserRole.manager]:
            raise HTTPException(403, "Managers cannot assign manager or owner roles")
        member.role = new_role

    if body.is_active is not None:
        member.is_active = body.is_active

    db.commit()
    db.refresh(member)
    return member
