"""Email template rendering engine.

Supports both lead-variable substitution ({{lead_name}}, etc.) and custom
key→value context overrides passed at render time.
"""
from __future__ import annotations

import re
from typing import Any

from sqlalchemy.orm import Session

from app.models import EmailTemplate, Lead


_LEAD_FIELDS = {
    "lead_name": "name",
    "lead_email": "email",
    "lead_phone": "phone",
    "lead_company": "company",
    "lead_city": "city",
    "lead_state": "state",
    "lead_source": "source",
    "lead_website": "website",
}

_VAR_RE = re.compile(r"\{\{(\w+)\}\}")


def render_template(
    template: EmailTemplate,
    lead: Lead | None = None,
    extra_context: dict[str, Any] | None = None,
) -> tuple[str, str, str]:
    """Render a template. Returns (subject, body_html, body_text)."""
    ctx: dict[str, str] = {}

    if lead:
        for var_key, attr in _LEAD_FIELDS.items():
            ctx[var_key] = str(getattr(lead, attr) or "")

    if extra_context:
        for k, v in extra_context.items():
            ctx[k] = str(v)

    def _sub(text: str) -> str:
        return _VAR_RE.sub(lambda m: ctx.get(m.group(1), m.group(0)), text)

    subject = _sub(template.subject or "")
    body_html = _sub(template.body_html or "")
    body_text = _sub(template.body_text or "")
    return subject, body_html, body_text


def render_template_by_id(
    db: Session,
    org_id: str,
    template_id: str,
    lead: Lead | None = None,
    extra_context: dict[str, Any] | None = None,
) -> tuple[str, str, str]:
    tpl = db.query(EmailTemplate).filter(
        EmailTemplate.id == template_id,
        EmailTemplate.organization_id == org_id,
    ).first()
    if not tpl:
        raise ValueError(f"EmailTemplate {template_id} not found")
    return render_template(tpl, lead, extra_context)


def list_templates(
    db: Session,
    org_id: str,
    category: str | None = None,
) -> list[EmailTemplate]:
    q = db.query(EmailTemplate).filter(EmailTemplate.organization_id == org_id)
    if category:
        q = q.filter(EmailTemplate.category == category)
    return q.order_by(EmailTemplate.created_at.desc()).all()


def preview_template(
    template: EmailTemplate,
    sample_lead_name: str = "Alex Sample",
    sample_company: str = "Acme Corp",
) -> dict[str, str]:
    """Render with placeholder values for preview/test purposes."""
    ctx = {
        "lead_name": sample_lead_name,
        "lead_email": "alex@example.com",
        "lead_phone": "+1 555-000-0000",
        "lead_company": sample_company,
        "lead_city": "Springfield",
        "lead_state": "IL",
        "lead_source": "web",
        "lead_website": "https://example.com",
    }

    def _sub(text: str) -> str:
        return _VAR_RE.sub(lambda m: ctx.get(m.group(1), f"[{m.group(1)}]"), text or "")

    return {
        "subject": _sub(template.subject or ""),
        "body_html": _sub(template.body_html or ""),
        "body_text": _sub(template.body_text or ""),
    }
