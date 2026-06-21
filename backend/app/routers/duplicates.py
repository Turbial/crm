"""Duplicate candidate management endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_manager
from app.models import User
from app.schemas import DuplicateCandidateOut

router = APIRouter(prefix="/duplicates", tags=["Duplicates"])


@router.get("", response_model=list[DuplicateCandidateOut])
def list_duplicates(
    entity_type: str | None = Query(default=None),
    status: str = Query(default="pending"),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.duplicate_service import list_candidates
    return list_candidates(db, user.organization_id,
                           entity_type=entity_type, status=status,
                           limit=limit, offset=offset)


@router.post("/{candidate_id}/dismiss", response_model=DuplicateCandidateOut)
def dismiss(
    candidate_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.duplicate_service import dismiss_candidate
    cand = dismiss_candidate(db, user.organization_id, candidate_id, user.id)
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return cand


@router.post("/merge-leads")
def merge_leads(
    keep_id: str,
    merge_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    from app.services.duplicate_service import merge_leads as _merge
    lead = _merge(db, user.organization_id, keep_id, merge_id, user.id)
    if not lead:
        raise HTTPException(status_code=404, detail="One or both leads not found")
    return {"ok": True, "merged_into": lead.id, "name": lead.name}


@router.post("/merge-contacts")
def merge_contacts(
    keep_id: str,
    merge_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    from app.services.duplicate_service import merge_contacts as _merge
    contact = _merge(db, user.organization_id, keep_id, merge_id, user.id)
    if not contact:
        raise HTTPException(status_code=404, detail="One or both contacts not found")
    return {"ok": True, "merged_into": contact.id, "name": contact.name}


@router.post("/merge-companies")
def merge_companies(
    keep_id: str,
    merge_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    from app.services.duplicate_service import merge_companies as _merge
    company = _merge(db, user.organization_id, keep_id, merge_id, user.id)
    if not company:
        raise HTTPException(status_code=404, detail="One or both companies not found")
    return {"ok": True, "merged_into": company.id, "name": company.name}


@router.post("/scan-lead/{lead_id}")
def scan_lead(
    lead_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.duplicate_service import scan_lead_duplicates
    candidates = scan_lead_duplicates(db, user.organization_id, lead_id)
    return {"found": len(candidates)}
