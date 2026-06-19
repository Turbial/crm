from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import ValidationError
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.deps import get_current_user, require_manager, require_staff
from app.models import User, Lead, Opportunity, Job, Invoice, Payment, AgentAction, AutomationRun, Project, PMTask, ProjectApproval
from app import models
from app.schemas import ENTERPRISE_SCHEMAS

router = APIRouter(prefix="/enterprise", tags=["enterprise"])

RESOURCE_MAP = {
    "pipelines": models.Pipeline,
    "tags": models.Tag,
    "lead-tags": models.LeadTag,
    "segments": models.Segment,
    "web-forms": models.WebForm,
    "websites": models.Website,
    "landing-pages": models.LandingPage,
    "jobs": models.Job,
    "invoices": models.Invoice,
    "payments": models.Payment,
    "subscriptions": models.Subscription,
    "support-tickets": models.SupportTicket,
    "documents": models.Document,
    "notifications": models.Notification,
    "automation-runs": models.AutomationRun,
    "agent-memories": models.AgentMemory,
    "audit-logs": models.AuditLog,
    "project-templates": models.ProjectTemplate,
    "projects": models.Project,
    "project-milestones": models.ProjectMilestone,
    "pm-tasks": models.PMTask,
    "pm-task-dependencies": models.PMTaskDependency,
    "project-comments": models.ProjectComment,
    "project-files": models.ProjectFile,
    "project-approvals": models.ProjectApproval,
    "time-entries": models.TimeEntry,
}

READONLY_FIELDS = {"id", "created_at", "updated_at", "organization_id"}


def serialize(obj) -> dict[str, Any]:
    out = {}
    for col in obj.__table__.columns:
        val = getattr(obj, col.name)
        if hasattr(val, "isoformat"):
            val = val.isoformat()
        elif hasattr(val, "value"):
            val = val.value
        out[col.name] = val
    return out


def model_for(resource: str):
    m = RESOURCE_MAP.get(resource)
    if not m:
        raise HTTPException(404, f"Unknown enterprise resource: {resource}")
    return m


def _validate_payload(resource: str, payload: dict) -> dict:
    """Validate and coerce payload through the typed schema if one exists."""
    schema_cls = ENTERPRISE_SCHEMAS.get(resource)
    if schema_cls is None:
        # Resources without a schema (automation-runs, audit-logs) accept raw dicts
        # but are still filtered through READONLY_FIELDS in the caller.
        return payload
    try:
        return schema_cls.model_validate(payload).model_dump(exclude_unset=False)
    except ValidationError as exc:
        raise HTTPException(422, detail=exc.errors()) from exc


@router.get("/resources")
def resources():
    return {"resources": sorted(RESOURCE_MAP.keys()), "typed": sorted(ENTERPRISE_SCHEMAS.keys())}


@router.get("/overview")
def overview(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = user.organization_id
    revenue = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(Payment.organization_id == org, Payment.status == "succeeded").scalar() or 0
    open_jobs = db.query(Job).filter(Job.organization_id == org, Job.status.in_(["requested", "scheduled", "in_progress"])).count()
    unpaid = db.query(Invoice).filter(Invoice.organization_id == org, Invoice.status.in_(["sent", "overdue"])).count()
    automations = db.query(AutomationRun).filter(AutomationRun.organization_id == org).count()
    return {
        "leads": db.query(Lead).filter(Lead.organization_id == org).count(),
        "opportunities": db.query(Opportunity).filter(Opportunity.organization_id == org).count(),
        "open_jobs": open_jobs,
        "unpaid_invoices": unpaid,
        "revenue_collected": revenue,
        "agent_actions": db.query(AgentAction).filter(AgentAction.organization_id == org).count(),
        "automation_runs": automations,
        "projects": db.query(Project).filter(Project.organization_id == org).count(),
        "pm_open_tasks": db.query(PMTask).filter(PMTask.organization_id == org, PMTask.status.in_(["ready", "in_progress", "review", "blocked"])).count(),
        "pm_pending_approvals": db.query(ProjectApproval).filter(ProjectApproval.organization_id == org, ProjectApproval.status == "requested").count(),
    }


@router.get("/{resource}")
def list_resource(resource: str, limit: int = Query(100, le=500), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    model = model_for(resource)
    rows = db.query(model).filter(model.organization_id == user.organization_id).order_by(model.created_at.desc()).limit(limit).all()
    return [serialize(r) for r in rows]


@router.post("/{resource}")
def create_resource(resource: str, payload: dict, user: User = Depends(require_staff), db: Session = Depends(get_db)):
    model = model_for(resource)
    validated = _validate_payload(resource, payload)
    data = {k: v for k, v in validated.items() if k not in READONLY_FIELDS and hasattr(model, k)}
    obj = model(**data, organization_id=user.organization_id)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return serialize(obj)


@router.get("/{resource}/{item_id}")
def get_resource(resource: str, item_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    model = model_for(resource)
    obj = db.query(model).filter(model.id == item_id, model.organization_id == user.organization_id).first()
    if not obj:
        raise HTTPException(404, "Not found")
    return serialize(obj)


@router.patch("/{resource}/{item_id}")
def update_resource(resource: str, item_id: str, payload: dict, user: User = Depends(require_staff), db: Session = Depends(get_db)):
    model = model_for(resource)
    obj = db.query(model).filter(model.id == item_id, model.organization_id == user.organization_id).first()
    if not obj:
        raise HTTPException(404, "Not found")
    # For updates, validate only the supplied fields (partial update).
    schema_cls = ENTERPRISE_SCHEMAS.get(resource)
    if schema_cls:
        try:
            validated = schema_cls.model_validate(payload).model_dump(exclude_unset=True)
        except ValidationError as exc:
            raise HTTPException(422, detail=exc.errors()) from exc
    else:
        validated = payload
    for k, v in validated.items():
        if k not in READONLY_FIELDS and hasattr(model, k):
            setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return serialize(obj)


@router.delete("/{resource}/{item_id}")
def delete_resource(resource: str, item_id: str, user: User = Depends(require_manager), db: Session = Depends(get_db)):
    model = model_for(resource)
    obj = db.query(model).filter(model.id == item_id, model.organization_id == user.organization_id).first()
    if not obj:
        raise HTTPException(404, "Not found")
    db.delete(obj)
    db.commit()
    return {"ok": True}
