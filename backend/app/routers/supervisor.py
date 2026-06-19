"""Agent supervisor dashboard endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_manager
from app.models import User
from app.schemas import ActionRunOut

router = APIRouter(prefix="/supervisor", tags=["Supervisor"])


@router.get("/stats")
def get_stats(
    since_hours: int = Query(default=24, le=168),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.supervisor_service import get_action_stats
    return get_action_stats(db, user.organization_id, since_hours=since_hours)


@router.get("/stuck", response_model=list[ActionRunOut])
def get_stuck_runs(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.supervisor_service import get_stuck_action_runs
    return get_stuck_action_runs(db, user.organization_id)


@router.get("/overdue-approvals")
def get_overdue_approvals(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.supervisor_service import get_overdue_approvals
    from app.schemas import ApprovalRequestOut
    items = get_overdue_approvals(db, user.organization_id)
    return items


@router.get("/inactive-leads")
def get_inactive_leads(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.supervisor_service import get_inactive_leads
    leads = get_inactive_leads(db, user.organization_id)
    return [{"id": l.id, "name": l.name, "status": l.status.value,
             "score": l.score, "last_updated": l.updated_at} for l in leads]


@router.post("/scan")
def trigger_scan(
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    """Manually trigger stuck-work scan for this org."""
    from app.services.supervisor_service import scan_and_escalate
    return scan_and_escalate(db, user.organization_id)
