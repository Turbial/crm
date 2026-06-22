"""SMS delivery: Twilio → log fallback."""
from __future__ import annotations

import logging

from app.config import settings

logger = logging.getLogger(__name__)


def send_sms(to: str, body: str, from_number: str | None = None) -> dict:
    """Send an SMS via Twilio, or log-only if credentials not configured."""
    sender = from_number or settings.twilio_from_number

    if settings.twilio_account_sid and settings.twilio_auth_token:
        return _send_via_twilio(to, body, sender)

    logger.info("SMS (no-op) to=%s body=%r", to, body[:80])
    return {"provider": "log", "to": to}


def _send_via_twilio(to: str, body: str, from_number: str) -> dict:
    try:
        from twilio.rest import Client  # type: ignore

        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        message = client.messages.create(body=body, from_=from_number, to=to)
        logger.info("Twilio SMS sent to %s, sid=%s", to, message.sid)
        return {"provider": "twilio", "sid": message.sid, "to": to}
    except Exception as exc:
        logger.error("Twilio send failed: %s", exc)
        return {"provider": "twilio_error", "error": str(exc)}
