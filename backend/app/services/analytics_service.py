"""Sales & Revenue Intelligence service.

All computations run over existing CRM data — no new tables required.
Results are returned as plain dicts/dataclasses suitable for direct JSON serialization.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import (
    Lead, LeadStatus, Opportunity, OpportunityStage,
    Communication, AgentAction, Payment, PaymentStatus,
    Invoice, InvoiceStatus,
)


def pipeline_funnel(db: Session, org_id: str) -> dict:
    """Count and total value of leads and opportunities at each stage."""
    lead_counts: dict[str, int] = {}
    for status in LeadStatus:
        lead_counts[status.value] = (
            db.query(Lead)
            .filter(Lead.organization_id == org_id, Lead.status == status)
            .count()
        )

    opp_by_stage: dict[str, dict] = {}
    for stage in OpportunityStage:
        rows = (
            db.query(Opportunity)
            .filter(Opportunity.organization_id == org_id, Opportunity.stage == stage)
            .all()
        )
        opp_by_stage[stage.value] = {
            "count": len(rows),
            "total_value": sum(r.value for r in rows),
            "weighted_value": sum(r.value * r.probability / 100 for r in rows),
        }

    total_pipeline = sum(s["total_value"] for s in opp_by_stage.values())
    weighted_pipeline = sum(s["weighted_value"] for s in opp_by_stage.values())

    return {
        "lead_counts_by_status": lead_counts,
        "opportunities_by_stage": opp_by_stage,
        "total_pipeline_value": total_pipeline,
        "weighted_pipeline_value": weighted_pipeline,
    }


def revenue_forecast(db: Session, org_id: str, months_ahead: int = 3) -> dict:
    """Probability-weighted revenue projection for the next N months."""
    now = datetime.utcnow()
    buckets: dict[str, dict] = {}

    for i in range(months_ahead):
        month_start = (now.replace(day=1) + timedelta(days=32 * i)).replace(day=1)
        label = month_start.strftime("%Y-%m")
        buckets[label] = {"total_value": 0.0, "weighted_value": 0.0, "opportunity_count": 0}

    open_stages = {OpportunityStage.discovery, OpportunityStage.quoted, OpportunityStage.negotiation}
    opps = (
        db.query(Opportunity)
        .filter(Opportunity.organization_id == org_id, Opportunity.stage.in_(open_stages))
        .all()
    )

    # Distribute open opportunities across forecast months based on probability buckets.
    for opp in opps:
        prob = opp.probability / 100
        if prob >= 0.75:
            target_month = now.replace(day=1).strftime("%Y-%m")
        elif prob >= 0.50:
            target_month = (now.replace(day=1) + timedelta(days=32)).replace(day=1).strftime("%Y-%m")
        else:
            target_month = (now.replace(day=1) + timedelta(days=64)).replace(day=1).strftime("%Y-%m")

        if target_month in buckets:
            buckets[target_month]["total_value"] += opp.value
            buckets[target_month]["weighted_value"] += opp.value * prob
            buckets[target_month]["opportunity_count"] += 1

    # Actuals: payments received this month
    month_start_ts = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    collected_this_month = (
        db.query(func.coalesce(func.sum(Payment.amount), 0))
        .filter(
            Payment.organization_id == org_id,
            Payment.status == PaymentStatus.succeeded,
            Payment.created_at >= month_start_ts,
        )
        .scalar() or 0
    )

    return {
        "forecast_months": buckets,
        "collected_this_month": float(collected_this_month),
        "generated_at": now.isoformat(),
    }


def sales_velocity(db: Session, org_id: str, lookback_days: int = 90) -> dict:
    """Average deal size, win rate, and estimated days to close."""
    since = datetime.utcnow() - timedelta(days=lookback_days)

    won = db.query(Lead).filter(
        Lead.organization_id == org_id, Lead.status == LeadStatus.won, Lead.created_at >= since
    ).all()
    lost = db.query(Lead).filter(
        Lead.organization_id == org_id, Lead.status == LeadStatus.lost, Lead.created_at >= since
    ).all()
    total_closed = len(won) + len(lost)
    win_rate = len(won) / total_closed if total_closed else 0

    won_opps = (
        db.query(Opportunity)
        .filter(
            Opportunity.organization_id == org_id,
            Opportunity.stage == OpportunityStage.won,
            Opportunity.created_at >= since,
        )
        .all()
    )
    avg_deal_size = sum(o.value for o in won_opps) / len(won_opps) if won_opps else 0

    # Avg days from lead creation → won status (rough proxy using updated_at)
    cycle_days: list[float] = []
    for lead in won:
        delta = (lead.updated_at - lead.created_at).total_seconds() / 86400
        if delta > 0:
            cycle_days.append(delta)
    avg_cycle_days = sum(cycle_days) / len(cycle_days) if cycle_days else 0

    # Sales velocity = (won_count × avg_deal × win_rate) / avg_cycle_days
    velocity = (len(won) * avg_deal_size * win_rate) / avg_cycle_days if avg_cycle_days else 0

    return {
        "lookback_days": lookback_days,
        "won_deals": len(won),
        "lost_deals": len(lost),
        "win_rate": round(win_rate, 4),
        "avg_deal_size": round(avg_deal_size, 2),
        "avg_cycle_days": round(avg_cycle_days, 1),
        "sales_velocity_per_day": round(velocity, 2),
    }


def conversion_rates(db: Session, org_id: str) -> dict:
    """Stage-to-stage conversion rates across the lead funnel."""
    stage_order = [
        LeadStatus.new,
        LeadStatus.contacted,
        LeadStatus.qualified,
        LeadStatus.appointment,
        LeadStatus.proposal,
        LeadStatus.won,
    ]
    counts = {
        s: db.query(Lead).filter(Lead.organization_id == org_id, Lead.status == s).count()
        for s in stage_order
    }
    rates: list[dict] = []
    for i in range(len(stage_order) - 1):
        from_s = stage_order[i]
        to_s = stage_order[i + 1]
        from_count = counts[from_s]
        to_count = counts[to_s]
        rate = to_count / from_count if from_count else 0
        rates.append({
            "from": from_s.value,
            "to": to_s.value,
            "from_count": from_count,
            "to_count": to_count,
            "conversion_rate": round(rate, 4),
        })
    return {"stage_conversions": rates, "total_leads": counts[LeadStatus.new], "total_won": counts[LeadStatus.won]}


def agent_performance(db: Session, org_id: str, lookback_days: int = 30) -> dict:
    """Per-agent action counts and completion rates over the last N days."""
    since = datetime.utcnow() - timedelta(days=lookback_days)
    rows = db.query(AgentAction).filter(
        AgentAction.organization_id == org_id, AgentAction.created_at >= since
    ).all()

    by_agent: dict[str, dict] = defaultdict(lambda: {"total": 0, "completed": 0, "failed": 0, "running": 0})
    for row in rows:
        a = by_agent[row.agent_name]
        a["total"] += 1
        a[row.status.value if hasattr(row.status, "value") else str(row.status)] = \
            a.get(row.status.value if hasattr(row.status, "value") else str(row.status), 0) + 1

    return {
        "lookback_days": lookback_days,
        "by_agent": dict(by_agent),
        "total_actions": len(rows),
    }


def lead_source_report(db: Session, org_id: str) -> dict:
    """Breakdown of leads by source with win rates."""
    rows = db.query(Lead.source, Lead.status).filter(Lead.organization_id == org_id).all()
    by_source: dict[str, dict] = defaultdict(lambda: {"total": 0, "won": 0, "lost": 0})
    for source, status in rows:
        s = by_source[source or "unknown"]
        s["total"] += 1
        if status == LeadStatus.won:
            s["won"] += 1
        elif status == LeadStatus.lost:
            s["lost"] += 1
    for source, data in by_source.items():
        data["win_rate"] = round(data["won"] / data["total"], 4) if data["total"] else 0
    return {"by_source": dict(by_source)}
