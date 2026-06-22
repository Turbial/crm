"""Intent classifier — pattern-based with LLM extension point.

Classifies natural language text into structured intents and extracts
entity hints. Designed to be replaced or augmented with a real LLM call.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any


# ── Intent pattern catalog ──────────────────────────────────────────────────

_PATTERNS: list[tuple[str, list[str], str]] = [
    # (intent_key, regex_patterns, action_key)

    # CRM
    ("create_lead",          [r"add lead", r"new lead", r"create lead", r"add a lead", r"create a lead"], "crm.create_lead"),
    ("create_contact",       [r"add contact", r"new contact", r"create contact"], "crm.create_contact"),
    ("create_company",       [r"add company", r"new company", r"create company", r"add a company"], "crm.create_company"),
    ("create_deal",          [r"create deal", r"new deal", r"add deal", r"new opportunity"], "crm.create_deal"),
    ("move_deal",            [r"move deal", r"advance deal", r"close deal", r"stage.{0,20}deal"], "crm.move_deal_stage"),
    ("update_lead_status",   [r"qualify lead", r"update.*lead", r"change.*status", r"mark.*lead", r"lead.*status"], "crm.update_lead_status"),
    ("add_note",             [r"add note", r"note that", r"log note", r"make a note", r"take a note"], "crm.add_note"),
    ("schedule_followup",    [r"schedule.*follow.?up", r"follow.?up.*with", r"remind me", r"set.*reminder"], "crm.schedule_followup"),
    ("delete_lead",          [r"delete lead", r"remove lead", r"archive lead"], "crm.delete_lead"),

    # PM
    ("create_project",       [r"create project", r"new project", r"start project", r"build.*project", r"set up.*project"], "pm.create_project"),
    ("create_task",          [r"create task", r"add task", r"new task", r"create a task", r"add a task"], "pm.create_task"),
    ("assign_task",          [r"assign.*to", r"give.*task.*to", r"task.*assign"], "pm.assign_task"),
    ("complete_task",        [r"complete task", r"mark.*done", r"finish task", r"close task"], "pm.complete_task"),
    ("move_card",            [r"move.*card", r"move.*task", r"change.*column"], "pm.move_card"),
    ("create_from_template", [r"from template", r"use.*template", r"create.*using"], "pm.create_from_template"),

    # Billing
    ("create_payment_link",  [r"payment link", r"send payment", r"create.*payment", r"charge.*for"], "billing.create_payment_link"),
    ("send_invoice",         [r"send invoice", r"create invoice", r"bill.*for", r"invoice.*for"], "billing.send_invoice"),

    # Messaging
    ("send_message",         [r"send.*message", r"message.*them", r"text.*them", r"email.*them", r"reach out"], "message.send"),
    ("schedule_message",     [r"schedule.*message", r"send.*later", r"message.*at"], "message.schedule"),
    ("enroll_sequence",      [r"enroll.*sequence", r"drip.*campaign", r"nurture.*lead", r"add.*drip"], "sequence.enroll_lead"),

    # Portal
    ("generate_portal",      [r"portal.*link", r"send.*portal", r"client.*portal", r"customer portal"], "portal.generate_token"),
    ("request_esignature",   [r"e.?sign", r"signature.*request", r"sign.*document", r"request.*sign"], "portal.request_esignature"),

    # Automation
    ("run_workflow",         [r"run workflow", r"trigger workflow", r"start workflow", r"execute workflow"], "automation.run_workflow"),

    # Search/Query (not actions, just queries)
    ("search",               [r"find.*lead", r"search.*for", r"look up", r"show me", r"list.*", r"get.*"], ""),
    ("summarize",            [r"summary", r"overview", r"status.*of", r"how is", r"what.*happened"], ""),
]

_ENTITY_PATTERNS = {
    "lead_name":     r"(?:for|to|with|about|lead named?|contact named?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)",
    "company_name":  r"(?:at|from|company named?|for company)\s+([A-Z][a-zA-Z\s&]+?)(?:\s+(?:using|from|with|,|\.|$))",
    "amount":        r"\$\s*([\d,]+(?:\.\d{2})?)|(\d+)\s*(?:dollars?|USD|usd)",
    "email":         r"\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b",
    "phone":         r"\b(\+?1?\s?[\(\-]?\d{3}[\)\-\s]?\s?\d{3}[\-\s]?\d{4})\b",
    "user_name":     r"(?:assign(?:ed)?(?:\s+to)?|to|by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)",
    "project_name":  r"project\s+(?:called|named|titled)?\s*[\"']?([^\"',\.]{3,40})[\"']?",
    "task_title":    r"task\s+(?:called|named|titled|:)?\s*[\"']?([^\"',\.]{3,80})[\"']?",
}


@dataclass
class ClassifyResult:
    intent: str
    action_key: str
    confidence: float
    raw_entities: dict[str, Any] = field(default_factory=dict)
    ambiguous: bool = False
    alternatives: list[tuple[str, float]] = field(default_factory=list)


def classify(text: str) -> ClassifyResult:
    """Classify a natural-language text into an intent."""
    normalized = text.lower().strip()
    scores: list[tuple[str, str, float]] = []

    for intent_key, patterns, action_key in _PATTERNS:
        best_score = 0.0
        for pat in patterns:
            if re.search(pat, normalized):
                # Longer / more specific patterns score higher
                specificity = min(len(pat) / 20, 1.0)
                score = 0.7 + 0.3 * specificity
                best_score = max(best_score, score)
        if best_score > 0:
            scores.append((intent_key, action_key, best_score))

    if not scores:
        return ClassifyResult(intent="unknown", action_key="", confidence=0.0)

    scores.sort(key=lambda x: x[2], reverse=True)
    top_intent, top_action, top_score = scores[0]

    alternatives = [(s[0], s[2]) for s in scores[1:4]]
    ambiguous = len(scores) > 1 and scores[1][2] >= top_score * 0.85

    raw_entities = extract_entities(text)

    return ClassifyResult(
        intent=top_intent,
        action_key=top_action,
        confidence=top_score,
        raw_entities=raw_entities,
        ambiguous=ambiguous,
        alternatives=alternatives,
    )


def extract_entities(text: str) -> dict[str, Any]:
    """Extract entity hints from raw text."""
    entities: dict[str, Any] = {}
    for key, pattern in _ENTITY_PATTERNS.items():
        match = re.search(pattern, text)
        if match:
            # Take first non-None group
            value = next((g for g in match.groups() if g), None)
            if value:
                entities[key] = value.strip()

    # Clean up amount to float
    if "amount" in entities:
        try:
            entities["amount"] = float(str(entities["amount"]).replace(",", ""))
        except (ValueError, TypeError):
            del entities["amount"]

    return entities


def build_input_payload(intent: str, raw_entities: dict, linked_entities: dict) -> dict[str, Any]:
    """Combine raw text entities + DB-linked entities into an action input payload."""
    payload: dict[str, Any] = {**linked_entities}

    mappings: dict[str, list[str]] = {
        "lead_id":       ["lead_id"],
        "contact_id":    ["contact_id"],
        "company_id":    ["company_id"],
        "deal_id":       ["deal_id"],
        "project_id":    ["project_id"],
        "task_id":       ["task_id"],
        "owner_user_id": ["user_id", "assignee_id"],
        "amount":        ["amount", "amount_cents"],
        "email":         ["email"],
        "phone":         ["phone"],
    }

    for target_field, source_keys in mappings.items():
        for src in source_keys:
            if src in raw_entities and target_field not in payload:
                payload[target_field] = raw_entities[src]

    # Intent-specific defaults
    if intent == "create_lead":
        if "lead_name" in raw_entities and "name" not in payload:
            payload["name"] = raw_entities["lead_name"]
        if "company_name" in raw_entities and "company" not in payload:
            payload["company"] = raw_entities["company_name"]

    if intent in ("create_project", "create_from_template"):
        if "project_name" in raw_entities and "name" not in payload:
            payload["name"] = raw_entities["project_name"]

    if intent == "create_task":
        if "task_title" in raw_entities and "title" not in payload:
            payload["title"] = raw_entities["task_title"]

    if intent in ("create_payment_link", "send_invoice") and "amount" in raw_entities:
        payload["amount_cents"] = int(raw_entities["amount"] * 100)

    return payload
