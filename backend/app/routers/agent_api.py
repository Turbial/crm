"""Dedicated /agent router — clean, well-documented surface for AI agents.

Authentication: pass your API key as either
  - Header:      X-API-Key: mcrm_...
  - Bearer token: Authorization: Bearer mcrm_...

Scopes (set when creating a key; empty list = full access):
  leads:read    leads:write
  deals:read    deals:write
  contacts:read contacts:write
  companies:read companies:write
  actions:run
  memory:read   memory:write
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
    Company, Contact, Deal, Lead, LeadStatus, PMTask, PMTaskStatus, User,
)

router = APIRouter(prefix="/agent", tags=["Agent API"])


# ── Capabilities ──────────────────────────────────────────────────────────────

@router.get("/capabilities")
def capabilities():
    """Return what this API version supports. Agents should call this first."""
    return {
        "version": "1.1",
        "auth": {
            "methods": ["X-API-Key header", "Authorization: Bearer <key>"],
            "key_prefix": "mcrm_",
            "note": "JWT tokens from /auth/login also work with full access",
        },
        "scopes": [
            "leads:read", "leads:write",
            "deals:read", "deals:write",
            "contacts:read", "contacts:write",
            "companies:read", "companies:write",
            "actions:run",
            "memory:read", "memory:write",
            "analytics:read",
        ],
        "endpoints": [
            {"method": "GET",   "path": "/agent/capabilities",       "description": "List scopes and endpoints (no auth required)"},
            {"method": "GET",   "path": "/agent/context",             "description": "Org operational snapshot", "scope": "leads:read"},
            {"method": "GET",   "path": "/agent/leads",               "description": "List/search leads",        "scope": "leads:read"},
            {"method": "POST",  "path": "/agent/leads",               "description": "Create a lead",            "scope": "leads:write"},
            {"method": "PATCH", "path": "/agent/leads/{id}",          "description": "Update a lead",            "scope": "leads:write"},
            {"method": "GET",   "path": "/agent/deals",               "description": "List deals",               "scope": "deals:read"},
            {"method": "POST",  "path": "/agent/deals",               "description": "Create a deal",            "scope": "deals:write"},
            {"method": "PATCH", "path": "/agent/deals/{id}",          "description": "Update a deal",            "scope": "deals:write"},
            {"method": "GET",   "path": "/agent/contacts",            "description": "List contacts",            "scope": "contacts:read"},
            {"method": "POST",  "path": "/agent/contacts",            "description": "Create a contact",         "scope": "contacts:write"},
            {"method": "PATCH", "path": "/agent/contacts/{id}",       "description": "Update a contact",         "scope": "contacts:write"},
            {"method": "GET",   "path": "/agent/companies",           "description": "List companies",           "scope": "companies:read"},
            {"method": "POST",  "path": "/agent/companies",           "description": "Create a company",         "scope": "companies:write"},
            {"method": "PATCH", "path": "/agent/companies/{id}",      "description": "Update a company",         "scope": "companies:write"},
            {"method": "POST",  "path": "/agent/actions/run",         "description": "Trigger a registered action", "scope": "actions:run"},
            {"method": "GET",   "path": "/agent/actions",             "description": "List recent action runs",  "scope": "actions:run"},
            {"method": "GET",   "path": "/agent/actions/{run_id}",    "description": "Get single action run status", "scope": "actions:run"},
            {"method": "GET",   "path": "/agent/memory/{key}",        "description": "Read agent memory",        "scope": "memory:read"},
            {"method": "PUT",   "path": "/agent/memory/{key}",        "description": "Write agent memory",       "scope": "memory:write"},
            {"method": "GET",   "path": "/agent/analytics/summary",   "description": "30-day KPI summary",       "scope": "analytics:read"},
            {"method": "POST",  "path": "/agent/batch",               "description": "Fetch multiple resources in one call (no extra scope beyond individual resource scopes)"},
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
        "tasks": {"overdue": overdue_tasks},
        "approvals": {"pending": pending_approvals},
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


# ── Contacts ──────────────────────────────────────────────────────────────────

@router.get("/contacts")
def list_contacts(
    q: Optional[str] = Query(None, description="Search by name or email"),
    limit: int = Query(20, le=100),
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(require_scope("contacts:read")),
):
    query = db.query(Contact).filter(Contact.organization_id == user.organization_id)
    if q:
        like = f"%{q}%"
        query = query.filter((Contact.name.ilike(like)) | (Contact.email.ilike(like)))
    contacts = query.order_by(Contact.created_at.desc()).offset(offset).limit(limit).all()
    return [_contact_out(c) for c in contacts]


@router.post("/contacts", status_code=201)
def create_contact(
    body: dict = Body(..., example={"name": "Jane Doe", "email": "jane@acme.com", "title": "CTO"}),
    db: Session = Depends(get_db),
    user: User = Depends(require_scope("contacts:write")),
):
    if not body.get("name"):
        raise HTTPException(status_code=422, detail="name is required")
    contact = Contact(
        organization_id=user.organization_id,
        name=body["name"],
        email=body.get("email"),
        phone=body.get("phone"),
        title=body.get("title"),
        lead_id=body.get("lead_id"),
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return _contact_out(contact)


@router.patch("/contacts/{contact_id}")
def update_contact(
    contact_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_scope("contacts:write")),
):
    contact = db.query(Contact).filter(
        Contact.id == contact_id, Contact.organization_id == user.organization_id
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    for k, v in body.items():
        if k in {"name", "email", "phone", "title", "lead_id"}:
            setattr(contact, k, v)
    db.commit()
    db.refresh(contact)
    return _contact_out(contact)


def _contact_out(c: Contact) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "email": c.email,
        "phone": c.phone,
        "title": c.title,
        "lead_id": c.lead_id,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


# ── Companies ─────────────────────────────────────────────────────────────────

@router.get("/companies")
def list_companies(
    q: Optional[str] = Query(None, description="Search by name or domain"),
    industry: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(require_scope("companies:read")),
):
    query = db.query(Company).filter(Company.organization_id == user.organization_id)
    if q:
        like = f"%{q}%"
        query = query.filter((Company.name.ilike(like)) | (Company.domain.ilike(like)))
    if industry:
        query = query.filter(Company.industry.ilike(f"%{industry}%"))
    companies = query.order_by(Company.name).offset(offset).limit(limit).all()
    return [_company_out(c) for c in companies]


@router.post("/companies", status_code=201)
def create_company(
    body: dict = Body(..., example={"name": "Acme Corp", "domain": "acme.com", "industry": "SaaS"}),
    db: Session = Depends(get_db),
    user: User = Depends(require_scope("companies:write")),
):
    if not body.get("name"):
        raise HTTPException(status_code=422, detail="name is required")
    company = Company(
        organization_id=user.organization_id,
        name=body["name"],
        domain=body.get("domain"),
        industry=body.get("industry"),
        size=body.get("size"),
        website=body.get("website"),
        phone=body.get("phone"),
        city=body.get("city"),
        state=body.get("state"),
        country=body.get("country"),
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return _company_out(company)


@router.patch("/companies/{company_id}")
def update_company(
    company_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_scope("companies:write")),
):
    company = db.query(Company).filter(
        Company.id == company_id, Company.organization_id == user.organization_id
    ).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    allowed = {"name", "domain", "industry", "size", "website", "phone", "city", "state", "country"}
    for k, v in body.items():
        if k in allowed:
            setattr(company, k, v)
    db.commit()
    db.refresh(company)
    return _company_out(company)


def _company_out(c: Company) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "domain": c.domain,
        "industry": c.industry,
        "size": c.size,
        "website": c.website,
        "phone": c.phone,
        "city": c.city,
        "state": c.state,
        "country": c.country,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


# ── Action execution ──────────────────────────────────────────────────────────

class RunActionRequest(BaseModel):
    action_key: str
    input: dict[str, Any] = {}
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    async_run: bool = True


@router.post("/actions/run")
def run_action(
    body: RunActionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_scope("actions:run")),
):
    """Trigger a registered action by its action_key.

    Set async_run=false to execute inline (blocks until complete).
    Set async_run=true (default) to enqueue; poll GET /agent/actions/{run_id} for status.

    Common action keys: crm.create_lead, crm.update_lead_status, crm.add_note,
    crm.schedule_followup, pm.create_task, pm.create_project, comms.send_email.
    """
    from app.models import ActionDefinition

    action_def = db.query(ActionDefinition).filter(
        ActionDefinition.organization_id == user.organization_id,
        ActionDefinition.action_key == body.action_key,
        ActionDefinition.is_active == True,
    ).first()
    if not action_def:
        available = [a.action_key for a in db.query(ActionDefinition).filter(
            ActionDefinition.organization_id == user.organization_id,
            ActionDefinition.is_active == True,
        ).all()]
        raise HTTPException(
            status_code=404,
            detail=f"Action '{body.action_key}' not found. Available: {available}",
        )

    run = ActionRun(
        organization_id=user.organization_id,
        action_key=body.action_key,
        source="agent_api",
        requested_by_type="agent",
        requested_by_id=user.id,
        linked_entity_type=body.entity_type,
        linked_entity_id=body.entity_id,
        input_payload=body.input,
        status=ActionStatus.pending,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    if not body.async_run:
        from app.services.action_executor import execute_action
        execute_action(db, run.id)
        db.refresh(run)

    return _run_out(run)


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
    return [_run_out(r) for r in runs]


@router.get("/actions/{run_id}")
def get_action(
    run_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_scope("actions:run")),
):
    """Get the current status and output of a single action run.

    Poll this after triggering with async_run=true until status is
    'completed' or 'failed'. Typical polling: every 2s for up to 60s.
    """
    run = db.query(ActionRun).filter(
        ActionRun.id == run_id,
        ActionRun.organization_id == user.organization_id,
    ).first()
    if not run:
        raise HTTPException(status_code=404, detail="Action run not found")
    return _run_out(run)


def _run_out(r: ActionRun) -> dict:
    return {
        "id": r.id,
        "action_key": r.action_key,
        "status": r.status.value,
        "entity_type": r.linked_entity_type,
        "entity_id": r.linked_entity_id,
        "input": r.input_payload,
        "output": r.output_payload,
        "error": r.error,
        "logs": r.logs,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "started_at": r.started_at.isoformat() if r.started_at else None,
        "completed_at": r.completed_at.isoformat() if r.completed_at else None,
    }


# ── Agent memory ──────────────────────────────────────────────────────────────

@router.get("/memory/{key}")
def read_memory(
    key: str,
    agent_name: str = Query("default"),
    db: Session = Depends(get_db),
    user: User = Depends(require_scope("memory:read")),
):
    """Read a memory value by key. Returns null value if not set."""
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
    import json
    mem = set_memory(db, user.organization_id, agent_name, key, body.get("value"), source="agent_api")
    db.commit()
    return {"agent_name": agent_name, "key": key, "value": json.loads(mem.value_json)}


# ── Batch fetch ───────────────────────────────────────────────────────────────

class BatchItem(BaseModel):
    type: str   # lead | deal | contact | company
    id: str


@router.post("/batch")
def batch_fetch(
    items: list[BatchItem] = Body(..., example=[
        {"type": "lead", "id": "lead-uuid"},
        {"type": "deal", "id": "deal-uuid"},
        {"type": "contact", "id": "contact-uuid"},
    ]),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Fetch multiple resources in a single call — the GraphQL alternative.

    Returns a dict keyed by '<type>:<id>'. Missing or unauthorized items
    appear as null. Scopes are enforced per resource type.
    """
    scopes: list[str] | None = getattr(user, "_api_key_scopes", None)

    def _has_scope(scope: str) -> bool:
        if scopes is None:
            return True
        return not scopes or scope in scopes

    results: dict[str, Any] = {}
    org = user.organization_id

    for item in items:
        key = f"{item.type}:{item.id}"
        if item.type == "lead":
            if not _has_scope("leads:read"):
                results[key] = None
                continue
            row = db.query(Lead).filter(Lead.id == item.id, Lead.organization_id == org).first()
            results[key] = _lead_out(row) if row else None
        elif item.type == "deal":
            if not _has_scope("deals:read"):
                results[key] = None
                continue
            row = db.query(Deal).filter(Deal.id == item.id, Deal.organization_id == org).first()
            results[key] = _deal_out(row) if row else None
        elif item.type == "contact":
            if not _has_scope("contacts:read"):
                results[key] = None
                continue
            row = db.query(Contact).filter(Contact.id == item.id, Contact.organization_id == org).first()
            results[key] = _contact_out(row) if row else None
        elif item.type == "company":
            if not _has_scope("companies:read"):
                results[key] = None
                continue
            row = db.query(Company).filter(Company.id == item.id, Company.organization_id == org).first()
            results[key] = _company_out(row) if row else None
        else:
            results[key] = {"error": f"unknown resource type: {item.type}"}

    return {"results": results, "count": len(results)}


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
