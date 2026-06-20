"""Server-Sent Events for real-time notification streaming."""
from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.security import decode_token

logger = logging.getLogger("mighty.sse")
router = APIRouter(prefix="/sse", tags=["SSE"])

# user_id → list of queues (one per open connection)
_queues: dict[str, list[asyncio.Queue]] = defaultdict(list)


def push_notification(user_id: str, payload: dict) -> None:
    """Push a notification to all open SSE connections for user_id (sync-safe)."""
    for q in list(_queues.get(user_id, [])):
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            pass


async def _event_generator(user_id: str, request: Request) -> AsyncGenerator[str, None]:
    q: asyncio.Queue = asyncio.Queue(maxsize=50)
    _queues[user_id].append(q)
    try:
        yield "data: {\"type\":\"connected\"}\n\n"
        while True:
            if await request.is_disconnected():
                break
            try:
                payload = await asyncio.wait_for(q.get(), timeout=25.0)
                yield f"data: {json.dumps(payload)}\n\n"
            except asyncio.TimeoutError:
                yield ": keepalive\n\n"
    finally:
        try:
            _queues[user_id].remove(q)
        except ValueError:
            pass
        if not _queues[user_id]:
            del _queues[user_id]


def _get_user_from_token(token: str = Query(...), db: Session = Depends(get_db)) -> User:
    user_id = decode_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Inactive or missing user")
    return user


@router.get("/notifications")
async def sse_notifications(
    request: Request,
    user: User = Depends(_get_user_from_token),
):
    return StreamingResponse(
        _event_generator(user.id, request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
