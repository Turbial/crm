from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from sqlalchemy.orm import Session

from app.models import (
    AgentAction, AgentActionStatus, AssigneeType, PMTask, PMTaskStatus, Project,
    ProjectApproval, ProjectMilestone, ProjectPriority, ProjectStatus, ProjectTemplate,
    ProjectType,
)

WEBSITE_BLUEPRINT = {
    "milestones": [
        {"name": "Discovery", "tasks": [
            {"title": "Collect business profile", "agent": "ManagerAgent"},
            {"title": "Research competitors", "agent": "RevenueAgent"},
            {"title": "Define offer and CTA", "agent": "MarketingAgent"},
        ]},
        {"name": "Content", "tasks": [
            {"title": "Generate homepage copy", "agent": "WebsiteAgent"},
            {"title": "Generate services page copy", "agent": "WebsiteAgent"},
            {"title": "Generate SEO title and meta descriptions", "agent": "WebsiteAgent"},
        ]},
        {"name": "Build", "tasks": [
            {"title": "Create website structure", "agent": "WebsiteAgent"},
            {"title": "Build responsive homepage", "agent": "WebsiteAgent"},
            {"title": "Configure contact form", "agent": "WebsiteAgent"},
        ]},
        {"name": "QA & Launch", "tasks": [
            {"title": "QA mobile and desktop", "agent": "QAAgent"},
            {"title": "Request owner approval", "agent": "ManagerAgent", "approval": True},
            {"title": "Launch domain and publish", "agent": "OperatorAgent", "approval": True},
        ]},
    ]
}

MARKETING_BLUEPRINT = {
    "milestones": [
        {"name": "Strategy", "tasks": [
            {"title": "Define target audience", "agent": "MarketingAgent"},
            {"title": "Create offer and angle", "agent": "MarketingAgent"},
        ]},
        {"name": "Assets", "tasks": [
            {"title": "Draft campaign email", "agent": "SalesAgent"},
            {"title": "Create landing page brief", "agent": "WebsiteAgent"},
            {"title": "Generate social posts", "agent": "MarketingAgent"},
        ]},
        {"name": "Execution", "tasks": [
            {"title": "Queue outreach campaign", "agent": "OperatorAgent", "approval": True},
            {"title": "Track replies and conversions", "agent": "SalesAgent"},
        ]},
    ]
}

CRM_SETUP_BLUEPRINT = {
    "milestones": [
        {"name": "Setup", "tasks": [
            {"title": "Import leads and contacts", "agent": "OperatorAgent"},
            {"title": "Configure pipeline stages", "agent": "ManagerAgent"},
            {"title": "Create follow-up workflow", "agent": "ManagerAgent"},
        ]},
        {"name": "Validation", "tasks": [
            {"title": "Test lead capture", "agent": "QAAgent"},
            {"title": "Test messenger commands", "agent": "QAAgent"},
        ]},
    ]
}

REVIEW_BLUEPRINT = {
    "milestones": [
        {"name": "Review funnel", "tasks": [
            {"title": "Create QR review funnel", "agent": "ReviewAgent"},
            {"title": "Write SMS review request", "agent": "ReviewAgent"},
            {"title": "Configure negative feedback routing", "agent": "ReviewAgent"},
            {"title": "Request launch approval", "agent": "ManagerAgent", "approval": True},
        ]},
    ]
}

APP_BLUEPRINT = {
    "milestones": [
        {"name": "Product", "tasks": [
            {"title": "Define app requirements", "agent": "ManagerAgent"},
            {"title": "Create technical architecture", "agent": "DeveloperAgent"},
        ]},
        {"name": "Build", "tasks": [
            {"title": "Build backend API", "agent": "DeveloperAgent"},
            {"title": "Build frontend UI", "agent": "DeveloperAgent"},
            {"title": "Write tests", "agent": "QAAgent"},
        ]},
    ]
}

BLUEPRINTS = {
    ProjectType.website: WEBSITE_BLUEPRINT,
    ProjectType.marketing: MARKETING_BLUEPRINT,
    ProjectType.crm_setup: CRM_SETUP_BLUEPRINT,
    ProjectType.review_latch: REVIEW_BLUEPRINT,
    ProjectType.app_development: APP_BLUEPRINT,
    ProjectType.operations: MARKETING_BLUEPRINT,
    ProjectType.custom: {"milestones": [{"name": "Plan", "tasks": [{"title": "Break down project", "agent": "ManagerAgent"}]}]},
}

@dataclass
class GeneratedProject:
    project: Project
    milestones_created: int
    tasks_created: int
    agent_actions_created: int

class PMService:
    def __init__(self, db: Session, organization_id: str, user_id: str | None = None):
        self.db = db
        self.organization_id = organization_id
        self.user_id = user_id

    def create_default_templates(self) -> int:
        created = 0
        for project_type, blueprint in BLUEPRINTS.items():
            name = self.human_name(project_type)
            exists = self.db.query(ProjectTemplate).filter(
                ProjectTemplate.organization_id == self.organization_id,
                ProjectTemplate.name == name,
            ).first()
            if exists:
                continue
            tmpl = ProjectTemplate(
                organization_id=self.organization_id,
                name=name,
                project_type=project_type,
                description=f"Default MightyMax {name} delivery template.",
                default_agent="ManagerAgent",
                blueprint=blueprint,
                active=True,
            )
            self.db.add(tmpl)
            created += 1
        self.db.commit()
        return created

    def generate_project(self, name: str, project_type: ProjectType, goal: str | None = None, lead_id: str | None = None, template_name: str | None = None, auto_queue_openclaw: bool = True) -> GeneratedProject:
        self.create_default_templates()
        template = None
        if template_name:
            template = self.db.query(ProjectTemplate).filter(ProjectTemplate.organization_id == self.organization_id, ProjectTemplate.name == template_name).first()
        if not template:
            template = self.db.query(ProjectTemplate).filter(ProjectTemplate.organization_id == self.organization_id, ProjectTemplate.project_type == project_type, ProjectTemplate.active == True).first()
        blueprint = (template.blueprint if template else BLUEPRINTS.get(project_type, BLUEPRINTS[ProjectType.custom])) or BLUEPRINTS[ProjectType.custom]
        project = Project(
            organization_id=self.organization_id,
            owner_user_id=self.user_id,
            template_id=template.id if template else None,
            name=name,
            project_type=project_type,
            status=ProjectStatus.active,
            priority=ProjectPriority.normal,
            goal=goal or f"Complete {name}",
            lead_id=lead_id,
            metadata_json={"generated_by": "PMService", "template": template.name if template else None},
        )
        self.db.add(project); self.db.flush()
        m_count = t_count = a_count = 0
        for m_idx, milestone_def in enumerate(blueprint.get("milestones", []), start=1):
            milestone = ProjectMilestone(
                organization_id=self.organization_id,
                project_id=project.id,
                name=milestone_def.get("name", f"Milestone {m_idx}"),
                description=milestone_def.get("description"),
                position=m_idx,
                status=PMTaskStatus.ready,
            )
            self.db.add(milestone); self.db.flush(); m_count += 1
            for task_def in milestone_def.get("tasks", []):
                agent = task_def.get("agent", template.default_agent if template else "ManagerAgent")
                task = PMTask(
                    organization_id=self.organization_id,
                    project_id=project.id,
                    milestone_id=milestone.id,
                    title=task_def.get("title", "Project task"),
                    description=task_def.get("description") or f"Auto-generated task for {name}.",
                    status=PMTaskStatus.ready,
                    priority=ProjectPriority.normal,
                    assignee_type=AssigneeType.agent,
                    assignee_agent=agent,
                    estimate_minutes=int(task_def.get("estimate_minutes", 30)),
                    requires_approval=bool(task_def.get("approval", False)),
                    metadata_json={"template_task": task_def},
                )
                self.db.add(task); self.db.flush(); t_count += 1
                if auto_queue_openclaw:
                    action = AgentAction(
                        organization_id=self.organization_id,
                        agent_name=agent or "ManagerAgent",
                        action_type="pm_task",
                        instruction=f"Project: {name}\nTask: {task.title}\nGoal: {project.goal or ''}",
                        status=AgentActionStatus.queued,
                        metadata_json={"source": "pm_project_generation", "project_id": project.id, "pm_task_id": task.id, "requires_approval": task.requires_approval},
                    )
                    self.db.add(action); a_count += 1
        self.db.commit(); self.db.refresh(project)
        return GeneratedProject(project=project, milestones_created=m_count, tasks_created=t_count, agent_actions_created=a_count)

    def queue_task_for_openclaw(self, task: PMTask) -> AgentAction:
        action = AgentAction(
            organization_id=self.organization_id,
            agent_name=task.assignee_agent or "ManagerAgent",
            action_type="pm_task",
            instruction=f"Execute PM task: {task.title}\nDescription: {task.description or ''}",
            status=AgentActionStatus.queued,
            metadata_json={"source": "pm_task_queue", "project_id": task.project_id, "pm_task_id": task.id, "requires_approval": task.requires_approval},
        )
        task.status = PMTaskStatus.in_progress
        task.started_at = task.started_at or datetime.utcnow()
        self.db.add(action); self.db.commit(); self.db.refresh(action); self.db.refresh(task)
        return action

    def complete_task_from_agent(self, task_id: str, agent_name: str, output_summary: str, artifact_urls: list | None = None, cost_cents: int = 0, minutes: int = 0) -> PMTask:
        task = self.db.query(PMTask).filter(PMTask.id == task_id, PMTask.organization_id == self.organization_id).first()
        if not task:
            raise ValueError("PM task not found")
        task.status = PMTaskStatus.review if task.requires_approval else PMTaskStatus.done
        task.completed_at = None if task.requires_approval else datetime.utcnow()
        task.output_summary = output_summary
        task.artifact_urls = artifact_urls or []
        task.cost_cents = cost_cents
        task.actual_minutes = minutes
        self.db.commit(); self.db.refresh(task)
        if task.requires_approval:
            approval = ProjectApproval(
                organization_id=self.organization_id,
                project_id=task.project_id,
                task_id=task.id,
                requested_by_agent=agent_name,
                title=f"Approval needed: {task.title}",
                request_body=output_summary,
            )
            self.db.add(approval); self.db.commit()
        return task

    @staticmethod
    def human_name(project_type: ProjectType) -> str:
        return {
            ProjectType.website: "Website Build",
            ProjectType.marketing: "Marketing Campaign",
            ProjectType.crm_setup: "CRM Setup",
            ProjectType.review_latch: "ReviewLatch Setup",
            ProjectType.app_development: "App Development",
            ProjectType.operations: "Operations Sprint",
            ProjectType.custom: "Custom Project",
        }.get(project_type, "Custom Project")
