from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models import User, Note
from app.schemas import NoteCreate, NoteOut

router = APIRouter(prefix="/notes", tags=["notes"])

@router.get("", response_model=list[NoteOut])
def list_notes(lead_id: str | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Note).filter(Note.organization_id == user.organization_id)
    if lead_id:
        query = query.filter(Note.lead_id == lead_id)
    return query.order_by(Note.created_at.desc()).all()

@router.post("", response_model=NoteOut)
def create_note(payload: NoteCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    note = Note(**payload.model_dump(), organization_id=user.organization_id, author_user_id=user.id)
    db.add(note); db.commit(); db.refresh(note)
    return note
