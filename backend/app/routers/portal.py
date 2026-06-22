"""Customer portal endpoints.

/portal/tokens  — staff-facing: generate and manage access tokens
/portal/view    — public: lead-facing portal (token in header)
/portal/sign    — public: e-signature completion
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_manager
from app.models import User, PortalPermission
from app.schemas import (
    PortalTokenCreate, PortalTokenOut,
    ESignatureRequestCreate, ESignatureRequestOut,
    ESignatureCompleteIn,
)

router = APIRouter(prefix="/portal", tags=["Customer Portal"])


# ─── Staff endpoints ───────────────────────────────────────────────────────────

@router.post("/tokens", response_model=dict)
def generate_token(
    body: PortalTokenCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    from app.services.portal_service import generate_portal_token
    perms = [PortalPermission(p) for p in (body.permissions or [])]
    try:
        row, raw = generate_portal_token(
            db=db,
            org_id=user.organization_id,
            lead_id=body.lead_id,
            permissions=perms or None,
            ttl_hours=body.ttl_hours,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {
        "token_id": row.id,
        "raw_token": raw,
        "expires_at": row.expires_at.isoformat() if row.expires_at else None,
        "permissions": row.permissions,
    }


@router.get("/tokens", response_model=list[PortalTokenOut])
def list_tokens(
    lead_id: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    from app.models import PortalToken
    q = db.query(PortalToken).filter(
        PortalToken.organization_id == user.organization_id,
        PortalToken.active == True,
    )
    if lead_id:
        q = q.filter(PortalToken.lead_id == lead_id)
    return q.order_by(PortalToken.created_at.desc()).all()


@router.post("/esignature", response_model=dict)
def create_esignature_request(
    body: ESignatureRequestCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    from app.services.portal_service import request_esignature
    req, raw = request_esignature(
        db=db,
        org_id=user.organization_id,
        lead_id=body.lead_id,
        document_type=body.document_type,
        document_id=body.document_id,
        signer_name=body.signer_name,
        signer_email=body.signer_email,
    )
    return {
        "request_id": req.id,
        "sign_token": raw,
        "status": req.status.value,
    }


@router.get("/esignature/{req_id}", response_model=ESignatureRequestOut)
def get_esignature_request(
    req_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.models import ESignatureRequest
    req = db.query(ESignatureRequest).filter(
        ESignatureRequest.id == req_id,
        ESignatureRequest.organization_id == user.organization_id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Signature request not found")
    return req


# ─── Public/lead-facing endpoints ─────────────────────────────────────────────

@router.get("/view")
def portal_view(
    x_portal_token: str = Header(..., alias="X-Portal-Token"),
    db: Session = Depends(get_db),
):
    from app.services.portal_service import resolve_portal_token, get_portal_view
    token_row = resolve_portal_token(db, x_portal_token)
    if not token_row:
        raise HTTPException(status_code=401, detail="Invalid or expired portal token")
    return get_portal_view(db, token_row)


@router.post("/sign")
def complete_signature(
    body: ESignatureCompleteIn,
    request: Request,
    db: Session = Depends(get_db),
):
    from app.services.portal_service import complete_esignature
    client_ip = request.client.host if request.client else "unknown"
    req = complete_esignature(db, body.sign_token, client_ip, body.signature_data)
    if not req:
        raise HTTPException(status_code=404, detail="Invalid or already-completed signature request")
    return {"signed": True, "signed_at": req.signed_at.isoformat()}
