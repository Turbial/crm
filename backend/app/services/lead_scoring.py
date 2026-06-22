from dataclasses import dataclass
from datetime import datetime, timedelta
from app.models import Lead, Communication, Task, LeadStatus

@dataclass
class ScoreBreakdown:
    score: int
    reasons: list[str]

def score_lead(lead: Lead, communications: list[Communication] | None = None, tasks: list[Task] | None = None) -> ScoreBreakdown:
    score = int(lead.score or 0)
    reasons: list[str] = []
    if lead.email:
        score += 10; reasons.append("has email")
    if lead.phone:
        score += 15; reasons.append("has phone")
    if lead.website:
        score += 5; reasons.append("has website")
    if lead.status in {LeadStatus.contacted, LeadStatus.qualified, LeadStatus.appointment, LeadStatus.proposal}:
        score += 15; reasons.append(f"active stage: {lead.status.value}")
    if lead.status == LeadStatus.won:
        score += 40; reasons.append("won customer")
    if communications:
        inbound = [c for c in communications if str(c.direction).endswith("inbound")]
        outbound = [c for c in communications if str(c.direction).endswith("outbound")]
        score += min(25, len(inbound) * 8 + len(outbound) * 3)
        if inbound: reasons.append("customer engaged")
    if tasks:
        overdue = [t for t in tasks if t.due_at and t.due_at < datetime.utcnow() and str(t.status).endswith("open")]
        if overdue:
            score -= 15; reasons.append("overdue task exists")
    score = max(0, min(100, score))
    return ScoreBreakdown(score=score, reasons=reasons or ["baseline score"])

def recommended_next_action(lead: Lead, communications: list[Communication]) -> dict:
    if not lead.phone and not lead.email:
        return {"action": "enrich_contact", "priority": "high", "reason": "lead has no contact channel"}
    if not communications:
        return {"action": "first_touch", "channel": "call" if lead.phone else "email", "priority": "high", "reason": "no outreach recorded"}
    last = sorted(communications, key=lambda c: c.created_at, reverse=True)[0]
    age_hours = (datetime.utcnow() - last.created_at).total_seconds()/3600
    if age_hours > 48 and str(last.direction).endswith("outbound"):
        return {"action": "follow_up", "channel": "sms" if lead.phone else "email", "priority": "medium", "reason": "outbound message older than 48 hours"}
    if lead.status.value in ["qualified", "appointment"]:
        return {"action": "send_quote_or_schedule", "priority": "high", "reason": "lead is qualified"}
    return {"action": "monitor", "priority": "low", "reason": "recent activity exists"}
