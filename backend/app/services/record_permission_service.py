"""Record-level permission service — fine-grained access control per entity."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.models import RecordPermission, PermissionLevel, User, UserRole


def grant(
    db: Session,
    org_id: str,
    entity_type: str,
    entity_id: str,
    permission: str,
    granted_by_user_id: str,
    user_id: str | None = None,
    role: str | None = None,
    expires_at: datetime | None = None,
) -> RecordPermission:
    perm = RecordPermission(
        organization_id=org_id,
        entity_type=entity_type,
        entity_id=entity_id,
        user_id=user_id,
        role=role,
        permission=PermissionLevel(permission),
        granted_by_user_id=granted_by_user_id,
        expires_at=expires_at,
    )
    db.add(perm)
    db.commit()
    db.refresh(perm)
    return perm


def revoke(
    db: Session,
    org_id: str,
    entity_type: str,
    entity_id: str,
    user_id: str | None = None,
    role: str | None = None,
) -> int:
    q = db.query(RecordPermission).filter(
        RecordPermission.organization_id == org_id,
        RecordPermission.entity_type == entity_type,
        RecordPermission.entity_id == entity_id,
    )
    if user_id:
        q = q.filter(RecordPermission.user_id == user_id)
    if role:
        q = q.filter(RecordPermission.role == role)
    count = q.delete()
    db.commit()
    return count


def list_permissions(
    db: Session,
    org_id: str,
    entity_type: str,
    entity_id: str,
) -> list[RecordPermission]:
    now = datetime.utcnow()
    return db.query(RecordPermission).filter(
        RecordPermission.organization_id == org_id,
        RecordPermission.entity_type == entity_type,
        RecordPermission.entity_id == entity_id,
        (RecordPermission.expires_at.is_(None)) | (RecordPermission.expires_at > now),
    ).all()


def check_permission(
    db: Session,
    user: User,
    entity_type: str,
    entity_id: str,
    required: str = "view",
) -> bool:
    """Returns True if user has at least the required permission on this record.

    Permission hierarchy: admin > delete > edit > view
    Managers and owners always have full access.
    """
    if user.role in (UserRole.owner, UserRole.manager):
        return True

    hierarchy = [
        PermissionLevel.view,
        PermissionLevel.edit,
        PermissionLevel.delete,
        PermissionLevel.admin,
    ]
    required_level = PermissionLevel(required)
    required_idx = hierarchy.index(required_level)

    now = datetime.utcnow()
    perms = db.query(RecordPermission).filter(
        RecordPermission.organization_id == user.organization_id,
        RecordPermission.entity_type == entity_type,
        RecordPermission.entity_id == entity_id,
        (RecordPermission.expires_at.is_(None)) | (RecordPermission.expires_at > now),
        (RecordPermission.user_id == user.id) | (RecordPermission.role == user.role.value),
    ).all()

    for perm in perms:
        perm_idx = hierarchy.index(perm.permission)
        if perm_idx >= required_idx:
            return True
    return False
