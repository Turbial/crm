from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, SessionLocal
from app.models import Organization, User, UserRole, Project, PMTask, AgentAction, ProjectTemplate
from app.security import hash_password

client = TestClient(app)

def setup_module(module):
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    org = Organization(name="PM Org", industry="contractor", plan="agent")
    db.add(org); db.flush()
    user = User(organization_id=org.id, name="Owner", email="pm@test.com", password_hash=hash_password("pass"), role=UserRole.owner)
    db.add(user); db.commit(); db.close()

def auth_headers():
    res = client.post('/auth/login', json={'email':'pm@test.com','password':'pass'})
    assert res.status_code == 200, res.text
    return {'Authorization': f"Bearer {res.json()['access_token']}"}

def test_default_templates_created():
    res = client.post('/projects/templates/defaults', headers=auth_headers())
    assert res.status_code == 200, res.text
    templates = client.get('/projects/templates', headers=auth_headers()).json()
    assert any(t['name'] == 'Website Build' for t in templates)

def test_generate_website_project_with_openclaw_actions():
    res = client.post('/projects/generate', json={'name': 'ABC Roofing Website', 'project_type': 'website', 'goal': 'Launch a MightyMax website'}, headers=auth_headers())
    assert res.status_code == 200, res.text
    body = res.json()
    assert body['milestones_created'] >= 4
    assert body['tasks_created'] >= 10
    assert body['agent_actions_created'] == body['tasks_created']
    board = client.get(f"/projects/{body['project']['id']}/board", headers=auth_headers()).json()
    assert 'ready' in board['tasks_by_status']

def test_messenger_can_generate_project():
    res = client.post('/messenger/command', json={'text': 'Build website for XYZ Plumbing'}, headers=auth_headers())
    assert res.status_code == 200, res.text
    body = res.json()
    assert body['execution']['intent'] == 'pm_generate_project'
    assert 'Project created' in body['assistant_message']['body']
