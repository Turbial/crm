"""Drip sequence CRUD and enrollment endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_manager
from app.models import User, DripSequence, DripStep, DripEnrollment
from app.schemas import (
    DripSequenceCreate, DripSequenceOut,
    DripStepCreate, DripStepOut,
    DripEnrollmentCreate, DripEnrollmentOut,
)

router = APIRouter(prefix="/sequences", tags=["Drip Sequences"])


# ─── Sequences ────────────────────────────────────────────────────────────────

@router.post("", response_model=DripSequenceOut)
def create_sequence(
    body: DripSequenceCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    seq = DripSequence(
        organization_id=user.organization_id,
        name=body.name,
        channel=body.channel,
        trigger=body.trigger,
        active=body.active,
    )
    db.add(seq)
    db.commit()
    db.refresh(seq)
    return seq


@router.get("", response_model=list[DripSequenceOut])
def list_sequences(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return db.query(DripSequence).filter(
        DripSequence.organization_id == user.organization_id
    ).order_by(DripSequence.created_at.desc()).all()


@router.get("/{seq_id}", response_model=DripSequenceOut)
def get_sequence(
    seq_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    seq = db.query(DripSequence).filter(
        DripSequence.id == seq_id,
        DripSequence.organization_id == user.organization_id,
    ).first()
    if not seq:
        raise HTTPException(status_code=404, detail="Sequence not found")
    return seq


@router.patch("/{seq_id}", response_model=DripSequenceOut)
def update_sequence(
    seq_id: str,
    body: DripSequenceCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    seq = db.query(DripSequence).filter(
        DripSequence.id == seq_id,
        DripSequence.organization_id == user.organization_id,
    ).first()
    if not seq:
        raise HTTPException(status_code=404, detail="Sequence not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(seq, field, val)
    db.commit()
    db.refresh(seq)
    return seq


@router.delete("/{seq_id}", status_code=204)
def delete_sequence(
    seq_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    seq = db.query(DripSequence).filter(
        DripSequence.id == seq_id,
        DripSequence.organization_id == user.organization_id,
    ).first()
    if not seq:
        raise HTTPException(status_code=404, detail="Sequence not found")
    db.delete(seq)
    db.commit()


# ─── Steps ────────────────────────────────────────────────────────────────────

@router.post("/{seq_id}/steps", response_model=DripStepOut)
def add_step(
    seq_id: str,
    body: DripStepCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    seq = db.query(DripSequence).filter(
        DripSequence.id == seq_id,
        DripSequence.organization_id == user.organization_id,
    ).first()
    if not seq:
        raise HTTPException(status_code=404, detail="Sequence not found")
    step = DripStep(
        organization_id=user.organization_id,
        sequence_id=seq_id,
        position=body.position,
        delay_hours=body.delay_hours,
        subject=body.subject,
        message_template=body.message_template,
    )
    db.add(step)
    db.commit()
    db.refresh(step)
    return step


@router.get("/{seq_id}/steps", response_model=list[DripStepOut])
def list_steps(
    seq_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return db.query(DripStep).filter(
        DripStep.sequence_id == seq_id,
        DripStep.organization_id == user.organization_id,
    ).order_by(DripStep.position).all()


@router.delete("/{seq_id}/steps/{step_id}", status_code=204)
def delete_step(
    seq_id: str,
    step_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    step = db.query(DripStep).filter(
        DripStep.id == step_id,
        DripStep.sequence_id == seq_id,
        DripStep.organization_id == user.organization_id,
    ).first()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    db.delete(step)
    db.commit()


# ─── Enrollments ──────────────────────────────────────────────────────────────

@router.post("/{seq_id}/enroll", response_model=DripEnrollmentOut)
def enroll_lead(
    seq_id: str,
    body: DripEnrollmentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    from app.services.sequence_engine import enroll_lead as _enroll
    try:
        enrollment = _enroll(db, user.organization_id, seq_id, body.lead_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return enrollment


@router.post("/{seq_id}/enrollments/{enrollment_id}/unenroll")
def unenroll(
    seq_id: str,
    enrollment_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    from app.services.sequence_engine import unenroll as _unenroll
    if not _unenroll(db, user.organization_id, enrollment_id):
        raise HTTPException(status_code=404, detail="Enrollment not found")
    return {"unenrolled": True}


@router.get("/{seq_id}/enrollments", response_model=list[DripEnrollmentOut])
def list_enrollments(
    seq_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return db.query(DripEnrollment).filter(
        DripEnrollment.sequence_id == seq_id,
        DripEnrollment.organization_id == user.organization_id,
    ).order_by(DripEnrollment.created_at.desc()).all()
