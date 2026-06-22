"""File attachment endpoints — generic across all entity types."""
from __future__ import annotations

import io

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_manager
from app.models import User, FileAttachment
from app.schemas import FileAttachmentCreate, FileAttachmentOut

router = APIRouter(prefix="/attachments", tags=["Attachments"])


@router.post("/upload", response_model=FileAttachmentOut, status_code=201)
async def upload_attachment(
    entity_type: str = Query(...),
    entity_id: str = Query(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.file_service import upload_file
    content = await file.read()
    url = upload_file(
        io.BytesIO(content),
        file.filename or "upload",
        content_type=file.content_type or "application/octet-stream",
        prefix=f"attachments/{entity_type}",
    )
    attachment = FileAttachment(
        organization_id=user.organization_id,
        entity_type=entity_type,
        entity_id=entity_id,
        uploaded_by_user_id=user.id,
        name=file.filename or "upload",
        mime_type=file.content_type or "application/octet-stream",
        size_bytes=len(content),
        storage_url=url,
        is_public=False,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    from app.services.timeline_service import record_file_uploaded
    record_file_uploaded(db, user.organization_id, entity_type, entity_id,
                         file.filename or "upload", actor_id=user.id, actor_name=user.name)
    db.commit()
    return attachment


@router.post("", response_model=FileAttachmentOut)
def create_attachment(
    body: FileAttachmentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    attachment = FileAttachment(
        organization_id=user.organization_id,
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        uploaded_by_user_id=user.id,
        name=body.name,
        mime_type=body.mime_type,
        size_bytes=body.size_bytes,
        storage_url=body.storage_url,
        thumbnail_url=body.thumbnail_url,
        is_public=body.is_public,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    from app.services.timeline_service import record_file_uploaded
    record_file_uploaded(db, user.organization_id, body.entity_type, body.entity_id,
                         body.name, actor_id=user.id, actor_name=user.name)
    db.commit()
    return attachment


@router.get("", response_model=list[FileAttachmentOut])
def list_attachments(
    entity_type: str = Query(...),
    entity_id: str = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return db.query(FileAttachment).filter(
        FileAttachment.organization_id == user.organization_id,
        FileAttachment.entity_type == entity_type,
        FileAttachment.entity_id == entity_id,
    ).order_by(FileAttachment.created_at.desc()).all()


@router.get("/{attachment_id}", response_model=FileAttachmentOut)
def get_attachment(
    attachment_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    attachment = db.query(FileAttachment).filter(
        FileAttachment.id == attachment_id,
        FileAttachment.organization_id == user.organization_id,
    ).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    return attachment


@router.delete("/{attachment_id}", status_code=204)
def delete_attachment(
    attachment_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    attachment = db.query(FileAttachment).filter(
        FileAttachment.id == attachment_id,
        FileAttachment.organization_id == user.organization_id,
    ).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    db.delete(attachment)
    db.commit()
