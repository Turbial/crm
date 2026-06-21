"""Organization settings, pipeline stages, SLA rules management."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.deps import get_current_user, require_manager
from app.models import User, Organization, SLARule
from app.schemas import SLARuleCreate, SLARuleOut

router = APIRouter(prefix="/settings", tags=["Settings"])


class OrgSettingsUpdate(BaseModel):
    name: Optional[str] = None
    website: Optional[str] = None
    industry: Optional[str] = None


class SLARuleUpdate(BaseModel):
    name: Optional[str] = None
    entity_type: Optional[str] = None
    sla_hours: Optional[float] = None
    escalate_via: Optional[str] = None
    action_on_breach: Optional[str] = None
    active: Optional[bool] = None


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
    ).order_by(SLARule.entity_type, SLARule.sla_hours).all()


@router.post("/sla-rules", response_model=SLARuleOut, status_code=201)
def create_sla_rule(
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


@router.patch("/sla-rules/{rule_id}", response_model=SLARuleOut)
def update_sla_rule(
    rule_id: str,
    body: SLARuleUpdate,
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


# ── LLM / AI provider settings ────────────────────────────────────────────────

class LLMProviderConfig(BaseModel):
    api_key: Optional[str] = None         # None = don't change; "" = clear
    model: Optional[str] = None
    base_url: Optional[str] = None        # for custom / openai-compat providers

class LLMSettingsUpdate(BaseModel):
    active_provider: Optional[str] = None
    providers: Optional[dict[str, LLMProviderConfig]] = None


@router.get("/llm")
def get_llm_settings(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return current LLM provider configuration (API keys are masked)."""
    org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    from app.services.llm_client import get_provider_status
    return get_provider_status(org.settings if org else None)


@router.patch("/llm")
def update_llm_settings(
    body: LLMSettingsUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    """Update LLM provider configuration.

    Send only the fields you want to change. Pass api_key="" to clear a key.
    API keys are stored in the organization settings; masked in GET responses.
    """
    org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    settings_dict = dict(org.settings or {})
    llm = dict(settings_dict.get("llm", {}))
    existing_providers = dict(llm.get("providers", {}))

    if body.active_provider is not None:
        from app.services.llm_client import PROVIDERS
        if body.active_provider not in PROVIDERS:
            raise HTTPException(status_code=422, detail=f"Unknown provider: {body.active_provider}. Valid: {list(PROVIDERS)}")
        llm["active_provider"] = body.active_provider

    if body.providers:
        for pname, pconf in body.providers.items():
            existing = dict(existing_providers.get(pname, {}))
            if pconf.api_key is not None:
                existing["api_key"] = pconf.api_key
            if pconf.model is not None:
                existing["model"] = pconf.model
            if pconf.base_url is not None:
                existing["base_url"] = pconf.base_url
            existing_providers[pname] = existing

    llm["providers"] = existing_providers
    settings_dict["llm"] = llm
    org.settings = settings_dict
    db.commit()

    from app.services.llm_client import get_provider_status
    return get_provider_status(org.settings)


@router.post("/llm/test")
def test_llm_connection(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Send a minimal test prompt to verify the active provider is working."""
    org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    from app.services.llm_client import complete
    try:
        response = complete("Reply with exactly: OK", org_settings=org.settings if org else None)
        return {"ok": True, "response": response[:200]}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))
