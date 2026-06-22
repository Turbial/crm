from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, SessionLocal
from app.models import Organization, User, UserRole, Lead, LeadStatus, CommandExecution, MessengerMessage
from app.security import hash_password

client = TestClient(app)

def setup_module(module):
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    org = Organization(name="Test Org", industry="contractor", plan="agent")
    db.add(org); db.flush()
    user = User(organization_id=org.id, name="Owner", email="owner@test.com", password_hash=hash_password("pass"), role=UserRole.owner)
    db.add(user)
    db.add(Lead(organization_id=org.id, name="New Lead", email="lead@test.com", status=LeadStatus.new, source="test"))
    db.commit(); db.close()

def auth_headers():
    res = client.post('/auth/login', json={'email':'owner@test.com','password':'pass'})
    assert res.status_code == 200, res.text
    return {'Authorization': f"Bearer {res.json()['access_token']}"}

def test_messenger_report_command():
    res = client.post('/messenger/command', json={'text': "Show me today's CRM summary"}, headers=auth_headers())
    assert res.status_code == 200, res.text
    body = res.json()
    assert body['execution']['intent'] == 'report'
    assert 'CRM summary' in body['assistant_message']['body']

def test_messenger_create_lead_command():
    res = client.post('/messenger/command', json={'text': 'Add lead Sarah Brown sarah@example.com 310-555-0199'}, headers=auth_headers())
    assert res.status_code == 200, res.text
    assert res.json()['execution']['intent'] == 'create_lead'
    leads = client.get('/leads?q=Sarah', headers=auth_headers()).json()
    assert any('Sarah' in lead['name'] for lead in leads)

def test_messenger_follow_up_requires_approval_by_default():
    res = client.post('/messenger/command', json={'text': 'Follow up with all new leads by SMS'}, headers=auth_headers())
    assert res.status_code == 200, res.text
    body = res.json()
    assert body['execution']['intent'] == 'bulk_follow_up'
    assert body['execution']['requires_approval'] is True
