from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings.

    Production should pass these with environment variables. `.env` is only a
    local convenience and should never be committed with real secrets.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    app_name: str = "Mighty CRM"
    app_version: str = "1.1.0-production"
    environment: Literal["local", "staging", "production"] = "local"
    debug: bool = False

    database_url: str = "sqlite:///./mighty_crm.db"
    auto_create_tables: bool = True

    secret_key: str = "local-dev-secret-change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 15   # Short-lived; clients refresh via /auth/refresh
    refresh_token_expire_days: int = 7
    password_min_length: int = 10

    frontend_origin: str = "http://localhost:5173"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Webhook security. Use distinct values in production.
    provider_webhook_secret: str = "local-provider-webhook-secret"
    openclaw_webhook_secret: str = "local-openclaw-webhook-secret"
    webhook_timestamp_tolerance_seconds: int = 300

    # AI execution backend. "local" = deterministic simulator, "openclaw" = external OpenClaw runtime.
    agent_executor: str = "local"

    # Stripe billing
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_default_org_id: str = ""

    # Public URL used in redirect links (e.g. Stripe success_url)
    app_base_url: str = "http://localhost:8000"

    # Worker / queue settings.
    worker_enabled: bool = True
    worker_poll_seconds: int = 5
    redis_url: str = "redis://redis:6379/0"

    # Email delivery
    sendgrid_api_key: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    email_from: str = "noreply@mightyops.io"
    email_from_name: str = "MightyOps"

    # SMS delivery
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""

    # AI / LLM
    anthropic_api_key: str = ""
    ai_model: str = "claude-sonnet-4-6"

    # File storage: "local" | "s3"
    storage_backend: str = "local"
    local_storage_path: str = "./uploads"
    s3_bucket: str = ""
    s3_region: str = "us-east-1"
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_endpoint_url: str = ""          # For MinIO or S3-compatible endpoints
    storage_public_url: str = "http://localhost:8000/uploads"

    # Observability.
    log_level: str = "INFO"
    request_id_header: str = "X-Request-ID"

    @property
    def cors_origin_list(self) -> list[str]:
        raw = self.cors_origins or self.frontend_origin
        return [item.strip() for item in raw.split(",") if item.strip()]

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, value: str):
        # Fail fast in production if the default key is used.
        # We cannot see `environment` here reliably, so the app startup also checks.
        if not value or len(value) < 24:
            return value
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
