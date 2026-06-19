from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.models import AgentAction, AgentActionStatus, AgentMemory, AuditLog

PROMPT_ROOT = Path(__file__).resolve().parents[1] / "prompts" / "openclaw"


@dataclass
class OpenClawTask:
    agent_name: str
    task_type: str
    instruction: str
    priority: str = "normal"
    context: dict[str, Any] | None = None
    requires_approval: bool = True


class OpenClawBridge:
    """OpenClaw-facing bridge for Mighty CRM.

    This service does three jobs:
    1. exposes versioned prompt packs for OpenClaw agents,
    2. converts CRM/messenger commands into safe AgentAction rows,
    3. accepts OpenClaw callbacks/results and writes an auditable trail.
    """

    def __init__(self, db: Session, organization_id: str, actor_user_id: str | None = None):
        self.db = db
        self.organization_id = organization_id
        self.actor_user_id = actor_user_id

    def list_agents(self) -> list[dict[str, str]]:
        agents = []
        for path in sorted(PROMPT_ROOT.glob("*.md")):
            agents.append({
                "agent_name": path.stem,
                "prompt_file": path.name,
                "description": self._first_heading_or_line(path),
            })
        return agents

    def get_prompt(self, agent_name: str) -> dict[str, Any]:
        safe = agent_name.replace("/", "").replace("..", "")
        path = PROMPT_ROOT / f"{safe}.md"
        if not path.exists():
            raise FileNotFoundError(f"Unknown OpenClaw agent prompt: {agent_name}")
        return {
            "agent_name": safe,
            "prompt_version": "2026-06-18.v1",
            "system_prompt": path.read_text(encoding="utf-8"),
            "contracts": self.task_contract(),
        }

    def task_contract(self) -> dict[str, Any]:
        return {
            "task_input": {
                "agent_name": "SalesAgent | RevenueAgent | OperatorAgent | QAAgent | WebsiteAgent | ReviewAgent | ManagerAgent",
                "task_type": "research_leads | qualify_lead | call_lead | send_email | create_campaign | update_website | request_review | qa_check | report",
                "instruction": "Plain English instruction from Mighty Messenger or workflow.",
                "priority": "low | normal | high | urgent",
                "context": "Tenant-scoped CRM context only; never include another organization's records.",
                "requires_approval": "true for external calls, SMS, emails, billing, deletes, or public website changes.",
            },
            "task_output": {
                "status": "completed | failed | blocked | needs_approval",
                "summary": "Human-readable result.",
                "crm_updates": ["optional list of suggested or completed CRM updates"],
                "next_actions": ["recommended next steps"],
                "evidence": ["URLs, IDs, excerpts, transcripts, or structured evidence"],
                "cost_cents": "integer estimated tool/model cost",
                "duration_ms": "integer runtime duration",
            },
            "safety_rules": [
                "Always preserve organization_id tenant isolation.",
                "Do not send external SMS/email/calls without explicit approval unless a workflow pre-approves it.",
                "Write every meaningful action to AgentAction or AuditLog.",
                "When unsure, return blocked with a clear reason and suggested clarification.",
            ],
        }

    def queue_task(self, task: OpenClawTask) -> AgentAction:
        metadata = {
            "source": "openclaw_bridge",
            "priority": task.priority,
            "context": task.context or {},
            "requires_approval": task.requires_approval,
            "contract_version": "2026-06-18.v1",
        }
        action = AgentAction(
            organization_id=self.organization_id,
            agent_name=task.agent_name,
            action_type=task.task_type,
            instruction=task.instruction,
            status=AgentActionStatus.blocked if task.requires_approval else AgentActionStatus.queued,
            metadata_json=metadata,
        )
        self.db.add(action)
        self.db.add(AuditLog(
            organization_id=self.organization_id,
            actor_user_id=self.actor_user_id,
            actor_type="user" if self.actor_user_id else "system",
            event="openclaw.task_queued",
            entity_type="agent_action",
            entity_id=action.id,
            metadata_json=metadata,
        ))
        self.db.commit(); self.db.refresh(action)
        return action

    def approve_task(self, action_id: str) -> AgentAction:
        action = self._get_action(action_id)
        action.status = AgentActionStatus.queued
        meta = dict(action.metadata_json or {})
        meta["approved"] = True
        action.metadata_json = meta
        self.db.add(AuditLog(
            organization_id=self.organization_id,
            actor_user_id=self.actor_user_id,
            actor_type="user" if self.actor_user_id else "system",
            event="openclaw.task_approved",
            entity_type="agent_action",
            entity_id=action.id,
            metadata_json={"agent_name": action.agent_name, "action_type": action.action_type},
        ))
        self.db.commit(); self.db.refresh(action)
        return action

    def record_result(self, action_id: str, payload: dict[str, Any]) -> AgentAction:
        action = self._get_action(action_id)
        status = payload.get("status", "completed")
        action.status = AgentActionStatus.completed if status == "completed" else AgentActionStatus.failed if status == "failed" else AgentActionStatus.blocked if status in {"blocked", "needs_approval"} else AgentActionStatus.completed
        action.result = payload.get("summary") or json.dumps(payload, indent=2)
        action.cost_cents = int(payload.get("cost_cents") or 0)
        action.duration_ms = int(payload.get("duration_ms") or 0)
        meta = dict(action.metadata_json or {})
        meta["openclaw_result"] = payload
        action.metadata_json = meta
        self.db.add(AuditLog(
            organization_id=self.organization_id,
            actor_user_id=self.actor_user_id,
            actor_type="agent",
            event="openclaw.task_result",
            entity_type="agent_action",
            entity_id=action.id,
            metadata_json=payload,
        ))
        self.db.commit(); self.db.refresh(action)
        return action

    def upsert_memory(self, agent_name: str, key: str, value: dict[str, Any], source: str = "openclaw") -> AgentMemory:
        memory = self.db.query(AgentMemory).filter(
            AgentMemory.organization_id == self.organization_id,
            AgentMemory.agent_name == agent_name,
            AgentMemory.key == key,
        ).first()
        if memory:
            memory.value_json = value
            memory.source = source
        else:
            memory = AgentMemory(organization_id=self.organization_id, agent_name=agent_name, key=key, value_json=value, source=source)
            self.db.add(memory)
        self.db.commit(); self.db.refresh(memory)
        return memory

    def _get_action(self, action_id: str) -> AgentAction:
        action = self.db.query(AgentAction).filter(AgentAction.id == action_id, AgentAction.organization_id == self.organization_id).first()
        if not action:
            raise ValueError("OpenClaw task not found for this organization")
        return action

    def _first_heading_or_line(self, path: Path) -> str:
        for line in path.read_text(encoding="utf-8").splitlines():
            clean = line.strip("# ").strip()
            if clean:
                return clean[:160]
        return path.stem
