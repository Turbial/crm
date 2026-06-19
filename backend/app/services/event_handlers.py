"""Event handlers registered at application startup.

Import this module in main.py to activate the handlers.
Each handler responds to a named event emitted by service code.
"""
from __future__ import annotations

import logging

from app.services import events

logger = logging.getLogger("mighty.events")


@events.on("agent_action.created")
def _dispatch_to_celery(action, **kwargs):
    """When an AgentAction is created, dispatch it to Celery instead of polling."""
    try:
        from app.tasks.agent_tasks import dispatch_action
        dispatch_action(action)
    except Exception:
        # Celery may be unavailable in local/test environments.
        # The DB-backed worker (worker.py) acts as a fallback.
        logger.warning(
            "Celery dispatch failed for action %s — DB worker will pick it up on next poll",
            action.id,
        )


@events.on("lead.status_changed")
def _log_status_change(lead, old_status, new_status, db=None, **kwargs):
    """Write an AuditLog entry whenever a lead's status changes."""
    if db is None:
        return
    from app.models import AuditLog
    db.add(AuditLog(
        organization_id=lead.organization_id,
        actor_type="system",
        event="lead.status_changed",
        entity_type="lead",
        entity_id=lead.id,
        metadata_json={"old_status": str(old_status), "new_status": str(new_status)},
    ))
    # Caller is responsible for commit to batch with the lead update.


@events.on("lead.status_changed")
def _trigger_workflow_on_status(lead, new_status, db=None, **kwargs):
    """Queue agent actions for active workflows whose trigger matches the new status."""
    if db is None:
        return
    from app.models import Workflow, WorkflowStatus
    from app.services.workflow_engine import run_workflow

    trigger = f"lead_status_{new_status.value}" if hasattr(new_status, "value") else f"lead_status_{new_status}"
    workflows = (
        db.query(Workflow)
        .filter(
            Workflow.organization_id == lead.organization_id,
            Workflow.status == WorkflowStatus.active,
            Workflow.trigger == trigger,
        )
        .all()
    )
    for wf in workflows:
        run_workflow(db, wf, lead.organization_id, lead_id=lead.id)
