# MightyOps — Implementation Plan
## From Hardened CRM Backend → AI-Native Operations Platform

**Branch:** `claude/happy-fermat-iz8nol`  
**Goal:** Become the leading AI-native CRM/PM operations platform where Messenger input becomes structured work, executed by agents, tracked in a unified ledger, and visible on live dashboards.

---

## North Star Positioning

> **MightyOps** is the AI-native operations core where a Messenger message becomes a CRM update, PM task, approval request, or completed action — all tracked in one ledger, visible on one dashboard, executed by agents with human control.

---

## What's Already Built (Strong Foundation)

| Capability | Status |
|---|---|
| JWT auth (access 15min + refresh 7d) | ✅ Done |
| Rate limiting (slowapi) | ✅ Done |
| RBAC (owner > manager > employee > agent) | ✅ Done |
| Session-level multi-tenant isolation | ✅ Done |
| In-process event bus | ✅ Done |
| Celery + Redis async task queue | ✅ Done |
| AgentExecutor protocol (local + OpenClaw) | ✅ Done |
| Workflow engine | ✅ Done |
| Sales analytics (6 functions) | ✅ Done |
| Outbound webhooks + HMAC delivery | ✅ Done |
| API keys (prefix + hash) | ✅ Done |
| Drip sequences + enrollment engine | ✅ Done |
| Email template engine | ✅ Done |
| Scheduled messages + Celery processor | ✅ Done |
| Call logs | ✅ Done |
| Customer portal (tokens, permissions, view) | ✅ Done |
| E-signatures | ✅ Done |
| Stripe billing (payment links + webhooks) | ✅ Done |
| Projects, milestones, PM tasks | ✅ Done |
| Kanban boards, sprints, risks, CRs | ✅ Done |
| Portfolio management | ✅ Done |
| Workload allocation | ✅ Done |
| Basic Messenger/command center | ✅ Done |

---

## What Is Missing (Ordered by Impact)

| Gap | Priority |
|---|---|
| Unified activity timeline (cross-object) | P0 |
| Company (B2B entity separate from Lead) | P0 |
| Full-text / cross-object search | P0 |
| Custom fields (v1 — JSONB) | P0 |
| File/document attachments (general) | P0 |
| In-app notification delivery system | P0 |
| Action Registry + ActionRun ledger | P0 |
| Approval queue (first-class, not project-only) | P0 |
| Conversation model (omnichannel) | P1 |
| ConversationState (short-term AI memory) | P1 |
| Intent routing engine | P1 |
| Frontend app shell + CRM pipeline board | P0 |
| Frontend PM board + task detail | P0 |
| Frontend Messenger inbox | P1 |
| Frontend Action console + approval queue | P1 |
| Duplicate detection + merge | P2 |
| Record-level permissions | P2 |
| SDK (`@mighty-crm/client`) | P2 |
| CLI (`mighty`) | P3 |
| Alembic migration setup | P0 (infrastructure) |
| Celery Beat schedule | P0 (infrastructure) |
| Real email/SMS senders | P1 |

---

## Phase 1 — CRM/PM Operating Surfaces (Days 1–30)

**Goal:** Turn backend capabilities into surfaces users can actually operate.

### 1.1 New Backend Models

#### `Company`
B2B company entity. Leads and deals belong to companies.
```
id, org_id, name, domain, industry, size, website, phone, address,
city, state, country, owner_user_id, metadata_json, created_at, updated_at
```

#### `Deal` (first-class, enriched Opportunity)
Enriched version of Opportunity with full pipeline context.
```
id, org_id, title, lead_id, contact_id, company_id, pipeline_id,
stage_id, value, probability, currency, expected_close_date,
owner_user_id, lost_reason, source, tags, custom_data (JSONB),
created_at, updated_at, closed_at
```

#### `PipelineStage`
Configurable stages belonging to a pipeline.
```
id, org_id, pipeline_id, name, position, probability_default,
color, is_won_stage, is_lost_stage, created_at
```

#### `TimelineEvent` (unified read model)
Cross-object activity feed. Written by services when anything significant happens.
```
id, org_id, entity_type, entity_id, event_type, actor_type,
actor_id, actor_name, summary, metadata_json, occurred_at, created_at
```
Event types: `lead_created`, `lead_status_changed`, `note_added`, `call_logged`,
`email_sent`, `task_created`, `task_completed`, `deal_moved`, `invoice_paid`,
`payment_received`, `esignature_signed`, `portal_viewed`, `agent_action`,
`approval_granted`, `file_uploaded`, `message_received`, `sequence_enrolled`

#### `CustomFieldDefinition`
Org-level field definitions for any entity type.
```
id, org_id, entity_type (lead/deal/contact/company/project/task),
name, key, field_type (text/number/date/select/multi_select/checkbox/url/email/phone),
options (JSON — for select types), required, position, active, created_at
```

#### `FileAttachment`
General file attachment for any entity.
```
id, org_id, entity_type, entity_id, uploaded_by_user_id,
name, mime_type, size_bytes, storage_url, thumbnail_url,
is_public, created_at
```

#### `ActionDefinition`
Registry of all executable actions.
```
id, org_id (null = system-level), action_key, display_name,
description, category (crm/pm/billing/messaging/portal/automation),
input_schema (JSON), output_schema (JSON), required_role,
approval_required, destructive, idempotent, timeout_seconds,
retry_policy (JSON), owning_service, active, created_at
```

#### `ActionRun` (operational ledger)
Record of every action execution.
```
id, org_id, action_key, source (messenger/api/workflow/agent/webhook/ui),
source_message_id, requested_by_type (human/agent/system/api),
requested_by_id, actor_type, actor_id,
linked_entity_type, linked_entity_id,
input_payload (JSON), output_payload (JSON),
status (pending/running/waiting_approval/completed/failed/cancelled/retrying),
approval_status, current_step, logs (JSON array),
artifacts (JSON array), error, retries, idempotency_key,
started_at, completed_at, created_at, updated_at
```

#### `ApprovalRequest` (first-class)
Decoupled from ProjectApproval — covers all approval scenarios.
```
id, org_id, action_run_id, entity_type, entity_id,
requested_by_type, requested_by_id, approver_user_id,
title, description, proposed_change (JSON),
risk_level (low/medium/high/critical), status (pending/approved/rejected/expired),
decision_note, comments (JSON), due_at, approved_at, rejected_at, created_at
```

### 1.2 New Services

| Service | Responsibility |
|---|---|
| `timeline_service.py` | Write/read `TimelineEvent`; fanout from event bus handlers |
| `company_service.py` | Company CRUD, lead-to-company linking, domain dedup |
| `custom_field_service.py` | Define fields, read/write custom values (JSONB on entity) |
| `file_service.py` | Attachment CRUD, signed URL generation, thumbnail |
| `notification_service.py` | Create/deliver/mark-read notifications; preference routing |
| `search_service.py` | Cross-object full-text search (PostgreSQL `tsvector` or ILIKE) |
| `action_registry.py` | Register/look up ActionDefinitions, seed system actions |
| `action_runner.py` | Execute ActionRun — route to correct handler, write ledger |
| `approval_service.py` | Create/approve/reject ApprovalRequests, notify approver |

### 1.3 New API Endpoints

```
/companies                    CRUD
/companies/{id}/leads         List leads for company
/companies/{id}/deals         List deals for company
/companies/{id}/timeline      Company activity feed

/deals                        CRUD (enriched opportunities)
/deals/{id}/move-stage        Move deal to new pipeline stage
/deals/board                  Kanban view grouped by stage

/timeline/{type}/{id}         GET unified activity for any entity

/custom-fields                GET definitions by entity_type
/custom-fields                POST create definition
/custom-fields/{id}           PATCH/DELETE

/attachments                  POST upload (multipart)
/attachments/{id}             GET/DELETE

/search                       GET ?q=&types=lead,deal,project,task,company
/search/suggest               GET typeahead suggestions

/notifications                GET list (paginated)
/notifications/{id}/read      POST mark read
/notifications/read-all       POST mark all read

/actions/definitions          GET/POST action registry
/actions/execute              POST canonical action endpoint
/actions/runs                 GET list action runs
/actions/runs/{id}            GET action run detail + logs

/approvals                    GET list pending
/approvals/{id}/approve       POST
/approvals/{id}/reject        POST

/audit-log                    GET org audit trail
```

### 1.4 Frontend App Shell

Stack: React 18, Vite, React Router v6, TanStack Query, Tailwind CSS, shadcn/ui, @dnd-kit (drag-drop), Recharts (charts).

Pages (Phase 1):
```
/                     → Redirect to /dashboard
/login                → Login form
/dashboard            → Today view: tasks due, overdue, pending approvals, hot leads
/crm/leads            → Lead list + pipeline board
/crm/leads/:id        → Lead detail + unified timeline
/crm/contacts         → Contacts list
/crm/contacts/:id     → Contact detail
/crm/companies        → Companies list
/crm/companies/:id    → Company detail
/crm/deals            → Deal pipeline board (Kanban by stage)
/crm/deals/:id        → Deal detail
/pm/projects          → Project list
/pm/projects/:id      → Project board (Kanban)
/pm/projects/:id/tasks/:tid → Task detail panel
/notifications        → Notification center
/settings             → Org settings, pipeline stages, custom fields
```

Components:
```
AppShell              Sidebar + topbar + outlet
CRMBoard              Drag-drop Kanban for leads/deals
DealCard              Pipeline deal card
LeadCard              Lead card
TimelineView          Unified activity feed
TaskPanel             Slide-over task detail
CommentThread         Threaded comments
AttachmentList        Files with upload
KanbanBoard           PM project board (reuse from CRM)
NotificationBell      Topbar bell + dropdown
NotificationCenter    Full notification page
SearchModal           ⌘K command palette
CustomFieldForm       Dynamic custom field renderer
ApprovalBanner        Inline approval widget
```

### 1.5 Infrastructure

- **Alembic** — `alembic init`, generate initial migration from current models
- **Celery Beat** — add `beat_schedule` in `celery_app.py` for message + sequence periodic tasks
- **Email adapter** — plug SendGrid/SES into `message_scheduler._send_email()`
- **File storage** — S3-compatible signed URL generation in `file_service.py`
- **pytest baseline** — `tests/` directory with fixtures, basic smoke tests per router

**Phase 1 success metric:**
> A user opens the app, sees their dashboard, manages leads on a pipeline board, views a deal's full timeline, manages PM tasks on a Kanban, and receives in-app notifications — all from real data.

---

## Phase 2 — Messenger & Action Core (Days 31–60)

**Goal:** Messenger becomes a structured operations intake that creates traceable work.

### 2.1 New Models

#### `Conversation`
Omnichannel conversation container.
```
id, org_id, channel (messenger/sms/email/whatsapp/telegram/web),
external_thread_id, lead_id, contact_id, company_id,
assigned_user_id, status (open/pending/resolved/snoozed),
priority, subject, sla_due_at, resolved_at, created_at, updated_at
```

#### `ConversationMessage`
Individual message in a conversation.
```
id, org_id, conversation_id, sender_type (human/agent/customer/system),
sender_id, sender_name, body, body_html, attachments (JSON),
metadata_json, sent_at, created_at
```

#### `ConversationState`
Short-term AI memory per conversation thread.
```
id, org_id, conversation_id, current_intent, active_entity_type,
active_entity_id, pending_action_key, pending_action_payload (JSON),
last_mentioned_contact_id, last_mentioned_project_id,
unresolved_fields (JSON), context_window (JSON), updated_at
```

#### `IntentRoute`
Maps classified intents to action keys.
```
id, org_id, intent_pattern, action_key, target_surface (crm/pm/billing),
confidence_threshold, require_confirmation, active, created_at
```

### 2.2 New Services

| Service | Responsibility |
|---|---|
| `conversation_service.py` | Create/list/update conversations, assign, resolve |
| `intent_classifier.py` | Classify text intent, extract entities, resolve ambiguity |
| `entity_linker.py` | Resolve "John from Acme" → contact_id + company_id |
| `conversation_state.py` | Read/write ConversationState, context accumulation |
| `action_router.py` | Map intent + payload → ActionDefinition → ActionRun |

### 2.3 New API Endpoints

```
/conversations                GET/POST
/conversations/{id}           GET/PATCH
/conversations/{id}/messages  GET/POST
/conversations/{id}/assign    POST
/conversations/{id}/resolve   POST
/conversations/{id}/link      POST  (link to lead/deal/project)

/messenger/classify           POST  classify intent from raw text
/messenger/propose            POST  classify → propose action (no execute)
/messenger/execute            POST  classify → execute action → ActionRun

/actions/definitions          POST register (Phase 1 had GET)
/actions/execute              POST (Phase 1 built, now fully wired to Messenger)

/intent-routes                CRUD for intent routing rules
```

### 2.4 Frontend

Pages:
```
/messenger                    Messenger inbox (conversation list)
/messenger/:id                Conversation detail + AI draft + action cards
/actions                      Action run console
/actions/:id                  Action run detail + logs + artifacts
/approvals                    Approval queue dashboard
/approvals/:id                Approval detail + approve/reject
```

Components:
```
MessengerInbox            Conversation list with filters
ConversationView          Thread with message history + state panel
ActionCard                Proposed action card (approve/edit/reject)
ActionRunRow              Single run in the console
ActionRunDetail           Full run with logs + artifacts
ApprovalCard              Approval with proposed change diff
ApprovalQueue             Full approval list
IntentBadge               Classified intent display
EntityChip                Resolved entity link chip
```

**Phase 2 success metric:**
> A user sends "Create a website project for John at Acme Roofing, assign to Sarah, use the Website Build template" — the system classifies the intent, extracts entities, creates an ActionRun, requests approval, and on approval creates the project with tasks, linked to John's deal, and notifies Sarah.

---

## Phase 3 — AI Operations Platform (Days 61–90)

**Goal:** The system runs itself. Agents execute work, surface blockers, and request human decisions.

### 3.1 New Capabilities

#### Agent Supervisor Dashboard
- Agent action feed (live)
- Failure rate per agent
- Pending approval queue
- Stuck action detector (actions >10min with no progress)
- Manual retry, cancel, escalate controls

#### AI Daily Brief
Scheduled job at 8am org-local time:
- Tasks due today
- Overdue items
- Hot leads (score change)
- Unpaid invoices
- Pending approvals
- Blocked projects
- Agent anomalies
- Revenue snapshot
Delivered to: Messenger + notification center + email

#### Stuck Detection
Celery task every 5 minutes:
- ActionRuns in `running` state > timeout
- Enrollments past `next_send_at` by >1h
- Approvals pending > SLA
- Projects with all tasks blocked
- Leads with no activity > N days
Escalate to: approver_user_id → notification + Messenger card

#### SLA + Escalation Rules
```
id, org_id, entity_type, condition_json, sla_hours,
escalate_to_user_id, escalate_via (messenger/email/notification),
action_on_breach (notify/escalate/auto_execute), active
```

#### Duplicate Detection
Service: `duplicate_service.py`
- On lead/contact/company create: score against existing records
- Scoring: name similarity (fuzzy), email exact, phone exact, domain match
- Threshold-based: auto-merge (>0.95), suggest (>0.75), ignore (<0.75)
- `DuplicateCandidate` table: entity_type, entity_id, candidate_id, score, status (pending/merged/dismissed)

#### Record-Level Permissions (v1)
- `RecordPermission`: entity_type, entity_id, user_id, permission (view/edit/delete)
- Middleware: check record permission on GET/PATCH/DELETE
- Default: managers+ see all; employees see assigned; agents see linked

#### SDK v1 (`@mighty-crm/client`)
```typescript
// npm install @mighty-crm/client
import { MightyCRM } from '@mighty-crm/client';

const crm = new MightyCRM({ apiKey: 'mcrm_...', orgId: '...' });

// CRM
const lead = await crm.leads.create({ name: 'John', email: 'john@acme.com' });
await crm.leads.updateStatus(lead.id, 'qualified');

// PM  
const project = await crm.projects.create({ name: 'Acme Website', leadId: lead.id });
const task = await crm.tasks.create({ projectId: project.id, title: 'Design mockup' });

// Actions
const run = await crm.actions.execute('pm.create_project', { name: 'Test', leadId: lead.id });
await crm.actions.waitForCompletion(run.id);

// Events
crm.on('lead.status_changed', (event) => console.log(event));
crm.on('action.completed', (event) => console.log(event));
```

**Phase 3 success metric:**
> The system detects stuck work, surfaces it proactively in Messenger, allows one-tap decisions, executes approved actions autonomously, and produces a morning brief that replaces a daily standup.

---

## Longer-Term Roadmap (Post Day 90)

### CRM Depth
- Custom objects (full EAV model)
- Advanced lead scoring (ML-assisted)
- Relationship mapping (graph-style)
- Quote/proposal builder with templates
- Product catalog + price books
- Win/loss analysis with reasons
- Conversation intelligence (call transcription + summary)
- Email tracking (opens, clicks)

### PM Depth
- Gantt / timeline view
- Workload heat map
- Recurring tasks
- PM docs/wiki per project
- Client-facing project status page (via portal)
- PM reporting (burndown, velocity, estimation accuracy)

### Platform Depth
- SSO (SAML/OIDC)
- SCIM user provisioning
- White-label / agency mode (multi-org management)
- Marketplace of action modules
- Advanced audit log with before/after diffs
- Mobile app (React Native)
- Advanced reporting builder
- Data export + import

### AI Depth
- Long-term agent memory (vector store)
- Multi-step planning (planner → executor → reviewer)
- Agent confidence scoring
- Tool permission model per agent
- Rollback/undo for AI actions
- Autonomous exception handling
- Action cost tracking per org

---

## Canonical Data Flow (The Product Promise)

```
User/Customer                AI Agent
     │                           │
     ▼                           ▼
  Messenger ──────────────── Event Bus
     │                           │
     ▼                           ▼
Intent Classifier          Action Registry
     │                           │
     ▼                           ▼
Entity Linker              Action Runner
     │                           │
     ▼                           ▼
Action Router ──────────── ActionRun Ledger
     │                           │
     ├──→ CRM (Lead/Deal/Contact/Company)
     ├──→ PM (Project/Task/Board)
     ├──→ Billing (Invoice/Payment/Quote)
     ├──→ Comms (Sequence/Message/Email)
     ├──→ Portal (Token/Signature)
     ▼                           │
Approval Queue ◄────────────────┘
     │
     ▼ (approved)
Dashboard + Timeline + Notifications
```

---

## File Structure (Target End State)

```
backend/
├── alembic/                  ← Migration versions
├── app/
│   ├── routers/              ← 50+ routers (36 now, 14+ to add)
│   ├── services/             ← 35+ services (23 now, 12+ to add)
│   ├── tasks/                ← 8+ Celery tasks (4 now, 4+ to add)
│   ├── actions/              ← Action registry handlers
│   └── tests/                ← pytest suite

frontend/
├── src/
│   ├── components/           ← Reusable UI components
│   │   ├── crm/              ← CRM-specific components
│   │   ├── pm/               ← PM board components
│   │   ├── messenger/        ← Messenger/inbox components
│   │   ├── actions/          ← Action run + approval components
│   │   └── shared/           ← Layout, search, notifications
│   ├── pages/                ← Route-level pages
│   ├── hooks/                ← Custom React hooks
│   ├── lib/                  ← API client, utils
│   └── stores/               ← Zustand state stores
├── package.json
└── vite.config.ts

sdk/                          ← @mighty-crm/client (Phase 3)
├── src/
└── package.json
```

---

## Implementation Sequence (Phase 1 Detailed)

### Week 1 — Models + Core Services
- [ ] `Company` model + router + service
- [ ] `PipelineStage` model + migration
- [ ] `TimelineEvent` model + `timeline_service.py`
- [ ] Wire timeline writes into event handlers
- [ ] `CustomFieldDefinition` + `custom_data` JSONB on Lead/Deal/Contact
- [ ] `custom_field_service.py` + router
- [ ] `FileAttachment` model + `file_service.py` + router

### Week 2 — Action Registry + Approval
- [ ] `ActionDefinition` model + `action_registry.py`
- [ ] `ActionRun` model + `action_runner.py`
- [ ] `ApprovalRequest` model + `approval_service.py`
- [ ] Seed system action definitions
- [ ] `POST /actions/execute` router
- [ ] `GET /actions/runs` + `/approvals` routers
- [ ] Hook existing services into ActionRun on major operations

### Week 3 — Search + Notifications + Alembic
- [ ] `search_service.py` — ILIKE cross-object search
- [ ] `GET /search` endpoint
- [ ] `notification_service.py` — create + deliver + mark-read
- [ ] `GET /notifications` + mark-read endpoints
- [ ] Alembic init + initial migration
- [ ] Celery Beat schedule config
- [ ] pytest baseline (10 smoke tests)

### Week 4 — Frontend App Shell
- [ ] Vite + React 18 + React Router + Tailwind + shadcn setup
- [ ] AppShell (sidebar, topbar, nav)
- [ ] Dashboard page (today view)
- [ ] CRM leads list + pipeline board
- [ ] Lead detail page + timeline
- [ ] PM project list + Kanban board
- [ ] Notification center
- [ ] Search modal (⌘K)
