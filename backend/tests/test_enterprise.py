from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    r = client.get('/health')
    assert r.status_code == 200
    assert r.json()['ok'] is True

def test_openapi_has_enterprise():
    schema = client.get('/openapi.json').json()
    assert '/enterprise/resources' in schema['paths']
    assert '/enterprise/overview' in schema['paths']
