from app.models import Lead
from app.services.lead_scoring import score_lead, recommended_next_action

def test_score_lead_with_contact_channels():
    lead = Lead(organization_id="org", name="Test", email="a@b.com", phone="123", score=20)
    out = score_lead(lead, [], [])
    assert out.score >= 45
    assert "has phone" in out.reasons

def test_next_action_first_touch():
    lead = Lead(organization_id="org", name="Test", email="a@b.com", phone="123")
    action = recommended_next_action(lead, [])
    assert action["action"] == "first_touch"
