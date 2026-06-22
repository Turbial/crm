"""Celery task — scans for stuck work every 5 minutes across all orgs."""
from __future__ import annotations

import logging

from app.celery_app import celery
from app.database import SessionLocal

logger = logging.getLogger("mighty.tasks.stuck_detector")


@celery.task(name="stuck_detector.scan_all_orgs", ignore_result=True)
def scan_all_orgs() -> None:
    from app.models import Organization
    from app.services.supervisor_service import scan_and_escalate

    with SessionLocal() as db:
        orgs = db.query(Organization).filter(Organization.active == True).all()
        for org in orgs:
            try:
                result = scan_and_escalate(db, org.id)
                if any(result.values()):
                    logger.info("Org %s stuck scan: %s", org.id, result)
            except Exception as exc:
                logger.exception("Stuck scan failed for org %s: %s", org.id, exc)
