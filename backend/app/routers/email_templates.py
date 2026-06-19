"""Email template CRUD and preview endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_manager
from app.models import User, EmailTemplate
from app.schemas import EmailTemplateCreate, EmailTemplateOut

router = APIRouter(prefix="/email-templates", tags=["Email Templates"])


@router.post("", response_model=EmailTemplateOut)
def create_template(
    body: EmailTemplateCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    tpl = EmailTemplate(
        organization_id=user.organization_id,
        name=body.name,
        category=body.category,
        subject=body.subject,
        body_html=body.body_html,
        body_text=body.body_text,
        variables=body.variables,
    )
    db.add(tpl)
    db.commit()
    db.refresh(tpl)
    return tpl


@router.get("", response_model=list[EmailTemplateOut])
def list_templates(
    category: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.email_template_engine import list_templates as _list
    return _list(db, user.organization_id, category)


@router.get("/{tpl_id}", response_model=EmailTemplateOut)
def get_template(
    tpl_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tpl = db.query(EmailTemplate).filter(
        EmailTemplate.id == tpl_id,
        EmailTemplate.organization_id == user.organization_id,
    ).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return tpl


@router.patch("/{tpl_id}", response_model=EmailTemplateOut)
def update_template(
    tpl_id: str,
    body: EmailTemplateCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    tpl = db.query(EmailTemplate).filter(
        EmailTemplate.id == tpl_id,
        EmailTemplate.organization_id == user.organization_id,
    ).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(tpl, field, val)
    db.commit()
    db.refresh(tpl)
    return tpl


@router.delete("/{tpl_id}", status_code=204)
def delete_template(
    tpl_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    tpl = db.query(EmailTemplate).filter(
        EmailTemplate.id == tpl_id,
        EmailTemplate.organization_id == user.organization_id,
    ).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(tpl)
    db.commit()


@router.post("/{tpl_id}/preview")
def preview_template(
    tpl_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.email_template_engine import preview_template as _preview
    tpl = db.query(EmailTemplate).filter(
        EmailTemplate.id == tpl_id,
        EmailTemplate.organization_id == user.organization_id,
    ).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return _preview(tpl)


@router.post("/{tpl_id}/render")
def render_for_lead(
    tpl_id: str,
    lead_id: str = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.email_template_engine import render_template_by_id
    from app.models import Lead
    lead = db.query(Lead).filter(
        Lead.id == lead_id, Lead.organization_id == user.organization_id
    ).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    subject, body_html, body_text = render_template_by_id(
        db, user.organization_id, tpl_id, lead
    )
    return {"subject": subject, "body_html": body_html, "body_text": body_text}
