from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, SessionLocal
from app.models import Organization, User, UserRole
from app.security import hash_password

client = TestClient(app)

def setup_module(module):
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    org = Organization(name="OpenClaw Org", industry="contractor", plan="agent")
    db.add(org); db.flush()
    db.add(User(organization_id=org.id, name="Owner", email="openclaw@test.com", password_hash=hash_password("pass"), role=UserRole.owner))
    db.commit(); db.close()

def headers():
    r = client.post('/auth/login', json={'email':'openclaw@test.com','password':'pass'})
    assert r.status_code == 200, r.text
    return {'Authorization': f"Bearer {r.json()['access_token']}"}

def test_openclaw_prompt_available():
    r = client.get('/openclaw/prompts/ManagerAgent', headers=headers())
    assert r.status_code == 200, r.text
    assert 'system_prompt' in r.json()
    assert 'task_input' in r.json()['contracts']

def test_openclaw_queue_approve_result():
    h = headers()
    r = client.post('/openclaw/tasks', headers=h, json={
        'agent_name': 'SalesAgent',
        'task_type': 'send_email',
        'instruction': 'Draft follow-up email',
        'requires_approval': True,
    })
    assert r.status_code == 200, r.text
    task = r.json()
    assert task['status'] == 'blocked'
    approved = client.post(f"/openclaw/tasks/{task['id']}/approve", headers=h)
    assert approved.status_code == 200, approved.text
    assert approved.json()['status'] == 'queued'
    result = client.post(f"/openclaw/tasks/{task['id']}/result", headers=h, json={'status':'completed','summary':'Draft ready'})
    assert result.status_code == 200, result.text
    assert result.json()['status'] == 'completed'

def test_messenger_can_queue_openclaw_task():
    r = client.post('/messenger/command', headers=headers(), json={'text':'Ask RevenueAgent to find 20 outdated contractor websites', 'require_approval_for_external_actions': False})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body['execution']['intent'] == 'openclaw_task'
    assert 'OpenClaw task queued' in body['assistant_message']['body']
