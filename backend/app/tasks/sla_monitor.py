"""Celery task — runs SLA checks every 15 minutes across all orgs."""
from __future__ import annotations

import logging

from app.celery_app import celery
from app.database import SessionLocal

logger = logging.getLogger("mighty.tasks.sla_monitor")


@celery.task(name="sla_monitor.check_all_orgs", ignore_result=True)
def check_all_orgs() -> None:
    from app.models import Organization
    from app.services.sla_service import run_sla_check

    with SessionLocal() as db:
        orgs = db.query(Organization).filter(Organization.active == True).all()
        for org in orgs:
            try:
                breaches = run_sla_check(db, org.id)
                if breaches:
                    logger.info("SLA breaches for org %s: %s", org.id, breaches)
            except Exception as exc:
                logger.exception("SLA check failed for org %s: %s", org.id, exc)
