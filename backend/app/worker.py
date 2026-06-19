"""DB-backed worker for production alpha.

This worker intentionally keeps dependencies light. It polls queued AgentAction
rows and marks them as running, then leaves actual OpenClaw execution to the
external OpenClaw runtime via callbacks/webhooks. In a later version, replace or
extend this with Celery/RQ/Temporal.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime

from app.config import settings
from app.database import SessionLocal
from app.models import AgentAction, AgentActionStatus, AuditLog

logging.basicConfig(level=settings.log_level)
logger = logging.getLogger("mighty.worker")


def claim_next_action(db):
    action = (
        db.query(AgentAction)
        .filter(AgentAction.status == AgentActionStatus.queued)
        .order_by(AgentAction.created_at.asc())
        .first()
    )
    if not action:
        return None
    action.status = AgentActionStatus.running
    meta = dict(action.metadata_json or {})
    meta["claimed_at"] = datetime.utcnow().isoformat()
    meta["claimed_by"] = "mighty-db-worker"
    action.metadata_json = meta
    db.add(
        AuditLog(
            organization_id=action.organization_id,
            actor_type="system",
            event="worker.action_claimed",
            entity_type="agent_action",
            entity_id=action.id,
            metadata_json={"agent_name": action.agent_name, "action_type": action.action_type},
        )
    )
    db.commit()
    db.refresh(action)
    return action


def run_once() -> bool:
    db = SessionLocal()
    try:
        action = claim_next_action(db)
        if not action:
            return False
        logger.info("claimed action=%s agent=%s type=%s", action.id, action.agent_name, action.action_type)
        # External OpenClaw should fetch/receive this action and post a signed result.
        return True
    finally:
        db.close()


def main():
    logger.info("starting Mighty CRM worker env=%s poll=%ss", settings.environment, settings.worker_poll_seconds)
    while settings.worker_enabled:
        did_work = run_once()
        if not did_work:
            time.sleep(settings.worker_poll_seconds)


if __name__ == "__main__":
    main()
