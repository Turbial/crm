from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.middleware.rate_limit import limiter
from app.models import User, MessengerThread, MessengerMessage, CommandExecution, CommandTemplate, MessengerChannel
from app.schemas import (
    MessengerCommandIn, MessengerCommandOut, MessengerThreadCreate, MessengerThreadOut,
    MessengerMessageOut, CommandExecutionOut, CommandTemplateCreate, CommandTemplateOut,
)
from app.services.messenger_service import MessengerService

router = APIRouter(prefix="/messenger", tags=["messenger"])

@router.get("/threads", response_model=list[MessengerThreadOut])
def list_threads(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(MessengerThread).filter(MessengerThread.organization_id == user.organization_id).order_by(MessengerThread.updated_at.desc()).limit(50).all()

@router.post("/threads", response_model=MessengerThreadOut)
def create_thread(payload: MessengerThreadCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    thread = MessengerThread(
        organization_id=user.organization_id,
        owner_user_id=user.id,
        channel=MessengerChannel(payload.channel) if payload.channel in {c.value for c in MessengerChannel} else MessengerChannel.web,
        title=payload.title,
        external_thread_id=payload.external_thread_id,
        context_json=payload.context_json,
    )
    db.add(thread); db.commit(); db.refresh(thread)
    return thread

@router.get("/threads/{thread_id}/messages", response_model=list[MessengerMessageOut])
def list_messages(thread_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    thread = db.query(MessengerThread).filter(MessengerThread.id == thread_id, MessengerThread.organization_id == user.organization_id).first()
    if not thread:
        raise HTTPException(404, "Thread not found")
    return db.query(MessengerMessage).filter(MessengerMessage.thread_id == thread_id, MessengerMessage.organization_id == user.organization_id).order_by(MessengerMessage.created_at.asc()).limit(200).all()

@router.post("/command", response_model=MessengerCommandOut)
@limiter.limit("30/minute")
def send_command(request: Request, payload: MessengerCommandIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    service = MessengerService(db, user.organization_id, user.id)
    thread, user_msg, assistant_msg, execution, suggestions = service.handle(
        payload.text,
        thread_id=payload.thread_id,
        channel=MessengerChannel(payload.channel) if payload.channel in {c.value for c in MessengerChannel} else MessengerChannel.web,
        dry_run=payload.dry_run,
        require_approval_for_external_actions=payload.require_approval_for_external_actions,
    )
    return {
        "thread": thread,
        "user_message": user_msg,
        "assistant_message": assistant_msg,
        "execution": execution,
        "suggestions": suggestions,
    }

@router.get("/executions", response_model=list[CommandExecutionOut])
def list_executions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(CommandExecution).filter(CommandExecution.organization_id == user.organization_id).order_by(CommandExecution.created_at.desc()).limit(100).all()

@router.get("/templates", response_model=list[CommandTemplateOut])
def list_templates(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(CommandTemplate).filter(CommandTemplate.organization_id == user.organization_id, CommandTemplate.active == True).order_by(CommandTemplate.created_at.asc()).all()

@router.post("/templates", response_model=CommandTemplateOut)
def create_template(payload: CommandTemplateCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    template = CommandTemplate(**payload.model_dump(), organization_id=user.organization_id)
    db.add(template); db.commit(); db.refresh(template)
    return template
