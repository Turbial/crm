"""SLA monitoring — checks entity age against configured SLA rules and escalates breaches."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.models import SLARule, BreachAction, EscalateVia, Lead, Deal, Conversation


def get_rules(db: Session, org_id: str, entity_type: str | None = None) -> list[SLARule]:
    q = db.query(SLARule).filter(
        SLARule.organization_id == org_id,
        SLARule.active == True,
    )
    if entity_type:
        q = q.filter(SLARule.entity_type == entity_type)
    return q.all()


def _matches_condition(entity: Any, condition_json: dict) -> bool:
    """Check if an entity matches all conditions in condition_json."""
    for field, expected in condition_json.items():
        val = getattr(entity, field, None)
        if val is None:
            return False
        actual = val.value if hasattr(val, "value") else str(val)
        if actual != str(expected):
            return False
    return True


def _breach_lead(db: Session, rule: SLARule, lead: Lead) -> None:
    cutoff = datetime.utcnow() - timedelta(hours=rule.sla_hours)
    if lead.updated_at and lead.updated_at > cutoff:
        return
    _escalate(db, rule, entity_type="lead", entity_id=lead.id,
              entity_name=lead.name)


def _breach_deal(db: Session, rule: SLARule, deal: Deal) -> None:
    cutoff = datetime.utcnow() - timedelta(hours=rule.sla_hours)
    if deal.updated_at and deal.updated_at > cutoff:
        return
    _escalate(db, rule, entity_type="deal", entity_id=deal.id,
              entity_name=deal.title)


def _breach_conversation(db: Session, rule: SLARule, conv: Conversation) -> None:
    cutoff = datetime.utcnow() - timedelta(hours=rule.sla_hours)
    if conv.updated_at and conv.updated_at > cutoff:
        return
    _escalate(db, rule, entity_type="conversation", entity_id=conv.id,
              entity_name=conv.subject or conv.id)


def _escalate(
    db: Session,
    rule: SLARule,
    entity_type: str,
    entity_id: str,
    entity_name: str,
) -> None:
    from app.services.notification_service import notify, notify_org_managers
    title = f"SLA breach: {rule.name}"
    body = (f"{entity_type.title()} '{entity_name}' has exceeded the "
            f"{rule.sla_hours}h SLA for rule '{rule.name}'.")

    if rule.escalate_to_user_id:
        notify(db, rule.organization_id, rule.escalate_to_user_id,
               title=title, body=body,
               notification_type="sla_breach",
               action_url=f"/{entity_type}s/{entity_id}")
    else:
        notify_org_managers(db, rule.organization_id,
                            title=title, body=body,
                            notification_type="sla_breach",
                            action_url=f"/{entity_type}s/{entity_id}")

    if rule.action_on_breach == BreachAction.auto_execute and rule.escalation_action_key:
        from app.services.action_executor import execute_with_approval_check
        execute_with_approval_check(
            db,
            org_id=rule.organization_id,
            action_key=rule.escalation_action_key,
            input_payload={f"{entity_type}_id": entity_id},
            source="sla_monitor",
            requested_by_type="system",
        )


def run_sla_check(db: Session, org_id: str) -> dict[str, int]:
    """Run all SLA rules for an org. Returns breach counts per entity type."""
    rules = get_rules(db, org_id)
    breaches: dict[str, int] = {}

    for rule in rules:
        et = rule.entity_type
        entities: list[Any] = []

        if et == "lead":
            entities = db.query(Lead).filter(Lead.organization_id == org_id).all()
            for e in entities:
                if _matches_condition(e, rule.condition_json):
                    cutoff = datetime.utcnow() - timedelta(hours=rule.sla_hours)
                    if e.updated_at and e.updated_at < cutoff:
                        _breach_lead(db, rule, e)
                        breaches[et] = breaches.get(et, 0) + 1

        elif et == "deal":
            entities = db.query(Deal).filter(Deal.organization_id == org_id).all()
            for e in entities:
                if _matches_condition(e, rule.condition_json):
                    cutoff = datetime.utcnow() - timedelta(hours=rule.sla_hours)
                    if e.updated_at and e.updated_at < cutoff:
                        _breach_deal(db, rule, e)
                        breaches[et] = breaches.get(et, 0) + 1

        elif et == "conversation":
            entities = db.query(Conversation).filter(Conversation.organization_id == org_id).all()
            for e in entities:
                if _matches_condition(e, rule.condition_json):
                    cutoff = datetime.utcnow() - timedelta(hours=rule.sla_hours)
                    if e.updated_at and e.updated_at < cutoff:
                        _breach_conversation(db, rule, e)
                        breaches[et] = breaches.get(et, 0) + 1

    return breaches


def create_rule(
    db: Session,
    org_id: str,
    name: str,
    entity_type: str,
    sla_hours: float,
    condition_json: dict | None = None,
    escalate_to_user_id: str | None = None,
    escalate_via: str = "notification",
    action_on_breach: str = "notify",
    escalation_action_key: str | None = None,
) -> SLARule:
    rule = SLARule(
        organization_id=org_id,
        name=name,
        entity_type=entity_type,
        sla_hours=sla_hours,
        condition_json=condition_json or {},
        escalate_to_user_id=escalate_to_user_id,
        escalate_via=EscalateVia(escalate_via),
        action_on_breach=BreachAction(action_on_breach),
        escalation_action_key=escalation_action_key,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule
