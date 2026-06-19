"""Outbound webhook endpoint management."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_manager
from app.models import User, WebhookEndpoint, WebhookDelivery
from app.schemas import (
    WebhookEndpointCreate, WebhookEndpointOut,
    WebhookDeliveryOut,
)

router = APIRouter(prefix="/webhooks-out", tags=["Webhooks (Outbound)"])


@router.post("", response_model=WebhookEndpointOut)
def create_endpoint(
    body: WebhookEndpointCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    import secrets
    ep = WebhookEndpoint(
        organization_id=user.organization_id,
        url=str(body.url),
        secret=secrets.token_hex(32),
        events=body.events,
        active=body.active,
    )
    db.add(ep)
    db.commit()
    db.refresh(ep)
    return ep


@router.get("", response_model=list[WebhookEndpointOut])
def list_endpoints(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return db.query(WebhookEndpoint).filter(
        WebhookEndpoint.organization_id == user.organization_id
    ).all()


@router.get("/{endpoint_id}", response_model=WebhookEndpointOut)
def get_endpoint(
    endpoint_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ep = db.query(WebhookEndpoint).filter(
        WebhookEndpoint.id == endpoint_id,
        WebhookEndpoint.organization_id == user.organization_id,
    ).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    return ep


@router.patch("/{endpoint_id}", response_model=WebhookEndpointOut)
def update_endpoint(
    endpoint_id: str,
    body: WebhookEndpointCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    ep = db.query(WebhookEndpoint).filter(
        WebhookEndpoint.id == endpoint_id,
        WebhookEndpoint.organization_id == user.organization_id,
    ).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    ep.url = str(body.url)
    ep.events = body.events
    ep.active = body.active
    db.commit()
    db.refresh(ep)
    return ep


@router.delete("/{endpoint_id}", status_code=204)
def delete_endpoint(
    endpoint_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    ep = db.query(WebhookEndpoint).filter(
        WebhookEndpoint.id == endpoint_id,
        WebhookEndpoint.organization_id == user.organization_id,
    ).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    db.delete(ep)
    db.commit()


@router.get("/{endpoint_id}/deliveries", response_model=list[WebhookDeliveryOut])
def list_deliveries(
    endpoint_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return db.query(WebhookDelivery).filter(
        WebhookDelivery.endpoint_id == endpoint_id,
        WebhookDelivery.organization_id == user.organization_id,
    ).order_by(WebhookDelivery.created_at.desc()).limit(50).all()


@router.post("/{endpoint_id}/deliveries/{delivery_id}/redeliver")
def redeliver(
    endpoint_id: str,
    delivery_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    from app.models import WebhookDeliveryStatus
    delivery = db.query(WebhookDelivery).filter(
        WebhookDelivery.id == delivery_id,
        WebhookDelivery.endpoint_id == endpoint_id,
        WebhookDelivery.organization_id == user.organization_id,
    ).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    delivery.status = WebhookDeliveryStatus.pending
    delivery.attempts = 0
    db.commit()
    from app.tasks.webhook_tasks import dispatch_webhook_delivery
    dispatch_webhook_delivery(delivery_id)
    return {"queued": True, "delivery_id": delivery_id}
