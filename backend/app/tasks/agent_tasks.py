"""Celery tasks for agent action execution.

Each task is idempotent: it looks up the AgentAction by ID, verifies it is
still in the correct state, then either executes locally or hands off to OpenClaw
depending on the AGENT_EXECUTOR setting.
"""
from __future__ import annotations

import logging

from app.celery_app import celery
from app.database import SessionLocal
from app.models import AgentAction, AgentActionStatus, AuditLog

logger = logging.getLogger("mighty.tasks")


@celery.task(
    bind=True,
    name="agent_tasks.run_action",
    max_retries=3,
    default_retry_delay=30,
    acks_late=True,
)
def run_action_task(self, action_id: str, organization_id: str) -> dict:
    """Claim and execute a single AgentAction.

    On failure, the task retries up to 3 times with exponential back-off.
    After all retries the action is marked 'failed' and an audit entry is written.
    """
    db = SessionLocal()
    try:
        action = db.get(AgentAction, action_id)
        if not action:
            logger.warning("action %s not found — skipping", action_id)
            return {"skipped": True, "reason": "not_found"}

        if action.status != AgentActionStatus.queued:
            logger.info("action %s already in status %s — skipping", action_id, action.status)
            return {"skipped": True, "reason": action.status.value}

        action.status = AgentActionStatus.running
        db.add(AuditLog(
            organization_id=organization_id,
            actor_type="celery_worker",
            event="worker.action_claimed",
            entity_type="agent_action",
            entity_id=action_id,
            metadata_json={"agent_name": action.agent_name, "action_type": action.action_type, "task_id": self.request.id},
        ))
        db.commit()

        from app.services.agent_executor import get_executor
        executor = get_executor(db, organization_id)
        result = executor.run(action)

        return {"action_id": result.id, "status": result.status.value}

    except Exception as exc:
        db.rollback()
        logger.exception("action %s failed on attempt %d", action_id, self.request.retries + 1)
        try:
            self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            action = db.get(AgentAction, action_id)
            if action:
                action.status = AgentActionStatus.failed
                action.result = str(exc)
                db.add(AuditLog(
                    organization_id=organization_id,
                    actor_type="celery_worker",
                    event="worker.action_failed",
                    entity_type="agent_action",
                    entity_id=action_id,
                    metadata_json={"error": str(exc)},
                ))
                db.commit()
        return {"action_id": action_id, "status": "failed"}
    finally:
        db.close()


def dispatch_action(action: AgentAction) -> None:
    """Dispatch an AgentAction to Celery. Call this after creating the DB row."""
    run_action_task.delay(action.id, action.organization_id)
