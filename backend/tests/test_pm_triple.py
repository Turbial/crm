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
    org = Organization(name="PM Triple Org", industry="agency", plan="agent")
    db.add(org); db.flush()
    user = User(organization_id=org.id, name="Owner", email="pmtriple@test.com", password_hash=hash_password("pass"), role=UserRole.owner)
    db.add(user); db.commit(); db.close()


def auth_headers():
    res = client.post('/auth/login', json={'email':'pmtriple@test.com','password':'pass'})
    assert res.status_code == 200, res.text
    return {'Authorization': f"Bearer {res.json()['access_token']}"}


def test_pm_triple_auto_plan_and_overview():
    headers = auth_headers()
    gen = client.post('/projects/generate', json={'name': 'Triple PM Website', 'project_type': 'website', 'goal': 'Launch with full PM controls'}, headers=headers)
    assert gen.status_code == 200, gen.text
    project_id = gen.json()['project']['id']

    portfolio = client.post('/pm/portfolios', json={'name': 'Client Delivery Portfolio'}, headers=headers)
    assert portfolio.status_code == 200, portfolio.text
    link = client.post(f"/pm/portfolios/{portfolio.json()['id']}/projects", json={'project_id': project_id}, headers=headers)
    assert link.status_code == 200, link.text

    auto = client.post(f'/pm/projects/{project_id}/auto-plan', headers=headers)
    assert auto.status_code == 200, auto.text
    assert auto.json()['risks_created'] == 3

    risk = client.post(f'/pm/projects/{project_id}/risks', json={'title': 'DNS not ready', 'severity': 'high', 'mitigation_plan': 'Use temporary MightyMax subdomain'}, headers=headers)
    assert risk.status_code == 200, risk.text

    cr = client.post(f'/pm/projects/{project_id}/change-requests', json={'title': 'Add booking page', 'impact_minutes': 90}, headers=headers)
    assert cr.status_code == 200, cr.text

    overview = client.get('/pm/executive-overview', headers=headers)
    assert overview.status_code == 200, overview.text
    body = overview.json()
    assert body['projects_total'] >= 1
    assert body['open_risks'] >= 3
    assert body['pending_change_requests'] >= 1


def test_workload_capacity_report():
    headers = auth_headers()
    res = client.post('/pm/workload', json={'assignee_type': 'agent', 'assignee_agent': 'WebsiteAgent', 'capacity_minutes_per_week': 600}, headers=headers)
    assert res.status_code == 200, res.text
    report = client.get('/pm/workload', headers=headers)
    assert report.status_code == 200, report.text
    assert any(i['assignee'] == 'WebsiteAgent' for i in report.json()['items'])
