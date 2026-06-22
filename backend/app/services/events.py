"""Lightweight in-process event bus.

Usage:
    # Register a handler (typically at module import time)
    @events.on("lead.status_changed")
    def _trigger_workflow(lead, old_status, new_status, db, **kwargs):
        ...

    # Emit from any service (all registered handlers run synchronously)
    events.emit("lead.status_changed", lead=lead, old_status=old, new_status=new, db=db)

Handlers that need async work should dispatch a Celery task inside the handler
rather than doing the work directly.
"""
from __future__ import annotations

import logging
from collections import defaultdict
from typing import Callable

logger = logging.getLogger("mighty.events")

_handlers: dict[str, list[Callable]] = defaultdict(list)


def on(event_name: str):
    """Decorator that registers a handler for the given event."""
    def _decorator(fn: Callable) -> Callable:
        _handlers[event_name].append(fn)
        return fn
    return _decorator


def emit(event_name: str, **kwargs) -> None:
    """Emit an event, calling all registered handlers in registration order."""
    for handler in _handlers.get(event_name, []):
        try:
            handler(**kwargs)
        except Exception:
            logger.exception("Event handler %s failed for event %s", handler.__name__, event_name)
