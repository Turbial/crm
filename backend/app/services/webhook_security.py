import hashlib
import hmac
import time
from typing import Optional

from fastapi import HTTPException, Request

from app.config import settings


def _sign(secret: str, timestamp: str, body: bytes) -> str:
    payload = timestamp.encode("utf-8") + b"." + body
    return hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()


async def verify_signed_webhook(request: Request, secret: Optional[str] = None) -> bytes:
    """Verify webhook signatures.

    Preferred production format:
      X-Mighty-Timestamp: unix seconds
      X-Mighty-Signature: hex(hmac_sha256(secret, f"{timestamp}.{raw_body}"))

    Legacy dev fallback:
      X-Mighty-Webhook-Secret: <secret>
    """
    expected_secret = secret or settings.provider_webhook_secret
    body = await request.body()
    x_mighty_signature = request.headers.get("x-mighty-signature")
    x_mighty_timestamp = request.headers.get("x-mighty-timestamp")
    x_mighty_webhook_secret = request.headers.get("x-mighty-webhook-secret")

    if x_mighty_signature and x_mighty_timestamp:
        try:
            timestamp = int(x_mighty_timestamp)
        except ValueError as exc:
            raise HTTPException(401, "Invalid webhook timestamp") from exc
        if abs(int(time.time()) - timestamp) > settings.webhook_timestamp_tolerance_seconds:
            raise HTTPException(401, "Expired webhook timestamp")
        expected = _sign(expected_secret, x_mighty_timestamp, body)
        if not hmac.compare_digest(expected, x_mighty_signature):
            raise HTTPException(401, "Invalid webhook signature")
        return body

    if x_mighty_webhook_secret and hmac.compare_digest(x_mighty_webhook_secret, expected_secret):
        return body

    raise HTTPException(401, "Missing or invalid webhook signature")
