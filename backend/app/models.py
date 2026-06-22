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
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verification_token: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    password_reset_token: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    password_reset_expires: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
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
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)

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


# ============================================================
# Sales & Revenue Intelligence
# ============================================================

class PipelineSnapshot(Base, TimestampMixin):
    """Point-in-time snapshot of pipeline metrics for trend analysis."""
    __tablename__ = "pipeline_snapshots"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    snapshot_date: Mapped[datetime] = mapped_column(DateTime, index=True)
    metrics_json: Mapped[dict] = mapped_column(JSON, default=dict)


# ============================================================
# Automation & Integrations
# ============================================================

class WebhookDeliveryStatus(str, enum.Enum):
    pending = "pending"
    delivered = "delivered"
    failed = "failed"
    retrying = "retrying"

class DripEnrollmentStatus(str, enum.Enum):
    active = "active"
    completed = "completed"
    unsubscribed = "unsubscribed"
    paused = "paused"

class WebhookEndpoint(Base, TimestampMixin):
    """Outbound webhook configuration — org subscribes to events and receives HTTP calls."""
    __tablename__ = "webhook_endpoints"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    url: Mapped[str] = mapped_column(String(500))
    secret: Mapped[str] = mapped_column(String(255))
    events: Mapped[list] = mapped_column(JSON, default=list)   # e.g. ["lead.status_changed"]
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    description: Mapped[str | None] = mapped_column(String(255))
    # Optional entity-level filters — only deliver when payload matches.
    # Format: [{"entity_type": "lead", "entity_id": "abc123"}, ...]
    # Empty list = no filter (receive all matching events).
    entity_filters: Mapped[list] = mapped_column(JSON, default=list)

class WebhookDelivery(Base, TimestampMixin):
    """Record of each outbound webhook attempt."""
    __tablename__ = "webhook_deliveries"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    endpoint_id: Mapped[str] = mapped_column(ForeignKey("webhook_endpoints.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(100), index=True)
    payload_json: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[WebhookDeliveryStatus] = mapped_column(Enum(WebhookDeliveryStatus), default=WebhookDeliveryStatus.pending, index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_response_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_response_body: Mapped[str | None] = mapped_column(Text)
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

class ApiKey(Base, TimestampMixin):
    """API key for programmatic / agent access."""
    __tablename__ = "api_keys"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    key_prefix: Mapped[str] = mapped_column(String(12), index=True)   # visible e.g. "mcrm_abc123"
    key_hash: Mapped[str] = mapped_column(String(255))                 # bcrypt hash of full key
    scopes: Mapped[list] = mapped_column(JSON, default=list)           # ["leads:read", "leads:write"]
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

class DripSequence(Base, TimestampMixin):
    """A named sequence of timed messages sent to enrolled leads."""
    __tablename__ = "drip_sequences"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    channel: Mapped[Channel] = mapped_column(Enum(Channel), default=Channel.email)
    trigger: Mapped[str] = mapped_column(String(100), default="manual")  # "manual", "lead_created", "lead_status_{x}"
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    description: Mapped[str | None] = mapped_column(Text)
    steps: Mapped[list["DripStep"]] = relationship(back_populates="sequence", cascade="all, delete-orphan")

class DripStep(Base, TimestampMixin):
    """A single step in a drip sequence."""
    __tablename__ = "drip_steps"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    sequence_id: Mapped[str] = mapped_column(ForeignKey("drip_sequences.id"), index=True)
    position: Mapped[int] = mapped_column(Integer, default=1)
    delay_hours: Mapped[int] = mapped_column(Integer, default=24)
    subject: Mapped[str | None] = mapped_column(String(255))
    message_template: Mapped[str] = mapped_column(Text, default="")
    sequence: Mapped[DripSequence] = relationship(back_populates="steps")

class DripEnrollment(Base, TimestampMixin):
    """Tracks a lead's progression through a drip sequence."""
    __tablename__ = "drip_enrollments"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    sequence_id: Mapped[str] = mapped_column(ForeignKey("drip_sequences.id"), index=True)
    lead_id: Mapped[str] = mapped_column(ForeignKey("leads.id"), index=True)
    status: Mapped[DripEnrollmentStatus] = mapped_column(Enum(DripEnrollmentStatus), default=DripEnrollmentStatus.active, index=True)
    current_step: Mapped[int] = mapped_column(Integer, default=0)
    next_send_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


# ============================================================
# Communication Hub
# ============================================================

class ScheduledMessageStatus(str, enum.Enum):
    scheduled = "scheduled"
    sent = "sent"
    failed = "failed"
    canceled = "canceled"

class CallDisposition(str, enum.Enum):
    connected = "connected"
    voicemail = "voicemail"
    no_answer = "no_answer"
    busy = "busy"
    wrong_number = "wrong_number"
    callback_requested = "callback_requested"

class ScheduledMessage(Base, TimestampMixin):
    """A message queued for delivery at a future time."""
    __tablename__ = "scheduled_messages"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    lead_id: Mapped[str | None] = mapped_column(ForeignKey("leads.id"), nullable=True, index=True)
    drip_enrollment_id: Mapped[str | None] = mapped_column(ForeignKey("drip_enrollments.id"), nullable=True, index=True)
    channel: Mapped[Channel] = mapped_column(Enum(Channel))
    subject: Mapped[str | None] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)
    send_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    status: Mapped[ScheduledMessageStatus] = mapped_column(Enum(ScheduledMessageStatus), default=ScheduledMessageStatus.scheduled, index=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error: Mapped[str | None] = mapped_column(Text)
    provider_message_id: Mapped[str | None] = mapped_column(String(255))
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)

class CallLog(Base, TimestampMixin):
    """Record of an inbound or outbound call."""
    __tablename__ = "call_logs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    lead_id: Mapped[str | None] = mapped_column(ForeignKey("leads.id"), nullable=True, index=True)
    agent_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    direction: Mapped[Direction] = mapped_column(Enum(Direction))
    disposition: Mapped[CallDisposition] = mapped_column(Enum(CallDisposition), default=CallDisposition.connected, index=True)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    recording_url: Mapped[str | None] = mapped_column(String(500))
    notes: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)

class EmailTemplate(Base, TimestampMixin):
    """Reusable email template with variable substitution support."""
    __tablename__ = "email_templates"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    subject: Mapped[str] = mapped_column(String(255))
    body_html: Mapped[str] = mapped_column(Text, default="")
    body_text: Mapped[str | None] = mapped_column(Text)
    variables: Mapped[list] = mapped_column(JSON, default=list)  # ["lead_name", "company"]
    category: Mapped[str] = mapped_column(String(100), default="general")
    active: Mapped[bool] = mapped_column(Boolean, default=True)


# ============================================================
# Customer Portal & Billing
# ============================================================

class PortalPermission(str, enum.Enum):
    view_quotes = "view_quotes"
    view_invoices = "view_invoices"
    sign_documents = "sign_documents"
    pay_invoices = "pay_invoices"
    view_project_status = "view_project_status"

class ESignatureStatus(str, enum.Enum):
    pending = "pending"
    signed = "signed"
    declined = "declined"
    expired = "expired"

class PaymentLinkStatus(str, enum.Enum):
    active = "active"
    paid = "paid"
    expired = "expired"
    canceled = "canceled"

class PortalToken(Base, TimestampMixin):
    """Secure token granting a customer access to their portal view."""
    __tablename__ = "portal_tokens"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    lead_id: Mapped[str] = mapped_column(ForeignKey("leads.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(255), index=True)  # SHA-256 of raw token
    permissions: Mapped[list] = mapped_column(JSON, default=list)      # list of PortalPermission values
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    last_accessed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

class ESignatureRequest(Base, TimestampMixin):
    """Request for a customer to e-sign a document (quote, contract, etc.)."""
    __tablename__ = "esignature_requests"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    lead_id: Mapped[str | None] = mapped_column(ForeignKey("leads.id"), nullable=True, index=True)
    document_type: Mapped[str] = mapped_column(String(100))   # "quote", "contract", "proposal"
    document_id: Mapped[str | None] = mapped_column(String(100))
    signer_name: Mapped[str] = mapped_column(String(200))
    signer_email: Mapped[str] = mapped_column(String(255))
    token_hash: Mapped[str] = mapped_column(String(255), index=True)
    status: Mapped[ESignatureStatus] = mapped_column(Enum(ESignatureStatus), default=ESignatureStatus.pending, index=True)
    signed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    declined_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    signer_ip: Mapped[str | None] = mapped_column(String(50))
    signature_data: Mapped[str | None] = mapped_column(Text)   # base64 drawn signature or typed name

class PaymentLink(Base, TimestampMixin):
    """Payment link for a quote or invoice — optionally backed by Stripe."""
    __tablename__ = "payment_links"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    lead_id: Mapped[str | None] = mapped_column(ForeignKey("leads.id"), nullable=True, index=True)
    quote_id: Mapped[str | None] = mapped_column(ForeignKey("quotes.id"), nullable=True, index=True)
    invoice_id: Mapped[str | None] = mapped_column(ForeignKey("invoices.id"), nullable=True, index=True)
    amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(10), default="usd")
    description: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[PaymentLinkStatus] = mapped_column(Enum(PaymentLinkStatus), default=PaymentLinkStatus.active, index=True)
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(255), index=True)
    stripe_checkout_url: Mapped[str | None] = mapped_column(String(500))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)

class StripeWebhookEvent(Base, TimestampMixin):
    """Processed Stripe webhook events — stored for idempotency."""
    __tablename__ = "stripe_webhook_events"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str | None] = mapped_column(String(100), index=True)
    stripe_event_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    event_type: Mapped[str] = mapped_column(String(100), index=True)
    processed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    payload_json: Mapped[dict] = mapped_column(JSON, default=dict)


# ============================================================
# Phase 1 — CRM/PM Operating Surfaces
# ============================================================

class Company(Base, TimestampMixin):
    """B2B company entity. Leads, contacts, and deals belong to companies."""
    __tablename__ = "companies"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(300), index=True)
    domain: Mapped[str | None] = mapped_column(String(255), index=True)
    industry: Mapped[str | None] = mapped_column(String(100))
    size: Mapped[str | None] = mapped_column(String(50))   # "1-10", "11-50", "51-200", etc.
    website: Mapped[str | None] = mapped_column(String(500))
    phone: Mapped[str | None] = mapped_column(String(50))
    address: Mapped[str | None] = mapped_column(String(500))
    city: Mapped[str | None] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(String(100))
    country: Mapped[str | None] = mapped_column(String(100))
    owner_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    tags: Mapped[list] = mapped_column(JSON, default=list)
    custom_data: Mapped[dict] = mapped_column(JSON, default=dict)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)


class PipelineStage(Base, TimestampMixin):
    """Configurable stage within a named pipeline."""
    __tablename__ = "pipeline_stages"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    pipeline_id: Mapped[str] = mapped_column(ForeignKey("pipelines.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    position: Mapped[int] = mapped_column(Integer, default=1)
    probability_default: Mapped[int] = mapped_column(Integer, default=25)
    color: Mapped[str | None] = mapped_column(String(20))    # hex color
    is_won_stage: Mapped[bool] = mapped_column(Boolean, default=False)
    is_lost_stage: Mapped[bool] = mapped_column(Boolean, default=False)


class Deal(Base, TimestampMixin):
    """First-class deal entity with full pipeline context."""
    __tablename__ = "deals"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    title: Mapped[str] = mapped_column(String(300))
    lead_id: Mapped[str | None] = mapped_column(ForeignKey("leads.id"), nullable=True, index=True)
    contact_id: Mapped[str | None] = mapped_column(ForeignKey("contacts.id"), nullable=True, index=True)
    company_id: Mapped[str | None] = mapped_column(ForeignKey("companies.id"), nullable=True, index=True)
    pipeline_id: Mapped[str | None] = mapped_column(ForeignKey("pipelines.id"), nullable=True, index=True)
    stage_id: Mapped[str | None] = mapped_column(ForeignKey("pipeline_stages.id"), nullable=True, index=True)
    stage: Mapped[str | None] = mapped_column(String(50), nullable=True)
    value: Mapped[float] = mapped_column(Float, default=0)
    probability: Mapped[int] = mapped_column(Integer, default=25)
    currency: Mapped[str] = mapped_column(String(10), default="usd")
    expected_close_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    owner_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    source: Mapped[str | None] = mapped_column(String(100))
    lost_reason: Mapped[str | None] = mapped_column(String(500))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list] = mapped_column(JSON, default=list)
    custom_data: Mapped[dict] = mapped_column(JSON, default=dict)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class TimelineEvent(Base):
    """Unified activity timeline — one row per significant business event on any entity."""
    __tablename__ = "timeline_events"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(String(100), index=True)
    entity_type: Mapped[str] = mapped_column(String(50), index=True)   # lead/deal/contact/company/project/task
    entity_id: Mapped[str] = mapped_column(String(100), index=True)
    event_type: Mapped[str] = mapped_column(String(100), index=True)
    actor_type: Mapped[str] = mapped_column(String(20), default="system")  # human/agent/system/api/customer
    actor_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    actor_name: Mapped[str | None] = mapped_column(String(200))
    summary: Mapped[str] = mapped_column(Text)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CustomFieldDefinition(Base, TimestampMixin):
    """Org-level custom field definitions per entity type."""
    __tablename__ = "custom_field_definitions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    entity_type: Mapped[str] = mapped_column(String(50), index=True)   # lead/deal/contact/company/project/task
    name: Mapped[str] = mapped_column(String(100))
    key: Mapped[str] = mapped_column(String(100), index=True)    # snake_case identifier
    field_type: Mapped[str] = mapped_column(String(30))   # text/number/date/select/multi_select/checkbox/url/email/phone
    options: Mapped[list] = mapped_column(JSON, default=list)    # for select/multi_select types
    required: Mapped[bool] = mapped_column(Boolean, default=False)
    position: Mapped[int] = mapped_column(Integer, default=1)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class FileAttachment(Base, TimestampMixin):
    """General file attachment for any entity."""
    __tablename__ = "file_attachments"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    entity_type: Mapped[str] = mapped_column(String(50), index=True)
    entity_id: Mapped[str] = mapped_column(String(100), index=True)
    uploaded_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(300))
    mime_type: Mapped[str | None] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    storage_url: Mapped[str] = mapped_column(String(1000))
    thumbnail_url: Mapped[str | None] = mapped_column(String(1000))
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)


class ActionStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    waiting_approval = "waiting_approval"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"
    retrying = "retrying"


class ActionApprovalStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    expired = "expired"


class RiskLevel(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class ActionDefinition(Base, TimestampMixin):
    """Registry of all executable system and org-level actions."""
    __tablename__ = "action_definitions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)  # null = system
    action_key: Mapped[str] = mapped_column(String(100), index=True)   # e.g. "crm.create_lead"
    display_name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(50), index=True)   # crm/pm/billing/messaging/portal/automation
    input_schema: Mapped[dict] = mapped_column(JSON, default=dict)
    output_schema: Mapped[dict] = mapped_column(JSON, default=dict)
    required_role: Mapped[str] = mapped_column(String(50), default="employee")
    approval_required: Mapped[bool] = mapped_column(Boolean, default=False)
    destructive: Mapped[bool] = mapped_column(Boolean, default=False)
    idempotent: Mapped[bool] = mapped_column(Boolean, default=True)
    timeout_seconds: Mapped[int] = mapped_column(Integer, default=60)
    retry_policy: Mapped[dict] = mapped_column(JSON, default=dict)
    owning_service: Mapped[str | None] = mapped_column(String(100))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class ActionRun(Base, TimestampMixin):
    """Operational ledger — every action execution creates one row."""
    __tablename__ = "action_runs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(String(100), index=True)
    action_key: Mapped[str] = mapped_column(String(100), index=True)
    source: Mapped[str] = mapped_column(String(50), index=True)   # messenger/api/workflow/agent/webhook/ui
    source_message_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    requested_by_type: Mapped[str] = mapped_column(String(20), default="human")  # human/agent/system/api
    requested_by_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    actor_type: Mapped[str] = mapped_column(String(20), default="system")
    actor_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    linked_entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    linked_entity_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    input_payload: Mapped[dict] = mapped_column(JSON, default=dict)
    output_payload: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[ActionStatus] = mapped_column(Enum(ActionStatus), default=ActionStatus.pending, index=True)
    approval_status: Mapped[ActionApprovalStatus | None] = mapped_column(Enum(ActionApprovalStatus), nullable=True)
    current_step: Mapped[int] = mapped_column(Integer, default=0)
    logs: Mapped[list] = mapped_column(JSON, default=list)
    artifacts: Mapped[list] = mapped_column(JSON, default=list)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    retries: Mapped[int] = mapped_column(Integer, default=0)
    idempotency_key: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class ApprovalRequest(Base, TimestampMixin):
    """First-class approval — decoupled from any specific entity type."""
    __tablename__ = "approval_requests"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(String(100), index=True)
    action_run_id: Mapped[str | None] = mapped_column(ForeignKey("action_runs.id"), nullable=True, index=True)
    entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    requested_by_type: Mapped[str] = mapped_column(String(20), default="agent")
    requested_by_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    approver_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text)
    proposed_change: Mapped[dict] = mapped_column(JSON, default=dict)
    risk_level: Mapped[RiskLevel] = mapped_column(Enum(RiskLevel), default=RiskLevel.medium, index=True)
    status: Mapped[ActionApprovalStatus] = mapped_column(Enum(ActionApprovalStatus), default=ActionApprovalStatus.pending, index=True)
    decision_note: Mapped[str | None] = mapped_column(Text)
    comments: Mapped[list] = mapped_column(JSON, default=list)
    due_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


# ============================================================
# Phase 2 — Messenger & Conversation Core
# ============================================================

class ConversationStatus(str, enum.Enum):
    open = "open"
    pending = "pending"
    resolved = "resolved"
    snoozed = "snoozed"


class ConversationChannel(str, enum.Enum):
    messenger = "messenger"
    sms = "sms"
    email = "email"
    whatsapp = "whatsapp"
    telegram = "telegram"
    web = "web"
    internal = "internal"


class Conversation(Base, TimestampMixin):
    """Omnichannel conversation container."""
    __tablename__ = "conversations"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    channel: Mapped[ConversationChannel] = mapped_column(Enum(ConversationChannel), default=ConversationChannel.internal, index=True)
    external_thread_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    lead_id: Mapped[str | None] = mapped_column(ForeignKey("leads.id"), nullable=True, index=True)
    contact_id: Mapped[str | None] = mapped_column(ForeignKey("contacts.id"), nullable=True, index=True)
    company_id: Mapped[str | None] = mapped_column(ForeignKey("companies.id"), nullable=True, index=True)
    assigned_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    status: Mapped[ConversationStatus] = mapped_column(Enum(ConversationStatus), default=ConversationStatus.open, index=True)
    priority: Mapped[str] = mapped_column(String(20), default="normal")   # low/normal/high/urgent
    subject: Mapped[str | None] = mapped_column(String(300))
    sla_due_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)


class ConversationMessage(Base, TimestampMixin):
    """Individual message in a conversation thread."""
    __tablename__ = "conversation_messages"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id"), index=True)
    sender_type: Mapped[str] = mapped_column(String(20), index=True)   # human/agent/customer/system
    sender_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sender_name: Mapped[str | None] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    body_html: Mapped[str | None] = mapped_column(Text)
    attachments: Mapped[list] = mapped_column(JSON, default=list)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    sent_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class ConversationState(Base):
    """Short-term AI memory per conversation — intent and entity context."""
    __tablename__ = "conversation_states"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(String(100), index=True)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id"), unique=True, index=True)
    current_intent: Mapped[str | None] = mapped_column(String(100))
    active_entity_type: Mapped[str | None] = mapped_column(String(50))
    active_entity_id: Mapped[str | None] = mapped_column(String(100))
    pending_action_key: Mapped[str | None] = mapped_column(String(100))
    pending_action_payload: Mapped[dict] = mapped_column(JSON, default=dict)
    last_mentioned_contact_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_mentioned_project_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    unresolved_fields: Mapped[dict] = mapped_column(JSON, default=dict)
    context_window: Mapped[list] = mapped_column(JSON, default=list)   # last N messages for context
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class IntentRoute(Base, TimestampMixin):
    """Maps a classified intent to a target action key and surface."""
    __tablename__ = "intent_routes"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)  # null = system
    intent_pattern: Mapped[str] = mapped_column(String(100), index=True)   # e.g. "create_project"
    action_key: Mapped[str] = mapped_column(String(100))                   # e.g. "pm.create_project"
    target_surface: Mapped[str] = mapped_column(String(50), default="crm")  # crm/pm/billing/messaging/portal
    confidence_threshold: Mapped[float] = mapped_column(Float, default=0.6)
    require_confirmation: Mapped[bool] = mapped_column(Boolean, default=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class DuplicateStatus(str, enum.Enum):
    pending = "pending"
    merged = "merged"
    dismissed = "dismissed"


class DuplicateCandidate(Base, TimestampMixin):
    """Flagged potential duplicate record pairs."""
    __tablename__ = "duplicate_candidates"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(String(100), index=True)
    entity_type: Mapped[str] = mapped_column(String(50), index=True)
    entity_id: Mapped[str] = mapped_column(String(100), index=True)
    candidate_id: Mapped[str] = mapped_column(String(100), index=True)
    score: Mapped[float] = mapped_column(Float)   # 0.0–1.0 similarity
    match_reasons: Mapped[list] = mapped_column(JSON, default=list)   # ["same_email", "similar_name"]
    status: Mapped[DuplicateStatus] = mapped_column(Enum(DuplicateStatus), default=DuplicateStatus.pending, index=True)
    merged_into_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    resolved_by_user_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


# ============================================================
# Phase 3 — AI Operations Platform
# ============================================================

class EscalateVia(str, enum.Enum):
    messenger = "messenger"
    email = "email"
    notification = "notification"

class BreachAction(str, enum.Enum):
    notify = "notify"
    escalate = "escalate"
    auto_execute = "auto_execute"

class SLARule(Base, TimestampMixin):
    """Org-level SLA configuration — defines time limits and escalation for entity types."""
    __tablename__ = "sla_rules"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    entity_type: Mapped[str] = mapped_column(String(50), index=True)
    condition_json: Mapped[dict] = mapped_column(JSON, default=dict)
    sla_hours: Mapped[float] = mapped_column(Float, default=24.0)
    escalate_to_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    escalate_via: Mapped[EscalateVia] = mapped_column(Enum(EscalateVia), default=EscalateVia.notification)
    action_on_breach: Mapped[BreachAction] = mapped_column(Enum(BreachAction), default=BreachAction.notify)
    escalation_action_key: Mapped[str | None] = mapped_column(String(100), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class PermissionLevel(str, enum.Enum):
    view = "view"
    edit = "edit"
    delete = "delete"
    admin = "admin"

class RecordPermission(Base, TimestampMixin):
    """Fine-grained per-record permission grants."""
    __tablename__ = "record_permissions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(String(100), index=True)
    entity_type: Mapped[str] = mapped_column(String(50), index=True)
    entity_id: Mapped[str] = mapped_column(String(100), index=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    role: Mapped[str | None] = mapped_column(String(50), nullable=True)
    permission: Mapped[PermissionLevel] = mapped_column(Enum(PermissionLevel), index=True)
    granted_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class DailyBriefStatus(str, enum.Enum):
    generated = "generated"
    delivered = "delivered"
    failed = "failed"

class DailyBrief(Base, TimestampMixin):
    """Generated morning brief for an org/user."""
    __tablename__ = "daily_briefs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    brief_date: Mapped[datetime] = mapped_column(DateTime, index=True)
    sections: Mapped[dict] = mapped_column(JSON, default=dict)
    summary_text: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[DailyBriefStatus] = mapped_column(Enum(DailyBriefStatus), default=DailyBriefStatus.generated)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
