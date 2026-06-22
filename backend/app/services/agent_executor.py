"""Unified interface for AI agent execution.

All execution paths — local simulator, OpenClaw, future providers — implement
AgentExecutor. Selection is via config: AGENT_EXECUTOR=local|openclaw.

Consumers should depend on this Protocol, not on a concrete implementation.
"""
from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from sqlalchemy.orm import Session

from app.models import AgentAction


@runtime_checkable
class AgentExecutor(Protocol):
    def queue(
        self,
        agent_name: str,
        action_type: str,
        instruction: str,
        lead_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> AgentAction: ...

    def run(self, action: AgentAction) -> AgentAction: ...

    def record_result(self, action_id: str, result: dict[str, Any]) -> AgentAction: ...


def get_executor(db: Session, organization_id: str, user_id: str | None = None) -> AgentExecutor:
    """Factory: returns the executor selected by AGENT_EXECUTOR setting."""
    from app.config import settings

    backend = getattr(settings, "agent_executor", "local")

    if backend == "openclaw":
        from app.services.openclaw_bridge import OpenClawBridge
        return OpenClawBridge(db, organization_id, user_id)  # type: ignore[return-value]

    from app.services.agent_service import AgentService
    return AgentService(db, organization_id)  # type: ignore[return-value]
