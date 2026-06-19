"""SLA rule configuration endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_manager
from app.models import User, SLARule
from app.schemas import SLARuleCreate, SLARuleOut

router = APIRouter(prefix="/sla-rules", tags=["SLA Rules"])


@router.get("", response_model=list[SLARuleOut])
def list_rules(
    entity_type: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.sla_service import get_rules
    return get_rules(db, user.organization_id, entity_type=entity_type)


@router.post("", response_model=SLARuleOut)
def create_rule(
    body: SLARuleCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    from app.services.sla_service import create_rule as _create
    return _create(
        db, user.organization_id,
        name=body.name,
        entity_type=body.entity_type,
        sla_hours=body.sla_hours,
        condition_json=body.condition_json,
        escalate_to_user_id=body.escalate_to_user_id,
        escalate_via=body.escalate_via,
        action_on_breach=body.action_on_breach,
        escalation_action_key=body.escalation_action_key,
    )


@router.patch("/{rule_id}", response_model=SLARuleOut)
def update_rule(
    rule_id: str,
    body: SLARuleCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    rule = db.query(SLARule).filter(
        SLARule.id == rule_id,
        SLARule.organization_id == user.organization_id,
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="SLA rule not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(rule, k, v)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/{rule_id}", status_code=204)
def delete_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    rule = db.query(SLARule).filter(
        SLARule.id == rule_id,
        SLARule.organization_id == user.organization_id,
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="SLA rule not found")
    rule.active = False
    db.commit()


@router.post("/run-check")
def run_check(
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    """Manually trigger SLA check for this org."""
    from app.services.sla_service import run_sla_check
    return run_sla_check(db, user.organization_id)
