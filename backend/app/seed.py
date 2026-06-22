from datetime import datetime, timedelta
from app.database import Base, engine, SessionLocal
from app.models import (
    Organization, User, Lead, Task, Communication, Opportunity, AgentAction,
    Campaign, Workflow, WorkflowStep, InboxThread, Appointment, ProductService,
    Quote, ReviewRequest, IntegrationConnection, MessengerThread, MessengerMessage, CommandTemplate
)
from app.models import (
    LeadStatus, Channel, Direction, OpportunityStage, AgentActionStatus, UserRole,
    TaskPriority, CampaignStatus, WorkflowStatus, AppointmentStatus, QuoteStatus,
    ReviewStatus, IntegrationStatus,
)
from app.security import hash_password


def seed():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        org = Organization(name="MightyMax Demo Roofing", industry="roofing", plan="agent", settings={"timezone":"America/Los_Angeles", "brand":"MightyMax"})
        db.add(org); db.flush()
        user = User(organization_id=org.id, name="Marcus Owner", email="owner@mightymax.ai", password_hash=hash_password("mighty123"), role=UserRole.owner, email_verified=True)
        agent_user = User(organization_id=org.id, name="Mighty Sales Agent", email="sales-agent@mightymax.ai", password_hash=hash_password("mighty123"), role=UserRole.agent, email_verified=True)
        db.add_all([user, agent_user]); db.flush()

        leads = [
            Lead(organization_id=org.id, name="John Smith", company="Smith Residence", email="john@example.com", phone="+13105550101", source="website", status=LeadStatus.new, score=82, city="Torrance", state="CA", website="https://example.com", metadata_json={"need":"roof repair", "budget":"unknown"}),
            Lead(organization_id=org.id, name="Maria Lopez", company="Lopez Properties", email="maria@example.com", phone="+13105550102", source="google_maps", status=LeadStatus.contacted, score=74, city="Lomita", state="CA", metadata_json={"asset":"rental portfolio"}),
            Lead(organization_id=org.id, name="Tom Baker", company="Baker Auto", email="tom@example.com", phone="+13105550103", source="cold_call", status=LeadStatus.appointment, score=91, city="Redondo Beach", state="CA"),
            Lead(organization_id=org.id, name="Ava Chen", company="Chen Apartments", email="ava@example.com", phone="+13105550104", source="review_campaign", status=LeadStatus.qualified, score=88, city="San Pedro", state="CA"),
        ]
        db.add_all(leads); db.flush()

        services = [
            ProductService(organization_id=org.id, name="Roof inspection", description="Drone/photo roof inspection", price=99),
            ProductService(organization_id=org.id, name="Emergency leak repair", description="Same-day leak response", price=650),
            ProductService(organization_id=org.id, name="Full roof replacement", description="Complete replacement package", price=12500),
        ]
        db.add_all(services); db.flush()

        wf = Workflow(organization_id=org.id, name="New Lead 5-Touch Follow-up", trigger="lead_created", status=WorkflowStatus.active, description="Call, SMS, email, then appointment booking.")
        db.add(wf); db.flush()
        db.add_all([
            WorkflowStep(organization_id=org.id, workflow_id=wf.id, position=1, action_type="call", instruction="Call the lead and qualify the job", wait_minutes=0),
            WorkflowStep(organization_id=org.id, workflow_id=wf.id, position=2, action_type="sms", instruction="Send polite SMS if no answer", wait_minutes=5),
            WorkflowStep(organization_id=org.id, workflow_id=wf.id, position=3, action_type="email", instruction="Send website/estimate follow-up", wait_minutes=1440),
        ])

        db.add_all([
            Task(organization_id=org.id, lead_id=leads[0].id, owner_user_id=user.id, title="Call John about roof estimate", priority=TaskPriority.high),
            Task(organization_id=org.id, lead_id=leads[1].id, owner_user_id=user.id, title="Send website promo follow-up", priority=TaskPriority.medium),
            Communication(organization_id=org.id, lead_id=leads[1].id, channel=Channel.sms, direction=Direction.outbound, subject="Follow-up", content="Hi Maria, checking if you want the free website preview."),
            Opportunity(organization_id=org.id, lead_id=leads[2].id, title="Roof replacement", value=12500, stage=OpportunityStage.quoted, probability=60),
            Opportunity(organization_id=org.id, lead_id=leads[3].id, title="Apartment building roof inspection", value=2500, stage=OpportunityStage.discovery, probability=35),
            AgentAction(organization_id=org.id, lead_id=leads[1].id, agent_name="SalesAgent", action_type="send_sms", instruction="Follow up on website preview", result="SMS sent", status=AgentActionStatus.completed, cost_cents=1, duration_ms=230),
            Campaign(organization_id=org.id, name="June Free Roof Inspection", channel=Channel.sms, status=CampaignStatus.active, audience="Past customers + new homeowners", goal="Book 20 inspections", message_template="Hi {{name}}, Mighty Roofing is offering a free roof check this week."),
            Campaign(organization_id=org.id, name="Review Request Push", channel=Channel.email, status=CampaignStatus.active, audience="Completed jobs", goal="Generate 25 Google reviews", message_template="Thanks for choosing us. Could you leave a quick review?"),
            InboxThread(organization_id=org.id, lead_id=leads[0].id, channel=Channel.chat, subject="Website chat: roof leak", status="open", last_message_preview="Do you service Torrance today?"),
            Appointment(organization_id=org.id, lead_id=leads[2].id, title="Roof estimate with Tom", starts_at=datetime.utcnow() + timedelta(hours=3), ends_at=datetime.utcnow() + timedelta(hours=4), status=AppointmentStatus.scheduled, location="Redondo Beach"),
            Quote(organization_id=org.id, lead_id=leads[2].id, title="Baker Auto roof replacement quote", status=QuoteStatus.sent, subtotal=12500, discount=500, total=12000, line_items=[{"name":"Full roof replacement", "qty":1, "price":12500}]),
            ReviewRequest(organization_id=org.id, lead_id=leads[3].id, customer_name="Ava Chen", email="ava@example.com", status=ReviewStatus.requested, public_review_url="https://google.com/review"),
            IntegrationConnection(organization_id=org.id, provider="Google Business Profile", status=IntegrationStatus.connected, external_account="Mighty Roofing", config={"reviews": True}),
            IntegrationConnection(organization_id=org.id, provider="Twilio", status=IntegrationStatus.disconnected, external_account=None, config={}),
        ])


        command_thread = MessengerThread(organization_id=org.id, owner_user_id=user.id, channel="web", title="Mighty Command")
        db.add(command_thread); db.flush()
        db.add_all([
            MessengerMessage(organization_id=org.id, thread_id=command_thread.id, sender_type="assistant", sender_name="MightyMax", body="I can control leads, tasks, campaigns, jobs, quotes, reviews, workflows and reports from this messenger."),
            CommandTemplate(organization_id=org.id, name="Daily summary", intent="report", example_text="Show me today's CRM summary", description="Returns key CRM metrics."),
            CommandTemplate(organization_id=org.id, name="New lead", intent="create_lead", example_text="Add lead John Smith john@example.com 310-555-0101", description="Creates a lead directly from text."),
            CommandTemplate(organization_id=org.id, name="Follow-up", intent="bulk_follow_up", example_text="Follow up with all new leads by SMS", description="Queues outreach actions with approval gate for external messages."),
            CommandTemplate(organization_id=org.id, name="Quote", intent="create_quote", example_text="Create a quote for $1200 website redesign", description="Creates a draft quote."),
        ])

        db.commit()
        print("Seeded demo data: owner@mightymax.ai / mighty123")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
