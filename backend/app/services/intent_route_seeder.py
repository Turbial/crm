"""Seed default (system-level) intent routes at startup."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import IntentRoute

SYSTEM_ROUTES = [
    # CRM
    dict(intent_pattern="create_lead",          action_key="crm.create_lead",          target_surface="crm",      confidence_threshold=0.70, require_confirmation=False),
    dict(intent_pattern="create_contact",        action_key="crm.create_contact",        target_surface="crm",      confidence_threshold=0.70, require_confirmation=False),
    dict(intent_pattern="create_company",        action_key="crm.create_company",        target_surface="crm",      confidence_threshold=0.70, require_confirmation=False),
    dict(intent_pattern="create_deal",           action_key="crm.create_deal",           target_surface="crm",      confidence_threshold=0.70, require_confirmation=False),
    dict(intent_pattern="move_deal",             action_key="crm.move_deal_stage",       target_surface="crm",      confidence_threshold=0.75, require_confirmation=True),
    dict(intent_pattern="update_lead_status",    action_key="crm.update_lead_status",    target_surface="crm",      confidence_threshold=0.72, require_confirmation=False),
    dict(intent_pattern="add_note",              action_key="crm.add_note",              target_surface="crm",      confidence_threshold=0.70, require_confirmation=False),
    dict(intent_pattern="schedule_followup",     action_key="crm.schedule_followup",     target_surface="crm",      confidence_threshold=0.70, require_confirmation=False),
    dict(intent_pattern="delete_lead",           action_key="crm.delete_lead",           target_surface="crm",      confidence_threshold=0.90, require_confirmation=True),
    # PM
    dict(intent_pattern="create_project",        action_key="pm.create_project",         target_surface="pm",       confidence_threshold=0.70, require_confirmation=True),
    dict(intent_pattern="create_task",           action_key="pm.create_task",            target_surface="pm",       confidence_threshold=0.70, require_confirmation=False),
    dict(intent_pattern="assign_task",           action_key="pm.assign_task",            target_surface="pm",       confidence_threshold=0.70, require_confirmation=False),
    dict(intent_pattern="complete_task",         action_key="pm.complete_task",          target_surface="pm",       confidence_threshold=0.72, require_confirmation=False),
    dict(intent_pattern="move_card",             action_key="pm.move_card",              target_surface="pm",       confidence_threshold=0.70, require_confirmation=False),
    dict(intent_pattern="create_from_template",  action_key="pm.create_from_template",   target_surface="pm",       confidence_threshold=0.75, require_confirmation=True),
    # Billing
    dict(intent_pattern="create_payment_link",   action_key="billing.create_payment_link", target_surface="billing", confidence_threshold=0.80, require_confirmation=True),
    dict(intent_pattern="send_invoice",          action_key="billing.send_invoice",       target_surface="billing", confidence_threshold=0.80, require_confirmation=True),
    # Messaging
    dict(intent_pattern="send_message",          action_key="message.send",               target_surface="messaging", confidence_threshold=0.78, require_confirmation=True),
    dict(intent_pattern="schedule_message",      action_key="message.schedule",           target_surface="messaging", confidence_threshold=0.72, require_confirmation=False),
    dict(intent_pattern="enroll_sequence",       action_key="sequence.enroll_lead",       target_surface="messaging", confidence_threshold=0.78, require_confirmation=True),
    # Portal
    dict(intent_pattern="generate_portal",       action_key="portal.generate_token",      target_surface="portal",   confidence_threshold=0.75, require_confirmation=False),
    dict(intent_pattern="request_esignature",    action_key="portal.request_esignature",  target_surface="portal",   confidence_threshold=0.80, require_confirmation=True),
    # Automation
    dict(intent_pattern="run_workflow",          action_key="automation.run_workflow",     target_surface="automation", confidence_threshold=0.75, require_confirmation=True),
]


def seed_intent_routes(db: Session) -> int:
    """Idempotently seed system-level IntentRoutes. Returns count created."""
    created = 0
    for spec in SYSTEM_ROUTES:
        existing = db.query(IntentRoute).filter(
            IntentRoute.intent_pattern == spec["intent_pattern"],
            IntentRoute.organization_id.is_(None),
        ).first()
        if not existing:
            db.add(IntentRoute(organization_id=None, **spec))
            created += 1
    if created:
        db.commit()
    return created
