"""Add Phase 1, 2 and 3 tables; patch notifications.metadata_json

Revision ID: 0002_phase1_2_3_tables
Revises: 0001_initial_schema
Create Date: 2026-06-19
"""
import sqlalchemy as sa
from alembic import op

from app.database import Base
from app import models  # noqa: F401 — ensure all models are registered

revision = "0002_phase1_2_3_tables"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()

    # Create every table that doesn't yet exist (idempotent via checkfirst=True default).
    # This handles Phase 1–3 tables: companies, pipeline_stages, deals, timeline_events,
    # custom_field_definitions, file_attachments, action_definitions, action_runs,
    # approval_requests, conversations, conversation_messages, conversation_states,
    # intent_routes, duplicate_candidates, sla_rules, record_permissions, daily_briefs.
    Base.metadata.create_all(bind=bind)

    # Add metadata_json to notifications if it was not yet present.
    inspector = sa.inspect(bind)
    if "notifications" in inspector.get_table_names():
        existing_cols = {c["name"] for c in inspector.get_columns("notifications")}
        if "metadata_json" not in existing_cols:
            op.add_column("notifications", sa.Column("metadata_json", sa.JSON(), nullable=True))


def downgrade():
    # Drop the Phase 3 tables only; leave Phase 1/2 and core tables intact.
    for tbl in ("daily_briefs", "record_permissions", "sla_rules"):
        op.drop_table(tbl)
    # Removing metadata_json from notifications on downgrade would lose data; skip it.
