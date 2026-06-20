"""AI-powered project scoping service.

Sends a project description to Claude and gets back a structured breakdown of
milestones and tasks ready to populate a Kanban board.

Falls back to keyword-based blueprint matching when ANTHROPIC_API_KEY is not set.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

logger = logging.getLogger("mighty.ai_scope")

_SCOPE_PROMPT = """\
You are a senior project manager. Break down this project into milestones and tasks for a Kanban board.

Project name: {project_name}
Description: {description}{context_block}

Return ONLY a valid JSON object — no markdown fences, no explanation:
{{
  "milestones": [
    {{
      "name": "Phase name",
      "description": "What this phase delivers",
      "tasks": [
        {{
          "title": "Specific actionable task",
          "description": "What to do and acceptance criteria",
          "priority": "high|medium|low",
          "estimate_minutes": 60,
          "column_key": "ready",
          "agent": "ManagerAgent|DeveloperAgent|DesignerAgent|MarketingAgent|QAAgent|SalesAgent|OperatorAgent",
          "requires_approval": false
        }}
      ]
    }}
  ]
}}

Rules:
- 2–5 milestones representing logical project phases
- 2–6 concrete, completable tasks per milestone (8–20 tasks total)
- Titles must be specific and action-oriented (verb + object, e.g. "Design homepage wireframes")
- priority: high = critical path blocker; medium = normal; low = nice-to-have
- estimate_minutes: realistic per-task (30–480)
- column_key: always "ready"
- requires_approval: true only for irreversible external actions (email blasts, deployments, payments)
- Pick the most fitting agent for each task
"""

_KEYWORD_TO_TYPE: list[tuple[list[str], str]] = [
    (["website", "web", "landing page", "homepage", "site"], "website"),
    (["app", "application", "mobile", "ios", "android", "software", "saas", "platform"], "app_development"),
    (["marketing", "campaign", "email blast", "social", "ads", "funnel"], "marketing"),
    (["crm", "pipeline", "leads", "contacts", "sales setup", "onboarding"], "crm_setup"),
    (["review", "reputation", "testimonial", "feedback", "rating", "qr"], "review_latch"),
    (["operations", "process", "workflow", "automation", "ops"], "operations"),
]

_FALLBACK_BLUEPRINTS: dict[str, dict] = {
    "website": {
        "milestones": [
            {"name": "Discovery", "description": "Define goals, audience, and structure", "tasks": [
                {"title": "Define site goals and success metrics", "priority": "high", "estimate_minutes": 60, "column_key": "ready", "agent": "ManagerAgent", "requires_approval": False},
                {"title": "Research target audience and competitors", "priority": "high", "estimate_minutes": 90, "column_key": "ready", "agent": "MarketingAgent", "requires_approval": False},
                {"title": "Create sitemap and information architecture", "priority": "high", "estimate_minutes": 60, "column_key": "ready", "agent": "DesignerAgent", "requires_approval": False},
            ]},
            {"name": "Design", "description": "Visual design and wireframes", "tasks": [
                {"title": "Design homepage wireframes", "priority": "high", "estimate_minutes": 120, "column_key": "ready", "agent": "DesignerAgent", "requires_approval": False},
                {"title": "Create brand style guide (colors, fonts, components)", "priority": "medium", "estimate_minutes": 90, "column_key": "ready", "agent": "DesignerAgent", "requires_approval": False},
                {"title": "Design inner page templates", "priority": "medium", "estimate_minutes": 120, "column_key": "ready", "agent": "DesignerAgent", "requires_approval": False},
            ]},
            {"name": "Development", "description": "Build and code the website", "tasks": [
                {"title": "Set up project repository and hosting environment", "priority": "high", "estimate_minutes": 60, "column_key": "ready", "agent": "DeveloperAgent", "requires_approval": False},
                {"title": "Build homepage and navigation", "priority": "high", "estimate_minutes": 180, "column_key": "ready", "agent": "DeveloperAgent", "requires_approval": False},
                {"title": "Build inner pages from templates", "priority": "medium", "estimate_minutes": 240, "column_key": "ready", "agent": "DeveloperAgent", "requires_approval": False},
                {"title": "Integrate contact form and CRM", "priority": "medium", "estimate_minutes": 90, "column_key": "ready", "agent": "DeveloperAgent", "requires_approval": False},
            ]},
            {"name": "Launch", "description": "QA, SEO, and go-live", "tasks": [
                {"title": "Cross-browser and mobile testing", "priority": "high", "estimate_minutes": 120, "column_key": "ready", "agent": "QAAgent", "requires_approval": False},
                {"title": "SEO meta tags and sitemap", "priority": "medium", "estimate_minutes": 60, "column_key": "ready", "agent": "MarketingAgent", "requires_approval": False},
                {"title": "Deploy to production", "priority": "high", "estimate_minutes": 60, "column_key": "ready", "agent": "OperatorAgent", "requires_approval": True},
            ]},
        ]
    },
    "app_development": {
        "milestones": [
            {"name": "Product Definition", "description": "Requirements and architecture", "tasks": [
                {"title": "Write product requirements document", "priority": "high", "estimate_minutes": 120, "column_key": "ready", "agent": "ManagerAgent", "requires_approval": False},
                {"title": "Design system architecture and data models", "priority": "high", "estimate_minutes": 180, "column_key": "ready", "agent": "DeveloperAgent", "requires_approval": False},
                {"title": "Create UI/UX wireframes", "priority": "high", "estimate_minutes": 180, "column_key": "ready", "agent": "DesignerAgent", "requires_approval": False},
            ]},
            {"name": "Backend", "description": "API and data layer", "tasks": [
                {"title": "Set up project infrastructure and CI/CD", "priority": "high", "estimate_minutes": 120, "column_key": "ready", "agent": "DeveloperAgent", "requires_approval": False},
                {"title": "Build core API endpoints", "priority": "high", "estimate_minutes": 360, "column_key": "ready", "agent": "DeveloperAgent", "requires_approval": False},
                {"title": "Implement authentication and authorization", "priority": "high", "estimate_minutes": 180, "column_key": "ready", "agent": "DeveloperAgent", "requires_approval": False},
            ]},
            {"name": "Frontend", "description": "UI implementation", "tasks": [
                {"title": "Build core UI components", "priority": "high", "estimate_minutes": 240, "column_key": "ready", "agent": "DeveloperAgent", "requires_approval": False},
                {"title": "Integrate frontend with API", "priority": "high", "estimate_minutes": 240, "column_key": "ready", "agent": "DeveloperAgent", "requires_approval": False},
            ]},
            {"name": "QA & Launch", "description": "Testing and deployment", "tasks": [
                {"title": "Write and run test suite", "priority": "high", "estimate_minutes": 180, "column_key": "ready", "agent": "QAAgent", "requires_approval": False},
                {"title": "Fix bugs from QA", "priority": "high", "estimate_minutes": 120, "column_key": "ready", "agent": "DeveloperAgent", "requires_approval": False},
                {"title": "Deploy to production", "priority": "high", "estimate_minutes": 60, "column_key": "ready", "agent": "OperatorAgent", "requires_approval": True},
            ]},
        ]
    },
    "marketing": {
        "milestones": [
            {"name": "Strategy", "description": "Define positioning and messaging", "tasks": [
                {"title": "Define target audience and ICP", "priority": "high", "estimate_minutes": 90, "column_key": "ready", "agent": "MarketingAgent", "requires_approval": False},
                {"title": "Craft campaign angle and core message", "priority": "high", "estimate_minutes": 60, "column_key": "ready", "agent": "MarketingAgent", "requires_approval": False},
            ]},
            {"name": "Content Creation", "description": "Build campaign assets", "tasks": [
                {"title": "Write email sequence copy", "priority": "high", "estimate_minutes": 120, "column_key": "ready", "agent": "SalesAgent", "requires_approval": False},
                {"title": "Design landing page", "priority": "high", "estimate_minutes": 180, "column_key": "ready", "agent": "DesignerAgent", "requires_approval": False},
                {"title": "Create social media content", "priority": "medium", "estimate_minutes": 90, "column_key": "ready", "agent": "MarketingAgent", "requires_approval": False},
            ]},
            {"name": "Launch", "description": "Execute and monitor", "tasks": [
                {"title": "Set up campaign tracking and analytics", "priority": "high", "estimate_minutes": 60, "column_key": "ready", "agent": "OperatorAgent", "requires_approval": False},
                {"title": "Launch email campaign", "priority": "high", "estimate_minutes": 30, "column_key": "ready", "agent": "SalesAgent", "requires_approval": True},
                {"title": "Monitor results and optimize", "priority": "medium", "estimate_minutes": 120, "column_key": "ready", "agent": "MarketingAgent", "requires_approval": False},
            ]},
        ]
    },
    "default": {
        "milestones": [
            {"name": "Planning", "description": "Define scope and approach", "tasks": [
                {"title": "Define project scope and deliverables", "priority": "high", "estimate_minutes": 60, "column_key": "ready", "agent": "ManagerAgent", "requires_approval": False},
                {"title": "Identify dependencies and risks", "priority": "high", "estimate_minutes": 45, "column_key": "ready", "agent": "ManagerAgent", "requires_approval": False},
                {"title": "Create detailed task breakdown", "priority": "medium", "estimate_minutes": 60, "column_key": "ready", "agent": "ManagerAgent", "requires_approval": False},
            ]},
            {"name": "Execution", "description": "Do the work", "tasks": [
                {"title": "Set up project environment and tools", "priority": "high", "estimate_minutes": 60, "column_key": "ready", "agent": "OperatorAgent", "requires_approval": False},
                {"title": "Complete primary deliverable", "priority": "high", "estimate_minutes": 240, "column_key": "ready", "agent": "ManagerAgent", "requires_approval": False},
                {"title": "Review and iterate on output", "priority": "medium", "estimate_minutes": 120, "column_key": "ready", "agent": "QAAgent", "requires_approval": False},
            ]},
            {"name": "Delivery", "description": "Finalize and ship", "tasks": [
                {"title": "Final review and sign-off", "priority": "high", "estimate_minutes": 60, "column_key": "ready", "agent": "ManagerAgent", "requires_approval": True},
                {"title": "Document outcomes and next steps", "priority": "low", "estimate_minutes": 45, "column_key": "ready", "agent": "ManagerAgent", "requires_approval": False},
            ]},
        ]
    },
}


def _detect_type(description: str) -> str:
    lower = description.lower()
    for keywords, project_type in _KEYWORD_TO_TYPE:
        if any(kw in lower for kw in keywords):
            return project_type
    return "default"


def _call_claude(prompt: str, api_key: str, model: str) -> str:
    resp = httpx.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": model,
            "max_tokens": 4096,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=45.0,
    )
    resp.raise_for_status()
    return resp.json()["content"][0]["text"]


def _extract_json(text: str) -> dict:
    """Extract first JSON object from text, handling markdown code fences."""
    text = re.sub(r"```(?:json)?\s*", "", text).strip()
    # Find first { ... } block
    start = text.find("{")
    if start == -1:
        raise ValueError("No JSON object found in response")
    # Walk to find matching closing brace
    depth = 0
    for i, ch in enumerate(text[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return json.loads(text[start : i + 1])
    raise ValueError("Malformed JSON in response")


def _normalize_task(task: dict) -> dict:
    """Ensure task has all required fields with valid values."""
    priority = task.get("priority", "medium")
    if priority not in ("high", "medium", "low"):
        priority = "medium"
    estimate = task.get("estimate_minutes", 60)
    try:
        estimate = max(15, min(480, int(estimate)))
    except (TypeError, ValueError):
        estimate = 60
    return {
        "title": str(task.get("title", "Task"))[:255],
        "description": task.get("description") or "",
        "priority": priority,
        "estimate_minutes": estimate,
        "column_key": task.get("column_key", "ready"),
        "agent": task.get("agent", "ManagerAgent"),
        "requires_approval": bool(task.get("requires_approval", False)),
    }


def _normalize_result(raw: dict, project_name: str) -> dict:
    milestones = []
    for m in raw.get("milestones", []):
        tasks = [_normalize_task(t) for t in m.get("tasks", []) if t.get("title")]
        if not tasks:
            continue
        milestones.append({
            "name": str(m.get("name", "Phase"))[:255],
            "description": m.get("description") or "",
            "tasks": tasks,
        })
    if not milestones:
        raise ValueError("No milestones in scope result")
    return {"milestones": milestones}


def scope_project(
    project_name: str,
    description: str,
    additional_context: str = "",
) -> dict[str, Any]:
    """Return a scoping breakdown as {milestones: [{name, description, tasks: [...]}]}.

    Uses Claude when ANTHROPIC_API_KEY is set, otherwise uses keyword-based blueprint.
    """
    from app.config import settings

    if settings.anthropic_api_key:
        context_block = f"\nAdditional context: {additional_context}" if additional_context else ""
        prompt = _SCOPE_PROMPT.format(
            project_name=project_name,
            description=description,
            context_block=context_block,
        )
        try:
            raw_text = _call_claude(prompt, settings.anthropic_api_key, settings.ai_model)
            raw = _extract_json(raw_text)
            return _normalize_result(raw, project_name)
        except Exception as exc:
            logger.warning("Claude scoping failed, falling back to blueprint: %s", exc)

    # Fallback: keyword-based blueprint
    detected = _detect_type(f"{project_name} {description} {additional_context}")
    blueprint = _FALLBACK_BLUEPRINTS.get(detected, _FALLBACK_BLUEPRINTS["default"])
    return _normalize_result({"milestones": blueprint["milestones"]}, project_name)
