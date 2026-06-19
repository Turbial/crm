"""Action Registry — catalog of all executable system actions.

ActionDefinitions are seeded at startup for system actions.
Org-level custom actions can be registered via the API.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models import ActionDefinition, ActionRun, ActionStatus, ApprovalRequest, ActionApprovalStatus, RiskLevel

SYSTEM_ACTIONS: list[dict[str, Any]] = [
    # CRM
    dict(action_key="crm.create_lead", display_name="Create Lead", category="crm",
         required_role="employee", approval_required=False, destructive=False),
    dict(action_key="crm.update_lead_status", display_name="Update Lead Status", category="crm",
         required_role="employee", approval_required=False, destructive=False),
    dict(action_key="crm.create_contact", display_name="Create Contact", category="crm",
         required_role="employee", approval_required=False, destructive=False),
    dict(action_key="crm.create_company", display_name="Create Company", category="crm",
         required_role="employee", approval_required=False, destructive=False),
    dict(action_key="crm.create_deal", display_name="Create Deal", category="crm",
         required_role="employee", approval_required=False, destructive=False),
    dict(action_key="crm.move_deal_stage", display_name="Move Deal Stage", category="crm",
         required_role="employee", approval_required=False, destructive=False),
    dict(action_key="crm.add_note", display_name="Add Note", category="crm",
         required_role="employee", approval_required=False, destructive=False),
    dict(action_key="crm.schedule_followup", display_name="Schedule Follow-up", category="crm",
         required_role="employee", approval_required=False, destructive=False),
    dict(action_key="crm.enroll_sequence", display_name="Enroll Lead in Sequence", category="crm",
         required_role="manager", approval_required=True, destructive=False),
    dict(action_key="crm.delete_lead", display_name="Delete Lead", category="crm",
         required_role="manager", approval_required=True, destructive=True),
    # PM
    dict(action_key="pm.create_project", display_name="Create Project", category="pm",
         required_role="employee", approval_required=True, destructive=False),
    dict(action_key="pm.create_task", display_name="Create Task", category="pm",
         required_role="employee", approval_required=False, destructive=False),
    dict(action_key="pm.move_card", display_name="Move Card", category="pm",
         required_role="employee", approval_required=False, destructive=False),
    dict(action_key="pm.assign_task", display_name="Assign Task", category="pm",
         required_role="employee", approval_required=False, destructive=False),
    dict(action_key="pm.add_comment", display_name="Add Comment", category="pm",
         required_role="employee", approval_required=False, destructive=False),
    dict(action_key="pm.complete_task", display_name="Complete Task", category="pm",
         required_role="employee", approval_required=False, destructive=False),
    dict(action_key="pm.create_from_template", display_name="Create Project from Template", category="pm",
         required_role="manager", approval_required=True, destructive=False),
    # Billing
    dict(action_key="billing.create_payment_link", display_name="Create Payment Link", category="billing",
         required_role="manager", approval_required=True, destructive=False),
    dict(action_key="billing.send_invoice", display_name="Send Invoice", category="billing",
         required_role="manager", approval_required=True, destructive=False),
    dict(action_key="billing.mark_invoice_paid", display_name="Mark Invoice Paid", category="billing",
         required_role="manager", approval_required=False, destructive=False),
    # Messaging
    dict(action_key="message.send", display_name="Send Message", category="messaging",
         required_role="employee", approval_required=True, destructive=False),
    dict(action_key="message.schedule", display_name="Schedule Message", category="messaging",
         required_role="employee", approval_required=False, destructive=False),
    dict(action_key="sequence.enroll_lead", display_name="Enroll in Drip Sequence", category="messaging",
         required_role="manager", approval_required=True, destructive=False),
    # Portal
    dict(action_key="portal.generate_token", display_name="Generate Portal Token", category="portal",
         required_role="manager", approval_required=False, destructive=False),
    dict(action_key="portal.request_esignature", display_name="Request E-Signature", category="portal",
         required_role="manager", approval_required=True, destructive=False),
    # Automation
    dict(action_key="automation.run_workflow", display_name="Run Workflow", category="automation",
         required_role="manager", approval_required=False, destructive=False),
]


def seed_system_actions(db: Session) -> int:
    """Idempotently seed system ActionDefinitions. Returns count created."""
    created = 0
    for spec in SYSTEM_ACTIONS:
        existing = db.query(ActionDefinition).filter(
            ActionDefinition.action_key == spec["action_key"],
            ActionDefinition.organization_id.is_(None),
        ).first()
        if not existing:
            db.add(ActionDefinition(organization_id=None, **spec))
            created += 1
    if created:
        db.commit()
    return created


def get_definition(db: Session, action_key: str, org_id: str | None = None) -> ActionDefinition | None:
    """Look up an action definition — org-level first, then system-level."""
    if org_id:
        org_def = db.query(ActionDefinition).filter(
            ActionDefinition.action_key == action_key,
            ActionDefinition.organization_id == org_id,
            ActionDefinition.active == True,
        ).first()
        if org_def:
            return org_def
    return db.query(ActionDefinition).filter(
        ActionDefinition.action_key == action_key,
        ActionDefinition.organization_id.is_(None),
        ActionDefinition.active == True,
    ).first()


def list_definitions(
    db: Session,
    org_id: str,
    category: str | None = None,
) -> list[ActionDefinition]:
    """List all available actions for an org (system + org-level)."""
    q = db.query(ActionDefinition).filter(
        ActionDefinition.active == True,
        (ActionDefinition.organization_id == org_id) | ActionDefinition.organization_id.is_(None),
    )
    if category:
        q = q.filter(ActionDefinition.category == category)
    return q.order_by(ActionDefinition.category, ActionDefinition.display_name).all()


def create_action_run(
    db: Session,
    org_id: str,
    action_key: str,
    source: str,
    input_payload: dict,
    requested_by_type: str = "human",
    requested_by_id: str | None = None,
    linked_entity_type: str | None = None,
    linked_entity_id: str | None = None,
    idempotency_key: str | None = None,
) -> ActionRun:
    """Create an ActionRun row."""
    if idempotency_key:
        existing = db.query(ActionRun).filter(
            ActionRun.idempotency_key == idempotency_key,
            ActionRun.organization_id == org_id,
        ).first()
        if existing:
            return existing

    run = ActionRun(
        organization_id=org_id,
        action_key=action_key,
        source=source,
        requested_by_type=requested_by_type,
        requested_by_id=requested_by_id,
        linked_entity_type=linked_entity_type,
        linked_entity_id=linked_entity_id,
        input_payload=input_payload,
        status=ActionStatus.pending,
        idempotency_key=idempotency_key,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def append_log(db: Session, run: ActionRun, message: str, level: str = "info") -> None:
    logs = list(run.logs or [])
    logs.append({"ts": datetime.utcnow().isoformat(), "level": level, "msg": message})
    run.logs = logs
    db.commit()


def complete_run(db: Session, run: ActionRun, output: dict) -> ActionRun:
    run.status = ActionStatus.completed
    run.output_payload = output
    run.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(run)
    return run


def fail_run(db: Session, run: ActionRun, error: str) -> ActionRun:
    run.status = ActionStatus.failed
    run.error = error
    run.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(run)
    return run


def request_approval(
    db: Session,
    org_id: str,
    run: ActionRun,
    title: str,
    description: str,
    proposed_change: dict,
    approver_user_id: str | None = None,
    risk_level: RiskLevel = RiskLevel.medium,
) -> ApprovalRequest:
    """Create an ApprovalRequest and move the ActionRun to waiting_approval."""
    approval = ApprovalRequest(
        organization_id=org_id,
        action_run_id=run.id,
        entity_type=run.linked_entity_type,
        entity_id=run.linked_entity_id,
        requested_by_type=run.requested_by_type,
        requested_by_id=run.requested_by_id,
        approver_user_id=approver_user_id,
        title=title,
        description=description,
        proposed_change=proposed_change,
        risk_level=risk_level,
        status=ActionApprovalStatus.pending,
    )
    db.add(approval)
    run.status = ActionStatus.waiting_approval
    run.approval_status = "pending"
    db.commit()
    db.refresh(approval)
    return approval


def resolve_approval(
    db: Session,
    approval_id: str,
    org_id: str,
    decision: str,
    note: str | None = None,
    user_id: str | None = None,
) -> ApprovalRequest | None:
    """Approve or reject an ApprovalRequest and resume the linked ActionRun."""
    approval = db.query(ApprovalRequest).filter(
        ApprovalRequest.id == approval_id,
        ApprovalRequest.organization_id == org_id,
        ApprovalRequest.status == ActionApprovalStatus.pending,
    ).first()
    if not approval:
        return None

    now = datetime.utcnow()
    if decision == "approved":
        approval.status = ActionApprovalStatus.approved
        approval.approved_at = now
        if approval.action_run_id:
            run = db.get(ActionRun, approval.action_run_id)
            if run:
                run.status = ActionStatus.running
                run.approval_status = "approved"
    else:
        approval.status = ActionApprovalStatus.rejected
        approval.rejected_at = now
        if approval.action_run_id:
            run = db.get(ActionRun, approval.action_run_id)
            if run:
                run.status = ActionStatus.cancelled
                run.approval_status = "rejected"

    approval.decision_note = note
    db.commit()
    db.refresh(approval)
    return approval
