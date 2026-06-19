"""Agent supervisor service — monitors action health, detects stuck work."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.models import (
    ActionRun, ActionStatus, ApprovalRequest, ActionApprovalStatus,
    DripEnrollment, DripEnrollmentStatus, Lead, LeadStatus,
)


STUCK_RUN_MINUTES = 10
NO_ACTIVITY_LEAD_DAYS = 14
APPROVAL_SLA_HOURS = 48


def get_stuck_action_runs(db: Session, org_id: str) -> list[ActionRun]:
    """ActionRuns stuck in 'running' beyond their timeout threshold."""
    cutoff = datetime.utcnow() - timedelta(minutes=STUCK_RUN_MINUTES)
    return db.query(ActionRun).filter(
        ActionRun.organization_id == org_id,
        ActionRun.status == ActionStatus.running,
        ActionRun.started_at < cutoff,
    ).all()


def get_overdue_approvals(db: Session, org_id: str) -> list[ApprovalRequest]:
    """Approvals pending beyond SLA hours."""
    cutoff = datetime.utcnow() - timedelta(hours=APPROVAL_SLA_HOURS)
    return db.query(ApprovalRequest).filter(
        ApprovalRequest.organization_id == org_id,
        ApprovalRequest.status == ActionApprovalStatus.pending,
        ApprovalRequest.created_at < cutoff,
    ).all()


def get_stuck_enrollments(db: Session, org_id: str) -> list[DripEnrollment]:
    """Drip enrollments past their next_send_at by more than 1 hour."""
    cutoff = datetime.utcnow() - timedelta(hours=1)
    return db.query(DripEnrollment).filter(
        DripEnrollment.organization_id == org_id,
        DripEnrollment.status == DripEnrollmentStatus.active,
        DripEnrollment.next_send_at < cutoff,
    ).all()


def get_inactive_leads(db: Session, org_id: str) -> list[Lead]:
    """Active leads with no recent activity."""
    cutoff = datetime.utcnow() - timedelta(days=NO_ACTIVITY_LEAD_DAYS)
    return db.query(Lead).filter(
        Lead.organization_id == org_id,
        Lead.status.in_([LeadStatus.new, LeadStatus.contacted, LeadStatus.qualified]),
        Lead.updated_at < cutoff,
    ).all()


def get_action_stats(db: Session, org_id: str, since_hours: int = 24) -> dict[str, Any]:
    """Aggregate action run statistics over the past N hours."""
    since = datetime.utcnow() - timedelta(hours=since_hours)
    runs = db.query(ActionRun).filter(
        ActionRun.organization_id == org_id,
        ActionRun.created_at >= since,
    ).all()

    by_status: dict[str, int] = {}
    by_key: dict[str, dict[str, int]] = {}
    for run in runs:
        s = run.status.value
        by_status[s] = by_status.get(s, 0) + 1
        if run.action_key not in by_key:
            by_key[run.action_key] = {"total": 0, "completed": 0, "failed": 0}
        by_key[run.action_key]["total"] += 1
        if run.status == ActionStatus.completed:
            by_key[run.action_key]["completed"] += 1
        elif run.status == ActionStatus.failed:
            by_key[run.action_key]["failed"] += 1

    total = len(runs)
    failed = by_status.get("failed", 0)
    return {
        "period_hours": since_hours,
        "total_runs": total,
        "by_status": by_status,
        "by_action_key": by_key,
        "failure_rate": round(failed / total, 3) if total else 0,
        "pending_approvals": db.query(ApprovalRequest).filter(
            ApprovalRequest.organization_id == org_id,
            ApprovalRequest.status == ActionApprovalStatus.pending,
        ).count(),
    }


def escalate_stuck_run(db: Session, run: ActionRun) -> None:
    """Mark a stuck run as failed and notify."""
    from app.services.action_registry import fail_run
    from app.services.notification_service import notify_org_managers, NT_ACTION_FAILED
    fail_run(db, run, f"Timed out after {STUCK_RUN_MINUTES} minutes with no progress")
    notify_org_managers(
        db, run.organization_id,
        title=f"Action timed out: {run.action_key}",
        body=f"ActionRun {run.id} was stuck in 'running' state and has been failed.",
        notification_type=NT_ACTION_FAILED,
        action_url=f"/actions/{run.id}",
    )


def scan_and_escalate(db: Session, org_id: str) -> dict[str, int]:
    """Scan for stuck work and escalate. Returns count of items escalated."""
    stuck_runs = get_stuck_action_runs(db, org_id)
    for run in stuck_runs:
        escalate_stuck_run(db, run)

    overdue = get_overdue_approvals(db, org_id)
    from app.services.notification_service import notify_org_managers, NT_APPROVAL_NEEDED
    for approval in overdue:
        notify_org_managers(
            db, org_id,
            title=f"Overdue approval: {approval.title}",
            body=f"Approval has been pending for over {APPROVAL_SLA_HOURS}h.",
            notification_type=NT_APPROVAL_NEEDED,
            action_url=f"/approvals/{approval.id}",
        )

    return {
        "stuck_runs_escalated": len(stuck_runs),
        "overdue_approvals_notified": len(overdue),
        "stuck_enrollments": len(get_stuck_enrollments(db, org_id)),
        "inactive_leads": len(get_inactive_leads(db, org_id)),
    }
