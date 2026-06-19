"""Sales & Revenue Intelligence endpoints."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_manager
from app.models import User
from app.services import analytics_service

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/pipeline")
def pipeline_funnel(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return analytics_service.pipeline_funnel(db, user.organization_id)


@router.get("/forecast")
def revenue_forecast(
    months_ahead: int = Query(default=3, ge=1, le=12),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return analytics_service.revenue_forecast(db, user.organization_id, months_ahead)


@router.get("/velocity")
def sales_velocity(
    lookback_days: int = Query(default=90, ge=7, le=365),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return analytics_service.sales_velocity(db, user.organization_id, lookback_days)


@router.get("/conversions")
def conversion_rates(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return analytics_service.conversion_rates(db, user.organization_id)


@router.get("/agent-performance")
def agent_performance(
    lookback_days: int = Query(default=30, ge=1, le=90),
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    return analytics_service.agent_performance(db, user.organization_id, lookback_days)


@router.get("/lead-sources")
def lead_sources(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return analytics_service.lead_source_report(db, user.organization_id)
