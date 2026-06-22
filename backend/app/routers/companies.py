"""Company CRUD endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_manager
from app.models import User, Company
from app.schemas import CompanyCreate, CompanyUpdate, CompanyOut

router = APIRouter(prefix="/companies", tags=["Companies"])


@router.post("", response_model=CompanyOut)
def create_company(
    body: CompanyCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.company_service import create_company as _create
    return _create(db, user.organization_id, body.name, domain=body.domain,
                   industry=body.industry, size=body.size, website=body.website,
                   phone=body.phone, address=body.address, city=body.city,
                   state=body.state, country=body.country)


@router.get("", response_model=list[CompanyOut])
def list_companies(
    search: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.company_service import list_companies as _list
    return _list(db, user.organization_id, search=search, limit=limit, offset=offset)


@router.get("/{company_id}", response_model=CompanyOut)
def get_company(
    company_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    company = db.query(Company).filter(
        Company.id == company_id,
        Company.organization_id == user.organization_id,
    ).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.patch("/{company_id}", response_model=CompanyOut)
def update_company(
    company_id: str,
    body: CompanyUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    company = db.query(Company).filter(
        Company.id == company_id,
        Company.organization_id == user.organization_id,
    ).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(company, field, val)
    db.commit()
    db.refresh(company)
    return company


@router.delete("/{company_id}", status_code=204)
def delete_company(
    company_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    company = db.query(Company).filter(
        Company.id == company_id,
        Company.organization_id == user.organization_id,
    ).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    db.delete(company)
    db.commit()


@router.get("/{company_id}/leads")
def company_leads(
    company_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.company_service import get_company_leads
    return get_company_leads(db, user.organization_id, company_id)


@router.get("/{company_id}/contacts")
def company_contacts(
    company_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.company_service import get_company_contacts
    return get_company_contacts(db, user.organization_id, company_id)


@router.get("/{company_id}/timeline")
def company_timeline(
    company_id: str,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.timeline_service import get_timeline
    return get_timeline(db, user.organization_id, "company", company_id, limit=limit, offset=offset)
