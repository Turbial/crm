"""Billing and payment endpoints.

POST /billing/payment-links  — create a Stripe Checkout session
GET  /billing/payment-links  — list payment links
GET  /billing/payment-links/{id} — get status
POST /billing/stripe/webhook — Stripe webhook receiver (unsigned, raw body)
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_manager
from app.models import User, PaymentLink
from app.schemas import PaymentLinkCreate, PaymentLinkOut

logger = logging.getLogger("mighty.billing")
router = APIRouter(prefix="/billing", tags=["Billing"])


@router.post("/payment-links", response_model=PaymentLinkOut)
def create_payment_link(
    body: PaymentLinkCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    from app.services.billing_service import create_payment_link as _create
    from app.config import settings
    if not getattr(settings, "stripe_secret_key", None):
        raise HTTPException(status_code=503, detail="Stripe not configured")
    try:
        link = _create(
            db=db,
            org_id=user.organization_id,
            amount_cents=body.amount_cents,
            currency=body.currency,
            description=body.description,
            invoice_id=body.invoice_id,
            quote_id=body.quote_id,
        )
    except Exception as exc:
        logger.error("Failed to create payment link: %s", exc)
        raise HTTPException(status_code=502, detail=f"Stripe error: {exc}") from exc
    return link


@router.get("/payment-links", response_model=list[PaymentLinkOut])
def list_payment_links(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return db.query(PaymentLink).filter(
        PaymentLink.organization_id == user.organization_id
    ).order_by(PaymentLink.created_at.desc()).limit(100).all()


@router.get("/payment-links/{link_id}", response_model=PaymentLinkOut)
def get_payment_link(
    link_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.billing_service import get_payment_link_status
    link = get_payment_link_status(db, user.organization_id, link_id)
    if not link:
        raise HTTPException(status_code=404, detail="Payment link not found")
    return link


@router.post("/stripe/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(..., alias="Stripe-Signature"),
    db: Session = Depends(get_db),
):
    """Stripe sends to this endpoint. No auth — signature verified internally."""
    raw_body = await request.body()
    from app.services.billing_service import handle_stripe_webhook
    from app.config import settings

    # Resolve org_id from the Stripe account metadata if needed.
    # For simplicity we use a single-tenant webhook; multi-tenant would
    # parse the metadata.organization_id from the event before routing.
    org_id = getattr(settings, "stripe_default_org_id", "")

    try:
        result = handle_stripe_webhook(db, org_id, raw_body, stripe_signature)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return result
