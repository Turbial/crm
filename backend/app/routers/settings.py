"""Organization settings, pipeline stages, SLA rules management."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.deps import get_current_user, require_manager
from app.models import User, Organization, SLARule, RiskLevel

router = APIRouter(prefix="/settings", tags=["Settings"])


class OrgSettingsUpdate(BaseModel):
    name: Optional[str] = None
    website: Optional[str] = None
    industry: Optional[str] = None


class SLARuleCreate(BaseModel):
    entity_type: str
    field_name: str
    threshold_hours: float
    risk_level: str = "medium"
    action_type: str = "notify"
    action_payload: Optional[dict] = None


class SLARuleOut(BaseModel):
    id: str
    entity_type: str
    field_name: str
    threshold_hours: float
    risk_level: str
    action_type: str
    action_payload: Optional[dict]
    is_active: bool

    class Config:
        from_attributes = True


@router.get("/org")
def get_org_settings(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return {
        "id": org.id,
        "name": org.name,
        "website": getattr(org, "website", None),
        "industry": getattr(org, "industry", None),
        "plan": getattr(org, "plan", "starter"),
    }


@router.patch("/org")
def update_org_settings(
    body: OrgSettingsUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    for field, val in body.model_dump(exclude_none=True).items():
        if hasattr(org, field):
            setattr(org, field, val)
    db.commit()
    db.refresh(org)
    return {"id": org.id, "name": org.name}


@router.get("/sla-rules", response_model=list[SLARuleOut])
def list_sla_rules(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return db.query(SLARule).filter(
        SLARule.organization_id == user.organization_id,
    ).order_by(SLARule.entity_type, SLARule.threshold_hours).all()


@router.post("/sla-rules", response_model=SLARuleOut, status_code=201)
def create_sla_rule(
    body: SLARuleCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    try:
        risk = RiskLevel(body.risk_level)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid risk_level: {body.risk_level}")

    rule = SLARule(
        organization_id=user.organization_id,
        entity_type=body.entity_type,
        field_name=body.field_name,
        threshold_hours=body.threshold_hours,
        risk_level=risk,
        action_type=body.action_type,
        action_payload=body.action_payload or {},
        is_active=True,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.patch("/sla-rules/{rule_id}")
def update_sla_rule(
    rule_id: str,
    body: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    rule = db.query(SLARule).filter(
        SLARule.id == rule_id,
        SLARule.organization_id == user.organization_id,
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="SLA rule not found")
    for k, v in body.items():
        if hasattr(rule, k) and k not in ("id", "organization_id"):
            setattr(rule, k, v)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/sla-rules/{rule_id}", status_code=204)
def delete_sla_rule(
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
    db.delete(rule)
    db.commit()
