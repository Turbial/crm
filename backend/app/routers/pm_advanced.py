from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.deps import get_current_user
from app.models import (
    User, Project, PMTask, ProjectApproval, ProjectPortfolio, PortfolioProject,
    ProjectSprint, SprintTask, ProjectRisk, ProjectChangeRequest, WorkloadAllocation,
    ProjectAutomationRule, PMTaskStatus, RiskStatus, RiskSeverity, ChangeRequestStatus, SprintStatus,
    AgentAction, AgentActionStatus, AssigneeType
)
from app.schemas import (
    PortfolioCreate, PortfolioOut, PortfolioAddProjectIn, SprintCreate, SprintOut,
    SprintAddTaskIn, RiskCreate, RiskUpdate, RiskOut, ChangeRequestCreate,
    ChangeRequestUpdate, ChangeRequestOut, WorkloadAllocationCreate,
    WorkloadAllocationOut, AutomationRuleCreate, AutomationRuleOut,
    PMExecutiveOverviewOut
)

router = APIRouter(prefix="/pm", tags=["pm-advanced"])


def ensure_project(db: Session, org: str, project_id: str) -> Project:
    project = db.query(Project).filter(Project.id == project_id, Project.organization_id == org).first()
    if not project:
        raise HTTPException(404, "Project not found")
    return project


def ensure_task(db: Session, org: str, project_id: str, task_id: str) -> PMTask:
    task = db.query(PMTask).filter(PMTask.id == task_id, PMTask.project_id == project_id, PMTask.organization_id == org).first()
    if not task:
        raise HTTPException(404, "PM task not found")
    return task


@router.get("/executive-overview", response_model=PMExecutiveOverviewOut)
def executive_overview(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = user.organization_id
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    projects_total = db.query(Project).filter(Project.organization_id == org).count()
    active_projects = db.query(Project).filter(Project.organization_id == org, Project.status == "active").count()
    overdue_tasks = db.query(PMTask).filter(PMTask.organization_id == org, PMTask.due_at != None, PMTask.due_at < now, PMTask.status != PMTaskStatus.done).count()
    blocked_tasks = db.query(PMTask).filter(PMTask.organization_id == org, PMTask.status == PMTaskStatus.blocked).count()
    open_risks = db.query(ProjectRisk).filter(ProjectRisk.organization_id == org, ProjectRisk.status.in_([RiskStatus.open, RiskStatus.mitigating])).count()
    critical_risks = db.query(ProjectRisk).filter(ProjectRisk.organization_id == org, ProjectRisk.severity == RiskSeverity.critical, ProjectRisk.status != RiskStatus.resolved).count()
    pending_change_requests = db.query(ProjectChangeRequest).filter(ProjectChangeRequest.organization_id == org, ProjectChangeRequest.status == ChangeRequestStatus.requested).count()
    pending_approvals = db.query(ProjectApproval).filter(ProjectApproval.organization_id == org, ProjectApproval.status == "requested").count()
    estimates = db.query(func.coalesce(func.sum(PMTask.estimate_minutes), 0), func.coalesce(func.sum(PMTask.actual_minutes), 0), func.coalesce(func.sum(PMTask.cost_cents), 0)).filter(PMTask.organization_id == org).first()
    by_agent_rows = db.query(PMTask.assignee_agent, PMTask.status, func.count(PMTask.id), func.coalesce(func.sum(PMTask.estimate_minutes), 0)).filter(PMTask.organization_id == org, PMTask.assignee_agent != None).group_by(PMTask.assignee_agent, PMTask.status).all()
    by_agent: dict[str, dict[str, int]] = {}
    for agent, status, count, minutes in by_agent_rows:
        key = agent or "unassigned"
        s = status.value if hasattr(status, "value") else str(status)
        by_agent.setdefault(key, {"tasks": 0, "minutes": 0})
        by_agent[key]["tasks"] += int(count)
        by_agent[key]["minutes"] += int(minutes or 0)
        by_agent[key][s] = int(count)
    return {
        "projects_total": projects_total,
        "active_projects": active_projects,
        "overdue_tasks": overdue_tasks,
        "blocked_tasks": blocked_tasks,
        "open_risks": open_risks,
        "critical_risks": critical_risks,
        "pending_change_requests": pending_change_requests,
        "pending_approvals": pending_approvals,
        "estimated_minutes": int(estimates[0] or 0),
        "actual_minutes": int(estimates[1] or 0),
        "projected_cost_cents": int(estimates[2] or 0),
        "by_agent": by_agent,
    }


@router.post("/portfolios", response_model=PortfolioOut)
def create_portfolio(payload: PortfolioCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    portfolio = ProjectPortfolio(**payload.model_dump(), organization_id=user.organization_id, owner_user_id=user.id)
    db.add(portfolio); db.commit(); db.refresh(portfolio)
    return portfolio


@router.get("/portfolios", response_model=list[PortfolioOut])
def list_portfolios(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(ProjectPortfolio).filter(ProjectPortfolio.organization_id == user.organization_id).order_by(ProjectPortfolio.updated_at.desc()).all()


@router.post("/portfolios/{portfolio_id}/projects")
def add_project_to_portfolio(portfolio_id: str, payload: PortfolioAddProjectIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    portfolio = db.query(ProjectPortfolio).filter(ProjectPortfolio.id == portfolio_id, ProjectPortfolio.organization_id == user.organization_id).first()
    if not portfolio:
        raise HTTPException(404, "Portfolio not found")
    ensure_project(db, user.organization_id, payload.project_id)
    link = PortfolioProject(organization_id=user.organization_id, portfolio_id=portfolio_id, project_id=payload.project_id, weight=payload.weight)
    db.add(link); db.commit(); db.refresh(link)
    return {"portfolio_project_id": link.id, "status": "linked"}


@router.post("/projects/{project_id}/sprints", response_model=SprintOut)
def create_sprint(project_id: str, payload: SprintCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_project(db, user.organization_id, project_id)
    sprint = ProjectSprint(**payload.model_dump(), organization_id=user.organization_id, project_id=project_id)
    db.add(sprint); db.commit(); db.refresh(sprint)
    return sprint


@router.get("/projects/{project_id}/sprints", response_model=list[SprintOut])
def list_sprints(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_project(db, user.organization_id, project_id)
    return db.query(ProjectSprint).filter(ProjectSprint.organization_id == user.organization_id, ProjectSprint.project_id == project_id).order_by(ProjectSprint.created_at.desc()).all()


@router.post("/projects/{project_id}/sprints/{sprint_id}/tasks")
def add_task_to_sprint(project_id: str, sprint_id: str, payload: SprintAddTaskIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_task(db, user.organization_id, project_id, payload.task_id)
    sprint = db.query(ProjectSprint).filter(ProjectSprint.id == sprint_id, ProjectSprint.project_id == project_id, ProjectSprint.organization_id == user.organization_id).first()
    if not sprint:
        raise HTTPException(404, "Sprint not found")
    item = SprintTask(organization_id=user.organization_id, sprint_id=sprint_id, task_id=payload.task_id, position=payload.position)
    db.add(item); db.commit(); db.refresh(item)
    return {"sprint_task_id": item.id, "status": "added"}


@router.post("/projects/{project_id}/risks", response_model=RiskOut)
def create_risk(project_id: str, payload: RiskCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_project(db, user.organization_id, project_id)
    risk = ProjectRisk(**payload.model_dump(), organization_id=user.organization_id, project_id=project_id)
    db.add(risk); db.commit(); db.refresh(risk)
    return risk


@router.get("/projects/{project_id}/risks", response_model=list[RiskOut])
def list_risks(project_id: str, status: str | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_project(db, user.organization_id, project_id)
    query = db.query(ProjectRisk).filter(ProjectRisk.organization_id == user.organization_id, ProjectRisk.project_id == project_id)
    if status:
        query = query.filter(ProjectRisk.status == status)
    return query.order_by(ProjectRisk.updated_at.desc()).all()


@router.patch("/projects/{project_id}/risks/{risk_id}", response_model=RiskOut)
def update_risk(project_id: str, risk_id: str, payload: RiskUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    risk = db.query(ProjectRisk).filter(ProjectRisk.id == risk_id, ProjectRisk.project_id == project_id, ProjectRisk.organization_id == user.organization_id).first()
    if not risk:
        raise HTTPException(404, "Risk not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(risk, k, v)
    db.commit(); db.refresh(risk)
    return risk


@router.post("/projects/{project_id}/change-requests", response_model=ChangeRequestOut)
def create_change_request(project_id: str, payload: ChangeRequestCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_project(db, user.organization_id, project_id)
    cr = ProjectChangeRequest(**payload.model_dump(), organization_id=user.organization_id, project_id=project_id, requested_by_user_id=user.id)
    db.add(cr); db.commit(); db.refresh(cr)
    return cr


@router.patch("/projects/{project_id}/change-requests/{change_id}", response_model=ChangeRequestOut)
def update_change_request(project_id: str, change_id: str, payload: ChangeRequestUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cr = db.query(ProjectChangeRequest).filter(ProjectChangeRequest.id == change_id, ProjectChangeRequest.project_id == project_id, ProjectChangeRequest.organization_id == user.organization_id).first()
    if not cr:
        raise HTTPException(404, "Change request not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(cr, k, v)
    db.commit(); db.refresh(cr)
    return cr


@router.post("/workload", response_model=WorkloadAllocationOut)
def create_workload(payload: WorkloadAllocationCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = WorkloadAllocation(**payload.model_dump(), organization_id=user.organization_id)
    db.add(row); db.commit(); db.refresh(row)
    return row


@router.get("/workload")
def workload_report(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = user.organization_id
    allocations = db.query(WorkloadAllocation).filter(WorkloadAllocation.organization_id == org, WorkloadAllocation.active == True).all()
    rows = []
    for allocation in allocations:
        q = db.query(func.coalesce(func.sum(PMTask.estimate_minutes), 0), func.count(PMTask.id)).filter(PMTask.organization_id == org, PMTask.status.notin_([PMTaskStatus.done, PMTaskStatus.canceled]))
        label = allocation.assignee_agent or allocation.assignee_user_id or "unassigned"
        if allocation.assignee_type == AssigneeType.agent:
            q = q.filter(PMTask.assignee_agent == allocation.assignee_agent)
        else:
            q = q.filter(PMTask.assignee_user_id == allocation.assignee_user_id)
        minutes, tasks = q.first()
        capacity = allocation.capacity_minutes_per_week or 1
        rows.append({
            "assignee": label,
            "assignee_type": allocation.assignee_type.value,
            "capacity_minutes_per_week": capacity,
            "assigned_estimate_minutes": int(minutes or 0),
            "open_tasks": int(tasks or 0),
            "utilization_percent": round((int(minutes or 0) / capacity) * 100, 1),
        })
    return {"items": rows}


@router.post("/automation-rules", response_model=AutomationRuleOut)
def create_automation_rule(payload: AutomationRuleCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.project_id:
        ensure_project(db, user.organization_id, payload.project_id)
    rule = ProjectAutomationRule(**payload.model_dump(), organization_id=user.organization_id)
    db.add(rule); db.commit(); db.refresh(rule)
    return rule


@router.post("/projects/{project_id}/auto-plan")
def auto_plan(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create a richer delivery plan: sprint, default risks, workload allocations, and OpenClaw review actions."""
    project = ensure_project(db, user.organization_id, project_id)
    tasks = db.query(PMTask).filter(PMTask.organization_id == user.organization_id, PMTask.project_id == project_id).all()
    sprint = ProjectSprint(organization_id=user.organization_id, project_id=project_id, name="Sprint 1 - Launch Foundation", goal=f"Move {project.name} from plan to review", status=SprintStatus.planned, capacity_minutes=sum(t.estimate_minutes for t in tasks[:10]))
    db.add(sprint); db.flush()
    for idx, task in enumerate(tasks[:10], start=1):
        db.add(SprintTask(organization_id=user.organization_id, sprint_id=sprint.id, task_id=task.id, position=idx))
    default_risks = [
        ("Client approval delay", "Escalate through messenger and continue non-blocked work."),
        ("Missing source material", "Use AI-generated placeholder assets, flag for approval."),
        ("Agent execution drift", "Require reviewer agent checkpoint before client-facing delivery."),
    ]
    for title, mitigation in default_risks:
        db.add(ProjectRisk(organization_id=user.organization_id, project_id=project_id, title=title, severity=RiskSeverity.medium, mitigation_plan=mitigation))
    agents = sorted({t.assignee_agent for t in tasks if t.assignee_agent})
    for agent in agents:
        existing = db.query(WorkloadAllocation).filter(WorkloadAllocation.organization_id == user.organization_id, WorkloadAllocation.assignee_agent == agent).first()
        if not existing:
            db.add(WorkloadAllocation(organization_id=user.organization_id, assignee_type=AssigneeType.agent, assignee_agent=agent, capacity_minutes_per_week=1800))
        db.add(AgentAction(organization_id=user.organization_id, agent_name="PMReviewerAgent", action_type="pm_review", instruction=f"Review project {project.name} tasks assigned to {agent}; identify blockers and next actions.", status=AgentActionStatus.queued, metadata_json={"project_id": project_id, "agent": agent}))
    db.commit()
    return {"sprint_created": sprint.id, "tasks_added_to_sprint": min(len(tasks), 10), "risks_created": len(default_risks), "review_actions_created": len(agents)}
