"""Celery tasks for outbound webhook delivery."""
from __future__ import annotations

import logging

from app.celery_app import celery_app
from app.database import SessionLocal

logger = logging.getLogger("mighty.tasks.webhooks")


@celery_app.task(bind=True, max_retries=5, default_retry_delay=60, name="tasks.deliver_webhook")
def deliver_webhook_task(self, delivery_id: str) -> bool:
    db = SessionLocal()
    try:
        from app.services.webhook_delivery import attempt_delivery
        success = attempt_delivery(db, delivery_id)
        if not success:
            from app.models import WebhookDelivery, WebhookDeliveryStatus
            delivery = db.get(WebhookDelivery, delivery_id)
            if delivery and delivery.status == WebhookDeliveryStatus.retrying:
                raise self.retry(countdown=60 * (2 ** self.request.retries))
        return success
    except Exception as exc:
        logger.error("Webhook delivery task failed for %s: %s", delivery_id, exc)
        raise
    finally:
        db.close()


def dispatch_webhook_delivery(delivery_id: str) -> None:
    deliver_webhook_task.delay(delivery_id)
