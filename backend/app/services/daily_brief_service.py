"""Daily brief generator — assembles a morning summary of the org's operational state."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.models import (
    DailyBrief, DailyBriefStatus,
    Lead, LeadStatus, Deal, PMTask, PMTaskStatus,
    ActionRun, ActionStatus, ApprovalRequest, ActionApprovalStatus,
    Project, ProjectStatus,
)


def _section_tasks_due_today(db: Session, org_id: str) -> dict[str, Any]:
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    tasks = db.query(PMTask).filter(
        PMTask.organization_id == org_id,
        PMTask.due_at >= today_start,
        PMTask.due_at < today_end,
        PMTask.status.notin_([PMTaskStatus.done, PMTaskStatus.canceled]),
    ).all()
    return {"count": len(tasks), "items": [{"id": t.id, "title": t.title} for t in tasks[:10]]}


def _section_overdue_tasks(db: Session, org_id: str) -> dict[str, Any]:
    now = datetime.utcnow()
    tasks = db.query(PMTask).filter(
        PMTask.organization_id == org_id,
        PMTask.due_at < now,
        PMTask.status.notin_([PMTaskStatus.done, PMTaskStatus.canceled]),
    ).all()
    return {"count": len(tasks), "items": [{"id": t.id, "title": t.title} for t in tasks[:10]]}


def _section_pending_approvals(db: Session, org_id: str) -> dict[str, Any]:
    approvals = db.query(ApprovalRequest).filter(
        ApprovalRequest.organization_id == org_id,
        ApprovalRequest.status == ActionApprovalStatus.pending,
    ).all()
    return {
        "count": len(approvals),
        "items": [{"id": a.id, "title": a.title, "risk_level": a.risk_level.value} for a in approvals[:10]],
    }


def _section_hot_leads(db: Session, org_id: str) -> dict[str, Any]:
    leads = db.query(Lead).filter(
        Lead.organization_id == org_id,
        Lead.score >= 70,
        Lead.status.notin_([LeadStatus.won, LeadStatus.lost]),
    ).order_by(Lead.score.desc()).limit(10).all()
    return {
        "count": len(leads),
        "items": [{"id": l.id, "name": l.name, "score": l.score, "status": l.status.value} for l in leads],
    }


def _section_blocked_projects(db: Session, org_id: str) -> dict[str, Any]:
    projects = db.query(Project).filter(
        Project.organization_id == org_id,
        Project.status == ProjectStatus.active,
    ).all()
    blocked = []
    for p in projects:
        blocked_tasks = db.query(PMTask).filter(
            PMTask.project_id == p.id,
            PMTask.status == PMTaskStatus.blocked,
        ).count()
        if blocked_tasks > 0:
            blocked.append({"id": p.id, "name": p.name, "blocked_tasks": blocked_tasks})
    return {"count": len(blocked), "items": blocked[:10]}


def _section_revenue_snapshot(db: Session, org_id: str) -> dict[str, Any]:
    since = datetime.utcnow() - timedelta(days=30)
    open_deals = db.query(Deal).filter(
        Deal.organization_id == org_id,
        Deal.closed_at.is_(None),
    ).all()
    pipeline_value = sum(d.value * (d.probability / 100) for d in open_deals)
    return {
        "open_deals": len(open_deals),
        "pipeline_value_weighted": round(pipeline_value, 2),
        "since_days": 30,
    }


def _section_agent_health(db: Session, org_id: str) -> dict[str, Any]:
    since = datetime.utcnow() - timedelta(hours=24)
    runs = db.query(ActionRun).filter(
        ActionRun.organization_id == org_id,
        ActionRun.created_at >= since,
    ).all()
    total = len(runs)
    failed = sum(1 for r in runs if r.status == ActionStatus.failed)
    stuck = sum(1 for r in runs if r.status == ActionStatus.running
                and r.started_at and (datetime.utcnow() - r.started_at).seconds > 600)
    return {
        "total_actions_24h": total,
        "failed": failed,
        "stuck": stuck,
        "failure_rate": round(failed / total, 3) if total else 0,
    }


def generate_brief(
    db: Session,
    org_id: str,
    user_id: str | None = None,
) -> DailyBrief:
    """Generate and persist a daily brief for the org."""
    sections = {
        "tasks_due_today":   _section_tasks_due_today(db, org_id),
        "overdue_tasks":     _section_overdue_tasks(db, org_id),
        "pending_approvals": _section_pending_approvals(db, org_id),
        "hot_leads":         _section_hot_leads(db, org_id),
        "blocked_projects":  _section_blocked_projects(db, org_id),
        "revenue_snapshot":  _section_revenue_snapshot(db, org_id),
        "agent_health":      _section_agent_health(db, org_id),
    }

    lines = [
        f"📋 MightyOps Daily Brief — {datetime.utcnow().strftime('%A, %B %-d')}",
        "",
        f"✅ Tasks due today: {sections['tasks_due_today']['count']}",
        f"⚠️  Overdue tasks: {sections['overdue_tasks']['count']}",
        f"🔔 Pending approvals: {sections['pending_approvals']['count']}",
        f"🔥 Hot leads (score ≥70): {sections['hot_leads']['count']}",
        f"🚧 Blocked projects: {sections['blocked_projects']['count']}",
        f"💰 Weighted pipeline: ${sections['revenue_snapshot']['pipeline_value_weighted']:,.0f}",
        f"🤖 Agent actions (24h): {sections['agent_health']['total_actions_24h']} "
        f"({sections['agent_health']['failure_rate']:.0%} failure rate)",
    ]
    summary = "\n".join(lines)

    brief = DailyBrief(
        organization_id=org_id,
        user_id=user_id,
        brief_date=datetime.utcnow(),
        sections=sections,
        summary_text=summary,
        status=DailyBriefStatus.generated,
    )
    db.add(brief)
    db.commit()
    db.refresh(brief)
    return brief


def deliver_brief(db: Session, brief: DailyBrief) -> None:
    """Deliver brief via notification center and email."""
    from app.models import User, UserRole
    from app.services.notification_service import notify_org_managers
    from app.services.email_service import send_email

    notify_org_managers(
        db, brief.organization_id,
        title="Your MightyOps Daily Brief is ready",
        body=brief.summary_text[:500],
        notification_type="daily_brief",
        action_url=f"/daily-brief/{brief.id}",
    )

    managers = db.query(User).filter(
        User.organization_id == brief.organization_id,
        User.role.in_([UserRole.owner, UserRole.manager]),
        User.is_active == True,
        User.email != None,
    ).all()
    html_body = "<pre style='font-family:monospace'>" + brief.summary_text + "</pre>"
    for mgr in managers:
        send_email(
            to=mgr.email,
            subject=f"MightyOps Daily Brief — {brief.brief_date.strftime('%b %-d')}",
            html_body=html_body,
            text_body=brief.summary_text,
        )

    brief.status = DailyBriefStatus.delivered
    brief.delivered_at = datetime.utcnow()
    db.commit()


def get_latest_brief(db: Session, org_id: str, user_id: str | None = None) -> DailyBrief | None:
    q = db.query(DailyBrief).filter(DailyBrief.organization_id == org_id)
    if user_id:
        q = q.filter(DailyBrief.user_id == user_id)
    return q.order_by(DailyBrief.brief_date.desc()).first()
