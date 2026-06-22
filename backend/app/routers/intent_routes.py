"""Intent route configuration endpoints — map intent patterns to action keys."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_manager
from app.models import User, IntentRoute
from app.schemas import IntentRouteCreate, IntentRouteOut

router = APIRouter(prefix="/intent-routes", tags=["Intent Routes"])


@router.get("", response_model=list[IntentRouteOut])
def list_routes(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return db.query(IntentRoute).filter(
        (IntentRoute.organization_id == user.organization_id) |
        IntentRoute.organization_id.is_(None),
        IntentRoute.active == True,
    ).order_by(IntentRoute.intent_pattern).all()


@router.post("", response_model=IntentRouteOut)
def create_route(
    body: IntentRouteCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    route = IntentRoute(
        organization_id=user.organization_id,
        intent_pattern=body.intent_pattern,
        action_key=body.action_key,
        target_surface=body.target_surface,
        confidence_threshold=body.confidence_threshold,
        require_confirmation=body.require_confirmation,
        active=body.active,
    )
    db.add(route)
    db.commit()
    db.refresh(route)
    return route


@router.patch("/{route_id}", response_model=IntentRouteOut)
def update_route(
    route_id: str,
    body: IntentRouteCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    route = db.query(IntentRoute).filter(
        IntentRoute.id == route_id,
        IntentRoute.organization_id == user.organization_id,
    ).first()
    if not route:
        raise HTTPException(status_code=404, detail="Intent route not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(route, k, v)
    db.commit()
    db.refresh(route)
    return route


@router.delete("/{route_id}", status_code=204)
def delete_route(
    route_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    route = db.query(IntentRoute).filter(
        IntentRoute.id == route_id,
        IntentRoute.organization_id == user.organization_id,
    ).first()
    if not route:
        raise HTTPException(status_code=404, detail="Intent route not found")
    route.active = False
    db.commit()
