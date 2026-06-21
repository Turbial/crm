"""Deal pipeline endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_manager
from app.models import User, Deal, PipelineStage
from app.schemas import DealCreate, DealUpdate, DealOut

router = APIRouter(prefix="/deals", tags=["Deals"])


@router.post("", response_model=DealOut)
def create_deal(
    body: DealCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    deal = Deal(
        organization_id=user.organization_id,
        title=body.title,
        lead_id=body.lead_id,
        contact_id=body.contact_id,
        company_id=body.company_id,
        pipeline_id=body.pipeline_id,
        stage_id=body.stage_id,
        value=body.value,
        probability=body.probability,
        currency=body.currency,
        expected_close_date=body.expected_close_date,
        owner_user_id=body.owner_user_id or user.id,
        source=body.source,
        tags=body.tags,
    )
    db.add(deal)
    db.commit()
    db.refresh(deal)
    from app.services.timeline_service import record
    record(db, user.organization_id, "deal", deal.id, "deal_created",
           f"Deal created: {deal.title}", actor_type="human", actor_id=user.id, actor_name=user.name)
    db.commit()
    return deal


@router.get("", response_model=list[DealOut])
def list_deals(
    pipeline_id: str | None = Query(default=None),
    stage_id: str | None = Query(default=None),
    owner_user_id: str | None = Query(default=None),
    q: str | None = Query(default=None),
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Deal).filter(Deal.organization_id == user.organization_id)
    if pipeline_id:
        query = query.filter(Deal.pipeline_id == pipeline_id)
    if stage_id:
        query = query.filter(Deal.stage_id == stage_id)
    if owner_user_id:
        query = query.filter(Deal.owner_user_id == owner_user_id)
    if q:
        query = query.filter(Deal.title.ilike(f"%{q}%"))
    return query.order_by(Deal.created_at.desc()).limit(limit).all()


@router.get("/board")
def deals_board(
    pipeline_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return deals grouped by pipeline stage — for Kanban rendering."""
    stages = db.query(PipelineStage).filter(
        PipelineStage.organization_id == user.organization_id,
        *([PipelineStage.pipeline_id == pipeline_id] if pipeline_id else []),
    ).order_by(PipelineStage.position).all()

    q = db.query(Deal).filter(Deal.organization_id == user.organization_id)
    if pipeline_id:
        q = q.filter(Deal.pipeline_id == pipeline_id)
    all_deals = q.all()

    stage_map: dict[str | None, list] = {s.id: [] for s in stages}
    stage_map[None] = []
    for deal in all_deals:
        stage_map.setdefault(deal.stage_id, []).append({
            "id": deal.id, "title": deal.title, "value": deal.value,
            "probability": deal.probability, "owner_user_id": deal.owner_user_id,
        })

    return {
        "stages": [
            {"id": s.id, "name": s.name, "position": s.position,
             "color": s.color, "probability_default": s.probability_default,
             "is_won_stage": s.is_won_stage, "is_lost_stage": s.is_lost_stage,
             "deals": stage_map.get(s.id, [])}
            for s in stages
        ],
        "unassigned": stage_map.get(None, []),
    }


@router.get("/{deal_id}", response_model=DealOut)
def get_deal(
    deal_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    deal = db.query(Deal).filter(
        Deal.id == deal_id, Deal.organization_id == user.organization_id
    ).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


@router.patch("/{deal_id}", response_model=DealOut)
def update_deal(
    deal_id: str,
    body: DealUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    deal = db.query(Deal).filter(
        Deal.id == deal_id, Deal.organization_id == user.organization_id
    ).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    old_stage = deal.stage_id
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(deal, field, val)
    db.commit()
    db.refresh(deal)
    if "stage_id" in body.model_fields_set and deal.stage_id != old_stage:
        from app.services.timeline_service import record_deal_moved
        record_deal_moved(db, user.organization_id, deal.id,
                          old_stage or "none", deal.stage_id or "none",
                          actor_id=user.id, actor_name=user.name)
        db.commit()
    return deal


@router.post("/{deal_id}/move-stage", response_model=DealOut)
def move_deal_stage(
    deal_id: str,
    stage_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    deal = db.query(Deal).filter(
        Deal.id == deal_id, Deal.organization_id == user.organization_id
    ).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    stage = db.query(PipelineStage).filter(
        PipelineStage.id == stage_id,
        PipelineStage.organization_id == user.organization_id,
    ).first()
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")
    old_stage_id = deal.stage_id
    deal.stage_id = stage_id
    deal.probability = stage.probability_default
    db.commit()
    from app.services.timeline_service import record_deal_moved
    record_deal_moved(db, user.organization_id, deal.id,
                      old_stage_id or "none", stage.name,
                      actor_id=user.id, actor_name=user.name)
    db.commit()
    db.refresh(deal)
    return deal


@router.delete("/{deal_id}", status_code=204)
def delete_deal(
    deal_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    deal = db.query(Deal).filter(
        Deal.id == deal_id, Deal.organization_id == user.organization_id
    ).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    db.delete(deal)
    db.commit()


@router.get("/{deal_id}/timeline")
def deal_timeline(
    deal_id: str,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.timeline_service import get_timeline
    return get_timeline(db, user.organization_id, "deal", deal_id, limit=limit, offset=offset)


# ─── Pipeline Stage management ─────────────────────────────────────────────────

@router.post("/stages", response_model=dict)
def create_stage(
    pipeline_id: str,
    name: str,
    position: int = 1,
    probability_default: int = 25,
    color: str | None = None,
    is_won_stage: bool = False,
    is_lost_stage: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    stage = PipelineStage(
        organization_id=user.organization_id,
        pipeline_id=pipeline_id,
        name=name,
        position=position,
        probability_default=probability_default,
        color=color,
        is_won_stage=is_won_stage,
        is_lost_stage=is_lost_stage,
    )
    db.add(stage)
    db.commit()
    db.refresh(stage)
    return {"id": stage.id, "name": stage.name, "position": stage.position}


@router.get("/stages/list")
def list_stages(
    pipeline_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return db.query(PipelineStage).filter(
        PipelineStage.organization_id == user.organization_id,
        PipelineStage.pipeline_id == pipeline_id,
    ).order_by(PipelineStage.position).all()
