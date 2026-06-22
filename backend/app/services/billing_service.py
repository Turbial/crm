"""Stripe billing service.

Handles payment intent creation, checkout session generation, and Stripe
webhook event processing with idempotency via StripeWebhookEvent.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import stripe
from sqlalchemy.orm import Session

from app.config import settings
from app.models import (
    Invoice, InvoiceStatus, Payment, PaymentStatus,
    PaymentLink, PaymentLinkStatus, StripeWebhookEvent, Quote,
)

logger = logging.getLogger("mighty.billing")


def _stripe() -> stripe:
    stripe.api_key = settings.stripe_secret_key
    return stripe


def create_payment_link(
    db: Session,
    org_id: str,
    amount_cents: int,
    currency: str = "usd",
    description: str = "Payment",
    invoice_id: str | None = None,
    quote_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> PaymentLink:
    """Create a Stripe Checkout Session and record a PaymentLink row."""
    s = _stripe()
    meta = {"organization_id": org_id, **(metadata or {})}
    if invoice_id:
        meta["invoice_id"] = invoice_id
    if quote_id:
        meta["quote_id"] = quote_id

    session = s.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": currency,
                "product_data": {"name": description},
                "unit_amount": amount_cents,
            },
            "quantity": 1,
        }],
        mode="payment",
        success_url=f"{settings.app_base_url}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{settings.app_base_url}/billing/cancel",
        metadata=meta,
    )

    link = PaymentLink(
        organization_id=org_id,
        invoice_id=invoice_id,
        quote_id=quote_id,
        amount=amount_cents / 100,
        currency=currency,
        stripe_payment_intent_id=session.payment_intent,
        stripe_checkout_url=session.url,
        status=PaymentLinkStatus.active,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


def handle_stripe_webhook(
    db: Session,
    org_id: str,
    raw_body: bytes,
    sig_header: str,
) -> dict[str, Any]:
    """Verify signature, deduplicate, and process a Stripe webhook event."""
    try:
        event = _stripe().Webhook.construct_event(
            raw_body, sig_header, settings.stripe_webhook_secret
        )
    except Exception as exc:
        logger.warning("Stripe webhook signature verification failed: %s", exc)
        raise ValueError("Invalid Stripe signature") from exc

    # Idempotency check
    existing = db.query(StripeWebhookEvent).filter(
        StripeWebhookEvent.stripe_event_id == event["id"]
    ).first()
    if existing:
        return {"status": "duplicate", "event_id": event["id"]}

    record = StripeWebhookEvent(
        organization_id=org_id,
        stripe_event_id=event["id"],
        event_type=event["type"],
        payload_json=dict(event),
    )
    db.add(record)
    db.commit()

    _process_stripe_event(db, org_id, event)
    return {"status": "processed", "event_id": event["id"], "type": event["type"]}


def _process_stripe_event(db: Session, org_id: str, event: dict) -> None:
    etype = event.get("type", "")
    data = event.get("data", {}).get("object", {})

    if etype == "checkout.session.completed":
        _on_checkout_completed(db, org_id, data)
    elif etype == "payment_intent.succeeded":
        _on_payment_succeeded(db, org_id, data)
    elif etype == "payment_intent.payment_failed":
        _on_payment_failed(db, org_id, data)
    elif etype in ("invoice.paid", "invoice.payment_succeeded"):
        _on_invoice_paid(db, org_id, data)
    else:
        logger.debug("Unhandled Stripe event type: %s", etype)


def _on_checkout_completed(db: Session, org_id: str, data: dict) -> None:
    pi_id = data.get("payment_intent")
    if not pi_id:
        return
    link = db.query(PaymentLink).filter(
        PaymentLink.stripe_payment_intent_id == pi_id,
        PaymentLink.organization_id == org_id,
    ).first()
    if link:
        link.status = PaymentLinkStatus.paid
        link.paid_at = datetime.utcnow()

    amount_total = data.get("amount_total", 0)
    meta = data.get("metadata", {})
    invoice_id = meta.get("invoice_id")

    payment = Payment(
        organization_id=org_id,
        invoice_id=invoice_id,
        provider="stripe",
        amount=amount_total / 100,
        status=PaymentStatus.succeeded,
        external_id=pi_id,
        metadata_json=meta,
    )
    db.add(payment)

    if invoice_id:
        inv = db.query(Invoice).filter(
            Invoice.id == invoice_id, Invoice.organization_id == org_id
        ).first()
        if inv:
            inv.status = InvoiceStatus.paid

    db.commit()


def _on_payment_succeeded(db: Session, org_id: str, data: dict) -> None:
    pi_id = data.get("id")
    link = db.query(PaymentLink).filter(
        PaymentLink.stripe_payment_intent_id == pi_id,
        PaymentLink.organization_id == org_id,
    ).first()
    if link and link.status != PaymentLinkStatus.paid:
        link.status = PaymentLinkStatus.paid
        link.paid_at = datetime.utcnow()
        db.commit()


def _on_payment_failed(db: Session, org_id: str, data: dict) -> None:
    pi_id = data.get("id")
    link = db.query(PaymentLink).filter(
        PaymentLink.stripe_payment_intent_id == pi_id,
        PaymentLink.organization_id == org_id,
    ).first()
    if link:
        link.status = PaymentLinkStatus.failed
        db.commit()


def _on_invoice_paid(db: Session, org_id: str, data: dict) -> None:
    stripe_invoice_id = data.get("id")
    amount_paid = data.get("amount_paid", 0)
    payment = Payment(
        organization_id=org_id,
        provider="stripe",
        amount=amount_paid / 100,
        status=PaymentStatus.succeeded,
        external_id=stripe_invoice_id,
        metadata_json={"stripe_invoice_id": stripe_invoice_id},
    )
    db.add(payment)
    db.commit()


def get_payment_link_status(db: Session, org_id: str, link_id: str) -> PaymentLink | None:
    return db.query(PaymentLink).filter(
        PaymentLink.id == link_id, PaymentLink.organization_id == org_id
    ).first()
