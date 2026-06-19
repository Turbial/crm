import enum
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Text, Integer, Float, Boolean, Enum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


def uid() -> str:
    return str(uuid.uuid4())

class UserRole(str, enum.Enum):
    owner = "owner"
    manager = "manager"
    employee = "employee"
    agent = "agent"

class LeadStatus(str, enum.Enum):
    new = "new"
    contacted = "contacted"
    qualified = "qualified"
    appointment = "appointment"
    proposal = "proposal"
    won = "won"
    lost = "lost"

class TaskStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    done = "done"
    canceled = "canceled"

class TaskPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"

class Channel(str, enum.Enum):
    email = "email"
    sms = "sms"
    call = "call"
    chat = "chat"
    social = "social"
    internal = "internal"

class Direction(str, enum.Enum):
    inbound = "inbound"
    outbound = "outbound"
    internal = "internal"

class OpportunityStage(str, enum.Enum):
    discovery = "discovery"
    quoted = "quoted"
    negotiation = "negotiation"
    won = "won"
    lost = "lost"

class AgentActionStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"
    blocked = "blocked"

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    industry: Mapped[str | None] = mapped_column(String(100))
    plan: Mapped[str] = mapped_column(String(50), default="starter")
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    users: Mapped[list["User"]] = relationship(back_populates="organization")

class User(Base, TimestampMixin):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.owner)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    organization: Mapped[Organization] = relationship(back_populates="users")

class Lead(Base, TimestampMixin):
    __tablename__ = "leads"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    company: Mapped[str | None] = mapped_column(String(200))
    email: Mapped[str | None] = mapped_column(String(255), index=True)
    phone: Mapped[str | None] = mapped_column(String(50), index=True)
    source: Mapped[str] = mapped_column(String(100), default="manual")
    status: Mapped[LeadStatus] = mapped_column(Enum(LeadStatus), default=LeadStatus.new, index=True)
    score: Mapped[int] = mapped_column(Integer, default=0)
    address: Mapped[str | None] = mapped_column(String(255))
    city: Mapped[str | None] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(String(50))
    website: Mapped[str | None] = mapped_column(String(255))
    assigned_to_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    contacts: Mapped[list["Contact"]] = relationship(back_populates="lead", cascade="all, delete-orphan")
    tasks: Mapped[list["Task"]] = relationship(back_populates="lead", cascade="all, delete-orphan")
    communications: Mapped[list["Communication"]] = relationship(back_populates="lead", cascade="all, delete-orphan")
    opportunities: Mapped[list["Opportunity"]] = relationship(back_populates="lead", cascade="all, delete-orphan")

class Contact(Base, TimestampMixin):
    __tablename__ = "contacts"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    lead_id: Mapped[str | None] = mapped_column(ForeignKey("leads.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    title: Mapped[str | None] = mapped_column(String(100))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50))
    lead: Mapped[Lead | None] = relationship(back_populates="contacts")

class Opportunity(Base, TimestampMixin):
    __tablename__ = "opportunities"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    lead_id: Mapped[str] = mapped_column(ForeignKey("leads.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    value: Mapped[float] = mapped_column(Float, default=0)
    stage: Mapped[OpportunityStage] = mapped_column(Enum(OpportunityStage), default=OpportunityStage.discovery)
    probability: Mapped[int] = mapped_column(Integer, default=25)
    lead: Mapped[Lead] = relationship(back_populates="opportunities")

class Task(Base, TimestampMixin):
    __tablename__ = "tasks"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    lead_id: Mapped[str | None] = mapped_column(ForeignKey("leads.id"), nullable=True, index=True)
    owner_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[TaskStatus] = mapped_column(Enum(TaskStatus), default=TaskStatus.open)
    priority: Mapped[TaskPriority] = mapped_column(Enum(TaskPriority), default=TaskPriority.medium)
    due_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    lead: Mapped[Lead | None] = relationship(back_populates="tasks")

class Communication(Base, TimestampMixin):
    __tablename__ = "communications"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    lead_id: Mapped[str | None] = mapped_column(ForeignKey("leads.id"), nullable=True, index=True)
    channel: Mapped[Channel] = mapped_column(Enum(Channel))
    direction: Mapped[Direction] = mapped_column(Enum(Direction))
    subject: Mapped[str | None] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)
    provider_message_id: Mapped[str | None] = mapped_column(String(255))
    lead: Mapped[Lead | None] = relationship(back_populates="communications")

class Note(Base, TimestampMixin):
    __tablename__ = "notes"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    lead_id: Mapped[str | None] = mapped_column(ForeignKey("leads.id"), nullable=True, index=True)
    author_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    content: Mapped[str] = mapped_column(Text)
    is_agent_note: Mapped[bool] = mapped_column(Boolean, default=False)

class AgentAction(Base, TimestampMixin):
    __tablename__ = "agent_actions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    lead_id: Mapped[str | None] = mapped_column(ForeignKey("leads.id"), nullable=True, index=True)
    agent_name: Mapped[str] = mapped_column(String(100), index=True)
    action_type: Mapped[str] = mapped_column(String(100))
    instruction: Mapped[str] = mapped_column(Text)
    result: Mapped[str | None] = mapped_column(Text)
    status: Mapped[AgentActionStatus] = mapped_column(Enum(AgentActionStatus), default=AgentActionStatus.queued)
    cost_cents: Mapped[int] = mapped_column(Integer, default=0)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)

class CampaignStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    paused = "paused"
    completed = "completed"

class WorkflowStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    paused = "paused"

class AppointmentStatus(str, enum.Enum):
    scheduled = "scheduled"
    completed = "completed"
    no_show = "no_show"
    canceled = "canceled"

class QuoteStatus(str, enum.Enum):
    draft = "draft"
    sent = "sent"
    accepted = "accepted"
    rejected = "rejected"

class ReviewStatus(str, enum.Enum):
    requested = "requested"
    clicked = "clicked"
    completed = "completed"
    private_feedback = "private_feedback"

class IntegrationStatus(str, enum.Enum):
    disconnected = "disconnected"
    connected = "connected"
    error = "error"

class Campaign(Base, TimestampMixin):
    __tablename__ = "campaigns"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    channel: Mapped[Channel] = mapped_column(Enum(Channel), default=Channel.email)
    status: Mapped[CampaignStatus] = mapped_column(Enum(CampaignStatus), default=CampaignStatus.draft)
    audience: Mapped[str | None] = mapped_column(String(200))
    goal: Mapped[str | None] = mapped_column(String(255))
    message_template: Mapped[str] = mapped_column(Text, default="")
    sent_count: Mapped[int] = mapped_column(Integer, default=0)
    reply_count: Mapped[int] = mapped_column(Integer, default=0)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)

class Workflow(Base, TimestampMixin):
    __tablename__ = "workflows"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    trigger: Mapped[str] = mapped_column(String(100), default="lead_created")
    status: Mapped[WorkflowStatus] = mapped_column(Enum(WorkflowStatus), default=WorkflowStatus.draft)
    description: Mapped[str | None] = mapped_column(Text)
    steps: Mapped[list["WorkflowStep"]] = relationship(back_populates="workflow", cascade="all, delete-orphan")

class WorkflowStep(Base, TimestampMixin):
    __tablename__ = "workflow_steps"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    workflow_id: Mapped[str] = mapped_column(ForeignKey("workflows.id"), index=True)
    position: Mapped[int] = mapped_column(Integer, default=1)
    action_type: Mapped[str] = mapped_column(String(100))
    instruction: Mapped[str] = mapped_column(Text)
    wait_minutes: Mapped[int] = mapped_column(Integer, default=0)
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    workflow: Mapped[Workflow] = relationship(back_populates="steps")

class InboxThread(Base, TimestampMixin):
    __tablename__ = "inbox_threads"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    lead_id: Mapped[str | None] = mapped_column(ForeignKey("leads.id"), nullable=True, index=True)
    channel: Mapped[Channel] = mapped_column(Enum(Channel))
    subject: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(50), default="open")
    last_message_preview: Mapped[str | None] = mapped_column(String(500))

class Appointment(Base, TimestampMixin):
    __tablename__ = "appointments"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    lead_id: Mapped[str | None] = mapped_column(ForeignKey("leads.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    starts_at: Mapped[datetime] = mapped_column(DateTime)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[AppointmentStatus] = mapped_column(Enum(AppointmentStatus), default=AppointmentStatus.scheduled)
    location: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)

class ProductService(Base, TimestampMixin):
    __tablename__ = "products_services"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    price: Mapped[float] = mapped_column(Float, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

class Quote(Base, TimestampMixin):
    __tablename__ = "quotes"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    lead_id: Mapped[str | None] = mapped_column(ForeignKey("leads.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    status: Mapped[QuoteStatus] = mapped_column(Enum(QuoteStatus), default=QuoteStatus.draft)
    subtotal: Mapped[float] = mapped_column(Float, default=0)
    discount: Mapped[float] = mapped_column(Float, default=0)
    total: Mapped[float] = mapped_column(Float, default=0)
    line_items: Mapped[list] = mapped_column(JSON, default=list)

class ReviewRequest(Base, TimestampMixin):
    __tablename__ = "review_requests"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    lead_id: Mapped[str | None] = mapped_column(ForeignKey("leads.id"), nullable=True, index=True)
    customer_name: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(255))
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[ReviewStatus] = mapped_column(Enum(ReviewStatus), default=ReviewStatus.requested)
    public_review_url: Mapped[str | None] = mapped_column(String(500))
    private_feedback: Mapped[str | None] = mapped_column(Text)

class IntegrationConnection(Base, TimestampMixin):
    __tablename__ = "integration_connections"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    provider: Mapped[str] = mapped_column(String(100))
    status: Mapped[IntegrationStatus] = mapped_column(Enum(IntegrationStatus), default=IntegrationStatus.disconnected)
    external_account: Mapped[str | None] = mapped_column(String(255))
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


# -------- Enterprise expansion: field service + AI ops + finance + retention --------
class PipelineStatus(str, enum.Enum):
    active = "active"
    archived = "archived"

class InvoiceStatus(str, enum.Enum):
    draft = "draft"
    sent = "sent"
    paid = "paid"
    overdue = "overdue"
    void = "void"

class PaymentStatus(str, enum.Enum):
    pending = "pending"
    succeeded = "succeeded"
    failed = "failed"
    refunded = "refunded"

class JobStatus(str, enum.Enum):
    requested = "requested"
    scheduled = "scheduled"
    in_progress = "in_progress"
    completed = "completed"
    canceled = "canceled"

class SubscriptionStatus(str, enum.Enum):
    trialing = "trialing"
    active = "active"
    past_due = "past_due"
    canceled = "canceled"

class TicketStatus(str, enum.Enum):
    open = "open"
    waiting = "waiting"
    resolved = "resolved"
    closed = "closed"

class Pipeline(Base, TimestampMixin):
    __tablename__ = "pipelines"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    status: Mapped[PipelineStatus] = mapped_column(Enum(PipelineStatus), default=PipelineStatus.active)
    stages: Mapped[list] = mapped_column(JSON, default=list)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)

class Tag(Base, TimestampMixin):
    __tablename__ = "tags"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(100), index=True)
    color: Mapped[str | None] = mapped_column(String(20))

class LeadTag(Base, TimestampMixin):
    __tablename__ = "lead_tags"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    lead_id: Mapped[str] = mapped_column(ForeignKey("leads.id"), index=True)
    tag_id: Mapped[str] = mapped_column(ForeignKey("tags.id"), index=True)

class Segment(Base, TimestampMixin):
    __tablename__ = "segments"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    filter_json: Mapped[dict] = mapped_column(JSON, default=dict)

class WebForm(Base, TimestampMixin):
    __tablename__ = "web_forms"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(200), index=True)
    fields: Mapped[list] = mapped_column(JSON, default=list)
    success_message: Mapped[str] = mapped_column(String(500), default="Thanks — we received your request.")
    active: Mapped[bool] = mapped_column(Boolean, default=True)

class Website(Base, TimestampMixin):
    __tablename__ = "websites"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    domain: Mapped[str | None] = mapped_column(String(255), index=True)
    subdomain: Mapped[str | None] = mapped_column(String(255), index=True)
    status: Mapped[str] = mapped_column(String(50), default="draft")
    industry: Mapped[str | None] = mapped_column(String(100))
    pages: Mapped[list] = mapped_column(JSON, default=list)
    seo_json: Mapped[dict] = mapped_column(JSON, default=dict)

class LandingPage(Base, TimestampMixin):
    __tablename__ = "landing_pages"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    campaign_id: Mapped[str | None] = mapped_column(ForeignKey("campaigns.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(255), index=True)
    content_json: Mapped[dict] = mapped_column(JSON, default=dict)
    published: Mapped[bool] = mapped_column(Boolean, default=False)

class Job(Base, TimestampMixin):
    __tablename__ = "jobs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    lead_id: Mapped[str | None] = mapped_column(ForeignKey("leads.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.requested)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    address: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)
    checklist: Mapped[list] = mapped_column(JSON, default=list)

class Invoice(Base, TimestampMixin):
    __tablename__ = "invoices"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    lead_id: Mapped[str | None] = mapped_column(ForeignKey("leads.id"), nullable=True, index=True)
    job_id: Mapped[str | None] = mapped_column(ForeignKey("jobs.id"), nullable=True, index=True)
    number: Mapped[str] = mapped_column(String(50), index=True)
    status: Mapped[InvoiceStatus] = mapped_column(Enum(InvoiceStatus), default=InvoiceStatus.draft)
    due_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    subtotal: Mapped[float] = mapped_column(Float, default=0)
    tax: Mapped[float] = mapped_column(Float, default=0)
    total: Mapped[float] = mapped_column(Float, default=0)
    line_items: Mapped[list] = mapped_column(JSON, default=list)

class Payment(Base, TimestampMixin):
    __tablename__ = "payments"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    invoice_id: Mapped[str | None] = mapped_column(ForeignKey("invoices.id"), nullable=True, index=True)
    provider: Mapped[str] = mapped_column(String(100), default="manual")
    amount: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.pending)
    external_id: Mapped[str | None] = mapped_column(String(255))
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)

class Subscription(Base, TimestampMixin):
    __tablename__ = "subscriptions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    plan_name: Mapped[str] = mapped_column(String(100))
    status: Mapped[SubscriptionStatus] = mapped_column(Enum(SubscriptionStatus), default=SubscriptionStatus.trialing)
    amount_monthly: Mapped[float] = mapped_column(Float, default=0)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    provider_subscription_id: Mapped[str | None] = mapped_column(String(255))

class SupportTicket(Base, TimestampMixin):
    __tablename__ = "support_tickets"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    lead_id: Mapped[str | None] = mapped_column(ForeignKey("leads.id"), nullable=True, index=True)
    subject: Mapped[str] = mapped_column(String(255))
    status: Mapped[TicketStatus] = mapped_column(Enum(TicketStatus), default=TicketStatus.open)
    priority: Mapped[TaskPriority] = mapped_column(Enum(TaskPriority), default=TaskPriority.medium)
    description: Mapped[str | None] = mapped_column(Text)

class Document(Base, TimestampMixin):
    __tablename__ = "documents"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    lead_id: Mapped[str | None] = mapped_column(ForeignKey("leads.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    kind: Mapped[str] = mapped_column(String(100), default="note")
    storage_url: Mapped[str | None] = mapped_column(String(500))
    content_text: Mapped[str | None] = mapped_column(Text)

class Notification(Base, TimestampMixin):
    __tablename__ = "notifications"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str | None] = mapped_column(Text)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    action_url: Mapped[str | None] = mapped_column(String(500))

class AutomationRun(Base, TimestampMixin):
    __tablename__ = "automation_runs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    workflow_id: Mapped[str | None] = mapped_column(ForeignKey("workflows.id"), nullable=True, index=True)
    status: Mapped[AgentActionStatus] = mapped_column(Enum(AgentActionStatus), default=AgentActionStatus.queued)
    trigger_payload: Mapped[dict] = mapped_column(JSON, default=dict)
    log: Mapped[list] = mapped_column(JSON, default=list)

class AgentMemory(Base, TimestampMixin):
    __tablename__ = "agent_memories"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    agent_name: Mapped[str] = mapped_column(String(100), index=True)
    key: Mapped[str] = mapped_column(String(200), index=True)
    value_json: Mapped[dict] = mapped_column(JSON, default=dict)
    source: Mapped[str | None] = mapped_column(String(200))

class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    actor_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    actor_type: Mapped[str] = mapped_column(String(50), default="user")
    event: Mapped[str] = mapped_column(String(200))
    entity_type: Mapped[str | None] = mapped_column(String(100))
    entity_id: Mapped[str | None] = mapped_column(String(100))
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)


class MessengerChannel(str, enum.Enum):
    web = "web"
    sms = "sms"
    whatsapp = "whatsapp"
    telegram = "telegram"
    slack = "slack"
    internal = "internal"

class CommandStatus(str, enum.Enum):
    received = "received"
    parsed = "parsed"
    running = "running"
    completed = "completed"
    failed = "failed"
    needs_approval = "needs_approval"

class MessengerThread(Base, TimestampMixin):
    __tablename__ = "messenger_threads"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    owner_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    channel: Mapped[MessengerChannel] = mapped_column(Enum(MessengerChannel), default=MessengerChannel.web)
    external_thread_id: Mapped[str | None] = mapped_column(String(255), index=True)
    title: Mapped[str] = mapped_column(String(255), default="Mighty Command")
    status: Mapped[str] = mapped_column(String(50), default="open")
    context_json: Mapped[dict] = mapped_column(JSON, default=dict)

class MessengerMessage(Base, TimestampMixin):
    __tablename__ = "messenger_messages"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    thread_id: Mapped[str] = mapped_column(ForeignKey("messenger_threads.id"), index=True)
    sender_type: Mapped[str] = mapped_column(String(50), default="user")  # user | assistant | agent | system
    sender_name: Mapped[str | None] = mapped_column(String(120))
    body: Mapped[str] = mapped_column(Text)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)

class CommandExecution(Base, TimestampMixin):
    __tablename__ = "command_executions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    thread_id: Mapped[str | None] = mapped_column(ForeignKey("messenger_threads.id"), nullable=True, index=True)
    message_id: Mapped[str | None] = mapped_column(ForeignKey("messenger_messages.id"), nullable=True, index=True)
    actor_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    raw_text: Mapped[str] = mapped_column(Text)
    intent: Mapped[str] = mapped_column(String(100), default="unknown")
    status: Mapped[CommandStatus] = mapped_column(Enum(CommandStatus), default=CommandStatus.received)
    target_type: Mapped[str | None] = mapped_column(String(100))
    target_id: Mapped[str | None] = mapped_column(String(100))
    plan_json: Mapped[dict] = mapped_column(JSON, default=dict)
    result_json: Mapped[dict] = mapped_column(JSON, default=dict)
    error: Mapped[str | None] = mapped_column(Text)
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=False)

class CommandTemplate(Base, TimestampMixin):
    __tablename__ = "command_templates"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    example_text: Mapped[str] = mapped_column(Text)
    intent: Mapped[str] = mapped_column(String(100))
    config_json: Mapped[dict] = mapped_column(JSON, default=dict)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

# -------- Mighty PM expansion: projects, milestones, dependencies, agent-native delivery --------
class ProjectStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    blocked = "blocked"
    completed = "completed"
    archived = "archived"

class ProjectPriority(str, enum.Enum):
    low = "low"
    normal = "normal"
    high = "high"
    urgent = "urgent"

class ProjectType(str, enum.Enum):
    website = "website"
    marketing = "marketing"
    crm_setup = "crm_setup"
    review_latch = "review_latch"
    app_development = "app_development"
    operations = "operations"
    custom = "custom"

class PMTaskStatus(str, enum.Enum):
    backlog = "backlog"
    ready = "ready"
    in_progress = "in_progress"
    review = "review"
    blocked = "blocked"
    done = "done"
    canceled = "canceled"

class AssigneeType(str, enum.Enum):
    human = "human"
    agent = "agent"
    team = "team"

class ApprovalStatus(str, enum.Enum):
    requested = "requested"
    approved = "approved"
    rejected = "rejected"
    canceled = "canceled"

class ProjectTemplate(Base, TimestampMixin):
    __tablename__ = "project_templates"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    project_type: Mapped[ProjectType] = mapped_column(Enum(ProjectType), default=ProjectType.custom)
    description: Mapped[str | None] = mapped_column(Text)
    default_agent: Mapped[str | None] = mapped_column(String(100))
    blueprint: Mapped[dict] = mapped_column(JSON, default=dict)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

class Project(Base, TimestampMixin):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    lead_id: Mapped[str | None] = mapped_column(ForeignKey("leads.id"), nullable=True, index=True)
    opportunity_id: Mapped[str | None] = mapped_column(ForeignKey("opportunities.id"), nullable=True, index=True)
    template_id: Mapped[str | None] = mapped_column(ForeignKey("project_templates.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    project_type: Mapped[ProjectType] = mapped_column(Enum(ProjectType), default=ProjectType.custom)
    status: Mapped[ProjectStatus] = mapped_column(Enum(ProjectStatus), default=ProjectStatus.active, index=True)
    priority: Mapped[ProjectPriority] = mapped_column(Enum(ProjectPriority), default=ProjectPriority.normal)
    owner_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    goal: Mapped[str | None] = mapped_column(Text)
    budget_cents: Mapped[int] = mapped_column(Integer, default=0)
    actual_cost_cents: Mapped[int] = mapped_column(Integer, default=0)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    milestones: Mapped[list["ProjectMilestone"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    tasks: Mapped[list["PMTask"]] = relationship(back_populates="project", cascade="all, delete-orphan")

class ProjectMilestone(Base, TimestampMixin):
    __tablename__ = "project_milestones"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[PMTaskStatus] = mapped_column(Enum(PMTaskStatus), default=PMTaskStatus.ready)
    due_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    project: Mapped[Project] = relationship(back_populates="milestones")


class KanbanColumn(Base, TimestampMixin):
    """Per-project Kanban column configuration.

    Columns map to PMTaskStatus but allow Mighty PM to expose a real board
    with custom labels, ordering, WIP limits, and automation metadata.
    """
    __tablename__ = "kanban_columns"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    key: Mapped[str] = mapped_column(String(80), index=True)
    label: Mapped[str] = mapped_column(String(120))
    mapped_status: Mapped[PMTaskStatus] = mapped_column(Enum(PMTaskStatus), default=PMTaskStatus.ready, index=True)
    position: Mapped[int] = mapped_column(Integer, default=1)
    wip_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_done_column: Mapped[bool] = mapped_column(Boolean, default=False)
    automation_json: Mapped[dict] = mapped_column(JSON, default=dict)

class PMTask(Base, TimestampMixin):
    __tablename__ = "pm_tasks"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    milestone_id: Mapped[str | None] = mapped_column(ForeignKey("project_milestones.id"), nullable=True, index=True)
    parent_task_id: Mapped[str | None] = mapped_column(ForeignKey("pm_tasks.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[PMTaskStatus] = mapped_column(Enum(PMTaskStatus), default=PMTaskStatus.ready, index=True)
    priority: Mapped[ProjectPriority] = mapped_column(Enum(ProjectPriority), default=ProjectPriority.normal)
    assignee_type: Mapped[AssigneeType] = mapped_column(Enum(AssigneeType), default=AssigneeType.agent)
    assignee_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    assignee_agent: Mapped[str | None] = mapped_column(String(100), index=True)
    estimate_minutes: Mapped[int] = mapped_column(Integer, default=0)
    actual_minutes: Mapped[int] = mapped_column(Integer, default=0)
    cost_cents: Mapped[int] = mapped_column(Integer, default=0)
    output_summary: Mapped[str | None] = mapped_column(Text)
    artifact_urls: Mapped[list] = mapped_column(JSON, default=list)
    due_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=False)
    blocked_reason: Mapped[str | None] = mapped_column(Text)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    project: Mapped[Project] = relationship(back_populates="tasks")

class PMTaskDependency(Base, TimestampMixin):
    __tablename__ = "pm_task_dependencies"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    task_id: Mapped[str] = mapped_column(ForeignKey("pm_tasks.id"), index=True)
    depends_on_task_id: Mapped[str] = mapped_column(ForeignKey("pm_tasks.id"), index=True)
    dependency_type: Mapped[str] = mapped_column(String(50), default="finish_to_start")

class ProjectComment(Base, TimestampMixin):
    __tablename__ = "project_comments"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    task_id: Mapped[str | None] = mapped_column(ForeignKey("pm_tasks.id"), nullable=True, index=True)
    author_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    author_agent: Mapped[str | None] = mapped_column(String(100))
    body: Mapped[str] = mapped_column(Text)
    visibility: Mapped[str] = mapped_column(String(50), default="internal")

class ProjectFile(Base, TimestampMixin):
    __tablename__ = "project_files"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    task_id: Mapped[str | None] = mapped_column(ForeignKey("pm_tasks.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    kind: Mapped[str] = mapped_column(String(100), default="artifact")
    storage_url: Mapped[str | None] = mapped_column(String(500))
    content_text: Mapped[str | None] = mapped_column(Text)

class ProjectApproval(Base, TimestampMixin):
    __tablename__ = "project_approvals"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    task_id: Mapped[str | None] = mapped_column(ForeignKey("pm_tasks.id"), nullable=True, index=True)
    requested_by_agent: Mapped[str | None] = mapped_column(String(100))
    requested_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    approver_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(255))
    request_body: Mapped[str | None] = mapped_column(Text)
    status: Mapped[ApprovalStatus] = mapped_column(Enum(ApprovalStatus), default=ApprovalStatus.requested, index=True)
    decision_note: Mapped[str | None] = mapped_column(Text)

class TimeEntry(Base, TimestampMixin):
    __tablename__ = "time_entries"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    task_id: Mapped[str | None] = mapped_column(ForeignKey("pm_tasks.id"), nullable=True, index=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    agent_name: Mapped[str | None] = mapped_column(String(100))
    minutes: Mapped[int] = mapped_column(Integer, default=0)
    note: Mapped[str | None] = mapped_column(Text)

# -------- PM Triple Expansion: portfolio, sprints, workload, risks, change control --------
class PortfolioStatus(str, enum.Enum):
    active = "active"
    paused = "paused"
    completed = "completed"
    archived = "archived"

class RiskSeverity(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"

class RiskStatus(str, enum.Enum):
    open = "open"
    mitigating = "mitigating"
    resolved = "resolved"
    accepted = "accepted"

class SprintStatus(str, enum.Enum):
    planned = "planned"
    active = "active"
    completed = "completed"
    canceled = "canceled"

class ChangeRequestStatus(str, enum.Enum):
    requested = "requested"
    approved = "approved"
    rejected = "rejected"
    implemented = "implemented"

class ProjectPortfolio(Base, TimestampMixin):
    __tablename__ = "project_portfolios"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[PortfolioStatus] = mapped_column(Enum(PortfolioStatus), default=PortfolioStatus.active, index=True)
    owner_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    budget_cents: Mapped[int] = mapped_column(Integer, default=0)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)

class PortfolioProject(Base, TimestampMixin):
    __tablename__ = "portfolio_projects"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    portfolio_id: Mapped[str] = mapped_column(ForeignKey("project_portfolios.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    weight: Mapped[int] = mapped_column(Integer, default=1)

class ProjectSprint(Base, TimestampMixin):
    __tablename__ = "project_sprints"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    goal: Mapped[str | None] = mapped_column(Text)
    status: Mapped[SprintStatus] = mapped_column(Enum(SprintStatus), default=SprintStatus.planned, index=True)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    capacity_minutes: Mapped[int] = mapped_column(Integer, default=0)

class SprintTask(Base, TimestampMixin):
    __tablename__ = "sprint_tasks"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    sprint_id: Mapped[str] = mapped_column(ForeignKey("project_sprints.id"), index=True)
    task_id: Mapped[str] = mapped_column(ForeignKey("pm_tasks.id"), index=True)
    position: Mapped[int] = mapped_column(Integer, default=1)

class ProjectRisk(Base, TimestampMixin):
    __tablename__ = "project_risks"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    task_id: Mapped[str | None] = mapped_column(ForeignKey("pm_tasks.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    severity: Mapped[RiskSeverity] = mapped_column(Enum(RiskSeverity), default=RiskSeverity.medium, index=True)
    status: Mapped[RiskStatus] = mapped_column(Enum(RiskStatus), default=RiskStatus.open, index=True)
    mitigation_plan: Mapped[str | None] = mapped_column(Text)
    owner_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    owner_agent: Mapped[str | None] = mapped_column(String(100))
    due_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

class ProjectChangeRequest(Base, TimestampMixin):
    __tablename__ = "project_change_requests"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[ChangeRequestStatus] = mapped_column(Enum(ChangeRequestStatus), default=ChangeRequestStatus.requested, index=True)
    requested_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    requested_by_agent: Mapped[str | None] = mapped_column(String(100))
    impact_budget_cents: Mapped[int] = mapped_column(Integer, default=0)
    impact_minutes: Mapped[int] = mapped_column(Integer, default=0)
    decision_note: Mapped[str | None] = mapped_column(Text)

class WorkloadAllocation(Base, TimestampMixin):
    __tablename__ = "workload_allocations"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    assignee_type: Mapped[AssigneeType] = mapped_column(Enum(AssigneeType), default=AssigneeType.agent)
    assignee_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    assignee_agent: Mapped[str | None] = mapped_column(String(100), index=True)
    capacity_minutes_per_week: Mapped[int] = mapped_column(Integer, default=1200)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

class ProjectAutomationRule(Base, TimestampMixin):
    __tablename__ = "project_automation_rules"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    trigger: Mapped[str] = mapped_column(String(100), default="task_done")
    condition_json: Mapped[dict] = mapped_column(JSON, default=dict)
    action_json: Mapped[dict] = mapped_column(JSON, default=dict)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
