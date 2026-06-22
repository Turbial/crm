"""Celery task — scans new leads/companies for duplicates."""
from __future__ import annotations

import logging

from app.celery_app import celery
from app.database import SessionLocal

logger = logging.getLogger("mighty.tasks.duplicate_scanner")


@celery.task(name="duplicate_scanner.scan_lead", ignore_result=True)
def scan_lead(org_id: str, lead_id: str) -> None:
    from app.services.duplicate_service import scan_lead_duplicates
    with SessionLocal() as db:
        try:
            candidates = scan_lead_duplicates(db, org_id, lead_id)
            if candidates:
                logger.info("Found %d duplicate candidates for lead %s", len(candidates), lead_id)
        except Exception as exc:
            logger.exception("Duplicate scan failed for lead %s: %s", lead_id, exc)


@celery.task(name="duplicate_scanner.scan_company", ignore_result=True)
def scan_company(org_id: str, company_id: str) -> None:
    from app.services.duplicate_service import scan_company_duplicates
    with SessionLocal() as db:
        try:
            candidates = scan_company_duplicates(db, org_id, company_id)
            if candidates:
                logger.info("Found %d duplicate candidates for company %s", len(candidates), company_id)
        except Exception as exc:
            logger.exception("Duplicate scan failed for company %s: %s", company_id, exc)
