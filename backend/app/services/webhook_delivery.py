"""Outbound webhook delivery service.

Sends signed HTTP POST requests to registered WebhookEndpoints. Delivery
records are written to webhook_deliveries and retried via Celery.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
from datetime import datetime, timedelta

import httpx
from sqlalchemy.orm import Session

from app.models import WebhookEndpoint, WebhookDelivery, WebhookDeliveryStatus

logger = logging.getLogger("mighty.webhooks")

MAX_ATTEMPTS = 5
RETRY_DELAYS = [60, 300, 900, 3600, 10800]  # 1m, 5m, 15m, 1h, 3h


def _sign_payload(secret: str, body: bytes, timestamp: str) -> str:
    message = f"{timestamp}.".encode() + body
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def queue_deliveries(db: Session, org_id: str, event_type: str, payload: dict) -> list[WebhookDelivery]:
    """Create WebhookDelivery rows for all active endpoints subscribed to this event."""
    endpoints = (
        db.query(WebhookEndpoint)
        .filter(WebhookEndpoint.organization_id == org_id, WebhookEndpoint.active == True)
        .all()
    )
    deliveries: list[WebhookDelivery] = []
    for ep in endpoints:
        subscribed = ep.events or []
        if event_type not in subscribed and "*" not in subscribed:
            continue
        delivery = WebhookDelivery(
            organization_id=org_id,
            endpoint_id=ep.id,
            event_type=event_type,
            payload_json=payload,
            status=WebhookDeliveryStatus.pending,
        )
        db.add(delivery)
        deliveries.append(delivery)
    db.commit()
    for d in deliveries:
        db.refresh(d)
    return deliveries


def attempt_delivery(db: Session, delivery_id: str) -> bool:
    """Make a single HTTP delivery attempt. Returns True on success."""
    delivery = db.get(WebhookDelivery, delivery_id)
    if not delivery:
        return False
    endpoint = db.get(WebhookEndpoint, delivery.endpoint_id)
    if not endpoint or not endpoint.active:
        delivery.status = WebhookDeliveryStatus.failed
        db.commit()
        return False

    body = json.dumps({
        "event": delivery.event_type,
        "organization_id": delivery.organization_id,
        "data": delivery.payload_json,
        "delivered_at": datetime.utcnow().isoformat(),
    }).encode()
    timestamp = str(int(datetime.utcnow().timestamp()))
    sig = _sign_payload(endpoint.secret, body, timestamp)

    headers = {
        "Content-Type": "application/json",
        "X-Mighty-Event": delivery.event_type,
        "X-Mighty-Timestamp": timestamp,
        "X-Mighty-Signature": sig,
        "X-Mighty-Delivery": delivery_id,
    }

    delivery.attempts = (delivery.attempts or 0) + 1
    try:
        resp = httpx.post(endpoint.url, content=body, headers=headers, timeout=10.0)
        delivery.last_response_code = resp.status_code
        delivery.last_response_body = resp.text[:1000]

        if resp.is_success:
            delivery.status = WebhookDeliveryStatus.delivered
            delivery.delivered_at = datetime.utcnow()
            db.commit()
            return True
        raise httpx.HTTPStatusError(f"status {resp.status_code}", request=resp.request, response=resp)

    except Exception as exc:
        logger.warning("webhook delivery %s failed attempt %d: %s", delivery_id, delivery.attempts, exc)
        if delivery.attempts < MAX_ATTEMPTS:
            delay = RETRY_DELAYS[min(delivery.attempts - 1, len(RETRY_DELAYS) - 1)]
            delivery.status = WebhookDeliveryStatus.retrying
            delivery.next_retry_at = datetime.utcnow() + timedelta(seconds=delay)
        else:
            delivery.status = WebhookDeliveryStatus.failed
        db.commit()
        return False
