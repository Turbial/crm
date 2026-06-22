"""Long-term agent memory with keyword search."""
from __future__ import annotations

import json
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models import AgentMemory


def set_memory(
    db: Session,
    org_id: str,
    agent_name: str,
    key: str,
    value: Any,
    source: str = "agent",
) -> AgentMemory:
    existing = (
        db.query(AgentMemory)
        .filter_by(organization_id=org_id, agent_name=agent_name, key=key)
        .first()
    )
    if existing:
        existing.value_json = json.dumps(value)
        existing.source = source
        db.flush()
        return existing

    mem = AgentMemory(
        organization_id=org_id,
        agent_name=agent_name,
        key=key,
        value_json=json.dumps(value),
        source=source,
    )
    db.add(mem)
    db.flush()
    return mem


def get_memory(
    db: Session,
    org_id: str,
    agent_name: str,
    key: str,
) -> Optional[Any]:
    mem = (
        db.query(AgentMemory)
        .filter_by(organization_id=org_id, agent_name=agent_name, key=key)
        .first()
    )
    if mem is None:
        return None
    return json.loads(mem.value_json)


def delete_memory(db: Session, org_id: str, agent_name: str, key: str) -> bool:
    mem = (
        db.query(AgentMemory)
        .filter_by(organization_id=org_id, agent_name=agent_name, key=key)
        .first()
    )
    if mem:
        db.delete(mem)
        db.flush()
        return True
    return False


def search_memory(
    db: Session,
    org_id: str,
    agent_name: Optional[str],
    keyword: str,
    limit: int = 20,
) -> list[AgentMemory]:
    q = db.query(AgentMemory).filter(AgentMemory.organization_id == org_id)
    if agent_name:
        q = q.filter(AgentMemory.agent_name == agent_name)
    keyword_lower = keyword.lower()
    results = []
    for mem in q.all():
        if keyword_lower in mem.key.lower() or keyword_lower in mem.value_json.lower():
            results.append(mem)
        if len(results) >= limit:
            break
    return results


def list_memory(
    db: Session,
    org_id: str,
    agent_name: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> list[AgentMemory]:
    q = db.query(AgentMemory).filter(AgentMemory.organization_id == org_id)
    if agent_name:
        q = q.filter(AgentMemory.agent_name == agent_name)
    return q.order_by(AgentMemory.key).offset(offset).limit(limit).all()
