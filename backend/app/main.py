from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.database import Base, check_database, engine
from app.middleware.rate_limit import limiter
from app.middleware.request_id import RequestIdMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
import app.services.event_handlers  # noqa: F401 — registers event handlers as a side effect
from app.routers import (
    agents,
    analytics,
    api_keys,
    appointments,
    auth,
    billing,
    call_logs,
    campaigns,
    communications,
    contacts,
    dashboard,
    email_templates,
    enterprise,
    inbox,
    integrations,
    intelligence,
    kanban,
    leads,
    messenger,
    notes,
    openclaw,
    opportunities,
    organizations,
    pm_advanced,
    portal,
    products_services,
    projects,
    quotes,
    reviews,
    scheduled_messages,
    sequences,
    tasks,
    webhooks,
    webhooks_out,
    workflow_runtime,
    workflows,
    # Phase 1: CRM/PM Operating Surfaces
    companies,
    deals,
    timeline,
    search,
    custom_fields,
    file_attachments,
    action_runs,
    approvals,
    notifications_hub,
    # Phase 2: Messenger & Action Core
    conversations,
    messenger_ai,
    intent_routes,
)


def create_app() -> FastAPI:
    if settings.environment == "production" and settings.secret_key.startswith("local-"):
        raise RuntimeError("SECRET_KEY must be changed before production startup")

    if settings.auto_create_tables:
        # Local/dev convenience. In production set AUTO_CREATE_TABLES=false and run Alembic.
        Base.metadata.create_all(bind=engine)
        from app.database import SessionLocal
        from app.services.action_registry import seed_system_actions
        from app.services.intent_route_seeder import seed_intent_routes
        with SessionLocal() as _db:
            seed_system_actions(_db)
            seed_intent_routes(_db)

    app = FastAPI(
        title="Mighty CRM API",
        version=settings.app_version,
        debug=settings.debug,
    )

    app.state.limiter = limiter

    @app.exception_handler(RateLimitExceeded)
    async def _rate_limit_handler(request: Request, exc: RateLimitExceeded):
        return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded. Please slow down."})

    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health():
        return {"ok": True, "service": "mighty-crm", "version": settings.app_version}

    @app.get("/health/live")
    def live():
        return {"ok": True}

    @app.get("/health/ready")
    def ready():
        try:
            check_database()
            return {"ok": True, "database": "ready"}
        except Exception as exc:  # pragma: no cover - defensive health endpoint
            raise HTTPException(status_code=503, detail=f"Database not ready: {exc}") from exc

    for router in [
        auth.router,
        organizations.router,
        leads.router,
        contacts.router,
        opportunities.router,
        tasks.router,
        communications.router,
        notes.router,
        agents.router,
        dashboard.router,
        campaigns.router,
        workflows.router,
        inbox.router,
        appointments.router,
        products_services.router,
        quotes.router,
        reviews.router,
        integrations.router,
        enterprise.router,
        intelligence.router,
        workflow_runtime.router,
        webhooks.router,
        messenger.router,
        openclaw.router,
        projects.router,
        pm_advanced.router,
        kanban.router,
        # Phase 3: tripled functionalities
        analytics.router,
        api_keys.router,
        billing.router,
        call_logs.router,
        email_templates.router,
        portal.router,
        scheduled_messages.router,
        sequences.router,
        webhooks_out.router,
        # Phase 1: CRM/PM Operating Surfaces
        companies.router,
        deals.router,
        timeline.router,
        search.router,
        custom_fields.router,
        file_attachments.router,
        action_runs.router,
        approvals.router,
        notifications_hub.router,
        # Phase 2: Messenger & Action Core
        conversations.router,
        messenger_ai.router,
        intent_routes.router,
    ]:
        app.include_router(router)

    return app


app = create_app()
