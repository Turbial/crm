from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models import User, Organization
from app.schemas import OrganizationOut

router = APIRouter(prefix="/organizations", tags=["organizations"])

@router.get("/current", response_model=OrganizationOut)
def current_org(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.get(Organization, user.organization_id)
