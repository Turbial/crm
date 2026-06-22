"""Action run ledger endpoints — observe and control action execution."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_manager
from app.models import User, ActionRun, ActionStatus, ActionDefinition
from app.schemas import ActionRunOut, ActionDefinitionOut

router = APIRouter(prefix="/action-runs", tags=["Action Runs"])


@router.get("", response_model=list[ActionRunOut])
def list_runs(
    action_key: str | None = Query(default=None),
    status: str | None = Query(default=None),
    linked_entity_type: str | None = Query(default=None),
    linked_entity_id: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(ActionRun).filter(ActionRun.organization_id == user.organization_id)
    if action_key:
        q = q.filter(ActionRun.action_key == action_key)
    if status:
        q = q.filter(ActionRun.status == status)
    if linked_entity_type:
        q = q.filter(ActionRun.linked_entity_type == linked_entity_type)
    if linked_entity_id:
        q = q.filter(ActionRun.linked_entity_id == linked_entity_id)
    return q.order_by(ActionRun.created_at.desc()).offset(offset).limit(limit).all()


@router.get("/definitions", response_model=list[ActionDefinitionOut])
def list_definitions(
    category: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.action_registry import list_definitions as _list
    return _list(db, user.organization_id, category=category)


@router.get("/{run_id}", response_model=ActionRunOut)
def get_run(
    run_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    run = db.query(ActionRun).filter(
        ActionRun.id == run_id,
        ActionRun.organization_id == user.organization_id,
    ).first()
    if not run:
        raise HTTPException(status_code=404, detail="Action run not found")
    return run


@router.post("/{run_id}/cancel", response_model=ActionRunOut)
def cancel_run(
    run_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    run = db.query(ActionRun).filter(
        ActionRun.id == run_id,
        ActionRun.organization_id == user.organization_id,
    ).first()
    if not run:
        raise HTTPException(status_code=404, detail="Action run not found")
    if run.status not in (ActionStatus.pending, ActionStatus.running, ActionStatus.waiting_approval):
        raise HTTPException(status_code=400, detail=f"Cannot cancel run in status '{run.status}'")
    run.status = ActionStatus.cancelled
    db.commit()
    db.refresh(run)
    return run


@router.post("", response_model=ActionRunOut)
def create_run(
    action_key: str,
    input_payload: dict,
    linked_entity_type: str | None = None,
    linked_entity_id: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Manually trigger an action run from the UI."""
    from app.services.action_registry import create_action_run
    run = create_action_run(
        db, user.organization_id, action_key, source="ui",
        input_payload=input_payload,
        requested_by_type="human", requested_by_id=user.id,
        linked_entity_type=linked_entity_type,
        linked_entity_id=linked_entity_id,
    )
    return run
