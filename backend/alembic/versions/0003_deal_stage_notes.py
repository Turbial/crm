"""Add stage and notes columns to deals table

Revision ID: 0003_deal_stage_notes
Revises: 0002_phase1_2_3_tables
Create Date: 2026-06-21
"""
import sqlalchemy as sa
from alembic import op

revision = "0003_deal_stage_notes"
down_revision = "0002_phase1_2_3_tables"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("deals")}

    if "stage" not in cols:
        op.add_column("deals", sa.Column("stage", sa.String(50), nullable=True))

    if "notes" not in cols:
        op.add_column("deals", sa.Column("notes", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("deals", "notes")
    op.drop_column("deals", "stage")
