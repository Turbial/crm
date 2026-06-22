import hashlib
import hmac
import json
import time

from fastapi.testclient import TestClient

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import Communication, Organization, User, UserRole
from app.security import hash_password

client = TestClient(app)


def sign(secret: str, body: bytes, timestamp: str | None = None):
    timestamp = timestamp or str(int(time.time()))
    signature = hmac.new(secret.encode(), timestamp.encode() + b"." + body, hashlib.sha256).hexdigest()
    return {
        "X-Mighty-Timestamp": timestamp,
        "X-Mighty-Signature": signature,
        "Content-Type": "application/json",
    }


def setup_module(module):
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    org = Organization(name="Production Org", industry="contractor", plan="production")
    db.add(org)
    db.flush()
    module.org_id = org.id
    db.add(
        User(
            organization_id=org.id,
            name="Owner",
            email="production@test.com",
            password_hash=hash_password("password123"),
            role=UserRole.owner,
        )
    )
    db.commit()
    db.close()


def auth_headers():
    r = client.post("/auth/login", json={"email": "production@test.com", "password": "password123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_readiness_endpoint_checks_database():
    r = client.get("/health/ready")
    assert r.status_code == 200
    assert r.json()["database"] == "ready"


def test_provider_webhook_requires_signature():
    r = client.post(
        "/webhooks/provider-message",
        json={"organization_id": org_id, "channel": "email", "content": "hello"},
    )
    assert r.status_code == 401


def test_provider_webhook_accepts_hmac_signature():
    payload = {
        "organization_id": org_id,
        "channel": "email",
        "direction": "inbound",
        "subject": "Signed",
        "content": "Signed message",
    }
    body = json.dumps(payload, separators=(",", ":")).encode()
    r = client.post("/webhooks/provider-message", data=body, headers=sign(settings.provider_webhook_secret, body))
    assert r.status_code == 200, r.text
    db = SessionLocal()
    try:
        assert db.query(Communication).filter(Communication.organization_id == org_id).count() == 1
    finally:
        db.close()


def test_openclaw_signed_callback_records_result():
    h = auth_headers()
    queued = client.post(
        "/openclaw/tasks",
        headers=h,
        json={
            "agent_name": "WebsiteAgent",
            "task_type": "pm_task",
            "instruction": "Finish production callback test",
            "requires_approval": False,
        },
    )
    assert queued.status_code == 200, queued.text
    action_id = queued.json()["id"]
    payload = {
        "organization_id": org_id,
        "status": "completed",
        "summary": "Callback completed",
        "cost_cents": 3,
        "duration_ms": 1000,
    }
    body = json.dumps(payload, separators=(",", ":")).encode()
    callback = client.post(
        f"/openclaw/callbacks/tasks/{action_id}/result",
        data=body,
        headers=sign(settings.openclaw_webhook_secret, body),
    )
    assert callback.status_code == 200, callback.text
    assert callback.json()["status"] == "completed"
    assert callback.json()["result"] == "Callback completed"
