"""Celery task — generates and delivers daily brief at 8 AM UTC for all orgs."""
from __future__ import annotations

import logging

from app.celery_app import celery
from app.database import SessionLocal

logger = logging.getLogger("mighty.tasks.daily_brief")


@celery.task(name="daily_brief.generate_and_deliver_all", ignore_result=True)
def generate_and_deliver_all() -> None:
    from app.models import Organization
    from app.services.daily_brief_service import generate_brief, deliver_brief

    with SessionLocal() as db:
        orgs = db.query(Organization).filter(Organization.active == True).all()
        for org in orgs:
            try:
                brief = generate_brief(db, org.id)
                deliver_brief(db, brief)
                logger.info("Daily brief delivered for org %s", org.id)
            except Exception as exc:
                logger.exception("Daily brief failed for org %s: %s", org.id, exc)
