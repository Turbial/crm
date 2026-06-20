from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user, require_manager
from app.models import User, Organization
from app.schemas import OrganizationOut
from app.security import hash_password

router = APIRouter(prefix="/organizations", tags=["organizations"])


class MemberOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    is_active: bool

    class Config:
        from_attributes = True


class MemberInvite(BaseModel):
    name: str
    email: str
    password: str
    role: str = "employee"


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

    from app.models import UserRole
    try:
        role = UserRole(body.role)
    except ValueError:
        raise HTTPException(422, f"Invalid role: {body.role}")

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
    body: dict,
    user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    member = db.query(User).filter(
        User.id == member_id,
        User.organization_id == user.organization_id,
    ).first()
    if not member:
        raise HTTPException(404, "Member not found")

    if "role" in body:
        from app.models import UserRole
        try:
            body["role"] = UserRole(body["role"])
        except ValueError:
            raise HTTPException(422, f"Invalid role: {body['role']}")

    for k, v in body.items():
        if k not in ("id", "organization_id", "password_hash", "email"):
            setattr(member, k, v)
    db.commit()
    db.refresh(member)
    return member
