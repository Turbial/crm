"""Agent memory CRUD endpoints."""
from __future__ import annotations

import json
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_manager
from app.models import User
from app.services import agent_memory_service as mem_svc

router = APIRouter(prefix="/agent-memory", tags=["Agent Memory"])


class MemoryWrite(BaseModel):
    agent_name: str
    key: str
    value: Any
    source: str = "api"


class MemoryOut(BaseModel):
    id: str
    agent_name: str
    key: str
    value: Any
    source: str

    class Config:
        from_attributes = True


def _serialize(mem) -> dict:
    return {
        "id": mem.id,
        "agent_name": mem.agent_name,
        "key": mem.key,
        "value": json.loads(mem.value_json),
        "source": mem.source,
    }


@router.get("")
def list_memory(
    agent_name: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if keyword:
        rows = mem_svc.search_memory(db, user.organization_id, agent_name, keyword, limit)
    else:
        rows = mem_svc.list_memory(db, user.organization_id, agent_name, limit, offset)
    return [_serialize(r) for r in rows]


@router.put("")
def set_memory(
    body: MemoryWrite,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    mem = mem_svc.set_memory(
        db, user.organization_id, body.agent_name, body.key, body.value, body.source
    )
    db.commit()
    return _serialize(mem)


@router.get("/{agent_name}/{key}")
def get_memory(
    agent_name: str,
    key: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    value = mem_svc.get_memory(db, user.organization_id, agent_name, key)
    if value is None:
        raise HTTPException(status_code=404, detail="Memory key not found")
    return {"agent_name": agent_name, "key": key, "value": value}


@router.delete("/{agent_name}/{key}", status_code=204)
def delete_memory(
    agent_name: str,
    key: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    deleted = mem_svc.delete_memory(db, user.organization_id, agent_name, key)
    if not deleted:
        raise HTTPException(status_code=404, detail="Memory key not found")
    db.commit()
