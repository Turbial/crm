"""Dedicated /agent router — clean, well-documented surface for AI agents.

Authentication: pass your API key as either
  - Header:      X-API-Key: mcrm_...
  - Bearer token: Authorization: Bearer mcrm_...

Scopes (set when creating a key; empty list = full access):
  leads:read   leads:write
  deals:read   deals:write
  contacts:read
  actions:run
  memory:read  memory:write
  analytics:read
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_scope
from app.models import (
    ActionRun, ActionStatus, ApprovalRequest, ActionApprovalStatus,
    Deal, Lead, LeadStatus, PMTask, PMTaskStatus, User,
)

router = APIRouter(prefix="/agent", tags=["Agent API"])


# ── Capabilities ──────────────────────────────────────────────────────────────

@router.get("/capabilities")
def capabilities():
    """Return what this API version supports. Agents should call this first."""
    return {
        "version": "1.0",
        "scopes": [
            "leads:read", "leads:write",
            "deals:read", "deals:write",
            "contacts:read",
            "actions:run",
            "memory:read", "memory:write",
            "analytics:read",
        ],
        "endpoints": [
            {"method": "GET",  "path": "/agent/capabilities",     "description": "List available scopes and endpoints"},
            {"method": "GET",  "path": "/agent/context",           "description": "Org operational snapshot (leads, deals, tasks, actions)"},
            {"method": "GET",  "path": "/agent/leads",             "description": "List/search leads", "scope": "leads:read"},
            {"method": "POST", "path": "/agent/leads",             "description": "Create a lead",     "scope": "leads:write"},
            {"method": "PATCH","path": "/agent/leads/{id}",        "description": "Update a lead",     "scope": "leads:write"},
            {"method": "GET",  "path": "/agent/deals",             "description": "List deals",         "scope": "deals:read"},
            {"method": "POST", "path": "/agent/deals",             "description": "Create a deal",      "scope": "deals:write"},
            {"method": "PATCH","path": "/agent/deals/{id}",        "description": "Update a deal",      "scope": "deals:write"},
            {"method": "POST", "path": "/agent/actions/run",       "description": "Trigger an action",  "scope": "actions:run"},
            {"method": "GET",  "path": "/agent/actions",           "description": "List action runs",   "scope": "actions:run"},
            {"method": "GET",  "path": "/agent/memory/{key}",      "description": "Read agent memory",  "scope": "memory:read"},
            {"method": "PUT",  "path": "/agent/memory/{key}",      "description": "Write agent memory", "scope": "memory:write"},
            {"method": "GET",  "path": "/agent/analytics/summary", "description": "KPI summary",        "scope": "analytics:read"},
        ],
    }


# ── Context snapshot ──────────────────────────────────────────────────────────

@router.get("/context")
def context(
    db: Session = Depends(get_db),
    user: User = Depends(require_scope("leads:read")),
):
    """Return a concise operational snapshot of the org for agent planning."""
    org_id = user.organization_id
    now = datetime.utcnow()

    open_leads = db.query(Lead).filter(
        Lead.organization_id == org_id,
        Lead.status.notin_([LeadStatus.won, LeadStatus.lost]),
    ).count()

    hot_leads = db.query(Lead).filter(
        Lead.organization_id == org_id,
        Lead.score >= 70,
        Lead.status.notin_([LeadStatus.won, LeadStatus.lost]),
    ).order_by(Lead.score.desc()).limit(5).all()

    open_deals = db.query(Deal).filter(
        Deal.organization_id == org_id,
        Deal.closed_at.is_(None),
    ).all()
    pipeline_value = sum(d.value * (d.probability / 100) for d in open_deals)

    overdue_tasks = db.query(PMTask).filter(
        PMTask.organization_id == org_id,
        PMTask.due_at < now,
        PMTask.status.notin_([PMTaskStatus.done, PMTaskStatus.canceled]),
    ).count()

    pending_approvals = db.query(ApprovalRequest).filter(
        ApprovalRequest.organization_id == org_id,
        ApprovalRequest.status == ActionApprovalStatus.pending,
    ).count()

    recent_failures = db.query(ActionRun).filter(
        ActionRun.organization_id == org_id,
        ActionRun.status == ActionStatus.failed,
        ActionRun.created_at >= datetime.utcnow().__class__.utcnow(),
    ).count()

    return {
        "timestamp": now.isoformat(),
        "organization_id": org_id,
        "leads": {
            "open": open_leads,
            "hot": [{"id": l.id, "name": l.name, "score": l.score, "status": l.status.value} for l in hot_leads],
        },
        "deals": {
            "open": len(open_deals),
            "weighted_pipeline_value": round(pipeline_value, 2),
        },
        "tasks": {
            "overdue": overdue_tasks,
        },
        "approvals": {
            "pending": pending_approvals,
        },
    }


# ── Leads ─────────────────────────────────────────────────────────────────────

@router.get("/leads")
def list_leads(
    status: Optional[str] = Query(None, description="Filter by status: new|contacted|qualified|proposal|negotiation|won|lost"),
    min_score: Optional[int] = Query(None, description="Minimum lead score"),
    q: Optional[str] = Query(None, description="Search by name or email"),
    limit: int = Query(20, le=100),
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(require_scope("leads:read")),
):
    """List leads with optional filters. Use for prospecting, scoring, and routing."""
    query = db.query(Lead).filter(Lead.organization_id == user.organization_id)
    if status:
        try:
            query = query.filter(Lead.status == LeadStatus(status))
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid status: {status}")
    if min_score is not None:
        query = query.filter(Lead.score >= min_score)
    if q:
        like = f"%{q}%"
        query = query.filter((Lead.name.ilike(like)) | (Lead.email.ilike(like)))
    leads = query.order_by(Lead.score.desc(), Lead.created_at.desc()).offset(offset).limit(limit).all()
    return [_lead_out(l) for l in leads]


@router.post("/leads", status_code=201)
def create_lead(
    body: dict = Body(..., example={"name": "Acme Corp", "email": "ceo@acme.com", "source": "agent", "score": 60}),
    db: Session = Depends(get_db),
    user: User = Depends(require_scope("leads:write")),
):
    """Create a new lead. Required: name. Optional: email, phone, company, source, score, status."""
    if not body.get("name"):
        raise HTTPException(status_code=422, detail="name is required")
    lead = Lead(
        organization_id=user.organization_id,
        name=body["name"],
        email=body.get("email"),
        phone=body.get("phone"),
        company=body.get("company"),
        source=body.get("source", "agent"),
        score=body.get("score", 0),
        status=LeadStatus(body["status"]) if body.get("status") else LeadStatus.new,
        metadata_json=body.get("metadata", {}),
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return _lead_out(lead)


@router.patch("/leads/{lead_id}")
def update_lead(
    lead_id: str,
    body: dict = Body(..., example={"score": 85, "status": "qualified"}),
    db: Session = Depends(get_db),
    user: User = Depends(require_scope("leads:write")),
):
    """Update lead fields. Pass only the fields you want to change."""
    lead = db.query(Lead).filter(
        Lead.id == lead_id, Lead.organization_id == user.organization_id
    ).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    allowed = {"name", "email", "phone", "company", "score", "source", "address", "city", "state", "website"}
    for k, v in body.items():
        if k == "status":
            lead.status = LeadStatus(v)
        elif k in allowed:
            setattr(lead, k, v)
    db.commit()
    db.refresh(lead)
    return _lead_out(lead)


def _lead_out(l: Lead) -> dict:
    return {
        "id": l.id,
        "name": l.name,
        "email": l.email,
        "phone": l.phone,
        "company": l.company,
        "status": l.status.value,
        "score": l.score,
        "source": l.source,
        "created_at": l.created_at.isoformat() if l.created_at else None,
        "updated_at": l.updated_at.isoformat() if l.updated_at else None,
    }


# ── Deals ─────────────────────────────────────────────────────────────────────

@router.get("/deals")
def list_deals(
    stage: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(require_scope("deals:read")),
):
    """List open deals, optionally filtered by stage."""
    q = db.query(Deal).filter(Deal.organization_id == user.organization_id, Deal.closed_at.is_(None))
    if stage:
        q = q.filter(Deal.stage == stage)
    deals = q.order_by(Deal.value.desc()).limit(limit).all()
    return [_deal_out(d) for d in deals]


@router.post("/deals", status_code=201)
def create_deal(
    body: dict = Body(..., example={"title": "Acme Enterprise License", "value": 50000, "stage": "qualified", "lead_id": "..."}),
    db: Session = Depends(get_db),
    user: User = Depends(require_scope("deals:write")),
):
    """Create a new deal."""
    if not body.get("title"):
        raise HTTPException(status_code=422, detail="title is required")
    deal = Deal(
        organization_id=user.organization_id,
        title=body["title"],
        value=body.get("value", 0),
        currency=body.get("currency", "USD"),
        stage=body.get("stage", "lead"),
        probability=body.get("probability", 20),
        lead_id=body.get("lead_id"),
        contact_id=body.get("contact_id"),
        company_id=body.get("company_id"),
        notes=body.get("notes"),
    )
    db.add(deal)
    db.commit()
    db.refresh(deal)
    return _deal_out(deal)


@router.patch("/deals/{deal_id}")
def update_deal(
    deal_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_scope("deals:write")),
):
    """Update deal fields."""
    deal = db.query(Deal).filter(
        Deal.id == deal_id, Deal.organization_id == user.organization_id
    ).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    allowed = {"title", "value", "currency", "stage", "probability", "notes", "expected_close_date"}
    for k, v in body.items():
        if k in allowed:
            setattr(deal, k, v)
        elif k == "closed_at":
            deal.closed_at = datetime.fromisoformat(v) if v else None
    db.commit()
    db.refresh(deal)
    return _deal_out(deal)


def _deal_out(d: Deal) -> dict:
    return {
        "id": d.id,
        "title": d.title,
        "value": d.value,
        "currency": d.currency,
        "stage": d.stage,
        "probability": d.probability,
        "lead_id": d.lead_id,
        "contact_id": d.contact_id,
        "company_id": d.company_id,
        "closed_at": d.closed_at.isoformat() if d.closed_at else None,
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }


# ── Action execution ──────────────────────────────────────────────────────────

class RunActionRequest(BaseModel):
    action_name: str
    input: dict[str, Any] = {}
    lead_id: Optional[str] = None
    contact_id: Optional[str] = None
    async_run: bool = True


@router.post("/actions/run")
def run_action(
    body: RunActionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_scope("actions:run")),
):
    """Trigger a registered action by name.

    Set async_run=false to execute inline (blocks until complete).
    Set async_run=true (default) to enqueue and return immediately.

    Common action names: send_email, send_sms, create_task, qualify_lead,
    score_lead, summarize_lead, schedule_followup.
    """
    from app.services.action_registry import get_action_by_name
    from app.models import ActionRun

    action_def = get_action_by_name(db, user.organization_id, body.action_name)
    if not action_def:
        # List available actions so agent can self-correct
        from app.models import ActionDefinition
        available = [a.name for a in db.query(ActionDefinition).filter(
            ActionDefinition.organization_id == user.organization_id,
            ActionDefinition.is_active == True,
        ).all()]
        raise HTTPException(
            status_code=404,
            detail=f"Action '{body.action_name}' not found. Available: {available}",
        )

    run = ActionRun(
        organization_id=user.organization_id,
        action_id=action_def.id,
        action_name=body.action_name,
        triggered_by=user.id,
        lead_id=body.lead_id,
        contact_id=body.contact_id,
        input_data=body.input,
        status=ActionStatus.pending,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    if not body.async_run:
        from app.services.action_executor import execute_action
        execute_action(db, run.id)
        db.refresh(run)

    return {
        "run_id": run.id,
        "action_name": run.action_name,
        "status": run.status.value,
        "async": body.async_run,
        "created_at": run.created_at.isoformat(),
    }


@router.get("/actions")
def list_actions(
    status: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(require_scope("actions:run")),
):
    """List recent action runs for this org."""
    q = db.query(ActionRun).filter(ActionRun.organization_id == user.organization_id)
    if status:
        try:
            q = q.filter(ActionRun.status == ActionStatus(status))
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid status: {status}")
    runs = q.order_by(ActionRun.created_at.desc()).limit(limit).all()
    return [
        {
            "id": r.id,
            "action_name": r.action_name,
            "status": r.status.value,
            "lead_id": r.lead_id,
            "error_message": r.error_message,
            "created_at": r.created_at.isoformat(),
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        }
        for r in runs
    ]


# ── Agent memory ──────────────────────────────────────────────────────────────

@router.get("/memory/{key}")
def read_memory(
    key: str,
    agent_name: str = Query("default"),
    db: Session = Depends(get_db),
    user: User = Depends(require_scope("memory:read")),
):
    """Read a memory value by key. Returns null if not set."""
    from app.services.agent_memory_service import get_memory
    value = get_memory(db, user.organization_id, agent_name, key)
    return {"agent_name": agent_name, "key": key, "value": value}


@router.put("/memory/{key}")
def write_memory(
    key: str,
    agent_name: str = Query("default"),
    body: dict = Body(..., example={"value": "anything JSON-serializable"}),
    db: Session = Depends(get_db),
    user: User = Depends(require_scope("memory:write")),
):
    """Persist a memory value. Overwrites existing. Value can be any JSON type."""
    from app.services.agent_memory_service import set_memory
    mem = set_memory(db, user.organization_id, agent_name, key, body.get("value"), source="agent_api")
    db.commit()
    import json
    return {"agent_name": agent_name, "key": key, "value": json.loads(mem.value_json)}


# ── Analytics ─────────────────────────────────────────────────────────────────

@router.get("/analytics/summary")
def analytics_summary(
    db: Session = Depends(get_db),
    user: User = Depends(require_scope("analytics:read")),
):
    """Key operational metrics for the org. Useful for agent decision-making."""
    from datetime import timedelta
    org_id = user.organization_id
    now = datetime.utcnow()
    since_30d = now - timedelta(days=30)

    total_leads = db.query(Lead).filter(Lead.organization_id == org_id).count()
    new_leads_30d = db.query(Lead).filter(
        Lead.organization_id == org_id,
        Lead.created_at >= since_30d,
    ).count()
    won_leads = db.query(Lead).filter(
        Lead.organization_id == org_id,
        Lead.status == LeadStatus.won,
        Lead.updated_at >= since_30d,
    ).count()
    open_deals = db.query(Deal).filter(Deal.organization_id == org_id, Deal.closed_at.is_(None)).all()
    pipeline_value = sum(d.value for d in open_deals)
    weighted_value = sum(d.value * (d.probability / 100) for d in open_deals)
    action_runs_30d = db.query(ActionRun).filter(
        ActionRun.organization_id == org_id,
        ActionRun.created_at >= since_30d,
    ).all()
    failed = sum(1 for r in action_runs_30d if r.status == ActionStatus.failed)

    return {
        "period_days": 30,
        "leads": {
            "total": total_leads,
            "new_30d": new_leads_30d,
            "won_30d": won_leads,
            "conversion_rate": round(won_leads / new_leads_30d, 3) if new_leads_30d else 0,
        },
        "deals": {
            "open": len(open_deals),
            "pipeline_value": round(pipeline_value, 2),
            "weighted_value": round(weighted_value, 2),
        },
        "actions": {
            "total_30d": len(action_runs_30d),
            "failed_30d": failed,
            "failure_rate": round(failed / len(action_runs_30d), 3) if action_runs_30d else 0,
        },
    }
