"""Action executor — routes ActionRun to concrete service handlers.

Each handler receives (db, run, payload) and returns output_payload dict.
Handlers should be idempotent where possible.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Callable

from sqlalchemy.orm import Session

from app.models import ActionRun, ActionStatus, ActionApprovalStatus

logger = logging.getLogger("mighty.action_executor")


# ── Handler implementations ──────────────────────────────────────────────────

def _handle_create_lead(db: Session, run: ActionRun, payload: dict) -> dict:
    from app.models import Lead, LeadStatus
    lead = Lead(
        organization_id=run.organization_id,
        name=payload.get("name", "Unknown"),
        email=payload.get("email"),
        phone=payload.get("phone"),
        company=payload.get("company"),
        source=payload.get("source", "messenger"),
        status=LeadStatus.new,
        metadata_json={"created_by_action": run.id},
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    from app.services.timeline_service import record
    record(db, run.organization_id, "lead", lead.id, "lead_created",
           f"Lead created via action: {lead.name}",
           actor_type=run.requested_by_type, actor_id=run.requested_by_id)
    db.commit()
    return {"lead_id": lead.id, "lead_name": lead.name}


def _handle_update_lead_status(db: Session, run: ActionRun, payload: dict) -> dict:
    from app.models import Lead, LeadStatus
    lead_id = payload.get("lead_id")
    new_status = payload.get("status", "qualified")
    if not lead_id:
        raise ValueError("lead_id is required")
    lead = db.query(Lead).filter(
        Lead.id == lead_id,
        Lead.organization_id == run.organization_id,
    ).first()
    if not lead:
        raise ValueError(f"Lead {lead_id} not found")
    old_status = lead.status.value if lead.status else "unknown"
    lead.status = LeadStatus(new_status)
    db.commit()
    from app.services.timeline_service import record_lead_status_changed
    record_lead_status_changed(db, run.organization_id, lead.id,
                               old_status, new_status, actor_id=run.requested_by_id)
    db.commit()
    return {"lead_id": lead.id, "old_status": old_status, "new_status": new_status}


def _handle_create_company(db: Session, run: ActionRun, payload: dict) -> dict:
    from app.services.company_service import create_company
    company = create_company(
        db, run.organization_id,
        name=payload.get("name", "Unknown Company"),
        domain=payload.get("domain"),
        industry=payload.get("industry"),
        website=payload.get("website"),
        phone=payload.get("phone"),
    )
    return {"company_id": company.id, "company_name": company.name}


def _handle_create_deal(db: Session, run: ActionRun, payload: dict) -> dict:
    from app.models import Deal
    deal = Deal(
        organization_id=run.organization_id,
        title=payload.get("title", "New Deal"),
        lead_id=payload.get("lead_id"),
        contact_id=payload.get("contact_id"),
        company_id=payload.get("company_id"),
        pipeline_id=payload.get("pipeline_id"),
        stage_id=payload.get("stage_id"),
        value=payload.get("value", 0),
        probability=payload.get("probability", 25),
        currency=payload.get("currency", "usd"),
        owner_user_id=payload.get("owner_user_id"),
        source=payload.get("source", "messenger"),
    )
    db.add(deal)
    db.commit()
    db.refresh(deal)
    from app.services.timeline_service import record
    record(db, run.organization_id, "deal", deal.id, "deal_created",
           f"Deal created via action: {deal.title}",
           actor_type=run.requested_by_type, actor_id=run.requested_by_id)
    db.commit()
    return {"deal_id": deal.id, "deal_title": deal.title}


def _handle_add_note(db: Session, run: ActionRun, payload: dict) -> dict:
    from app.models import Note
    lead_id = payload.get("lead_id")
    content = payload.get("content") or payload.get("body") or payload.get("note") or ""
    is_agent = run.requested_by_type == "agent"
    note = Note(
        organization_id=run.organization_id,
        lead_id=lead_id,
        content=content,
        author_user_id=run.requested_by_id if not is_agent else None,
        is_agent_note=is_agent,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    if lead_id:
        from app.services.timeline_service import record_note_added
        record_note_added(db, run.organization_id, lead_id, note.id,
                          is_agent=run.requested_by_type == "agent")
        db.commit()
    return {"note_id": note.id}


def _handle_create_project(db: Session, run: ActionRun, payload: dict) -> dict:
    from app.models import Project, ProjectType, ProjectStatus
    project = Project(
        organization_id=run.organization_id,
        name=payload.get("name", "New Project"),
        lead_id=payload.get("lead_id"),
        project_type=ProjectType(payload.get("project_type", "custom")),
        status=ProjectStatus.active,
        owner_user_id=payload.get("owner_user_id"),
        goal=payload.get("goal"),
        metadata_json={"created_by_action": run.id},
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    from app.services.timeline_service import record
    record(db, run.organization_id, "project", project.id, "project_created",
           f"Project created via action: {project.name}",
           actor_type=run.requested_by_type, actor_id=run.requested_by_id)
    db.commit()
    return {"project_id": project.id, "project_name": project.name}


def _handle_create_task(db: Session, run: ActionRun, payload: dict) -> dict:
    from app.models import PMTask, PMTaskStatus, ProjectPriority
    task = PMTask(
        organization_id=run.organization_id,
        project_id=payload.get("project_id"),
        title=payload.get("title", "New Task"),
        description=payload.get("description"),
        status=PMTaskStatus.ready,
        priority=ProjectPriority(payload.get("priority", "normal")),
        assignee_user_id=payload.get("owner_user_id") or payload.get("assignee_user_id"),
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return {"task_id": task.id, "task_title": task.title}


def _handle_assign_task(db: Session, run: ActionRun, payload: dict) -> dict:
    from app.models import PMTask
    task_id = payload.get("task_id")
    user_id = payload.get("owner_user_id") or payload.get("assignee_user_id")
    if not task_id:
        raise ValueError("task_id is required")
    task = db.query(PMTask).filter(
        PMTask.id == task_id,
        PMTask.organization_id == run.organization_id,
    ).first()
    if not task:
        raise ValueError(f"Task {task_id} not found")
    task.assignee_user_id = user_id
    db.commit()
    return {"task_id": task.id, "assignee_user_id": user_id}


def _handle_complete_task(db: Session, run: ActionRun, payload: dict) -> dict:
    from app.models import PMTask, PMTaskStatus
    task_id = payload.get("task_id")
    if not task_id:
        raise ValueError("task_id is required")
    task = db.query(PMTask).filter(
        PMTask.id == task_id,
        PMTask.organization_id == run.organization_id,
    ).first()
    if not task:
        raise ValueError(f"Task {task_id} not found")
    task.status = PMTaskStatus.done
    task.completed_at = datetime.utcnow()
    db.commit()
    return {"task_id": task.id, "status": "done"}


def _handle_create_payment_link(db: Session, run: ActionRun, payload: dict) -> dict:
    from app.services.billing_service import create_payment_link
    link = create_payment_link(
        db,
        org_id=run.organization_id,
        amount_cents=int(payload.get("amount_cents", 0)),
        currency=payload.get("currency", "usd"),
        description=payload.get("description", "Payment"),
        invoice_id=payload.get("invoice_id"),
        quote_id=payload.get("quote_id"),
    )
    return {"payment_link_id": link.id, "checkout_url": link.stripe_checkout_url}


def _handle_send_message(db: Session, run: ActionRun, payload: dict) -> dict:
    from app.models import ScheduledMessage, Channel
    from datetime import datetime as dt
    msg = ScheduledMessage(
        organization_id=run.organization_id,
        lead_id=payload.get("lead_id"),
        channel=Channel(payload.get("channel", "email")),
        subject=payload.get("subject"),
        content=payload.get("content") or payload.get("body", ""),
        send_at=dt.utcnow(),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return {"message_id": msg.id}


def _handle_move_deal_stage(db: Session, run: ActionRun, payload: dict) -> dict:
    from app.models import Deal, PipelineStage
    deal_id = payload.get("deal_id")
    stage_id = payload.get("stage_id")
    if not deal_id:
        raise ValueError("deal_id is required")
    deal = db.query(Deal).filter(
        Deal.id == deal_id,
        Deal.organization_id == run.organization_id,
    ).first()
    if not deal:
        raise ValueError(f"Deal {deal_id} not found")
    old_stage = deal.stage_id
    deal.stage_id = stage_id
    if stage_id:
        stage = db.query(PipelineStage).filter(PipelineStage.id == stage_id).first()
        if stage:
            deal.probability = stage.probability_default
    db.commit()
    from app.services.timeline_service import record_deal_moved
    record_deal_moved(db, run.organization_id, deal.id,
                      old_stage or "none", stage_id or "none",
                      actor_id=run.requested_by_id)
    db.commit()
    return {"deal_id": deal.id, "old_stage_id": old_stage, "new_stage_id": stage_id}


def _handle_generate_portal_token(db: Session, run: ActionRun, payload: dict) -> dict:
    from app.services.portal_service import generate_portal_token
    lead_id = payload.get("lead_id")
    if not lead_id:
        raise ValueError("lead_id is required")
    token = generate_portal_token(
        db, run.organization_id, lead_id,
        permissions=payload.get("permissions", []),
        ttl_hours=int(payload.get("ttl_hours", 72)),
    )
    return {"portal_token_id": token.id}


def _handle_enroll_sequence(db: Session, run: ActionRun, payload: dict) -> dict:
    from app.models import DripEnrollment
    enrollment = DripEnrollment(
        organization_id=run.organization_id,
        sequence_id=payload.get("sequence_id", ""),
        lead_id=payload.get("lead_id", ""),
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return {"enrollment_id": enrollment.id}


def _handle_run_workflow(db: Session, run: ActionRun, payload: dict) -> dict:
    return {"status": "workflow_triggered", "workflow_id": payload.get("workflow_id")}


# ── Handler registry ─────────────────────────────────────────────────────────

ACTION_HANDLERS: dict[str, Callable] = {
    "crm.create_lead":          _handle_create_lead,
    "crm.update_lead_status":   _handle_update_lead_status,
    "crm.create_company":       _handle_create_company,
    "crm.create_deal":          _handle_create_deal,
    "crm.add_note":             _handle_add_note,
    "crm.move_deal_stage":      _handle_move_deal_stage,
    "pm.create_project":        _handle_create_project,
    "pm.create_task":           _handle_create_task,
    "pm.assign_task":           _handle_assign_task,
    "pm.complete_task":         _handle_complete_task,
    "billing.create_payment_link": _handle_create_payment_link,
    "message.send":             _handle_send_message,
    "portal.generate_token":    _handle_generate_portal_token,
    "sequence.enroll_lead":     _handle_enroll_sequence,
    "automation.run_workflow":  _handle_run_workflow,
}


# ── Core executor ─────────────────────────────────────────────────────────────

def execute_action_run(db: Session, run_id: str) -> ActionRun:
    """Execute an ActionRun. Safe to call from Celery or inline."""
    from app.services.action_registry import append_log, complete_run, fail_run, request_approval
    from app.services.notification_service import notify_org_managers, NT_ACTION_COMPLETED, NT_ACTION_FAILED

    run = db.query(ActionRun).filter(ActionRun.id == run_id).first()
    if not run:
        raise ValueError(f"ActionRun {run_id} not found")

    if run.status not in (ActionStatus.pending,):
        logger.warning("ActionRun %s already in status %s, skipping", run_id, run.status)
        return run

    # Check if approval required
    if run.approval_status == ActionApprovalStatus.pending:
        run.status = ActionStatus.waiting_approval
        db.commit()
        return run

    run.status = ActionStatus.running
    run.started_at = datetime.utcnow()
    db.commit()

    handler = ACTION_HANDLERS.get(run.action_key)
    if not handler:
        return fail_run(db, run, f"No handler registered for action '{run.action_key}'")

    try:
        append_log(db, run, f"Executing {run.action_key}", level="info")
        output = handler(db, run, run.input_payload)
        complete_run(db, run, output)
        notify_org_managers(
            db, run.organization_id,
            title=f"Action completed: {run.action_key}",
            body=str(output),
            notification_type=NT_ACTION_COMPLETED,
            action_url=f"/actions/{run.id}",
        )
        logger.info("ActionRun %s completed: %s", run.id, output)
    except Exception as exc:
        error_msg = str(exc)
        logger.exception("ActionRun %s failed: %s", run.id, error_msg)
        fail_run(db, run, error_msg)
        notify_org_managers(
            db, run.organization_id,
            title=f"Action failed: {run.action_key}",
            body=error_msg,
            notification_type=NT_ACTION_FAILED,
            action_url=f"/actions/{run.id}",
        )

    return run


def execute_with_approval_check(
    db: Session,
    org_id: str,
    action_key: str,
    input_payload: dict,
    requested_by_type: str = "human",
    requested_by_id: str | None = None,
    linked_entity_type: str | None = None,
    linked_entity_id: str | None = None,
    source: str = "api",
) -> dict[str, Any]:
    """
    Full action lifecycle:
    1. Create ActionRun
    2. Check if action requires approval
    3a. If yes: create ApprovalRequest, return waiting status
    3b. If no: execute inline, return result
    """
    from app.services.action_registry import (
        create_action_run, get_definition, append_log, request_approval
    )
    from app.services.notification_service import notify_org_managers, NT_APPROVAL_NEEDED

    # Create the run
    run = create_action_run(
        db, org_id, action_key, source=source,
        input_payload=input_payload,
        requested_by_type=requested_by_type,
        requested_by_id=requested_by_id,
        linked_entity_type=linked_entity_type,
        linked_entity_id=linked_entity_id,
    )

    # Check definition for approval requirement
    defn = get_definition(db, action_key, org_id)
    if defn and defn.approval_required:
        approval = request_approval(
            db, org_id, run,
            title=f"Approval required: {defn.display_name}",
            description=f"Action '{defn.display_name}' requires approval before execution.",
            proposed_change=input_payload,
            risk_level=("high" if defn.destructive else "medium"),
        )
        notify_org_managers(
            db, org_id,
            title=f"Approval needed: {defn.display_name}",
            body=f"An action requires your approval before it can proceed.",
            notification_type=NT_APPROVAL_NEEDED,
            action_url=f"/approvals/{approval.id}",
        )
        return {
            "status": "waiting_approval",
            "run_id": run.id,
            "approval_id": approval.id,
            "action_key": action_key,
        }

    # Execute inline
    execute_action_run(db, run.id)
    db.refresh(run)
    return {
        "status": run.status.value,
        "run_id": run.id,
        "action_key": action_key,
        "output": run.output_payload,
        "error": run.error,
    }
