"""Add email verification and password reset token fields to users

Revision ID: 0004_auth_tokens
Revises: 0003_deal_stage_notes
Create Date: 2026-06-22
"""
import sqlalchemy as sa
from alembic import op

revision = "0004_auth_tokens"
down_revision = "0003_deal_stage_notes"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = {c["name"] for c in inspector.get_columns("users")}

    if "email_verified" not in existing_cols:
        op.add_column("users", sa.Column("email_verified", sa.Boolean(), nullable=False, server_default="0"))

    if "email_verification_token" not in existing_cols:
        op.add_column("users", sa.Column("email_verification_token", sa.String(255), nullable=True))
        op.create_index("ix_users_email_verification_token", "users", ["email_verification_token"], unique=False)

    if "password_reset_token" not in existing_cols:
        op.add_column("users", sa.Column("password_reset_token", sa.String(255), nullable=True))
        op.create_index("ix_users_password_reset_token", "users", ["password_reset_token"], unique=False)

    if "password_reset_expires" not in existing_cols:
        op.add_column("users", sa.Column("password_reset_expires", sa.DateTime(), nullable=True))

    # All users created before this migration were added via trusted admin invite —
    # mark them as verified so they aren't locked out.
    op.execute("UPDATE users SET email_verified = true WHERE email_verified = false")


def downgrade():
    op.drop_index("ix_users_password_reset_token", table_name="users")
    op.drop_index("ix_users_email_verification_token", table_name="users")
    op.drop_column("users", "password_reset_expires")
    op.drop_column("users", "password_reset_token")
    op.drop_column("users", "email_verification_token")
    op.drop_column("users", "email_verified")
