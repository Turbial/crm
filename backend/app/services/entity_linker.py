"""Entity linker — resolve text entity hints to DB record IDs.

Takes raw_entities from the intent classifier (names, emails, phone numbers)
and resolves them to actual database records within the org context.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models import Lead, Contact, Company, Deal, User, Project


@staticmethod
def _ilike(column, value: str):
    return column.ilike(f"%{value}%")


def find_lead(
    db: Session,
    org_id: str,
    name: str | None = None,
    email: str | None = None,
    phone: str | None = None,
) -> Lead | None:
    q = db.query(Lead).filter(Lead.organization_id == org_id)
    conditions = []
    if email:
        conditions.append(Lead.email == email)
    if phone:
        conditions.append(Lead.phone == phone)
    if email or phone:
        lead = q.filter(or_(*conditions)).first()
        if lead:
            return lead
    if name:
        return q.filter(Lead.name.ilike(f"%{name}%")).first()
    return None


def find_contact(
    db: Session,
    org_id: str,
    name: str | None = None,
    email: str | None = None,
) -> Contact | None:
    q = db.query(Contact).filter(Contact.organization_id == org_id)
    if email:
        contact = q.filter(Contact.email == email).first()
        if contact:
            return contact
    if name:
        return q.filter(Contact.name.ilike(f"%{name}%")).first()
    return None


def find_company(
    db: Session,
    org_id: str,
    name: str | None = None,
    domain: str | None = None,
) -> Company | None:
    q = db.query(Company).filter(Company.organization_id == org_id)
    if domain:
        company = q.filter(Company.domain == domain).first()
        if company:
            return company
    if name:
        return q.filter(Company.name.ilike(f"%{name}%")).first()
    return None


def find_deal(
    db: Session,
    org_id: str,
    title: str | None = None,
    company_id: str | None = None,
) -> Deal | None:
    q = db.query(Deal).filter(Deal.organization_id == org_id)
    if company_id:
        q = q.filter(Deal.company_id == company_id)
    if title:
        return q.filter(Deal.title.ilike(f"%{title}%")).first()
    return q.order_by(Deal.created_at.desc()).first()


def find_project(
    db: Session,
    org_id: str,
    name: str | None = None,
) -> Project | None:
    q = db.query(Project).filter(Project.organization_id == org_id)
    if name:
        return q.filter(Project.name.ilike(f"%{name}%")).first()
    return None


def find_user(
    db: Session,
    org_id: str,
    name: str | None = None,
    email: str | None = None,
) -> User | None:
    q = db.query(User).filter(User.organization_id == org_id, User.is_active == True)
    if email:
        user = q.filter(User.email == email).first()
        if user:
            return user
    if name:
        return q.filter(User.name.ilike(f"%{name}%")).first()
    return None


def link_entities(
    db: Session,
    org_id: str,
    raw_entities: dict[str, Any],
) -> dict[str, Any]:
    """
    Resolve raw text entities to DB IDs.

    Input:  {"lead_name": "John Smith", "company_name": "Acme Roofing", "user_name": "Sarah"}
    Output: {"lead_id": "...", "company_id": "...", "owner_user_id": "..."}
    """
    linked: dict[str, Any] = {}

    # Lead resolution
    lead = find_lead(
        db, org_id,
        name=raw_entities.get("lead_name"),
        email=raw_entities.get("email"),
        phone=raw_entities.get("phone"),
    )
    if lead:
        linked["lead_id"] = lead.id
        linked["lead_name"] = lead.name

    # Contact resolution
    contact = find_contact(
        db, org_id,
        name=raw_entities.get("lead_name") or raw_entities.get("contact_name"),
        email=raw_entities.get("email"),
    )
    if contact and "lead_id" not in linked:
        linked["contact_id"] = contact.id
        linked["contact_name"] = contact.name

    # Company resolution
    company = find_company(
        db, org_id,
        name=raw_entities.get("company_name"),
    )
    if company:
        linked["company_id"] = company.id
        linked["company_name"] = company.name

    # User/assignee resolution
    user = find_user(
        db, org_id,
        name=raw_entities.get("user_name"),
    )
    if user:
        linked["owner_user_id"] = user.id
        linked["assignee_name"] = user.name

    # Project resolution
    project = find_project(
        db, org_id,
        name=raw_entities.get("project_name"),
    )
    if project:
        linked["project_id"] = project.id

    return linked
