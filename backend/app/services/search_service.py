"""Cross-object full-text search.

Searches leads, contacts, companies, deals, projects, tasks, and notes
using case-insensitive LIKE queries. Results are ranked by entity type
and returned in a unified format.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models import Lead, Contact, Company, Deal, Note


SEARCHABLE_TYPES = {"lead", "contact", "company", "deal", "note", "project", "task"}


def search(
    db: Session,
    org_id: str,
    q: str,
    types: list[str] | None = None,
    limit_per_type: int = 10,
) -> dict[str, list[dict[str, Any]]]:
    """Cross-object search. Returns dict keyed by entity type."""
    if not q or len(q.strip()) < 2:
        return {}

    active_types = set(types) & SEARCHABLE_TYPES if types else SEARCHABLE_TYPES
    pattern = f"%{q.strip()}%"
    results: dict[str, list[dict[str, Any]]] = {}

    if "lead" in active_types:
        rows = db.query(Lead).filter(
            Lead.organization_id == org_id,
            (Lead.name.ilike(pattern)) | (Lead.email.ilike(pattern)) |
            (Lead.phone.ilike(pattern)) | (Lead.company.ilike(pattern)),
        ).limit(limit_per_type).all()
        results["lead"] = [
            {"id": r.id, "type": "lead", "title": r.name,
             "subtitle": r.company or r.email or "", "status": r.status.value if r.status else ""}
            for r in rows
        ]

    if "contact" in active_types:
        from app.models import Contact
        rows = db.query(Contact).filter(
            Contact.organization_id == org_id,
            (Contact.name.ilike(pattern)) | (Contact.email.ilike(pattern)) |
            (Contact.phone.ilike(pattern)),
        ).limit(limit_per_type).all()
        results["contact"] = [
            {"id": r.id, "type": "contact", "title": r.name,
             "subtitle": r.email or r.title or ""}
            for r in rows
        ]

    if "company" in active_types:
        rows = db.query(Company).filter(
            Company.organization_id == org_id,
            (Company.name.ilike(pattern)) | (Company.domain.ilike(pattern)),
        ).limit(limit_per_type).all()
        results["company"] = [
            {"id": r.id, "type": "company", "title": r.name,
             "subtitle": r.domain or r.industry or ""}
            for r in rows
        ]

    if "deal" in active_types:
        rows = db.query(Deal).filter(
            Deal.organization_id == org_id,
            Deal.title.ilike(pattern),
        ).limit(limit_per_type).all()
        results["deal"] = [
            {"id": r.id, "type": "deal", "title": r.title,
             "subtitle": f"${r.value:,.0f}" if r.value else ""}
            for r in rows
        ]

    if "note" in active_types:
        rows = db.query(Note).filter(
            Note.organization_id == org_id,
            Note.content.ilike(pattern),
        ).limit(limit_per_type).all()
        results["note"] = [
            {"id": r.id, "type": "note", "title": r.content[:60] + "..." if len(r.content) > 60 else r.content,
             "subtitle": "Note", "lead_id": r.lead_id}
            for r in rows
        ]

    if "project" in active_types:
        from app.models import Project
        rows = db.query(Project).filter(
            Project.organization_id == org_id,
            (Project.name.ilike(pattern)) | (Project.goal.ilike(pattern)),
        ).limit(limit_per_type).all()
        results["project"] = [
            {"id": r.id, "type": "project", "title": r.name,
             "subtitle": r.status.value if r.status else ""}
            for r in rows
        ]

    if "task" in active_types:
        from app.models import PMTask
        rows = db.query(PMTask).filter(
            PMTask.organization_id == org_id,
            (PMTask.title.ilike(pattern)) | (PMTask.description.ilike(pattern)),
        ).limit(limit_per_type).all()
        results["task"] = [
            {"id": r.id, "type": "task", "title": r.title,
             "subtitle": r.status.value if r.status else "", "project_id": r.project_id}
            for r in rows
        ]

    # Remove empty type buckets
    return {k: v for k, v in results.items() if v}


def suggest(
    db: Session,
    org_id: str,
    q: str,
    limit: int = 8,
) -> list[dict[str, Any]]:
    """Quick typeahead — returns flat list of top results across all types."""
    results = search(db, org_id, q, limit_per_type=3)
    flat = [item for items in results.values() for item in items]
    return flat[:limit]
