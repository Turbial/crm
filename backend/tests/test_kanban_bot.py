from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, SessionLocal
from app.models import Organization, User, UserRole, Project, PMTask, PMTaskStatus
from app.security import hash_password

client = TestClient(app)

def setup_module(module):
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    org = Organization(name="Kanban Org", industry="contractor", plan="agent")
    db.add(org); db.flush()
    user = User(organization_id=org.id, name="Owner", email="kanban@test.com", password_hash=hash_password("pass"), role=UserRole.owner)
    db.add(user); db.flush()
    project = Project(organization_id=org.id, owner_user_id=user.id, name="ABC Roofing Website", goal="Launch site")
    db.add(project); db.flush()
    db.add_all([
        PMTask(organization_id=org.id, project_id=project.id, title="Generate homepage copy", status=PMTaskStatus.ready, assignee_agent="WebsiteAgent"),
        PMTask(organization_id=org.id, project_id=project.id, title="QA mobile homepage", status=PMTaskStatus.review, assignee_agent="QAAgent"),
    ])
    db.commit(); db.close()

def auth_headers():
    res = client.post('/auth/login', json={'email':'kanban@test.com','password':'pass'})
    assert res.status_code == 200, res.text
    return {'Authorization': f"Bearer {res.json()['access_token']}"}

def test_kanban_board_defaults_and_counts():
    projects = client.get('/projects', headers=auth_headers()).json()
    pid = projects[0]['id']
    board = client.get(f'/projects/{pid}/kanban', headers=auth_headers())
    assert board.status_code == 200, board.text
    data = board.json()
    labels = [c['column']['label'] for c in data['columns']]
    assert 'Ready' in labels
    assert data['total_tasks'] == 2
    assert any(c['column']['key'] == 'ready' and c['count'] == 1 for c in data['columns'])

def test_move_task_on_kanban_board():
    h = auth_headers()
    project = client.get('/projects', headers=h).json()[0]
    tasks = client.get(f"/projects/{project['id']}/tasks", headers=h).json()
    task = next(t for t in tasks if t['title'] == 'Generate homepage copy')
    res = client.patch(f"/projects/{project['id']}/kanban/tasks/{task['id']}/move", headers=h, json={'column_key':'in_progress','position':1})
    assert res.status_code == 200, res.text
    assert res.json()['new_status'] == 'in_progress'
    board = client.get(f"/projects/{project['id']}/kanban", headers=h).json()
    assert any(c['column']['key'] == 'in_progress' and c['count'] >= 1 for c in board['columns'])

def test_messenger_bot_can_show_and_move_board():
    h = auth_headers()
    res = client.post('/messenger/command', headers=h, json={'text':'Show Kanban board for ABC Roofing Website'})
    assert res.status_code == 200, res.text
    assert 'Kanban board for ABC Roofing Website' in res.json()['assistant_message']['body']
    res = client.post('/messenger/command', headers=h, json={'text':'Move task QA mobile homepage to done for ABC Roofing Website'})
    assert res.status_code == 200, res.text
    body = res.json()['assistant_message']['body']
    assert 'Moved task' in body
    assert 'done' in body

def test_messenger_bot_can_create_pm_task():
    h = auth_headers()
    res = client.post('/messenger/command', headers=h, json={'text':'Create PM task write services page copy for ABC Roofing Website and assign to WebsiteAgent'})
    assert res.status_code == 200, res.text
    body = res.json()['assistant_message']['body']
    assert 'PM task created' in body
    tasks = client.get(f"/projects/{client.get('/projects', headers=h).json()[0]['id']}/tasks", headers=h).json()
    assert any('write services page copy' in t['title'].lower() for t in tasks)
