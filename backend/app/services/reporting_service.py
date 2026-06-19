from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Lead, Opportunity, Task, Communication, AgentAction

def executive_report(db: Session, organization_id: str) -> dict:
    leads_total = db.query(func.count(Lead.id)).filter(Lead.organization_id == organization_id).scalar() or 0
    open_tasks = db.query(func.count(Task.id)).filter(Task.organization_id == organization_id, Task.status != 'done').scalar() or 0
    pipeline_value = db.query(func.coalesce(func.sum(Opportunity.value), 0)).filter(Opportunity.organization_id == organization_id, Opportunity.stage.notin_(['won','lost'])).scalar() or 0
    won_value = db.query(func.coalesce(func.sum(Opportunity.value), 0)).filter(Opportunity.organization_id == organization_id, Opportunity.stage == 'won').scalar() or 0
    comms = db.query(func.count(Communication.id)).filter(Communication.organization_id == organization_id).scalar() or 0
    actions = db.query(func.count(AgentAction.id)).filter(AgentAction.organization_id == organization_id).scalar() or 0
    return {
        "leads_total": leads_total,
        "open_tasks": open_tasks,
        "pipeline_value": float(pipeline_value),
        "won_value": float(won_value),
        "communications_total": comms,
        "agent_actions_total": actions,
        "recommendation": "increase follow-up automation" if open_tasks > 5 else "keep pipeline moving",
    }
