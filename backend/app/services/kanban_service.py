from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models import (
    AgentAction, AgentActionStatus, AuditLog, KanbanColumn, PMTask, PMTaskStatus,
    Project, ProjectComment, ProjectPriority, AssigneeType
)
from app.services.pm_service import PMService

DEFAULT_COLUMNS = [
    {"key": "backlog", "label": "Backlog", "mapped_status": PMTaskStatus.backlog, "position": 1, "wip_limit": None, "is_done_column": False},
    {"key": "ready", "label": "Ready", "mapped_status": PMTaskStatus.ready, "position": 2, "wip_limit": None, "is_done_column": False},
    {"key": "in_progress", "label": "In Progress", "mapped_status": PMTaskStatus.in_progress, "position": 3, "wip_limit": 5, "is_done_column": False},
    {"key": "review", "label": "Review", "mapped_status": PMTaskStatus.review, "position": 4, "wip_limit": 5, "is_done_column": False},
    {"key": "blocked", "label": "Blocked", "mapped_status": PMTaskStatus.blocked, "position": 5, "wip_limit": None, "is_done_column": False},
    {"key": "done", "label": "Done", "mapped_status": PMTaskStatus.done, "position": 6, "wip_limit": None, "is_done_column": True},
]

STATUS_ALIASES = {
    "todo": PMTaskStatus.ready,
    "to do": PMTaskStatus.ready,
    "ready": PMTaskStatus.ready,
    "backlog": PMTaskStatus.backlog,
    "doing": PMTaskStatus.in_progress,
    "progress": PMTaskStatus.in_progress,
    "in progress": PMTaskStatus.in_progress,
    "working": PMTaskStatus.in_progress,
    "review": PMTaskStatus.review,
    "qa": PMTaskStatus.review,
    "blocked": PMTaskStatus.blocked,
    "stuck": PMTaskStatus.blocked,
    "done": PMTaskStatus.done,
    "complete": PMTaskStatus.done,
    "completed": PMTaskStatus.done,
    "cancel": PMTaskStatus.canceled,
    "canceled": PMTaskStatus.canceled,
}

@dataclass
class KanbanMoveResult:
    task: PMTask
    old_status: str
    new_status: str
    queued_agent_action_id: str | None = None

class KanbanService:
    def __init__(self, db: Session, organization_id: str, user_id: str | None = None):
        self.db = db
        self.organization_id = organization_id
        self.user_id = user_id

    def ensure_project(self, project_id: str) -> Project:
        project = self.db.query(Project).filter(Project.id == project_id, Project.organization_id == self.organization_id).first()
        if not project:
            raise HTTPException(404, "Project not found")
        return project

    def ensure_columns(self, project_id: str) -> list[KanbanColumn]:
        self.ensure_project(project_id)
        existing = self.db.query(KanbanColumn).filter(
            KanbanColumn.project_id == project_id,
            KanbanColumn.organization_id == self.organization_id,
        ).order_by(KanbanColumn.position.asc()).all()
        if existing:
            return existing
        columns = []
        for item in DEFAULT_COLUMNS:
            col = KanbanColumn(project_id=project_id, organization_id=self.organization_id, **item)
            self.db.add(col)
            columns.append(col)
        self.db.commit()
        for c in columns:
            self.db.refresh(c)
        return columns

    def add_column(self, project_id: str, **data) -> KanbanColumn:
        self.ensure_project(project_id)
        col = KanbanColumn(project_id=project_id, organization_id=self.organization_id, **data)
        self.db.add(col); self.db.commit(); self.db.refresh(col)
        return col

    def update_column(self, project_id: str, column_id: str, data: dict) -> KanbanColumn:
        self.ensure_project(project_id)
        col = self.db.query(KanbanColumn).filter(
            KanbanColumn.id == column_id,
            KanbanColumn.project_id == project_id,
            KanbanColumn.organization_id == self.organization_id,
        ).first()
        if not col:
            raise HTTPException(404, "Kanban column not found")
        for k, v in data.items():
            setattr(col, k, v)
        self.db.commit(); self.db.refresh(col)
        return col

    def board(self, project_id: str) -> dict:
        project = self.ensure_project(project_id)
        columns = self.ensure_columns(project_id)
        tasks = self.db.query(PMTask).filter(
            PMTask.project_id == project_id,
            PMTask.organization_id == self.organization_id,
        ).all()
        by_status: dict[str, list[PMTask]] = {}
        for task in tasks:
            key = task.status.value if hasattr(task.status, "value") else str(task.status)
            by_status.setdefault(key, []).append(task)
        column_payload = []
        for col in columns:
            status_key = col.mapped_status.value if hasattr(col.mapped_status, "value") else str(col.mapped_status)
            col_tasks = by_status.get(status_key, [])
            col_tasks.sort(key=lambda t: (self._task_position(t), t.created_at or datetime.utcnow()))
            column_payload.append({
                "column": col,
                "tasks": col_tasks,
                "count": len(col_tasks),
                "wip_over_limit": bool(col.wip_limit and len(col_tasks) > col.wip_limit),
            })
        return {
            "project": project,
            "columns": column_payload,
            "total_tasks": len(tasks),
            "blocked_count": len([t for t in tasks if t.status == PMTaskStatus.blocked]),
            "done_count": len([t for t in tasks if t.status == PMTaskStatus.done]),
            "next_recommended_commands": self.recommended_commands(project, tasks),
        }

    def move_task(self, project_id: str, task_id: str, column_key: str | None = None, status: PMTaskStatus | None = None, position: int | None = None, blocked_reason: str | None = None, output_summary: str | None = None, queue_openclaw: bool = False) -> KanbanMoveResult:
        self.ensure_project(project_id)
        task = self.db.query(PMTask).filter(
            PMTask.id == task_id,
            PMTask.project_id == project_id,
            PMTask.organization_id == self.organization_id,
        ).first()
        if not task:
            raise HTTPException(404, "PM task not found")
        old_status = task.status.value if hasattr(task.status, "value") else str(task.status)
        new_status = status
        if column_key:
            col = self.db.query(KanbanColumn).filter(
                KanbanColumn.project_id == project_id,
                KanbanColumn.organization_id == self.organization_id,
                KanbanColumn.key == column_key,
            ).first()
            if not col:
                raise HTTPException(404, "Kanban column not found")
            new_status = col.mapped_status
        if new_status is None:
            raise HTTPException(400, "column_key or status is required")
        task.status = new_status
        if new_status == PMTaskStatus.in_progress and not task.started_at:
            task.started_at = datetime.utcnow()
        if new_status == PMTaskStatus.done:
            task.completed_at = datetime.utcnow()
            if output_summary:
                task.output_summary = output_summary
        if new_status == PMTaskStatus.blocked:
            task.blocked_reason = blocked_reason or task.blocked_reason or "Moved to blocked from Kanban"
        elif blocked_reason is not None:
            task.blocked_reason = blocked_reason
        elif task.status != PMTaskStatus.blocked:
            task.blocked_reason = None
        meta = dict(task.metadata_json or {})
        if position is not None:
            meta["kanban_position"] = position
        meta["last_kanban_move"] = {"from": old_status, "to": new_status.value, "at": datetime.utcnow().isoformat()}
        task.metadata_json = meta
        queued_id = None
        if queue_openclaw:
            action = PMService(self.db, self.organization_id, self.user_id).queue_task_for_openclaw(task)
            queued_id = action.id
        self.db.add(AuditLog(
            organization_id=self.organization_id,
            actor_user_id=self.user_id,
            actor_type="kanban",
            event="pm.kanban.task_moved",
            entity_type="pm_task",
            entity_id=task.id,
            metadata_json={"project_id": project_id, "from": old_status, "to": new_status.value},
        ))
        self.db.commit(); self.db.refresh(task)
        return KanbanMoveResult(task=task, old_status=old_status, new_status=task.status.value, queued_agent_action_id=queued_id)

    def create_task_from_bot(self, project_id: str, title: str, assignee_agent: str | None = None, status: PMTaskStatus = PMTaskStatus.ready, priority: ProjectPriority = ProjectPriority.normal) -> PMTask:
        self.ensure_project(project_id)
        task = PMTask(
            organization_id=self.organization_id,
            project_id=project_id,
            title=title[:255],
            description="Created from Mighty PM messenger bot.",
            status=status,
            priority=priority,
            assignee_type=AssigneeType.agent if assignee_agent else AssigneeType.human,
            assignee_agent=assignee_agent,
            metadata_json={"source": "pm_messenger_bot"},
        )
        self.db.add(task)
        self.db.add(ProjectComment(
            organization_id=self.organization_id,
            project_id=project_id,
            task_id=None,
            author_user_id=self.user_id,
            body=f"Messenger bot created PM task: {title}",
            visibility="internal",
        ))
        self.db.commit(); self.db.refresh(task)
        return task

    def find_project_by_text(self, text: str) -> Project | None:
        projects = self.db.query(Project).filter(Project.organization_id == self.organization_id).order_by(Project.updated_at.desc()).limit(50).all()
        if not projects:
            return None
        lower = text.lower()
        for p in projects:
            if p.id in text or p.id[:8] in text or p.name.lower() in lower:
                return p
        # phrases like "for ABC Roofing" or "in ABC Roofing"
        m = re.search(r"(?:for|in|on)\s+(.+?)(?:\s+(?:move|task|board|kanban|to|into|as)\b|$)", text, re.I)
        if m:
            target = m.group(1).strip(" .:-").lower()
            for p in projects:
                if target and target in p.name.lower():
                    return p
        return projects[0]

    def find_task_by_text(self, project_id: str, text: str) -> PMTask | None:
        tasks = self.db.query(PMTask).filter(PMTask.project_id == project_id, PMTask.organization_id == self.organization_id).order_by(PMTask.updated_at.desc()).limit(200).all()
        if not tasks:
            return None
        lower = text.lower()
        for t in tasks:
            if t.id in text or t.id[:8] in text:
                return t
        quoted = re.findall(r"['\"]([^'\"]+)['\"]", text)
        for phrase in quoted:
            for t in tasks:
                if phrase.lower() in t.title.lower():
                    return t
        # Remove command words and compare on title tokens.
        cleaned = re.sub(r"\b(move|put|set|mark|task|card|to|into|as|done|complete|review|blocked|progress|ready|backlog|kanban|board|pm|for|in|on)\b", " ", lower)
        words = [w for w in re.split(r"\W+", cleaned) if len(w) >= 3]
        best = None; best_score = 0
        for t in tasks:
            title = t.title.lower()
            score = sum(1 for w in words if w in title)
            if score > best_score:
                best = t; best_score = score
        return best if best_score else tasks[0]

    def parse_status(self, text: str) -> PMTaskStatus | None:
        lower = text.lower()
        # Prefer the phrase after "to/into/as".
        m = re.search(r"(?:to|into|as)\s+([a-z_ ]+)", lower)
        candidates = [m.group(1).strip() if m else "", lower]
        for candidate in candidates:
            for phrase, status in sorted(STATUS_ALIASES.items(), key=lambda x: -len(x[0])):
                if phrase in candidate:
                    return status
        return None

    def _task_position(self, task: PMTask) -> int:
        meta = task.metadata_json or {}
        return int(meta.get("kanban_position", 1000))

    def recommended_commands(self, project: Project, tasks: list[PMTask]) -> list[str]:
        ready = next((t for t in tasks if t.status == PMTaskStatus.ready), None)
        review = next((t for t in tasks if t.status == PMTaskStatus.review), None)
        blocked = next((t for t in tasks if t.status == PMTaskStatus.blocked), None)
        cmds = [f"Show Kanban board for {project.name}"]
        if ready:
            cmds.append(f"Move task {ready.id[:8]} to in progress")
        if review:
            cmds.append(f"Move task {review.id[:8]} to done")
        if blocked:
            cmds.append(f"Unblock task {blocked.id[:8]}")
        cmds.append(f"Ask PM bot what is blocking {project.name}")
        return cmds
