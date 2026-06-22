from __future__ import annotations

from contextvars import ContextVar
from typing import Generator

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker, with_loader_criteria

from app.config import settings

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    future=True,
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

# Holds the active organization_id for the current request.
# Set once in get_db(); read automatically by the session event below.
_current_org_id: ContextVar[str | None] = ContextVar("current_org_id", default=None)


class Base(DeclarativeBase):
    pass


class OrgScoped:
    """Mixin marker. All models that carry organization_id should inherit this
    alongside Base so the automatic tenant filter applies to them."""
    organization_id: str


@event.listens_for(Session, "do_orm_execute")
def _auto_org_filter(execute_state):
    """Automatically append organization_id = <current> to every ORM query.

    This makes it impossible to forget the tenant filter in a router — the
    session enforces it at the ORM level. Models that don't carry organization_id
    (e.g. junction tables without that column) are unaffected.
    """
    org_id = _current_org_id.get()
    if not org_id:
        return
    if execute_state.is_column_load or execute_state.is_relationship_load:
        return
    execute_state.user_defined_options.extend([
        with_loader_criteria(
            OrgScoped,
            lambda cls: cls.organization_id == org_id,
            include_aliases=True,
        )
    ])


def set_org_context(org_id: str | None) -> None:
    _current_org_id.set(org_id)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database() -> bool:
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return True
