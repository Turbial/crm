"""Approval request endpoints — queue, view, approve, reject."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_manager
from app.models import User, ApprovalRequest, ActionApprovalStatus
from app.schemas import ApprovalRequestOut

router = APIRouter(prefix="/approvals", tags=["Approvals"])


@router.get("", response_model=list[ApprovalRequestOut])
def list_approvals(
    status: str | None = Query(default=None),
    entity_type: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(ApprovalRequest).filter(
        ApprovalRequest.organization_id == user.organization_id,
    )
    if status:
        q = q.filter(ApprovalRequest.status == status)
    if entity_type:
        q = q.filter(ApprovalRequest.entity_type == entity_type)
    return q.order_by(ApprovalRequest.created_at.desc()).offset(offset).limit(limit).all()


@router.get("/pending", response_model=list[ApprovalRequestOut])
def pending_for_me(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Approvals assigned to this user or unassigned (any manager can act)."""
    q = db.query(ApprovalRequest).filter(
        ApprovalRequest.organization_id == user.organization_id,
        ApprovalRequest.status == ActionApprovalStatus.pending,
    )
    return q.order_by(ApprovalRequest.created_at.asc()).all()


@router.get("/{approval_id}", response_model=ApprovalRequestOut)
def get_approval(
    approval_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    approval = db.query(ApprovalRequest).filter(
        ApprovalRequest.id == approval_id,
        ApprovalRequest.organization_id == user.organization_id,
    ).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    return approval


@router.post("/{approval_id}/approve", response_model=ApprovalRequestOut)
def approve(
    approval_id: str,
    note: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    from app.services.action_registry import resolve_approval
    approval = resolve_approval(db, approval_id, user.organization_id,
                                decision="approved", note=note, user_id=user.id)
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    return approval


@router.post("/{approval_id}/reject", response_model=ApprovalRequestOut)
def reject(
    approval_id: str,
    note: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    from app.services.action_registry import resolve_approval
    approval = resolve_approval(db, approval_id, user.organization_id,
                                decision="rejected", note=note, user_id=user.id)
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    return approval
