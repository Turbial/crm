"""Baseline tests for Phase 3 AI Operations Platform endpoints.

These tests verify the routers are mounted and return expected shapes.
They use a real DB session (SQLite in-memory via pytest fixtures when
TESTING=true or the default dev DB) so they're integration-level, not unit.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

# ── Helpers ───────────────────────────────────────────────────────────────────

_TOKEN: str | None = None


def _auth_headers() -> dict:
    global _TOKEN
    if not _TOKEN:
        res = client.post("/auth/login", json={"email": "owner@mightymax.ai", "password": "mighty123"})
        if res.status_code == 200:
            _TOKEN = res.json()["access_token"]
        else:
            pytest.skip("Seed data not available — skipping authenticated tests")
    return {"Authorization": f"Bearer {_TOKEN}"}


# ── Health guard (always runs) ────────────────────────────────────────────────

def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["ok"] is True


# ── Supervisor ────────────────────────────────────────────────────────────────

def test_supervisor_stats():
    res = client.get("/supervisor/stats", headers=_auth_headers())
    assert res.status_code == 200
    data = res.json()
    assert "total_runs" in data or isinstance(data, dict)


def test_supervisor_stuck():
    res = client.get("/supervisor/stuck", headers=_auth_headers())
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_supervisor_overdue_approvals():
    res = client.get("/supervisor/overdue-approvals", headers=_auth_headers())
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_supervisor_inactive_leads():
    res = client.get("/supervisor/inactive-leads", headers=_auth_headers())
    assert res.status_code == 200
    assert isinstance(res.json(), list)


# ── Daily brief ───────────────────────────────────────────────────────────────

def test_daily_brief_latest_missing():
    res = client.get("/daily-brief/latest", headers=_auth_headers())
    # Either 200 (exists) or 404 (not yet generated) — both are valid
    assert res.status_code in (200, 404)


def test_daily_brief_generate():
    res = client.post("/daily-brief/generate", headers=_auth_headers())
    assert res.status_code == 200
    data = res.json()
    assert "sections" in data
    assert "status" in data
    assert data["status"] in ("generated", "delivered", "failed")


def test_daily_brief_latest_after_generate():
    # After generate, /latest should return 200
    client.post("/daily-brief/generate", headers=_auth_headers())
    res = client.get("/daily-brief/latest", headers=_auth_headers())
    assert res.status_code == 200
    assert "sections" in res.json()


# ── Duplicates ────────────────────────────────────────────────────────────────

def test_duplicates_list():
    res = client.get("/duplicates", headers=_auth_headers())
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_duplicates_list_by_type():
    res = client.get("/duplicates?entity_type=lead&status=pending", headers=_auth_headers())
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_scan_lead_not_found():
    res = client.post("/duplicates/scan-lead/nonexistent-id", headers=_auth_headers())
    # 200 with found=0 or 404 — both acceptable
    assert res.status_code in (200, 404)


def test_dismiss_duplicate_not_found():
    res = client.post("/duplicates/nonexistent-id/dismiss", headers=_auth_headers())
    assert res.status_code == 404


# ── SLA rules ─────────────────────────────────────────────────────────────────

def test_sla_rules_list_empty():
    res = client.get("/sla-rules", headers=_auth_headers())
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_sla_rules_crud():
    headers = _auth_headers()
    # Create
    body = {"name": "Lead 24h SLA", "entity_type": "lead", "sla_hours": 24.0}
    res = client.post("/sla-rules", json=body, headers=headers)
    assert res.status_code == 200
    rule = res.json()
    assert rule["name"] == "Lead 24h SLA"
    rule_id = rule["id"]

    # List — should include new rule
    res2 = client.get("/sla-rules", headers=headers)
    assert any(r["id"] == rule_id for r in res2.json())

    # Update
    res3 = client.patch(f"/sla-rules/{rule_id}", json={**body, "sla_hours": 48.0}, headers=headers)
    assert res3.status_code == 200
    assert res3.json()["sla_hours"] == 48.0

    # Delete (soft)
    res4 = client.delete(f"/sla-rules/{rule_id}", headers=headers)
    assert res4.status_code == 204

    # After delete the rule should be inactive / not in active list
    res5 = client.get("/sla-rules", headers=headers)
    active_ids = [r["id"] for r in res5.json() if r.get("active")]
    assert rule_id not in active_ids


def test_sla_run_check():
    res = client.post("/sla-rules/run-check", headers=_auth_headers())
    assert res.status_code == 200


# ── Record permissions ────────────────────────────────────────────────────────

def test_record_permissions_list_empty():
    res = client.get("/permissions/lead/nonexistent-entity", headers=_auth_headers())
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_record_permissions_check():
    res = client.get("/permissions/lead/some-id/check?required=view", headers=_auth_headers())
    assert res.status_code == 200
    data = res.json()
    assert "allowed" in data
    assert "required" in data
    # Managers/owners always pass
    assert data["allowed"] is True


def test_record_permissions_grant_and_revoke():
    headers = _auth_headers()
    entity = "lead"
    entity_id = "test-entity-grant"

    # Grant view to role "employee"
    res = client.post(f"/permissions/{entity}/{entity_id}", json={"permission": "view", "role": "employee"}, headers=headers)
    assert res.status_code == 200
    perm = res.json()
    assert perm["permission"] == "view"
    assert perm["role"] == "employee"

    # List
    res2 = client.get(f"/permissions/{entity}/{entity_id}", headers=headers)
    assert any(p["id"] == perm["id"] for p in res2.json())

    # Revoke
    res3 = client.delete(f"/permissions/{entity}/{entity_id}?role=employee", headers=headers)
    assert res3.status_code == 204

    # List should now be empty for this entity
    res4 = client.get(f"/permissions/{entity}/{entity_id}", headers=headers)
    assert res4.json() == []
