"""Duplicate detection — scores entity pairs for similarity and flags candidates."""
from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models import DuplicateCandidate, DuplicateStatus, Lead, Contact, Company

AUTO_MERGE_THRESHOLD = 0.95
SUGGEST_THRESHOLD = 0.75


def _normalize(s: str | None) -> str:
    if not s:
        return ""
    return re.sub(r"\s+", " ", s.lower().strip())


def _name_similarity(a: str | None, b: str | None) -> float:
    na, nb = _normalize(a), _normalize(b)
    if not na or not nb:
        return 0.0
    if na == nb:
        return 1.0
    # Token overlap
    tokens_a = set(na.split())
    tokens_b = set(nb.split())
    overlap = tokens_a & tokens_b
    union = tokens_a | tokens_b
    return len(overlap) / len(union) if union else 0.0


def _score_leads(a: Lead, b: Lead) -> tuple[float, list[str]]:
    score = 0.0
    reasons: list[str] = []

    if a.email and b.email and a.email.lower() == b.email.lower():
        score += 0.6
        reasons.append("same_email")
    if a.phone and b.phone and re.sub(r"\D", "", a.phone) == re.sub(r"\D", "", b.phone):
        score += 0.4
        reasons.append("same_phone")
    name_sim = _name_similarity(a.name, b.name)
    if name_sim >= 0.85:
        score += 0.3 * name_sim
        reasons.append(f"similar_name:{name_sim:.2f}")
    if a.company and b.company and _normalize(a.company) == _normalize(b.company):
        score += 0.15
        reasons.append("same_company")

    return min(score, 1.0), reasons


def _score_contacts(a: Contact, b: Contact) -> tuple[float, list[str]]:
    score = 0.0
    reasons: list[str] = []
    if a.email and b.email and a.email.lower() == b.email.lower():
        score += 0.7
        reasons.append("same_email")
    if a.phone and b.phone and re.sub(r"\D", "", a.phone) == re.sub(r"\D", "", b.phone):
        score += 0.4
        reasons.append("same_phone")
    name_sim = _name_similarity(a.name, b.name)
    if name_sim >= 0.85:
        score += 0.25 * name_sim
        reasons.append(f"similar_name:{name_sim:.2f}")
    return min(score, 1.0), reasons


def _score_companies(a: Company, b: Company) -> tuple[float, list[str]]:
    score = 0.0
    reasons: list[str] = []
    if a.domain and b.domain and a.domain.lower() == b.domain.lower():
        score += 0.7
        reasons.append("same_domain")
    name_sim = _name_similarity(a.name, b.name)
    if name_sim >= 0.80:
        score += 0.4 * name_sim
        reasons.append(f"similar_name:{name_sim:.2f}")
    return min(score, 1.0), reasons


def _upsert_candidate(
    db: Session,
    org_id: str,
    entity_type: str,
    entity_id: str,
    candidate_id: str,
    score: float,
    reasons: list[str],
) -> DuplicateCandidate | None:
    if score < SUGGEST_THRESHOLD:
        return None
    existing = db.query(DuplicateCandidate).filter(
        DuplicateCandidate.organization_id == org_id,
        DuplicateCandidate.entity_type == entity_type,
        DuplicateCandidate.entity_id == entity_id,
        DuplicateCandidate.candidate_id == candidate_id,
    ).first()
    if existing:
        existing.score = score
        existing.match_reasons = reasons
        db.commit()
        return existing
    cand = DuplicateCandidate(
        organization_id=org_id,
        entity_type=entity_type,
        entity_id=entity_id,
        candidate_id=candidate_id,
        score=score,
        match_reasons=reasons,
        status=DuplicateStatus.pending,
    )
    db.add(cand)
    db.commit()
    db.refresh(cand)
    return cand


def scan_lead_duplicates(db: Session, org_id: str, lead_id: str) -> list[DuplicateCandidate]:
    """Score a single lead against all org leads."""
    target = db.query(Lead).filter(Lead.id == lead_id, Lead.organization_id == org_id).first()
    if not target:
        return []
    candidates = db.query(Lead).filter(
        Lead.organization_id == org_id,
        Lead.id != lead_id,
    ).limit(500).all()

    results = []
    for other in candidates:
        score, reasons = _score_leads(target, other)
        cand = _upsert_candidate(db, org_id, "lead", lead_id, other.id, score, reasons)
        if cand:
            results.append(cand)
    return results


def scan_company_duplicates(db: Session, org_id: str, company_id: str) -> list[DuplicateCandidate]:
    """Score a single company against all org companies."""
    from app.models import Company
    target = db.query(Company).filter(Company.id == company_id, Company.organization_id == org_id).first()
    if not target:
        return []
    candidates = db.query(Company).filter(
        Company.organization_id == org_id,
        Company.id != company_id,
    ).limit(500).all()

    results = []
    for other in candidates:
        score, reasons = _score_companies(target, other)
        cand = _upsert_candidate(db, org_id, "company", company_id, other.id, score, reasons)
        if cand:
            results.append(cand)
    return results


def list_candidates(
    db: Session,
    org_id: str,
    entity_type: str | None = None,
    status: str = "pending",
    limit: int = 50,
    offset: int = 0,
) -> list[DuplicateCandidate]:
    q = db.query(DuplicateCandidate).filter(
        DuplicateCandidate.organization_id == org_id,
        DuplicateCandidate.status == status,
    )
    if entity_type:
        q = q.filter(DuplicateCandidate.entity_type == entity_type)
    return q.order_by(DuplicateCandidate.score.desc()).offset(offset).limit(limit).all()


def dismiss_candidate(
    db: Session,
    org_id: str,
    candidate_id: str,
    user_id: str,
) -> DuplicateCandidate | None:
    cand = db.query(DuplicateCandidate).filter(
        DuplicateCandidate.id == candidate_id,
        DuplicateCandidate.organization_id == org_id,
    ).first()
    if not cand:
        return None
    cand.status = DuplicateStatus.dismissed
    cand.resolved_by_user_id = user_id
    cand.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(cand)
    return cand


def merge_leads(
    db: Session,
    org_id: str,
    keep_id: str,
    merge_id: str,
    user_id: str,
) -> Lead | None:
    """Merge merge_id into keep_id — copy missing fields, mark candidate merged."""
    keep = db.query(Lead).filter(Lead.id == keep_id, Lead.organization_id == org_id).first()
    merge = db.query(Lead).filter(Lead.id == merge_id, Lead.organization_id == org_id).first()
    if not keep or not merge:
        return None

    for field in ("email", "phone", "company", "website", "address", "city", "state"):
        if not getattr(keep, field) and getattr(merge, field):
            setattr(keep, field, getattr(merge, field))
    if merge.score > keep.score:
        keep.score = merge.score

    # Update candidate record
    cand = db.query(DuplicateCandidate).filter(
        DuplicateCandidate.organization_id == org_id,
        DuplicateCandidate.entity_type == "lead",
        DuplicateCandidate.entity_id == keep_id,
        DuplicateCandidate.candidate_id == merge_id,
    ).first()
    if cand:
        cand.status = DuplicateStatus.merged
        cand.merged_into_id = keep_id
        cand.resolved_by_user_id = user_id
        cand.resolved_at = datetime.utcnow()

    db.delete(merge)
    db.commit()
    db.refresh(keep)
    return keep


def merge_contacts(
    db: Session,
    org_id: str,
    keep_id: str,
    merge_id: str,
    user_id: str,
) -> Contact | None:
    """Merge merge_id into keep_id — copy missing fields, mark candidate merged."""
    keep = db.query(Contact).filter(Contact.id == keep_id, Contact.organization_id == org_id).first()
    merge_obj = db.query(Contact).filter(Contact.id == merge_id, Contact.organization_id == org_id).first()
    if not keep or not merge_obj:
        return None

    for field in ("email", "phone", "title"):
        if not getattr(keep, field, None) and getattr(merge_obj, field, None):
            setattr(keep, field, getattr(merge_obj, field))

    cand = db.query(DuplicateCandidate).filter(
        DuplicateCandidate.organization_id == org_id,
        DuplicateCandidate.entity_type == "contact",
        DuplicateCandidate.entity_id == keep_id,
        DuplicateCandidate.candidate_id == merge_id,
    ).first()
    if cand:
        cand.status = DuplicateStatus.merged
        cand.merged_into_id = keep_id
        cand.resolved_by_user_id = user_id
        cand.resolved_at = datetime.utcnow()

    db.delete(merge_obj)
    db.commit()
    db.refresh(keep)
    return keep


def merge_companies(
    db: Session,
    org_id: str,
    keep_id: str,
    merge_id: str,
    user_id: str,
) -> Company | None:
    """Merge merge_id into keep_id — copy missing fields, mark candidate merged."""
    keep = db.query(Company).filter(Company.id == keep_id, Company.organization_id == org_id).first()
    merge_obj = db.query(Company).filter(Company.id == merge_id, Company.organization_id == org_id).first()
    if not keep or not merge_obj:
        return None

    for field in ("domain", "industry", "size", "website", "phone", "address"):
        if not getattr(keep, field, None) and getattr(merge_obj, field, None):
            setattr(keep, field, getattr(merge_obj, field))

    cand = db.query(DuplicateCandidate).filter(
        DuplicateCandidate.organization_id == org_id,
        DuplicateCandidate.entity_type == "company",
        DuplicateCandidate.entity_id == keep_id,
        DuplicateCandidate.candidate_id == merge_id,
    ).first()
    if cand:
        cand.status = DuplicateStatus.merged
        cand.merged_into_id = keep_id
        cand.resolved_by_user_id = user_id
        cand.resolved_at = datetime.utcnow()

    db.delete(merge_obj)
    db.commit()
    db.refresh(keep)
    return keep
