"""Deal pipeline endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_manager
from app.models import User, Deal, Pipeline, PipelineStage, PipelineStatus
from app.schemas import DealCreate, DealUpdate, DealOut


class StageCreateBody(BaseModel):
    name: str
    pipeline_id: str | None = None
    position: int = 1
    probability_default: int = 25
    color: str | None = None
    is_won_stage: bool = False
    is_lost_stage: bool = False

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
        stage=body.stage,
        value=body.value,
        probability=body.probability,
        currency=body.currency,
        expected_close_date=body.expected_close_date,
        owner_user_id=body.owner_user_id or user.id,
        source=body.source,
        notes=body.notes,
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


_DEFAULT_STAGES = ["Lead", "Qualified", "Proposal", "Negotiation", "Won", "Lost"]


def _deal_card(deal: Deal) -> dict:
    return {
        "id": deal.id, "title": deal.title, "value": deal.value,
        "probability": deal.probability, "owner_user_id": deal.owner_user_id,
    }


@router.get("/board")
def deals_board(
    pipeline_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return deals grouped by pipeline stage — for Kanban rendering.

    Falls back to grouping by the deal.stage string field when no formal
    PipelineStage rows exist (common on fresh installs).
    """
    stages = db.query(PipelineStage).filter(
        PipelineStage.organization_id == user.organization_id,
        *([PipelineStage.pipeline_id == pipeline_id] if pipeline_id else []),
    ).order_by(PipelineStage.position).all()

    q = db.query(Deal).filter(Deal.organization_id == user.organization_id)
    if pipeline_id:
        q = q.filter(Deal.pipeline_id == pipeline_id)
    all_deals = q.all()

    if stages:
        # Formal pipeline: group by stage_id, match by stage string as fallback
        stage_by_name = {s.name.lower(): s for s in stages}
        stage_map: dict[str | None, list] = {s.id: [] for s in stages}
        stage_map[None] = []
        for deal in all_deals:
            key = deal.stage_id
            if key is None and deal.stage:
                matched = stage_by_name.get(deal.stage.lower())
                key = matched.id if matched else None
            stage_map.setdefault(key, []).append(_deal_card(deal))

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
    else:
        # No formal stages: group by deal.stage string field
        string_map: dict[str, list] = {}
        for deal in all_deals:
            key = (deal.stage or "lead").lower()
            string_map.setdefault(key, []).append(_deal_card(deal))

        ordered = sorted(
            string_map.keys(),
            key=lambda s: _DEFAULT_STAGES.index(s.capitalize()) if s.capitalize() in _DEFAULT_STAGES else 99,
        )
        return {
            "stages": [
                {"id": k, "name": k.capitalize(), "position": i,
                 "color": None, "probability_default": 25,
                 "is_won_stage": k == "won", "is_lost_stage": k == "lost",
                 "deals": string_map[k]}
                for i, k in enumerate(ordered)
            ],
            "unassigned": [],
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

def _get_or_create_default_pipeline(db: Session, org_id: str) -> Pipeline:
    pipeline = db.query(Pipeline).filter(
        Pipeline.organization_id == org_id,
        Pipeline.is_default == True,
    ).first()
    if not pipeline:
        pipeline = Pipeline(
            organization_id=org_id,
            name="Default Pipeline",
            status=PipelineStatus.active,
            is_default=True,
        )
        db.add(pipeline)
        db.flush()
    return pipeline


@router.post("/stages", response_model=dict)
def create_stage(
    body: StageCreateBody,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    pipeline_id = body.pipeline_id
    if not pipeline_id:
        pipeline_id = _get_or_create_default_pipeline(db, user.organization_id).id

    existing_count = db.query(PipelineStage).filter(
        PipelineStage.organization_id == user.organization_id,
        PipelineStage.pipeline_id == pipeline_id,
    ).count()

    stage = PipelineStage(
        organization_id=user.organization_id,
        pipeline_id=pipeline_id,
        name=body.name,
        position=body.position if body.position != 1 else existing_count + 1,
        probability_default=body.probability_default,
        color=body.color,
        is_won_stage=body.is_won_stage,
        is_lost_stage=body.is_lost_stage,
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
