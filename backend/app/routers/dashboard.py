from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models import User, Lead, Task, Opportunity, AgentAction, Campaign, InboxThread, Appointment, Quote, ReviewRequest, IntegrationConnection
from app.schemas import AdvancedDashboardOut

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/summary", response_model=AdvancedDashboardOut)
def summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = user.organization_id
    leads = db.query(Lead).filter(Lead.organization_id == org).all()
    leads_by_status = {}
    for lead in leads:
        leads_by_status[str(lead.status.value if hasattr(lead.status, 'value') else lead.status)] = leads_by_status.get(str(lead.status.value if hasattr(lead.status, 'value') else lead.status), 0) + 1
    open_tasks = db.query(Task).filter(Task.organization_id == org, Task.status != "done").count()
    pipeline_value = sum(o.value for o in db.query(Opportunity).filter(Opportunity.organization_id == org).all())
    actions = db.query(AgentAction).filter(AgentAction.organization_id == org).order_by(AgentAction.created_at.desc()).limit(10).all()
    today = datetime.utcnow().date()
    tomorrow = today + timedelta(days=1)
    return {
        "leads_total": len(leads),
        "leads_by_status": leads_by_status,
        "open_tasks": open_tasks,
        "pipeline_value": pipeline_value,
        "recent_agent_actions": actions,
        "active_campaigns": db.query(Campaign).filter(Campaign.organization_id == org, Campaign.status == "active").count(),
        "open_inbox_threads": db.query(InboxThread).filter(InboxThread.organization_id == org, InboxThread.status == "open").count(),
        "appointments_today": db.query(Appointment).filter(Appointment.organization_id == org, Appointment.starts_at >= today, Appointment.starts_at < tomorrow).count(),
        "quotes_total": sum(q.total for q in db.query(Quote).filter(Quote.organization_id == org).all()),
        "reviews_requested": db.query(ReviewRequest).filter(ReviewRequest.organization_id == org).count(),
        "connected_integrations": db.query(IntegrationConnection).filter(IntegrationConnection.organization_id == org, IntegrationConnection.status == "connected").count(),
    }
