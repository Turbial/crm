"""Email delivery: SendGrid → SMTP → log fallback."""
from __future__ import annotations

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)


def send_email(
    to: str,
    subject: str,
    html_body: str,
    text_body: Optional[str] = None,
    from_email: Optional[str] = None,
    from_name: Optional[str] = None,
) -> dict:
    """Send an email via SendGrid, SMTP, or log-only fallback."""
    sender = from_email or settings.email_from
    sender_name = from_name or settings.email_from_name

    if settings.sendgrid_api_key:
        return _send_via_sendgrid(to, subject, html_body, text_body, sender, sender_name)
    if settings.smtp_host:
        return _send_via_smtp(to, subject, html_body, text_body, sender, sender_name)
    logger.info(
        "EMAIL (no-op) to=%s subject=%r from=%s",
        to, subject, sender,
    )
    return {"provider": "log", "to": to}


def _send_via_sendgrid(to, subject, html_body, text_body, sender, sender_name) -> dict:
    try:
        import sendgrid  # type: ignore
        from sendgrid.helpers.mail import Content, Email, Mail, To  # type: ignore

        sg = sendgrid.SendGridAPIClient(api_key=settings.sendgrid_api_key)
        mail = Mail(
            from_email=Email(sender, sender_name),
            to_emails=To(to),
            subject=subject,
            html_content=Content("text/html", html_body),
        )
        if text_body:
            mail.content = [
                Content("text/plain", text_body),
                Content("text/html", html_body),
            ]
        response = sg.send(mail)
        logger.info("SendGrid email sent to %s, status=%s", to, response.status_code)
        return {"provider": "sendgrid", "status_code": response.status_code, "to": to}
    except Exception as exc:
        logger.error("SendGrid send failed: %s — falling back to log", exc)
        return {"provider": "sendgrid_error", "error": str(exc)}


def _send_via_smtp(to, subject, html_body, text_body, sender, sender_name) -> dict:
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{sender_name} <{sender}>"
        msg["To"] = to
        if text_body:
            msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.ehlo()
            server.starttls()
            if settings.smtp_user and settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(sender, [to], msg.as_string())
        logger.info("SMTP email sent to %s via %s", to, settings.smtp_host)
        return {"provider": "smtp", "to": to}
    except Exception as exc:
        logger.error("SMTP send failed: %s", exc)
        return {"provider": "smtp_error", "error": str(exc)}
