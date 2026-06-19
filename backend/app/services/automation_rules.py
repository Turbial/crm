DEFAULT_RULES = [
    {"name": "New lead first touch", "trigger": "lead.created", "steps": [{"type": "agent_action", "agent": "sales", "action": "first_touch", "instruction": "Call or message the new lead within 5 minutes."}]},
    {"name": "No response follow-up", "trigger": "communication.outbound.no_reply_48h", "steps": [{"type": "agent_action", "agent": "sales", "action": "follow_up", "instruction": "Send a short follow-up and ask one simple question."}]},
    {"name": "Won job review request", "trigger": "opportunity.won", "steps": [{"type": "agent_action", "agent": "review", "action": "request_review", "instruction": "Send review request with Google review link."}]},
]
