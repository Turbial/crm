"""Celery application.

Replace the polling DB worker with event-driven task dispatch backed by Redis.

Start workers with:
    celery -A app.celery_app worker --loglevel=info

The DB-backed worker (app/worker.py) remains available for environments where
Redis is not yet configured; WORKER_ENABLED=false disables it.
"""
from celery import Celery
from app.config import settings

celery = Celery(
    "mighty_crm",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.tasks.agent_tasks",
        "app.tasks.stuck_detector",
        "app.tasks.daily_brief_task",
        "app.tasks.sla_monitor",
        "app.tasks.duplicate_scanner",
    ],
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,           # Re-queue on worker crash
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,  # Fair dispatch — don't hoard tasks
    beat_schedule={
        "stuck-detector-every-5min": {
            "task": "app.tasks.stuck_detector.scan_all_orgs",
            "schedule": 300,  # 5 minutes
        },
        "daily-brief-8am-utc": {
            "task": "app.tasks.daily_brief_task.generate_and_deliver_all",
            "schedule": {"type": "crontab", "hour": 8, "minute": 0},
        },
        "sla-monitor-every-15min": {
            "task": "app.tasks.sla_monitor.check_all_orgs",
            "schedule": 900,  # 15 minutes
        },
    },
)
