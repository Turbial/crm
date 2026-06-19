"""Customer portal service.

Generates time-limited signed tokens for lead-facing self-service pages.
Tokens are stored as SHA-256 hashes; the raw token is returned once.
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Any

ESIG_TTL_DAYS = 7

from sqlalchemy.orm import Session

from app.models import (
    PortalToken, PortalPermission, ESignatureRequest, ESignatureStatus,
    Lead, Invoice, Quote, Document,
)

TOKEN_TTL_HOURS = 72


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def generate_portal_token(
    db: Session,
    org_id: str,
    lead_id: str,
    permissions: list[PortalPermission] | None = None,
    ttl_hours: int = TOKEN_TTL_HOURS,
) -> tuple[PortalToken, str]:
    """Create a portal access token for a lead. Returns (PortalToken row, raw_token)."""
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.organization_id == org_id).first()
    if not lead:
        raise ValueError(f"Lead {lead_id} not found")

    raw = secrets.token_urlsafe(32)
    row = PortalToken(
        organization_id=org_id,
        lead_id=lead_id,
        token_hash=_hash_token(raw),
        permissions=[p.value for p in (permissions or list(PortalPermission))],
        expires_at=datetime.utcnow() + timedelta(hours=ttl_hours),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row, raw


def resolve_portal_token(db: Session, raw_token: str) -> PortalToken | None:
    """Validate a raw portal token; returns the row or None if invalid/expired."""
    token_hash = _hash_token(raw_token)
    row = db.query(PortalToken).filter(
        PortalToken.token_hash == token_hash,
        PortalToken.active == True,
    ).first()
    if not row:
        return None
    if row.expires_at and row.expires_at < datetime.utcnow():
        row.active = False
        db.commit()
        return None
    return row


def get_portal_view(db: Session, portal_token: PortalToken) -> dict[str, Any]:
    """Build the portal data bundle returned to the lead."""
    lead = db.get(Lead, portal_token.lead_id)
    if not lead:
        return {}

    perms = set(portal_token.permissions or [])
    result: dict[str, Any] = {
        "lead": {
            "id": lead.id,
            "name": lead.name,
            "email": lead.email,
            "company": lead.company,
        },
        "permissions": list(perms),
    }

    if PortalPermission.view_invoices.value in perms:
        invoices = db.query(Invoice).filter(
            Invoice.organization_id == lead.organization_id,
            Invoice.lead_id == lead.id,
        ).order_by(Invoice.created_at.desc()).limit(20).all()
        result["invoices"] = [
            {
                "id": inv.id,
                "number": inv.number,
                "status": inv.status.value if hasattr(inv.status, "value") else str(inv.status),
                "total": float(inv.total),
                "due_at": inv.due_at.isoformat() if inv.due_at else None,
            }
            for inv in invoices
        ]

    if PortalPermission.view_quotes.value in perms:
        quotes = db.query(Quote).filter(
            Quote.organization_id == lead.organization_id,
            Quote.lead_id == lead.id,
        ).order_by(Quote.created_at.desc()).limit(10).all()
        result["quotes"] = [
            {
                "id": q.id,
                "title": q.title,
                "status": q.status.value if hasattr(q.status, "value") else str(q.status),
                "total": float(q.total),
            }
            for q in quotes
        ]

    if PortalPermission.sign_documents.value in perms:
        docs = db.query(Document).filter(
            Document.organization_id == lead.organization_id,
            Document.lead_id == lead.id,
        ).order_by(Document.created_at.desc()).limit(20).all()
        result["documents"] = [
            {"id": d.id, "title": d.title, "kind": d.kind, "storage_url": d.storage_url}
            for d in docs
        ]

    return result


def request_esignature(
    db: Session,
    org_id: str,
    lead_id: str,
    document_type: str,
    document_id: str,
    signer_name: str,
    signer_email: str,
) -> tuple[ESignatureRequest, str]:
    """Create an e-signature request. Returns (ESignatureRequest, raw_token)."""
    raw = secrets.token_urlsafe(48)
    req = ESignatureRequest(
        organization_id=org_id,
        lead_id=lead_id,
        document_type=document_type,
        document_id=document_id,
        signer_name=signer_name,
        signer_email=signer_email,
        token_hash=_hash_token(raw),
        status=ESignatureStatus.pending,
        expires_at=datetime.utcnow() + timedelta(days=ESIG_TTL_DAYS),
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req, raw


def complete_esignature(
    db: Session,
    raw_token: str,
    signer_ip: str,
    signature_data: str,
) -> ESignatureRequest | None:
    """Mark an e-signature request as completed."""
    token_hash = _hash_token(raw_token)
    req = db.query(ESignatureRequest).filter(
        ESignatureRequest.token_hash == token_hash,
        ESignatureRequest.status == ESignatureStatus.pending,
    ).first()
    if not req:
        return None
    req.status = ESignatureStatus.signed
    req.signed_at = datetime.utcnow()
    req.signer_ip = signer_ip
    req.signature_data = signature_data
    db.commit()
    db.refresh(req)
    return req
