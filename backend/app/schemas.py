from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import Optional, Any
from app.models import LeadStatus, TaskStatus, TaskPriority, Channel, Direction, OpportunityStage, AgentActionStatus, UserRole

class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class LoginIn(BaseModel):
    email: str
    password: str

class RefreshIn(BaseModel):
    refresh_token: str

class OrganizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    industry: Optional[str] = None
    plan: str
    settings: dict[str, Any]

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    name: str
    email: str
    role: UserRole

class LeadBase(BaseModel):
    name: str
    company: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    source: str = "manual"
    status: LeadStatus = LeadStatus.new
    score: int = 0
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    website: Optional[str] = None
    metadata_json: dict[str, Any] = {}

class LeadCreate(LeadBase):
    pass

class LeadUpdate(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    source: Optional[str] = None
    status: Optional[LeadStatus] = None
    score: Optional[int] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    website: Optional[str] = None
    metadata_json: Optional[dict[str, Any]] = None

class LeadOut(LeadBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    created_at: datetime
    updated_at: datetime

class ContactCreate(BaseModel):
    lead_id: Optional[str] = None
    name: str
    title: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

class ContactOut(ContactCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    created_at: datetime

class OpportunityCreate(BaseModel):
    lead_id: str
    title: str
    value: float = 0
    stage: OpportunityStage = OpportunityStage.discovery
    probability: int = 25

class OpportunityOut(OpportunityCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    created_at: datetime

class TaskCreate(BaseModel):
    lead_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.open
    priority: TaskPriority = TaskPriority.medium
    due_at: Optional[datetime] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    due_at: Optional[datetime] = None

class TaskOut(TaskCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    created_at: datetime
    updated_at: datetime

class CommunicationCreate(BaseModel):
    lead_id: Optional[str] = None
    channel: Channel
    direction: Direction
    subject: Optional[str] = None
    content: str
    provider_message_id: Optional[str] = None

class CommunicationOut(CommunicationCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    created_at: datetime

class NoteCreate(BaseModel):
    lead_id: Optional[str] = None
    content: str
    is_agent_note: bool = False

class NoteOut(NoteCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    created_at: datetime

class AgentCommandIn(BaseModel):
    agent_name: str = "SalesAgent"
    action_type: str
    instruction: str
    lead_id: Optional[str] = None
    metadata_json: dict[str, Any] = {}

class AgentActionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    lead_id: Optional[str] = None
    agent_name: str
    action_type: str
    instruction: str
    result: Optional[str] = None
    status: AgentActionStatus
    cost_cents: int
    duration_ms: int
    metadata_json: dict[str, Any]
    created_at: datetime
    updated_at: datetime

class DashboardOut(BaseModel):
    leads_total: int
    leads_by_status: dict[str, int]
    open_tasks: int
    pipeline_value: float
    recent_agent_actions: list[AgentActionOut]

from app.models import CampaignStatus, WorkflowStatus, AppointmentStatus, QuoteStatus, ReviewStatus, IntegrationStatus

class CampaignCreate(BaseModel):
    name: str
    channel: Channel = Channel.email
    status: CampaignStatus = CampaignStatus.draft
    audience: Optional[str] = None
    goal: Optional[str] = None
    message_template: str = ""
    metadata_json: dict[str, Any] = {}

class CampaignOut(CampaignCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    sent_count: int
    reply_count: int
    created_at: datetime
    updated_at: datetime

class WorkflowStepCreate(BaseModel):
    position: int = 1
    action_type: str
    instruction: str
    wait_minutes: int = 0
    config: dict[str, Any] = {}

class WorkflowCreate(BaseModel):
    name: str
    trigger: str = "lead_created"
    status: WorkflowStatus = WorkflowStatus.draft
    description: Optional[str] = None
    steps: list[WorkflowStepCreate] = []

class WorkflowStepOut(WorkflowStepCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    workflow_id: str
    created_at: datetime

class WorkflowOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    name: str
    trigger: str
    status: WorkflowStatus
    description: Optional[str] = None
    steps: list[WorkflowStepOut] = []
    created_at: datetime
    updated_at: datetime

class InboxThreadCreate(BaseModel):
    lead_id: Optional[str] = None
    channel: Channel
    subject: Optional[str] = None
    status: str = "open"
    last_message_preview: Optional[str] = None

class InboxThreadOut(InboxThreadCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    created_at: datetime
    updated_at: datetime

class AppointmentCreate(BaseModel):
    lead_id: Optional[str] = None
    title: str
    starts_at: datetime
    ends_at: Optional[datetime] = None
    status: AppointmentStatus = AppointmentStatus.scheduled
    location: Optional[str] = None
    notes: Optional[str] = None

class AppointmentOut(AppointmentCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    created_at: datetime
    updated_at: datetime

class ProductServiceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float = 0
    active: bool = True

class ProductServiceOut(ProductServiceCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    created_at: datetime

class QuoteCreate(BaseModel):
    lead_id: Optional[str] = None
    title: str
    status: QuoteStatus = QuoteStatus.draft
    subtotal: float = 0
    discount: float = 0
    total: float = 0
    line_items: list[dict[str, Any]] = []

class QuoteOut(QuoteCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    created_at: datetime
    updated_at: datetime

class ReviewRequestCreate(BaseModel):
    lead_id: Optional[str] = None
    customer_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    rating: Optional[int] = None
    status: ReviewStatus = ReviewStatus.requested
    public_review_url: Optional[str] = None
    private_feedback: Optional[str] = None

class ReviewRequestOut(ReviewRequestCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    created_at: datetime
    updated_at: datetime

class IntegrationConnectionCreate(BaseModel):
    provider: str
    status: IntegrationStatus = IntegrationStatus.disconnected
    external_account: Optional[str] = None
    config: dict[str, Any] = {}

class IntegrationConnectionOut(IntegrationConnectionCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    last_sync_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

class AdvancedDashboardOut(DashboardOut):
    active_campaigns: int
    open_inbox_threads: int
    appointments_today: int
    quotes_total: float
    reviews_requested: int
    connected_integrations: int


class MessengerThreadCreate(BaseModel):
    channel: str = "web"
    title: str = "Mighty Command"
    external_thread_id: Optional[str] = None
    context_json: dict[str, Any] = {}

class MessengerThreadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    owner_user_id: Optional[str] = None
    channel: Any
    external_thread_id: Optional[str] = None
    title: str
    status: str
    context_json: dict[str, Any]
    created_at: datetime
    updated_at: datetime

class MessengerMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    thread_id: str
    sender_type: str
    sender_name: Optional[str] = None
    body: str
    metadata_json: dict[str, Any]
    created_at: datetime

class MessengerCommandIn(BaseModel):
    text: str
    thread_id: Optional[str] = None
    channel: str = "web"
    dry_run: bool = False
    require_approval_for_external_actions: bool = True

class CommandExecutionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    thread_id: Optional[str] = None
    message_id: Optional[str] = None
    actor_user_id: Optional[str] = None
    raw_text: str
    intent: str
    status: Any
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    plan_json: dict[str, Any]
    result_json: dict[str, Any]
    error: Optional[str] = None
    requires_approval: bool
    created_at: datetime
    updated_at: datetime

class MessengerCommandOut(BaseModel):
    thread: MessengerThreadOut
    user_message: MessengerMessageOut
    assistant_message: MessengerMessageOut
    execution: CommandExecutionOut
    suggestions: list[str] = []

class CommandTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    example_text: str
    intent: str
    config_json: dict[str, Any] = {}
    active: bool = True

class CommandTemplateOut(CommandTemplateCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    created_at: datetime
    updated_at: datetime

from app.models import ProjectStatus, ProjectPriority, ProjectType, PMTaskStatus, AssigneeType, ApprovalStatus

class ProjectTemplateCreate(BaseModel):
    name: str
    project_type: ProjectType = ProjectType.custom
    description: Optional[str] = None
    default_agent: Optional[str] = None
    blueprint: dict[str, Any] = {}
    active: bool = True

class ProjectTemplateOut(ProjectTemplateCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    created_at: datetime
    updated_at: datetime

class ProjectCreate(BaseModel):
    name: str
    project_type: ProjectType = ProjectType.custom
    lead_id: Optional[str] = None
    opportunity_id: Optional[str] = None
    template_id: Optional[str] = None
    status: ProjectStatus = ProjectStatus.active
    priority: ProjectPriority = ProjectPriority.normal
    goal: Optional[str] = None
    budget_cents: int = 0
    due_at: Optional[datetime] = None
    metadata_json: dict[str, Any] = {}

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[ProjectStatus] = None
    priority: Optional[ProjectPriority] = None
    goal: Optional[str] = None
    budget_cents: Optional[int] = None
    actual_cost_cents: Optional[int] = None
    due_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    metadata_json: Optional[dict[str, Any]] = None

class ProjectOut(ProjectCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    owner_user_id: Optional[str] = None
    actual_cost_cents: int
    created_at: datetime
    updated_at: datetime

class MilestoneCreate(BaseModel):
    name: str
    description: Optional[str] = None
    position: int = 1
    status: PMTaskStatus = PMTaskStatus.ready
    due_at: Optional[datetime] = None

class MilestoneOut(MilestoneCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    project_id: str
    created_at: datetime
    updated_at: datetime

class PMTaskCreate(BaseModel):
    project_id: str
    milestone_id: Optional[str] = None
    parent_task_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    status: PMTaskStatus = PMTaskStatus.ready
    priority: ProjectPriority = ProjectPriority.normal
    assignee_type: AssigneeType = AssigneeType.agent
    assignee_user_id: Optional[str] = None
    assignee_agent: Optional[str] = None
    estimate_minutes: int = 0
    due_at: Optional[datetime] = None
    requires_approval: bool = False
    metadata_json: dict[str, Any] = {}

class PMTaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[PMTaskStatus] = None
    priority: Optional[ProjectPriority] = None
    assignee_type: Optional[AssigneeType] = None
    assignee_user_id: Optional[str] = None
    assignee_agent: Optional[str] = None
    estimate_minutes: Optional[int] = None
    actual_minutes: Optional[int] = None
    cost_cents: Optional[int] = None
    output_summary: Optional[str] = None
    artifact_urls: Optional[list[Any]] = None
    due_at: Optional[datetime] = None
    requires_approval: Optional[bool] = None
    blocked_reason: Optional[str] = None
    metadata_json: Optional[dict[str, Any]] = None

class PMTaskOut(PMTaskCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    actual_minutes: int
    cost_cents: int
    output_summary: Optional[str] = None
    artifact_urls: list[Any]
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    blocked_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class ProjectCommentCreate(BaseModel):
    task_id: Optional[str] = None
    body: str
    visibility: str = "internal"

class ProjectCommentOut(ProjectCommentCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    project_id: str
    author_user_id: Optional[str] = None
    author_agent: Optional[str] = None
    created_at: datetime

class ProjectApprovalCreate(BaseModel):
    task_id: Optional[str] = None
    requested_by_agent: Optional[str] = None
    title: str
    request_body: Optional[str] = None

class ProjectApprovalUpdate(BaseModel):
    status: ApprovalStatus
    decision_note: Optional[str] = None

class ProjectApprovalOut(ProjectApprovalCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    project_id: str
    approver_user_id: Optional[str] = None
    status: ApprovalStatus
    decision_note: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class ProjectGenerateIn(BaseModel):
    name: str
    project_type: ProjectType = ProjectType.website
    goal: Optional[str] = None
    lead_id: Optional[str] = None
    template_name: Optional[str] = None
    auto_queue_openclaw: bool = True

class ProjectGenerateOut(BaseModel):
    project: ProjectOut
    milestones_created: int
    tasks_created: int
    agent_actions_created: int

class ProjectBoardOut(BaseModel):
    project: ProjectOut
    milestones: list[MilestoneOut]
    tasks_by_status: dict[str, list[PMTaskOut]]
    blockers: list[PMTaskOut]
    pending_approvals: list[ProjectApprovalOut]

class KanbanColumnCreate(BaseModel):
    key: str
    label: str
    mapped_status: PMTaskStatus = PMTaskStatus.ready
    position: int = 1
    wip_limit: Optional[int] = None
    is_done_column: bool = False
    automation_json: dict[str, Any] = {}

class KanbanColumnUpdate(BaseModel):
    key: Optional[str] = None
    label: Optional[str] = None
    mapped_status: Optional[PMTaskStatus] = None
    position: Optional[int] = None
    wip_limit: Optional[int] = None
    is_done_column: Optional[bool] = None
    automation_json: Optional[dict[str, Any]] = None

class KanbanColumnOut(KanbanColumnCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    project_id: str
    created_at: datetime
    updated_at: datetime

class KanbanMoveTaskIn(BaseModel):
    column_key: Optional[str] = None
    status: Optional[PMTaskStatus] = None
    position: Optional[int] = None
    blocked_reason: Optional[str] = None
    output_summary: Optional[str] = None
    queue_openclaw: bool = False

class KanbanColumnWithTasks(BaseModel):
    column: KanbanColumnOut
    tasks: list[PMTaskOut]
    count: int
    wip_over_limit: bool = False

class KanbanBoardOut(BaseModel):
    project: ProjectOut
    columns: list[KanbanColumnWithTasks]
    total_tasks: int
    blocked_count: int
    done_count: int
    next_recommended_commands: list[str] = []

class PMBotCommandHelpOut(BaseModel):
    categories: dict[str, list[str]]

# -------- PM Triple schemas --------
from app.models import PortfolioStatus, RiskSeverity, RiskStatus, SprintStatus, ChangeRequestStatus, AssigneeType

class PortfolioCreate(BaseModel):
    name: str
    description: Optional[str] = None
    status: PortfolioStatus = PortfolioStatus.active
    budget_cents: int = 0
    metadata_json: dict[str, Any] = {}

class PortfolioOut(PortfolioCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    owner_user_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class PortfolioAddProjectIn(BaseModel):
    project_id: str
    weight: int = 1

class SprintCreate(BaseModel):
    name: str
    goal: Optional[str] = None
    status: SprintStatus = SprintStatus.planned
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    capacity_minutes: int = 0

class SprintOut(SprintCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    project_id: str
    created_at: datetime
    updated_at: datetime

class SprintAddTaskIn(BaseModel):
    task_id: str
    position: int = 1

class RiskCreate(BaseModel):
    task_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    severity: RiskSeverity = RiskSeverity.medium
    status: RiskStatus = RiskStatus.open
    mitigation_plan: Optional[str] = None
    owner_user_id: Optional[str] = None
    owner_agent: Optional[str] = None
    due_at: Optional[datetime] = None

class RiskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[RiskSeverity] = None
    status: Optional[RiskStatus] = None
    mitigation_plan: Optional[str] = None
    owner_user_id: Optional[str] = None
    owner_agent: Optional[str] = None
    due_at: Optional[datetime] = None

class RiskOut(RiskCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    project_id: str
    created_at: datetime
    updated_at: datetime

class ChangeRequestCreate(BaseModel):
    title: str
    description: Optional[str] = None
    impact_budget_cents: int = 0
    impact_minutes: int = 0
    requested_by_agent: Optional[str] = None

class ChangeRequestUpdate(BaseModel):
    status: Optional[ChangeRequestStatus] = None
    decision_note: Optional[str] = None
    impact_budget_cents: Optional[int] = None
    impact_minutes: Optional[int] = None

class ChangeRequestOut(ChangeRequestCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    project_id: str
    status: ChangeRequestStatus
    requested_by_user_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class WorkloadAllocationCreate(BaseModel):
    assignee_type: AssigneeType = AssigneeType.agent
    assignee_user_id: Optional[str] = None
    assignee_agent: Optional[str] = None
    capacity_minutes_per_week: int = 1200
    active: bool = True

class WorkloadAllocationOut(WorkloadAllocationCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    created_at: datetime
    updated_at: datetime

class AutomationRuleCreate(BaseModel):
    project_id: Optional[str] = None
    name: str
    trigger: str = "task_done"
    condition_json: dict[str, Any] = {}
    action_json: dict[str, Any] = {}
    active: bool = True

class AutomationRuleOut(AutomationRuleCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    created_at: datetime
    updated_at: datetime

class PMExecutiveOverviewOut(BaseModel):
    projects_total: int
    active_projects: int
    overdue_tasks: int
    blocked_tasks: int
    open_risks: int
    critical_risks: int
    pending_change_requests: int
    pending_approvals: int
    estimated_minutes: int
    actual_minutes: int
    projected_cost_cents: int
    by_agent: dict[str, dict[str, int]]


# -------- Typed schemas for enterprise generic CRUD --------
# These replace the raw-dict payloads accepted by /enterprise/{resource}.

from app.models import PipelineStatus, InvoiceStatus, PaymentStatus, JobStatus, SubscriptionStatus, TicketStatus

class PipelineCreate(BaseModel):
    name: str
    status: PipelineStatus = PipelineStatus.active
    stages: list[Any] = []
    is_default: bool = False

class TagCreate(BaseModel):
    name: str
    color: Optional[str] = None

class LeadTagCreate(BaseModel):
    lead_id: str
    tag_id: str

class SegmentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    filter_json: dict[str, Any] = {}

class WebFormCreate(BaseModel):
    name: str
    slug: str
    fields: list[Any] = []
    success_message: str = "Thanks — we received your request."
    active: bool = True

class WebsiteCreate(BaseModel):
    domain: Optional[str] = None
    subdomain: Optional[str] = None
    status: str = "draft"
    industry: Optional[str] = None
    pages: list[Any] = []
    seo_json: dict[str, Any] = {}

class LandingPageCreate(BaseModel):
    campaign_id: Optional[str] = None
    title: str
    slug: str
    content_json: dict[str, Any] = {}
    published: bool = False

class JobCreate(BaseModel):
    lead_id: Optional[str] = None
    title: str
    status: JobStatus = JobStatus.requested
    scheduled_at: Optional[datetime] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    checklist: list[Any] = []

class InvoiceCreate(BaseModel):
    lead_id: Optional[str] = None
    job_id: Optional[str] = None
    number: str
    status: InvoiceStatus = InvoiceStatus.draft
    due_at: Optional[datetime] = None
    subtotal: float = 0
    tax: float = 0
    total: float = 0
    line_items: list[Any] = []

class PaymentCreate(BaseModel):
    invoice_id: Optional[str] = None
    provider: str = "manual"
    amount: float = 0
    status: PaymentStatus = PaymentStatus.pending
    external_id: Optional[str] = None
    metadata_json: dict[str, Any] = {}

class SubscriptionCreate(BaseModel):
    plan_name: str
    status: SubscriptionStatus = SubscriptionStatus.trialing
    amount_monthly: float = 0
    current_period_end: Optional[datetime] = None
    provider_subscription_id: Optional[str] = None

class SupportTicketCreate(BaseModel):
    lead_id: Optional[str] = None
    subject: str
    status: TicketStatus = TicketStatus.open
    priority: TaskPriority = TaskPriority.medium
    description: Optional[str] = None

class DocumentCreate(BaseModel):
    lead_id: Optional[str] = None
    title: str
    kind: str = "note"
    storage_url: Optional[str] = None
    content_text: Optional[str] = None

class NotificationCreate(BaseModel):
    user_id: Optional[str] = None
    title: str
    body: Optional[str] = None
    read: bool = False
    action_url: Optional[str] = None

class TimeEntryCreate(BaseModel):
    project_id: str
    task_id: Optional[str] = None
    user_id: Optional[str] = None
    agent_name: Optional[str] = None
    minutes: int = 0
    note: Optional[str] = None

class PMTaskDependencyCreate(BaseModel):
    task_id: str
    depends_on_task_id: str
    dependency_type: str = "finish_to_start"

class ProjectFileCreate(BaseModel):
    project_id: str
    task_id: Optional[str] = None
    name: str
    kind: str = "artifact"
    storage_url: Optional[str] = None
    content_text: Optional[str] = None

class AgentMemoryCreate(BaseModel):
    agent_name: str
    key: str
    value_json: dict[str, Any] = {}
    source: Optional[str] = None


# Maps resource slug → (CreateSchema, UpdateSchema | None)
# Used by enterprise.py to validate payloads before writing to the DB.
ENTERPRISE_SCHEMAS: dict[str, type[BaseModel]] = {
    "pipelines": PipelineCreate,
    "tags": TagCreate,
    "lead-tags": LeadTagCreate,
    "segments": SegmentCreate,
    "web-forms": WebFormCreate,
    "websites": WebsiteCreate,
    "landing-pages": LandingPageCreate,
    "jobs": JobCreate,
    "invoices": InvoiceCreate,
    "payments": PaymentCreate,
    "subscriptions": SubscriptionCreate,
    "support-tickets": SupportTicketCreate,
    "documents": DocumentCreate,
    "notifications": NotificationCreate,
    "project-templates": ProjectTemplateCreate,
    "projects": ProjectCreate,
    "project-milestones": MilestoneCreate,
    "pm-tasks": PMTaskCreate,
    "pm-task-dependencies": PMTaskDependencyCreate,
    "project-comments": ProjectCommentCreate,
    "project-files": ProjectFileCreate,
    "project-approvals": ProjectApprovalCreate,
    "time-entries": TimeEntryCreate,
    "agent-memories": AgentMemoryCreate,
}
