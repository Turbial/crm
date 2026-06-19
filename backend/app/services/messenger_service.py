from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.services.openclaw_bridge import OpenClawBridge, OpenClawTask
from app.models import (
    AgentAction, AgentActionStatus, AuditLog, Channel, CommandExecution, CommandStatus,
    Communication, Direction, Lead, LeadStatus, MessengerChannel, MessengerMessage,
    MessengerThread, Opportunity, OpportunityStage, Task, TaskPriority, TaskStatus,
    Campaign, CampaignStatus, Workflow, AutomationRun, Appointment, Quote, ReviewRequest, ReviewStatus,
    Project, PMTask, ProjectApproval, ProjectType, PMTaskStatus,
)
from app.services.pm_service import PMService
from app.services.kanban_service import KanbanService

@dataclass
class CommandPlan:
    intent: str
    summary: str
    steps: list[dict]
    requires_approval: bool = False
    target_type: str | None = None
    target_id: str | None = None

class MessengerService:
    """Deterministic command router for the Mighty text messenger.

    The service is intentionally rules-first so it is testable, safe, and tenant-scoped.
    Later, an LLM/OpenClaw parser can produce the same CommandPlan shape and this
    executor can remain the permissioned state-changing layer.
    """
    def __init__(self, db: Session, organization_id: str, user_id: str | None = None):
        self.db = db
        self.organization_id = organization_id
        self.user_id = user_id

    def get_or_create_thread(self, thread_id: str | None, channel: str = "web") -> MessengerThread:
        if thread_id:
            thread = self.db.query(MessengerThread).filter(
                MessengerThread.id == thread_id,
                MessengerThread.organization_id == self.organization_id,
            ).first()
            if thread:
                return thread
        thread = MessengerThread(
            organization_id=self.organization_id,
            owner_user_id=self.user_id,
            channel=MessengerChannel(channel) if channel in {c.value for c in MessengerChannel} else MessengerChannel.web,
            title="Mighty Command",
        )
        self.db.add(thread); self.db.commit(); self.db.refresh(thread)
        return thread

    def handle(self, text: str, thread_id: str | None = None, channel: str = "web", dry_run: bool = False, require_approval_for_external_actions: bool = True):
        thread = self.get_or_create_thread(thread_id, channel)
        user_msg = MessengerMessage(
            organization_id=self.organization_id,
            thread_id=thread.id,
            sender_type="user",
            sender_name="Owner",
            body=text,
        )
        self.db.add(user_msg); self.db.commit(); self.db.refresh(user_msg)

        plan = self.plan(text, require_approval_for_external_actions)
        execution = CommandExecution(
            organization_id=self.organization_id,
            thread_id=thread.id,
            message_id=user_msg.id,
            actor_user_id=self.user_id,
            raw_text=text,
            intent=plan.intent,
            status=CommandStatus.parsed,
            target_type=plan.target_type,
            target_id=plan.target_id,
            plan_json={"summary": plan.summary, "steps": plan.steps},
            requires_approval=plan.requires_approval,
        )
        self.db.add(execution); self.db.commit(); self.db.refresh(execution)

        if dry_run or plan.requires_approval:
            execution.status = CommandStatus.needs_approval if plan.requires_approval else CommandStatus.completed
            execution.result_json = {"dry_run": dry_run, "message": plan.summary}
            answer = self.render_plan(plan, dry_run=dry_run)
        else:
            execution.status = CommandStatus.running
            self.db.commit()
            try:
                result = self.execute(plan, text)
                execution.status = CommandStatus.completed
                execution.result_json = result
                answer = self.render_result(plan, result)
            except Exception as exc:  # defensive audit trail
                execution.status = CommandStatus.failed
                execution.error = str(exc)
                answer = f"I could not complete that command: {exc}"
        self.db.add(AuditLog(
            organization_id=self.organization_id,
            actor_user_id=self.user_id,
            actor_type="messenger",
            event=f"command.{execution.intent}.{execution.status.value if hasattr(execution.status, 'value') else execution.status}",
            entity_type=execution.target_type,
            entity_id=execution.target_id,
            metadata_json={"text": text[:500], "execution_id": execution.id},
        ))
        assistant_msg = MessengerMessage(
            organization_id=self.organization_id,
            thread_id=thread.id,
            sender_type="assistant",
            sender_name="MightyMax",
            body=answer,
            metadata_json={"execution_id": execution.id, "intent": execution.intent},
        )
        self.db.add(assistant_msg); self.db.commit(); self.db.refresh(assistant_msg); self.db.refresh(execution)
        return thread, user_msg, assistant_msg, execution, self.suggestions()

    def plan(self, text: str, require_approval_for_external_actions: bool = True) -> CommandPlan:
        t = text.lower().strip()
        if any(x in t for x in ["dashboard", "report", "summary", "what happened", "today"]):
            return CommandPlan("report", "Prepare an executive CRM summary.", [{"action": "aggregate_crm_metrics"}])
        if any(x in t for x in ["follow up", "follow-up", "call leads", "email leads", "text leads"]):
            external = any(x in t for x in ["call", "email", "text", "sms"])
            return CommandPlan("bulk_follow_up", "Queue follow-up actions for matching leads.", [{"action": "find_matching_leads"}, {"action": "queue_agent_actions"}], requires_approval=external and require_approval_for_external_actions, target_type="lead")
        if "create lead" in t or "add lead" in t or "new lead" in t:
            return CommandPlan("create_lead", "Create a lead from the message.", [{"action": "extract_contact"}, {"action": "insert_lead"}], target_type="lead")
        if any(x in t for x in ["kanban", "board", "move task", "put task", "mark task", "block task", "unblock task", "create pm task", "add pm task", "pm bot"]):
            if any(x in t for x in ["show", "kanban", "board", "columns"]) and not any(x in t for x in ["move task", "put task", "mark task", "block task", "unblock task", "create pm task", "add pm task"]):
                return CommandPlan("pm_kanban_board", "Show the project Kanban board with task counts by column.", [{"action": "resolve_project"}, {"action": "load_kanban_columns"}, {"action": "group_tasks"}], target_type="project")
            if any(x in t for x in ["move task", "put task", "mark task", "block task", "unblock task"]):
                return CommandPlan("pm_kanban_move", "Move a PM task/card on the Kanban board.", [{"action": "resolve_project"}, {"action": "resolve_task"}, {"action": "move_card"}, {"action": "audit_move"}], target_type="pm_task")
            if "create pm task" in t or "add pm task" in t:
                return CommandPlan("pm_kanban_create_task", "Create a PM task card from the messenger bot.", [{"action": "resolve_project"}, {"action": "extract_title"}, {"action": "create_card"}], target_type="pm_task")
            return CommandPlan("pm_kanban_board", "Show the project Kanban board with task counts by column.", [{"action": "resolve_project"}, {"action": "load_kanban_columns"}, {"action": "group_tasks"}], target_type="project")
        if "task" in t or "remind" in t:
            return CommandPlan("create_task", "Create a CRM task.", [{"action": "parse_task"}, {"action": "insert_task"}], target_type="task")
        if "appointment" in t or "meeting" in t or "schedule" in t or "book" in t:
            return CommandPlan("schedule_appointment", "Create a placeholder appointment for the requested lead/customer.", [{"action": "find_or_create_lead"}, {"action": "insert_appointment"}], target_type="appointment")
        if "quote" in t or "estimate" in t or "proposal" in t:
            return CommandPlan("create_quote", "Create a draft quote/estimate.", [{"action": "find_lead"}, {"action": "insert_quote"}], target_type="quote")
        if "campaign" in t:
            return CommandPlan("create_campaign", "Create a draft campaign.", [{"action": "parse_campaign"}, {"action": "insert_campaign"}], target_type="campaign")
        if "review" in t:
            external = any(x in t for x in ["send", "text", "sms", "email"])
            return CommandPlan("review_request", "Create review request records.", [{"action": "find_customers"}, {"action": "create_review_requests"}], requires_approval=external and require_approval_for_external_actions, target_type="review_request")
        if "workflow" in t or "automation" in t:
            return CommandPlan("run_workflow", "Run a workflow preview.", [{"action": "resolve_workflow"}, {"action": "record_automation_run"}], target_type="workflow")
        if any(x in t for x in ["kanban", "board", "move task", "put task", "mark task", "block task", "unblock task", "create pm task", "pm bot"]):
            if any(x in t for x in ["show", "kanban", "board", "columns"]):
                return CommandPlan("pm_kanban_board", "Show the project Kanban board with task counts by column.", [{"action": "resolve_project"}, {"action": "load_kanban_columns"}, {"action": "group_tasks"}], target_type="project")
            if any(x in t for x in ["move task", "put task", "mark task", "block task", "unblock task"]):
                return CommandPlan("pm_kanban_move", "Move a PM task/card on the Kanban board.", [{"action": "resolve_project"}, {"action": "resolve_task"}, {"action": "move_card"}, {"action": "audit_move"}], target_type="pm_task")
            if "create pm task" in t or "add pm task" in t:
                return CommandPlan("pm_kanban_create_task", "Create a PM task card from the messenger bot.", [{"action": "resolve_project"}, {"action": "extract_title"}, {"action": "create_card"}], target_type="pm_task")
            return CommandPlan("pm_kanban_board", "Show the project Kanban board with task counts by column.", [{"action": "resolve_project"}, {"action": "load_kanban_columns"}, {"action": "group_tasks"}], target_type="project")
        if any(x in t for x in ["project", "pm ", "milestone", "blocker", "blocked tasks", "launch website", "build website"]):
            if any(x in t for x in ["blocked", "blocker", "what is stuck", "what's stuck"]):
                return CommandPlan("pm_blockers", "List PM blockers and approvals.", [{"action": "find_blocked_pm_tasks"}, {"action": "find_pending_approvals"}], target_type="project")
            if any(x in t for x in ["build website", "launch website", "create project", "new project", "start project", "generate project"]):
                return CommandPlan("pm_generate_project", "Generate a full PM project with milestones, tasks, and OpenClaw assignments.", [{"action": "select_template"}, {"action": "create_project"}, {"action": "create_milestones_tasks"}, {"action": "queue_openclaw_pm_tasks"}], target_type="project")
            return CommandPlan("pm_summary", "Prepare a project management summary.", [{"action": "aggregate_projects"}, {"action": "aggregate_pm_tasks"}], target_type="project")
        if "openclaw" in t or "sales agent" in t or "salesagent" in t or "revenue agent" in t or "revenueagent" in t or "operator agent" in t or "operatoragent" in t or "website agent" in t or "websiteagent" in t or "review agent" in t or "reviewagent" in t or "qa agent" in t or "qaagent" in t or "manager agent" in t or "manageragent" in t:
            external = any(x in t for x in ["send", "sms", "email", "call", "publish", "invoice", "payment"])
            return CommandPlan("openclaw_task", "Queue a tenant-scoped OpenClaw agent task.", [{"action": "select_agent"}, {"action": "queue_openclaw_task"}], requires_approval=external and require_approval_for_external_actions, target_type="agent_action")
        return CommandPlan("general_command", "Capture this as an agent instruction and internal note.", [{"action": "queue_general_agent_action"}], target_type="agent_action")

    def execute(self, plan: CommandPlan, text: str) -> dict:
        handlers = {
            "report": self._report,
            "create_lead": self._create_lead,
            "bulk_follow_up": self._bulk_follow_up,
            "create_task": self._create_task,
            "schedule_appointment": self._schedule_appointment,
            "create_quote": self._create_quote,
            "create_campaign": self._create_campaign,
            "review_request": self._review_request,
            "run_workflow": self._run_workflow,
            "pm_summary": self._pm_summary,
            "pm_blockers": self._pm_blockers,
            "pm_generate_project": self._pm_generate_project,
            "pm_kanban_board": self._pm_kanban_board,
            "pm_kanban_move": self._pm_kanban_move,
            "pm_kanban_create_task": self._pm_kanban_create_task,
            "openclaw_task": self._openclaw_task,
            "general_command": self._general_command,
        }
        return handlers.get(plan.intent, self._general_command)(text)

    def _report(self, text: str) -> dict:
        leads_total = self.db.query(Lead).filter(Lead.organization_id == self.organization_id).count()
        open_tasks = self.db.query(Task).filter(Task.organization_id == self.organization_id, Task.status != TaskStatus.done).count()
        new_leads = self.db.query(Lead).filter(Lead.organization_id == self.organization_id, Lead.status == LeadStatus.new).count()
        pipeline = self.db.query(func.coalesce(func.sum(Opportunity.value), 0)).filter(Opportunity.organization_id == self.organization_id, Opportunity.stage != OpportunityStage.lost).scalar() or 0
        recent = self.db.query(AgentAction).filter(AgentAction.organization_id == self.organization_id).order_by(AgentAction.created_at.desc()).limit(5).all()
        return {"leads_total": leads_total, "new_leads": new_leads, "open_tasks": open_tasks, "pipeline_value": float(pipeline), "recent_agent_actions": [a.action_type for a in recent]}

    def _create_lead(self, text: str) -> dict:
        name = self._extract_after(text, ["lead", "called", "name is"]) or "New Lead"
        email = self._extract_email(text)
        phone = self._extract_phone(text)
        lead = Lead(organization_id=self.organization_id, name=name[:120], email=email, phone=phone, source="messenger", status=LeadStatus.new, metadata_json={"source_text": text})
        self.db.add(lead); self.db.commit(); self.db.refresh(lead)
        return {"lead_id": lead.id, "name": lead.name, "email": lead.email, "phone": lead.phone}

    def _bulk_follow_up(self, text: str) -> dict:
        status = LeadStatus.new if "new" in text.lower() else None
        q = self.db.query(Lead).filter(Lead.organization_id == self.organization_id)
        if status:
            q = q.filter(Lead.status == status)
        leads = q.order_by(Lead.created_at.desc()).limit(25).all()
        channel = "send_sms" if any(x in text.lower() for x in ["sms", "text"]) else "send_email" if "email" in text.lower() else "call"
        actions = []
        for lead in leads:
            action = AgentAction(organization_id=self.organization_id, lead_id=lead.id, agent_name="MessengerSalesAgent", action_type=channel, instruction=text, status=AgentActionStatus.queued, metadata_json={"queued_by": "messenger"})
            self.db.add(action); actions.append(action)
        self.db.commit()
        return {"queued": len(actions), "action_type": channel, "lead_ids": [a.lead_id for a in actions]}

    def _create_task(self, text: str) -> dict:
        title = re.sub(r"^(create|add)?\s*(task|remind me to)\s*", "", text, flags=re.I).strip() or text
        task = Task(organization_id=self.organization_id, title=title[:200], description=text, priority=TaskPriority.medium)
        self.db.add(task); self.db.commit(); self.db.refresh(task)
        return {"task_id": task.id, "title": task.title}

    def _schedule_appointment(self, text: str) -> dict:
        starts = datetime.utcnow() + timedelta(days=1)
        appointment = Appointment(organization_id=self.organization_id, title=text[:160], starts_at=starts, ends_at=starts + timedelta(hours=1), notes="Created from Mighty Messenger command")
        self.db.add(appointment); self.db.commit(); self.db.refresh(appointment)
        return {"appointment_id": appointment.id, "title": appointment.title, "starts_at": appointment.starts_at.isoformat()}

    def _create_quote(self, text: str) -> dict:
        amount = self._extract_amount(text) or 0
        quote = Quote(organization_id=self.organization_id, title=text[:160], subtotal=amount, total=amount, line_items=[{"description": text[:120], "amount": amount}])
        self.db.add(quote); self.db.commit(); self.db.refresh(quote)
        return {"quote_id": quote.id, "title": quote.title, "total": quote.total}

    def _create_campaign(self, text: str) -> dict:
        campaign = Campaign(organization_id=self.organization_id, name=text[:120], status=CampaignStatus.draft, goal="Created by messenger", message_template=text)
        self.db.add(campaign); self.db.commit(); self.db.refresh(campaign)
        return {"campaign_id": campaign.id, "name": campaign.name, "status": campaign.status.value}

    def _review_request(self, text: str) -> dict:
        req = ReviewRequest(organization_id=self.organization_id, customer_name="Customer from messenger", status=ReviewStatus.requested, private_feedback=text)
        self.db.add(req); self.db.commit(); self.db.refresh(req)
        return {"review_request_id": req.id, "status": req.status.value if hasattr(req.status, 'value') else req.status}

    def _run_workflow(self, text: str) -> dict:
        run = AutomationRun(organization_id=self.organization_id, status=AgentActionStatus.completed, trigger_payload={"command": text}, log=[{"step": "messenger_trigger", "ok": True}, {"step": "workflow_preview", "ok": True}])
        self.db.add(run); self.db.commit(); self.db.refresh(run)
        return {"automation_run_id": run.id, "status": run.status.value}

    def _pm_summary(self, text: str) -> dict:
        projects_total = self.db.query(Project).filter(Project.organization_id == self.organization_id).count()
        active_projects = self.db.query(Project).filter(Project.organization_id == self.organization_id, Project.status == "active").count()
        open_pm_tasks = self.db.query(PMTask).filter(PMTask.organization_id == self.organization_id, PMTask.status.in_(["ready", "in_progress", "review", "blocked"])).count()
        pending_approvals = self.db.query(ProjectApproval).filter(ProjectApproval.organization_id == self.organization_id, ProjectApproval.status == "requested").count()
        recent_projects = self.db.query(Project).filter(Project.organization_id == self.organization_id).order_by(Project.updated_at.desc()).limit(5).all()
        return {"projects_total": projects_total, "active_projects": active_projects, "open_pm_tasks": open_pm_tasks, "pending_approvals": pending_approvals, "recent_projects": [p.name for p in recent_projects]}

    def _pm_blockers(self, text: str) -> dict:
        blocked = self.db.query(PMTask).filter(PMTask.organization_id == self.organization_id, PMTask.status == PMTaskStatus.blocked).order_by(PMTask.updated_at.desc()).limit(20).all()
        approvals = self.db.query(ProjectApproval).filter(ProjectApproval.organization_id == self.organization_id, ProjectApproval.status == "requested").order_by(ProjectApproval.created_at.desc()).limit(20).all()
        return {"blocked_tasks": [{"id": t.id, "title": t.title, "reason": t.blocked_reason} for t in blocked], "pending_approvals": [{"id": a.id, "title": a.title} for a in approvals]}

    def _pm_generate_project(self, text: str) -> dict:
        lower = text.lower()
        ptype = ProjectType.website if "website" in lower or "site" in lower else ProjectType.marketing if "marketing" in lower or "campaign" in lower else ProjectType.crm_setup if "crm" in lower else ProjectType.review_latch if "review" in lower else ProjectType.custom
        name = re.sub(r"^(please\s+)?(build|launch|create|start|generate|new)\s+(a\s+)?(project\s+)?", "", text, flags=re.I).strip(" .")
        name = name[:120] or "Mighty Project"
        generated = PMService(self.db, self.organization_id, self.user_id).generate_project(name=name, project_type=ptype, goal=text, auto_queue_openclaw=True)
        return {"project_id": generated.project.id, "project_name": generated.project.name, "project_type": generated.project.project_type.value, "milestones_created": generated.milestones_created, "tasks_created": generated.tasks_created, "agent_actions_created": generated.agent_actions_created}

    def _pm_kanban_board(self, text: str) -> dict:
        svc = KanbanService(self.db, self.organization_id, self.user_id)
        project = svc.find_project_by_text(text)
        if not project:
            return {"error": "No project found. Create a project first.", "columns": []}
        board = svc.board(project.id)
        columns = []
        for item in board["columns"]:
            col = item["column"]
            tasks = item["tasks"][:8]
            columns.append({
                "key": col.key,
                "label": col.label,
                "count": item["count"],
                "wip_over_limit": item["wip_over_limit"],
                "tasks": [{"id": t.id, "short_id": t.id[:8], "title": t.title, "assignee_agent": t.assignee_agent} for t in tasks],
            })
        return {
            "project_id": project.id,
            "project_name": project.name,
            "total_tasks": board["total_tasks"],
            "blocked_count": board["blocked_count"],
            "done_count": board["done_count"],
            "columns": columns,
            "commands": board["next_recommended_commands"],
        }

    def _pm_kanban_move(self, text: str) -> dict:
        svc = KanbanService(self.db, self.organization_id, self.user_id)
        project = svc.find_project_by_text(text)
        if not project:
            return {"error": "No project found."}
        task = svc.find_task_by_text(project.id, text)
        if not task:
            return {"error": "No task found on that project."}
        status = svc.parse_status(text)
        if "unblock" in text.lower() and status is None:
            status = PMTaskStatus.ready
        if status is None:
            status = PMTaskStatus.done if any(x in text.lower() for x in ["done", "complete", "completed"]) else PMTaskStatus.in_progress
        blocked_reason = None
        m = re.search(r"because\s+(.+)$", text, re.I)
        if m:
            blocked_reason = m.group(1).strip()
        result = svc.move_task(project.id, task.id, status=status, blocked_reason=blocked_reason)
        return {
            "project_id": project.id,
            "project_name": project.name,
            "task_id": result.task.id,
            "task_short_id": result.task.id[:8],
            "task_title": result.task.title,
            "old_status": result.old_status,
            "new_status": result.new_status,
            "blocked_reason": result.task.blocked_reason,
        }

    def _pm_kanban_create_task(self, text: str) -> dict:
        svc = KanbanService(self.db, self.organization_id, self.user_id)
        project = svc.find_project_by_text(text)
        if not project:
            return {"error": "No project found. Create a project first."}
        title = re.sub(r"^(create|add)\s+pm\s+task\s*", "", text, flags=re.I).strip(" .")
        title = re.sub(r"\s+(for|in|on)\s+.+$", "", title, flags=re.I).strip(" .") or "New PM task"
        agent = None
        for candidate in ["WebsiteAgent", "RevenueAgent", "SalesAgent", "QAAgent", "ManagerAgent", "OperatorAgent", "ReviewAgent"]:
            if candidate.lower() in text.lower():
                agent = candidate
                break
        task = svc.create_task_from_bot(project.id, title=title, assignee_agent=agent)
        return {"project_id": project.id, "project_name": project.name, "task_id": task.id, "task_short_id": task.id[:8], "task_title": task.title, "assignee_agent": task.assignee_agent, "status": task.status.value}

    def _openclaw_task(self, text: str) -> dict:
        lower = text.lower()
        agent = "ManagerAgent"
        if "sales agent" in lower or "salesagent" in lower:
            agent = "SalesAgent"
        elif "revenue agent" in lower or "revenueagent" in lower:
            agent = "RevenueAgent"
        elif "operator agent" in lower or "operatoragent" in lower:
            agent = "OperatorAgent"
        elif "website agent" in lower or "websiteagent" in lower:
            agent = "WebsiteAgent"
        elif "review agent" in lower or "reviewagent" in lower:
            agent = "ReviewAgent"
        elif "qa agent" in lower or "qaagent" in lower:
            agent = "QAAgent"
        task_type = "general"
        if "lead" in lower or "prospect" in lower:
            task_type = "research_leads" if agent == "RevenueAgent" else "qualify_lead"
        if "call" in lower:
            task_type = "call_lead"
        if "email" in lower:
            task_type = "send_email"
        if "sms" in lower or "text" in lower:
            task_type = "send_sms"
        if "website" in lower or "site" in lower:
            task_type = "update_website"
        if "review" in lower:
            task_type = "request_review"
        action = OpenClawBridge(self.db, self.organization_id, self.user_id).queue_task(OpenClawTask(
            agent_name=agent,
            task_type=task_type,
            instruction=text,
            priority="normal",
            context={"source": "mighty_messenger"},
            requires_approval=False,
        ))
        return {"agent_action_id": action.id, "agent_name": action.agent_name, "task_type": action.action_type, "status": action.status.value}

    def _general_command(self, text: str) -> dict:
        action = AgentAction(organization_id=self.organization_id, agent_name="MightyCommandAgent", action_type="general_instruction", instruction=text, status=AgentActionStatus.queued, metadata_json={"source": "messenger"})
        self.db.add(action); self.db.commit(); self.db.refresh(action)
        return {"agent_action_id": action.id, "status": action.status.value, "instruction": text}

    def render_plan(self, plan: CommandPlan, dry_run: bool = False) -> str:
        prefix = "Dry run — " if dry_run else "Approval needed — "
        steps = ", ".join(s["action"] for s in plan.steps)
        return f"{prefix}{plan.summary} Steps: {steps}."

    def render_result(self, plan: CommandPlan, result: dict) -> str:
        if plan.intent == "report":
            return f"CRM summary: {result['leads_total']} leads, {result['new_leads']} new, {result['open_tasks']} open tasks, ${result['pipeline_value']:,.0f} pipeline."
        if plan.intent == "create_lead":
            return f"Lead created: {result['name']} ({result.get('email') or 'no email'}, {result.get('phone') or 'no phone'})."
        if plan.intent == "bulk_follow_up":
            return f"Queued {result['queued']} {result['action_type']} actions for matching leads."
        if plan.intent == "create_task":
            return f"Task created: {result['title']}."
        if plan.intent == "schedule_appointment":
            return f"Appointment created: {result['title']} at {result['starts_at']}."
        if plan.intent == "create_quote":
            return f"Draft quote created for ${result['total']:,.0f}."
        if plan.intent == "create_campaign":
            return f"Draft campaign created: {result['name']}."
        if plan.intent == "review_request":
            return "Review request record created."
        if plan.intent == "run_workflow":
            return "Workflow preview run recorded."
        if plan.intent == "pm_summary":
            return f"PM summary: {result['projects_total']} projects, {result['active_projects']} active, {result['open_pm_tasks']} open PM tasks, {result['pending_approvals']} approvals pending."
        if plan.intent == "pm_blockers":
            return f"PM blockers: {len(result['blocked_tasks'])} blocked tasks and {len(result['pending_approvals'])} approvals waiting."
        if plan.intent == "pm_generate_project":
            return f"Project created: {result['project_name']} with {result['milestones_created']} milestones, {result['tasks_created']} tasks, and {result['agent_actions_created']} OpenClaw actions queued."
        if plan.intent == "pm_kanban_board":
            if result.get("error"):
                return result["error"]
            bits = [f"{c['label']}: {c['count']}" for c in result.get('columns', [])]
            return f"Kanban board for {result['project_name']}: " + ", ".join(bits) + f". Blocked: {result['blocked_count']}, Done: {result['done_count']}."
        if plan.intent == "pm_kanban_move":
            if result.get("error"):
                return result["error"]
            extra = f" Blocked reason: {result['blocked_reason']}." if result.get('blocked_reason') else ""
            return f"Moved task {result['task_short_id']} — {result['task_title']} from {result['old_status']} to {result['new_status']}.{extra}"
        if plan.intent == "pm_kanban_create_task":
            if result.get("error"):
                return result["error"]
            assignee = f" assigned to {result['assignee_agent']}" if result.get('assignee_agent') else ""
            return f"PM task created on {result['project_name']}: {result['task_title']} ({result['task_short_id']}){assignee}."
        if plan.intent == "openclaw_task":
            return f"OpenClaw task queued for {result['agent_name']}: {result['task_type']} ({result['status']})."
        return "Command captured and queued for the Mighty agent."

    def suggestions(self) -> list[str]:
        return [
            "Show me today's CRM summary",
            "Add lead John Smith john@example.com 555-123-4444",
            "Follow up with all new leads by SMS",
            "Create a quote for $1200 website redesign",
            "Create campaign for old website outreach",
            "Ask RevenueAgent to find 20 outdated contractor websites",
            "Build website for ABC Roofing",
            "Show PM blockers",
            "Show project summary",
            "Show Kanban board",
            "Move task <task id> to in progress",
            "Mark task <task id> done",
            "Create PM task QA homepage on mobile",
            "Ask QAAgent to check approval gates",
        ]

    def _extract_email(self, text: str) -> str | None:
        m = re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", text, re.I)
        return m.group(0) if m else None

    def _extract_phone(self, text: str) -> str | None:
        m = re.search(r"(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}", text)
        return m.group(0) if m else None

    def _extract_amount(self, text: str) -> float | None:
        m = re.search(r"\$?([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)", text)
        return float(m.group(1).replace(',', '')) if m else None

    def _extract_after(self, text: str, keys: list[str]) -> str | None:
        cleaned = text.strip()
        # Best effort: remove command words and contact data, keep name-like prefix.
        cleaned = re.sub(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", "", cleaned, flags=re.I)
        cleaned = re.sub(r"(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}", "", cleaned)
        cleaned = re.sub(r"\b(add|create|new|lead|called|named|name is)\b", "", cleaned, flags=re.I).strip(" :-,.")
        return cleaned or None
