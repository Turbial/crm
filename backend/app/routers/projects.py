from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.deps import get_current_user
from app.models import (
    User, Project, ProjectMilestone, PMTask, PMTaskDependency, ProjectComment,
    ProjectApproval, ProjectTemplate, Lead, AgentAction, PMTaskStatus, ApprovalStatus,
)
from app.schemas import (
    ProjectCreate, ProjectOut, ProjectUpdate, MilestoneCreate, MilestoneOut,
    PMTaskCreate, PMTaskOut, PMTaskUpdate, ProjectCommentCreate, ProjectCommentOut,
    ProjectApprovalCreate, ProjectApprovalOut, ProjectApprovalUpdate,
    ProjectTemplateCreate, ProjectTemplateOut, ProjectGenerateIn, ProjectGenerateOut,
    ProjectBoardOut,
)
from app.services.pm_service import PMService

router = APIRouter(prefix="/projects", tags=["projects"])

def ensure_project(db: Session, organization_id: str, project_id: str) -> Project:
    project = db.query(Project).filter(Project.id == project_id, Project.organization_id == organization_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    return project

@router.post("/templates/defaults")
def create_default_templates(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    created = PMService(db, user.organization_id, user.id).create_default_templates()
    return {"created": created}

@router.get("/templates", response_model=list[ProjectTemplateOut])
def list_templates(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(ProjectTemplate).filter(ProjectTemplate.organization_id == user.organization_id).order_by(ProjectTemplate.name.asc()).all()

@router.post("/templates", response_model=ProjectTemplateOut)
def create_template(payload: ProjectTemplateCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tmpl = ProjectTemplate(**payload.model_dump(), organization_id=user.organization_id)
    db.add(tmpl); db.commit(); db.refresh(tmpl)
    return tmpl

@router.get("", response_model=list[ProjectOut])
def list_projects(status: str | None = None, q: str | None = None, limit: int = Query(100, le=500), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Project).filter(Project.organization_id == user.organization_id)
    if status:
        query = query.filter(Project.status == status)
    if q:
        query = query.filter(Project.name.ilike(f"%{q}%"))
    return query.order_by(Project.updated_at.desc()).limit(limit).all()

@router.post("", response_model=ProjectOut)
def create_project(payload: ProjectCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.lead_id:
        lead = db.query(Lead).filter(Lead.id == payload.lead_id, Lead.organization_id == user.organization_id).first()
        if not lead:
            raise HTTPException(404, "Lead not found")
    project = Project(**payload.model_dump(), organization_id=user.organization_id, owner_user_id=user.id)
    db.add(project); db.commit(); db.refresh(project)
    return project

@router.post("/generate", response_model=ProjectGenerateOut)
def generate_project(payload: ProjectGenerateIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    generated = PMService(db, user.organization_id, user.id).generate_project(
        name=payload.name,
        project_type=payload.project_type,
        goal=payload.goal,
        lead_id=payload.lead_id,
        template_name=payload.template_name,
        auto_queue_openclaw=payload.auto_queue_openclaw,
    )
    return {
        "project": generated.project,
        "milestones_created": generated.milestones_created,
        "tasks_created": generated.tasks_created,
        "agent_actions_created": generated.agent_actions_created,
    }

@router.get("/overview")
def pm_overview(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = user.organization_id
    total = db.query(Project).filter(Project.organization_id == org).count()
    active = db.query(Project).filter(Project.organization_id == org, Project.status == "active").count()
    blocked = db.query(PMTask).filter(PMTask.organization_id == org, PMTask.status == "blocked").count()
    pending_approvals = db.query(ProjectApproval).filter(ProjectApproval.organization_id == org, ProjectApproval.status == "requested").count()
    queued_agent_tasks = db.query(AgentAction).filter(AgentAction.organization_id == org, AgentAction.action_type == "pm_task", AgentAction.status == "queued").count()
    by_status_rows = db.query(PMTask.status, func.count(PMTask.id)).filter(PMTask.organization_id == org).group_by(PMTask.status).all()
    return {
        "projects_total": total,
        "projects_active": active,
        "blocked_tasks": blocked,
        "pending_approvals": pending_approvals,
        "queued_agent_tasks": queued_agent_tasks,
        "tasks_by_status": {str(status.value if hasattr(status, 'value') else status): count for status, count in by_status_rows},
    }

@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return ensure_project(db, user.organization_id, project_id)

@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(project_id: str, payload: ProjectUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = ensure_project(db, user.organization_id, project_id)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(project, k, v)
    db.commit(); db.refresh(project)
    return project

@router.get("/{project_id}/board", response_model=ProjectBoardOut)
def project_board(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = ensure_project(db, user.organization_id, project_id)
    milestones = db.query(ProjectMilestone).filter(ProjectMilestone.project_id == project.id, ProjectMilestone.organization_id == user.organization_id).order_by(ProjectMilestone.position.asc()).all()
    tasks = db.query(PMTask).filter(PMTask.project_id == project.id, PMTask.organization_id == user.organization_id).order_by(PMTask.created_at.asc()).all()
    grouped = {}
    for task in tasks:
        key = task.status.value if hasattr(task.status, "value") else str(task.status)
        grouped.setdefault(key, []).append(task)
    blockers = [t for t in tasks if t.status == PMTaskStatus.blocked or t.blocked_reason]
    approvals = db.query(ProjectApproval).filter(ProjectApproval.project_id == project.id, ProjectApproval.organization_id == user.organization_id, ProjectApproval.status == ApprovalStatus.requested).all()
    return {"project": project, "milestones": milestones, "tasks_by_status": grouped, "blockers": blockers, "pending_approvals": approvals}

@router.post("/{project_id}/milestones", response_model=MilestoneOut)
def create_milestone(project_id: str, payload: MilestoneCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_project(db, user.organization_id, project_id)
    milestone = ProjectMilestone(**payload.model_dump(), project_id=project_id, organization_id=user.organization_id)
    db.add(milestone); db.commit(); db.refresh(milestone)
    return milestone

@router.get("/{project_id}/tasks", response_model=list[PMTaskOut])
def list_project_tasks(project_id: str, status: str | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_project(db, user.organization_id, project_id)
    query = db.query(PMTask).filter(PMTask.project_id == project_id, PMTask.organization_id == user.organization_id)
    if status:
        query = query.filter(PMTask.status == status)
    return query.order_by(PMTask.created_at.asc()).all()

@router.post("/{project_id}/tasks", response_model=PMTaskOut)
def create_project_task(project_id: str, payload: PMTaskCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_project(db, user.organization_id, project_id)
    data = payload.model_dump()
    data["project_id"] = project_id
    task = PMTask(**data, organization_id=user.organization_id)
    db.add(task); db.commit(); db.refresh(task)
    return task

@router.patch("/{project_id}/tasks/{task_id}", response_model=PMTaskOut)
def update_project_task(project_id: str, task_id: str, payload: PMTaskUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_project(db, user.organization_id, project_id)
    task = db.query(PMTask).filter(PMTask.id == task_id, PMTask.project_id == project_id, PMTask.organization_id == user.organization_id).first()
    if not task:
        raise HTTPException(404, "PM task not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(task, k, v)
    db.commit(); db.refresh(task)
    return task

@router.post("/{project_id}/tasks/{task_id}/queue-openclaw")
def queue_project_task(project_id: str, task_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_project(db, user.organization_id, project_id)
    task = db.query(PMTask).filter(PMTask.id == task_id, PMTask.project_id == project_id, PMTask.organization_id == user.organization_id).first()
    if not task:
        raise HTTPException(404, "PM task not found")
    action = PMService(db, user.organization_id, user.id).queue_task_for_openclaw(task)
    return {"agent_action_id": action.id, "agent_name": action.agent_name, "status": action.status.value}

@router.post("/{project_id}/comments", response_model=ProjectCommentOut)
def create_comment(project_id: str, payload: ProjectCommentCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_project(db, user.organization_id, project_id)
    comment = ProjectComment(**payload.model_dump(), project_id=project_id, organization_id=user.organization_id, author_user_id=user.id)
    db.add(comment); db.commit(); db.refresh(comment)
    return comment

@router.post("/{project_id}/approvals", response_model=ProjectApprovalOut)
def create_approval(project_id: str, payload: ProjectApprovalCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_project(db, user.organization_id, project_id)
    approval = ProjectApproval(**payload.model_dump(), project_id=project_id, organization_id=user.organization_id, requested_by_user_id=user.id)
    db.add(approval); db.commit(); db.refresh(approval)
    return approval

@router.patch("/{project_id}/approvals/{approval_id}", response_model=ProjectApprovalOut)
def decide_approval(project_id: str, approval_id: str, payload: ProjectApprovalUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_project(db, user.organization_id, project_id)
    approval = db.query(ProjectApproval).filter(ProjectApproval.id == approval_id, ProjectApproval.project_id == project_id, ProjectApproval.organization_id == user.organization_id).first()
    if not approval:
        raise HTTPException(404, "Approval not found")
    approval.status = payload.status
    approval.decision_note = payload.decision_note
    approval.approver_user_id = user.id
    if approval.task_id and payload.status == ApprovalStatus.approved:
        task = db.query(PMTask).filter(PMTask.id == approval.task_id, PMTask.organization_id == user.organization_id).first()
        if task:
            task.status = PMTaskStatus.done
    db.commit(); db.refresh(approval)
    return approval
