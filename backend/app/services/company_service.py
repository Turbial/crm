"""Company CRUD service with domain-based deduplication."""
from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from app.models import Company, Lead, Contact


def _extract_domain(url_or_email: str | None) -> str | None:
    if not url_or_email:
        return None
    if "@" in url_or_email:
        return url_or_email.split("@")[-1].lower().strip()
    try:
        parsed = urlparse(url_or_email if "://" in url_or_email else f"https://{url_or_email}")
        return parsed.hostname or None
    except Exception:
        return None


def create_company(
    db: Session,
    org_id: str,
    name: str,
    domain: str | None = None,
    **kwargs: Any,
) -> Company:
    """Create a company. Checks for existing domain match first."""
    if domain:
        existing = find_by_domain(db, org_id, domain)
        if existing:
            return existing

    company = Company(
        organization_id=org_id,
        name=name,
        domain=domain,
        **{k: v for k, v in kwargs.items() if hasattr(Company, k)},
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def find_by_domain(db: Session, org_id: str, domain: str) -> Company | None:
    clean = domain.lower().strip().removeprefix("www.")
    return db.query(Company).filter(
        Company.organization_id == org_id,
        Company.domain.ilike(f"%{clean}%"),
    ).first()


def get_or_create_by_lead(db: Session, org_id: str, lead: Lead) -> Company | None:
    """Attempt to find/create a company from lead.company + lead.website/email."""
    if not lead.company:
        return None

    domain = _extract_domain(lead.website) or _extract_domain(lead.email)
    existing = None
    if domain:
        existing = find_by_domain(db, org_id, domain)
    if not existing:
        # Name-based fallback
        existing = db.query(Company).filter(
            Company.organization_id == org_id,
            Company.name.ilike(lead.company.strip()),
        ).first()

    if existing:
        return existing

    return create_company(db, org_id, name=lead.company, domain=domain)


def link_lead_to_company(db: Session, lead: Lead, company: Company) -> None:
    """Store company_id on lead via metadata (avoids schema migration for now)."""
    meta = lead.metadata_json or {}
    meta["company_id"] = company.id
    lead.metadata_json = meta
    db.commit()


def list_companies(
    db: Session,
    org_id: str,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Company]:
    q = db.query(Company).filter(Company.organization_id == org_id)
    if search:
        q = q.filter(Company.name.ilike(f"%{search}%"))
    return q.order_by(Company.name).offset(offset).limit(limit).all()


def get_company_leads(db: Session, org_id: str, company_id: str) -> list[Lead]:
    """Find leads whose metadata_json contains this company_id."""
    return [
        lead for lead in db.query(Lead).filter(Lead.organization_id == org_id).all()
        if (lead.metadata_json or {}).get("company_id") == company_id
    ]


def get_company_contacts(db: Session, org_id: str, company_id: str) -> list[Contact]:
    return [
        c for c in db.query(Contact).filter(Contact.organization_id == org_id).all()
        if (getattr(c, "metadata_json", None) or {}).get("company_id") == company_id
    ]
