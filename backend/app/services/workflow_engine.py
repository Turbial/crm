from dataclasses import dataclass
from sqlalchemy.orm import Session
from app.models import Workflow, WorkflowStep, AgentAction, Task, Communication, Channel, Direction, TaskPriority


@dataclass
class WorkflowExecutionResult:
    workflow_id: str
    created_actions: int
    created_tasks: int
    messages: list[str]


def run_workflow(db: Session, workflow: Workflow, organization_id: str, lead_id: str | None = None) -> WorkflowExecutionResult:
    # Use the WorkflowStep relationship ordered by position.
    # The previous version read workflow.definition which does not exist on the model.
    steps: list[WorkflowStep] = sorted(
        db.query(WorkflowStep)
        .filter(WorkflowStep.workflow_id == workflow.id, WorkflowStep.organization_id == organization_id)
        .all(),
        key=lambda s: s.position,
    )

    actions = 0
    tasks = 0
    messages: list[str] = []

    for step in steps:
        kind = step.action_type
        cfg = step.config or {}

        if kind == "agent_action":
            db.add(AgentAction(
                organization_id=organization_id,
                lead_id=lead_id,
                agent_name=cfg.get("agent", "sales"),
                action_type=cfg.get("action", "follow_up"),
                instruction=step.instruction or "Execute workflow step",
                metadata_json={"workflow_id": workflow.id, "step_id": step.id, "position": step.position},
            ))
            actions += 1

        elif kind == "task":
            db.add(Task(
                organization_id=organization_id,
                lead_id=lead_id,
                title=cfg.get("title", step.instruction or "Workflow task"),
                description=cfg.get("description"),
                priority=TaskPriority(cfg.get("priority", "medium")),
            ))
            tasks += 1

        elif kind == "communication_log":
            db.add(Communication(
                organization_id=organization_id,
                lead_id=lead_id,
                channel=Channel(cfg.get("channel", "internal")),
                direction=Direction.internal,
                subject=cfg.get("subject"),
                content=cfg.get("content", step.instruction or "Workflow logged event"),
            ))
            messages.append("logged communication")

    db.commit()
    return WorkflowExecutionResult(
        workflow_id=workflow.id,
        created_actions=actions,
        created_tasks=tasks,
        messages=messages,
    )
