from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Channel, Communication, Direction
from app.services.webhook_security import verify_signed_webhook

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


class ProviderMessage(BaseModel):
    organization_id: str
    lead_id: str | None = None
    channel: str
    direction: str = "inbound"
    subject: str | None = None
    content: str
    provider_message_id: str | None = None


@router.post("/provider-message")
async def ingest_provider_message(request: Request, db: Session = Depends(get_db)):
    body = await verify_signed_webhook(request)
    payload = ProviderMessage.model_validate_json(body)
    row = Communication(
        organization_id=payload.organization_id,
        lead_id=payload.lead_id,
        channel=Channel(payload.channel),
        direction=Direction(payload.direction),
        subject=payload.subject,
        content=payload.content,
        provider_message_id=payload.provider_message_id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"ok": True, "communication_id": row.id}
