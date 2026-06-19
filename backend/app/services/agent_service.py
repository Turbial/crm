
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import AgentAction, Communication, Task, Note, Lead, AutomationRun, AgentActionStatus, Channel, Direction, TaskPriority
from app.services import events

class AgentService:
    """Deterministic local agent simulator.

    This is intentionally provider-free. Wire OpenAI/Claude/OpenClaw in the TODO hooks,
    but keep the CRM state changes, tenant boundaries and audit log here.
    """
    def __init__(self, db: Session, organization_id: str):
        self.db = db
        self.organization_id = organization_id

    def queue_action(self, agent_name: str, action_type: str, instruction: str, lead_id: str | None = None, metadata: dict | None = None):
        action = AgentAction(
            organization_id=self.organization_id,
            lead_id=lead_id,
            agent_name=agent_name,
            action_type=action_type,
            instruction=instruction,
            metadata_json=metadata or {},
        )
        self.db.add(action)
        self.db.commit()
        self.db.refresh(action)
        events.emit("agent_action.created", action=action)
        return action

    # AgentExecutor Protocol implementation
    def queue(self, agent_name: str, action_type: str, instruction: str, lead_id: str | None = None, metadata: dict | None = None) -> AgentAction:
        return self.queue_action(agent_name, action_type, instruction, lead_id, metadata)

    def run(self, action: AgentAction) -> AgentAction:
        return self.run_action(action)

    def record_result(self, action_id: str, result: dict) -> AgentAction:
        action = self.db.get(AgentAction, action_id)
        if not action:
            raise ValueError(f"AgentAction {action_id} not found")
        action.result = str(result.get("summary", ""))
        action.status = AgentActionStatus.completed
        self.db.commit()
        self.db.refresh(action)
        return action

    def run_action(self, action: AgentAction):
        action.status = AgentActionStatus.running
        start = datetime.utcnow()
        result = f"{action.agent_name} prepared {action.action_type}: {action.instruction[:180]}"
        if action.lead_id and action.action_type in {"send_email", "send_sms", "call", "follow_up"}:
            comm = Communication(
                organization_id=self.organization_id,
                lead_id=action.lead_id,
                channel=Channel.email if action.action_type == "send_email" else Channel.sms if action.action_type == "send_sms" else Channel.call,
                direction=Direction.outbound,
                subject=f"Agent {action.action_type}",
                content=result,
            )
            self.db.add(comm)
        if action.lead_id and action.action_type in {"follow_up", "qualify", "book_appointment"}:
            self.db.add(Task(
                organization_id=self.organization_id,
                lead_id=action.lead_id,
                title=f"Review agent result: {action.action_type}",
                description=result,
                priority=TaskPriority.medium,
            ))
        self.db.add(Note(organization_id=self.organization_id, lead_id=action.lead_id, content=result, is_agent_note=True))
        action.result = result
        action.status = AgentActionStatus.completed
        action.duration_ms = int((datetime.utcnow() - start).total_seconds() * 1000)
        self.db.commit(); self.db.refresh(action)
        return action

    def execute_demo_action(self, action: AgentAction):
        """Alias for run_action used by the /agents/command endpoint."""
        return self.run_action(action)

    def run_workflow_preview(self, workflow_id: str | None, payload: dict):
        run = AutomationRun(
            organization_id=self.organization_id,
            workflow_id=workflow_id,
            status=AgentActionStatus.completed,
            trigger_payload=payload,
            log=[
                {"step": 1, "action": "detect_trigger", "ok": True},
                {"step": 2, "action": "prepare_agent_tasks", "ok": True},
                {"step": 3, "action": "write_audit_trail", "ok": True},
            ],
        )
        self.db.add(run); self.db.commit(); self.db.refresh(run)
        return run
