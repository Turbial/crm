# Mighty CRM — Full Product & Functionality Report

**Stack:** FastAPI · SQLAlchemy 2.0 · PostgreSQL · Celery + Redis · Stripe · React + Vite  
**Branch:** `claude/happy-fermat-iz8nol`  
**DB models:** 71 tables · **API routers:** 36 · **Service layer:** 23 modules · **Celery tasks:** 4 groups

---

## Architecture Overview

```
Client (React/Vite)
        │  HTTPS
        ▼
   Nginx reverse proxy
        │
  ┌─────┴─────┐
  │ FastAPI    │  ← JWT auth, slowapi rate-limit, CORS, HMAC webhook security
  │ (Uvicorn)  │  ← Session-level multi-tenant isolation (ContextVar + ORM event)
  └─────┬─────┘
        │ SQLAlchemy 2.0
        ▼
   PostgreSQL ──── Redis ──── Celery Workers
                                   │
                          ┌────────┴────────┐
                      Agent tasks    Message/Webhook tasks
```

### Security foundations
| Layer | Implementation |
|---|---|
| Authentication | JWT access token (15 min) + refresh token (7 days), separate `type` claim |
| Authorization | Parameterized RBAC: `owner > manager > employee > agent` |
| Multi-tenancy | SQLAlchemy `do_orm_execute` event + `ContextVar` — zero per-query boilerplate |
| Rate limiting | slowapi — login: 10/min, refresh: 30/min, IP-based |
| Webhook security | HMAC-SHA256 timestamp-verified signatures, 5-minute replay window |
| API key auth | `mcrm_` prefix + pbkdf2_sha256 hash; raw key returned once, never stored |
| Portal tokens | SHA-256 hashed, permission-scoped, time-limited (72 h default) |
| Stripe webhooks | Signature verified + idempotency guard on `stripe_event_id` |
| Headers | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` via middleware |
| Request tracing | `X-Request-ID` injected by middleware, propagated through logs |

---

## Module Breakdown

### 1. Core CRM

#### Leads (`/leads`)
- Full CRUD with typed `LeadStatus` state machine: `new → contacted → qualified → appointment → proposal → won / lost`
- Status change emits in-process `lead.status_changed` event → triggers workflows, audit log, outbound webhooks
- Optional `score` field updated by lead scoring service

#### Contacts (`/contacts`)
- Sub-records linked to a lead; name, title, email, phone

#### Opportunities (`/opportunities`)
- Stage-tracked (`discovery → quoted → negotiation → won / lost`) with value and probability
- Used as inputs to revenue forecasting

#### Tasks (`/tasks`)
- Priority (`low/medium/high/urgent`) + status (`open/in_progress/done/canceled`)
- Optional `due_at` with optional lead linkage

#### Communications (`/communications`)
- Multi-channel (`email/sms/call/chat/social/internal`), direction-aware (`inbound/outbound/internal`)
- Provider message ID for deduplication

#### Notes (`/notes`)
- Agent-authored or human notes, linked to a lead

#### Appointments (`/appointments`)
- `starts_at / ends_at`, location, status (`scheduled/completed/canceled/no_show`)

---

### 2. Sales Pipeline & Intelligence

#### Dashboard (`/dashboard/summary`)
- Aggregated KPIs: leads total, leads by status, open tasks, pipeline value, recent agent actions

#### Sales & Revenue Analytics (`/analytics`)

| Endpoint | What it returns |
|---|---|
| `GET /analytics/pipeline` | Lead counts by status + opportunity count/value/weighted-value by stage |
| `GET /analytics/forecast` | 3-month probability-weighted revenue projection (configurable N months) |
| `GET /analytics/velocity` | Win rate, avg deal size, avg cycle days, sales velocity per day |
| `GET /analytics/conversions` | Stage-to-stage conversion rates across the entire funnel |
| `GET /analytics/agent-performance` | Per-agent action totals, completion rates (manager+ only) |
| `GET /analytics/lead-sources` | Lead volume and win rates broken down by source |

#### Opportunities (`/opportunities`)
- Full opportunity CRUD with pipeline stage + probability

#### Quotes (`/quotes`)
- Multi-line-item quotes with subtotal, discount, and total
- Status lifecycle: `draft → sent → accepted → rejected → expired`

#### Products & Services (`/products-services`)
- Catalog of products/services with pricing and active flag

#### AI Lead Intelligence (`/intelligence`)
- `/leads/{lead_id}/score` — algorithmic lead score
- `/leads/{lead_id}/next-action` — recommended next action
- `/executive-report` — org-wide intelligence summary

---

### 3. Automation & Workflow

#### Workflows (`/workflows`)
- Named workflows with trigger string (e.g. `lead_status_won`, `lead_created`)
- Steps stored as ordered `WorkflowStep` rows with `action_type`, `instruction`, `wait_minutes`, `config`

#### Workflow Runtime (`/workflow-runtime`)
- `POST /{workflow_id}/run` — manually trigger a workflow against a lead
- Executes steps sequentially via the `AgentExecutor` abstraction

#### AI Agent System (`/agents`)
- `POST /agents/command` — queue an agent action
- `GET /agents/tasks` — list queued/running/done actions
- `POST /agents/tasks/{id}/approve` — human approval gate
- `POST /agents/tasks/{id}/result` — record result
- `GET /agents/memory/{agent_name}` — persistent agent memory
- `POST /agents/memory` — write agent memory

#### Agent Executor (dual-mode)
- **Local mode** — deterministic simulator for dev/test
- **OpenClaw mode** — forwards to external OpenClaw runtime with HMAC-signed callbacks
- Selected via `AGENT_EXECUTOR=local|openclaw` env var; both implement the `AgentExecutor` Protocol

#### In-process Event Bus (`events.py`)
- `@on("event_name")` / `emit("event_name", **kwargs)` — decoupled side effects
- Registered handlers: audit logging, Celery dispatch, workflow triggering, outbound webhook fanout

#### Celery Task Queue
- Broker/backend: Redis  
- `run_action_task` — `max_retries=3`, `acks_late=True`
- DB-backed worker (`worker.py`) as Celery fallback

#### Automation Rules
- Project-level automation rules (`task_done`, etc.) with condition + action JSON

---

### 4. Drip Sequences & Email Automation

#### Drip Sequences (`/sequences`)
- Named sequences with channel and trigger (`manual`, `lead_created`, `lead_status_{x}`)
- Steps with `position`, `delay_hours`, `subject`, `message_template`

| Endpoint | Description |
|---|---|
| `POST /sequences` | Create sequence |
| `GET /sequences` | List sequences |
| `POST /sequences/{id}/steps` | Add step |
| `GET /sequences/{id}/steps` | List steps ordered by position |
| `POST /sequences/{id}/enroll` | Enroll a lead (double-enrollment prevented) |
| `POST /sequences/{id}/enrollments/{eid}/unenroll` | Unenroll |
| `GET /sequences/{id}/enrollments` | List enrollments |

#### Sequence Engine (`sequence_engine.py`)
- `_render()` — template variable substitution (`{{lead_name}}`, `{{company}}`, `{{email}}`, `{{phone}}`, `{{city}}`)
- Each step schedules a `ScheduledMessage` row with `send_at = now + delay_hours`
- After delivery, `advance_enrollment()` schedules the next step

#### Email Templates (`/email-templates`)
- Subject + HTML + plain-text body with `{{variable}}` placeholders
- Category grouping (`general`, `follow_up`, `proposal`, etc.)
- `POST /{id}/preview` — renders with sample data
- `POST /{id}/render?lead_id=...` — renders for a specific lead

#### Scheduled Messages (`/scheduled-messages`)
- Manual scheduling for any channel (`email/sms/call/chat/social/internal`)
- `POST /{id}/cancel` — cancel before send
- `POST /{id}/send-now` — move to front of queue
- Processed by periodic Celery task (`process_scheduled_messages_task`)

#### Campaigns (`/campaigns`)
- Mass-messaging campaigns with audience, goal, message template
- Tracks `sent_count` and `reply_count`

---

### 5. Communication Hub

#### Call Logs (`/call-logs`)
- Log inbound/outbound calls with disposition (`connected/voicemail/no_answer/busy/wrong_number/callback_requested`)
- Duration, recording URL, notes, started_at

#### Inbox (`/inbox`)
- Multi-channel thread management (email, SMS, chat, social)
- Thread status: `open/resolved/snoozed`
- Last-message preview

#### Messenger / Command Center (`/messenger`)
- Natural-language command interface for agents
- Creates `MessengerThread` → `MessengerMessage` → `CommandExecution` chain
- `dry_run` mode and `require_approval_for_external_actions` safety gate
- `GET /messenger/threads/{id}/messages` — full message history
- Command templates with intent classification

#### Communications (`/communications`)
- Log individual communications (emails, calls, SMS) against leads

---

### 6. Customer Portal & Self-Service

#### Portal (`/portal`)
- `POST /portal/tokens` — generate scoped portal access token for a lead
- `GET /portal/tokens` — list active tokens
- `GET /portal/view` (public) — lead-facing view bundle; requires `X-Portal-Token` header
- Returns invoices, quotes, documents filtered by token permissions

**Permission scopes:**
- `view_quotes` — see quotes
- `view_invoices` — see invoices
- `sign_documents` — see documents
- `pay_invoices` — payment actions
- `view_project_status` — project progress

#### E-Signature (`/portal/esignature`)
- `POST /portal/esignature` — create signature request (returns one-time sign token)
- `GET /portal/esignature/{id}` — check status
- `POST /portal/sign` (public) — lead submits signature with IP capture and signature data
- Status lifecycle: `pending → signed / declined / expired`

---

### 7. Billing & Payments

#### Payment Links (`/billing/payment-links`)
- `POST /billing/payment-links` — creates Stripe Checkout Session + `PaymentLink` row
- `GET /billing/payment-links` — list all payment links
- `GET /billing/payment-links/{id}` — check payment status
- Link status: `active → paid / expired / canceled`

#### Stripe Webhook Handler (`POST /billing/stripe/webhook`)
- Verifies `Stripe-Signature` header
- Idempotency guard: deduplicates on `stripe_event_id` (unique index)
- Handles: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `invoice.paid`
- Auto-marks `Invoice` as `paid` and creates `Payment` record on success

#### Invoices (`/enterprise/invoices`)
- Line-item invoices with number, status, subtotal, tax, total, due date
- Status: `draft → sent → paid → overdue → cancelled`

#### Payments (`/enterprise/payments`)
- Payment records with provider, amount, status, external ID

#### Subscriptions (`/enterprise/subscriptions`)
- Recurring subscription tracking with plan name, monthly amount, period end

---

### 8. Project Management

#### Projects (`/projects`)
- Types: `website`, `seo`, `ads`, `social`, `email_marketing`, `automation`, `custom`
- Priority, budget (cents), actual cost, due date, goal
- `POST /projects/generate` — AI generates project + milestones + tasks from a prompt

#### Project Board (`/projects/{id}/board`)
- Milestones + tasks grouped by status, blockers, pending approvals

#### Tasks (`/projects/{id}/tasks`)
- Full CRUD with subtasks, dependencies, time tracking
- Assignee: human user or AI agent
- `requires_approval` flag for human gates
- `POST /{id}/tasks/{task_id}/queue-openclaw` — send to OpenClaw runtime

#### Kanban (`/projects/{id}/kanban`)
- Column CRUD with WIP limits and `is_done_column` flag
- `PATCH /tasks/{task_id}/move` — drag-and-drop column move
- Auto-applies automation rules on column transition
- `POST /defaults` — scaffold default columns for a project type

#### Milestones (`/projects/{id}/milestones`)
- Phase markers with status and due dates

#### Approvals (`/projects/{id}/approvals`)
- Approval requests from agents with `requested_by_agent`
- Human approves/rejects with decision note

#### Sprints (`/pm/projects/{id}/sprints`)
- Sprint planning with capacity in minutes, start/end dates
- Add/remove tasks from sprint

#### Project Risks (`/pm/projects/{id}/risks`)
- Risk registry with severity (`low/medium/high/critical`), status, mitigation plan, owner

#### Change Requests (`/pm/projects/{id}/change-requests`)
- Scope/budget/timeline change tracking with impact estimates
- Status: `pending → approved / rejected`

#### Portfolios (`/pm/portfolios`)
- Group multiple projects with weights and budget
- Executive overview across all portfolios

#### Workload (`/pm/workload`)
- Capacity allocation per user/agent (minutes per week)

#### Time Entries (`/enterprise/time-entries`)
- Time tracking per task with user or agent attribution

#### Executive PM Overview (`/pm/executive-overview`)
- Aggregates: active projects, overdue tasks, blocked tasks, open risks, critical risks, pending CRs, cost vs budget

---

### 9. Outbound Webhooks & Integrations

#### Webhook Endpoints (`/webhooks-out`)
- Register HTTP endpoints to receive CRM events
- Per-endpoint event filter list (e.g. `["lead.status_changed", "agent_action.created"]`) or `"*"` wildcard
- Auto-generated HMAC secret per endpoint

#### Webhook Delivery (`/webhooks-out/{id}/deliveries`)
- Delivery records with attempts, response code, response body
- `POST /deliveries/{did}/redeliver` — manually retry a failed delivery
- Celery task: 5 attempts, exponential backoff (1m→5m→15m→1h→3h)

**Signed request format:**
```
X-Mighty-Event: lead.status_changed
X-Mighty-Timestamp: 1718000000
X-Mighty-Signature: sha256(timestamp + "." + body)
X-Mighty-Delivery: {delivery_id}
```

#### Events that fire outbound webhooks (auto, via event bus):
- `lead.status_changed`
- `agent_action.created`

#### Inbound Webhooks (`/webhooks`)
- Receive signed payloads from external providers
- HMAC verification with timestamp replay protection

#### Integrations (`/integrations`)
- Integration connection registry (CRM, payment, etc.)
- `provider`, `status`, `external_account`, `config`, `last_sync_at`

#### API Keys (`/api-keys`)
- Create scoped programmatic access keys
- `mcrm_` prefix + 32-byte random token stored as pbkdf2_sha256 hash
- Scope list (e.g. `["leads:read", "leads:write"]`)
- Last-used timestamp, optional expiry, soft revoke

---

### 10. API Key Authentication

- Any request can authenticate via API key instead of JWT
- `verify_api_key()` — matches on 12-char prefix, then verifies full hash
- Expired and inactive keys rejected
- `last_used_at` updated on each successful verification

---

### 11. Reviews & Reputation (`/reviews`)
- Review request management with customer name, contact info
- Rating capture (1–5)
- Public review URL tracking
- Private feedback storage
- Status: `requested → received → published → suppressed`

---

### 12. Jobs (`/enterprise/jobs`)
- Field service job tracking with address, scheduled time, checklist
- Status: `requested → scheduled → in_progress → completed → canceled`

---

### 13. Websites, Landing Pages & Web Forms

#### Websites (`/enterprise/websites`)
- Domain/subdomain, status, industry, pages (JSON), SEO config

#### Landing Pages (`/enterprise/landing-pages`)
- Campaign-linked pages with slug, content JSON, published flag

#### Web Forms (`/enterprise/web-forms`)
- Configurable form fields, success message, active flag

---

### 14. CRM Data Organization

#### Pipelines (`/enterprise/pipelines`)
- Named sales pipelines with configurable stages and default flag

#### Tags & Segments
- `GET/POST /enterprise/tags` — color-coded tags
- `POST /enterprise/lead-tags` — tag a lead
- `POST /enterprise/segments` — save a filter-based audience segment

#### Documents (`/enterprise/documents`)
- File attachments or text content linked to a lead
- Kind: `note/contract/proposal/report`

#### Notifications (`/enterprise/notifications`)
- In-app notifications with read status and action URL

---

### 15. Support

#### Support Tickets (`/enterprise/support-tickets`)
- Subject, description, priority, status (`open → in_progress → resolved → closed`)
- Linked to a lead

---

## Celery Beat Tasks (Periodic)

| Task | Schedule | What it does |
|---|---|---|
| `process_scheduled_messages` | every ~1 min | Picks up all `ScheduledMessage` rows with `send_at ≤ now`, dispatches, advances drip enrollments |
| `process_sequence_steps` | every ~5 min | Finds stalled `DripEnrollment` rows past `next_send_at`, schedules next step |

---

## Complete API Surface (36 routers)

| Prefix | Tag | Endpoints |
|---|---|---|
| `/auth` | auth | login, refresh |
| `/organizations` | organizations | current, update |
| `/leads` | leads | CRUD + status events |
| `/contacts` | contacts | CRUD |
| `/opportunities` | opportunities | CRUD |
| `/tasks` | tasks | CRUD |
| `/communications` | communications | CRUD |
| `/notes` | notes | CRUD |
| `/agents` | agents | command, tasks, approve, result, memory |
| `/dashboard` | dashboard | summary |
| `/campaigns` | campaigns | CRUD |
| `/workflows` | workflows | CRUD |
| `/workflow-runtime` | workflow-runtime | run |
| `/inbox` | inbox | CRUD threads |
| `/appointments` | appointments | CRUD |
| `/products-services` | products-services | CRUD |
| `/quotes` | quotes | CRUD |
| `/reviews` | reviews | CRUD |
| `/integrations` | integrations | CRUD |
| `/intelligence` | intelligence | score, next-action, executive-report |
| `/enterprise` | enterprise | 24 generic resource types |
| `/webhooks` | webhooks | inbound provider webhook |
| `/messenger` | messenger | command, threads, messages, templates |
| `/openclaw` | openclaw | task result, contract, callback |
| `/projects` | projects | CRUD, board, generate, tasks, approvals |
| `/pm` | pm-advanced | portfolios, sprints, risks, change-requests, workload |
| `/projects/{id}/kanban` | kanban | board, columns, move tasks |
| `/analytics` | Analytics | pipeline, forecast, velocity, conversions, agent-perf, lead-sources |
| `/api-keys` | API Keys | create, list, revoke |
| `/billing` | Billing | payment-links, Stripe webhook |
| `/call-logs` | Call Logs | CRUD |
| `/email-templates` | Email Templates | CRUD, preview, render |
| `/portal` | Customer Portal | tokens, view, esignature, sign |
| `/scheduled-messages` | Scheduled Messages | schedule, cancel, send-now |
| `/sequences` | Drip Sequences | CRUD, steps, enroll, unenroll |
| `/webhooks-out` | Webhooks (Outbound) | CRUD, deliveries, redeliver |

---

## Data Model Summary (71 tables)

**Core:** Organization, User  
**CRM:** Lead, Contact, Opportunity, Task, Communication, Note, Appointment  
**Sales:** Pipeline, Tag, LeadTag, Segment, Quote, ProductService  
**Intelligence:** AgentAction, AgentMemory, AuditLog  
**Automation:** Workflow, WorkflowStep, AutomationRule, Campaign  
**Sequences:** DripSequence, DripStep, DripEnrollment, ScheduledMessage  
**Communication:** CallLog, EmailTemplate, InboxThread, ReviewRequest, Notification  
**Messenger:** MessengerThread, MessengerMessage, CommandExecution, CommandTemplate  
**Projects:** Project, ProjectMilestone, PMTask, PMTaskDependency, KanbanColumn, ProjectComment, ProjectFile, ProjectApproval, TimeEntry, ProjectPortfolio, PortfolioProject, ProjectSprint, SprintTask, ProjectRisk, ProjectChangeRequest, WorkloadAllocation, ProjectAutomationRule, ProjectTemplate  
**Web/Forms:** Website, LandingPage, WebForm  
**Jobs:** Job  
**Finance:** Invoice, Payment, Subscription, SupportTicket, Document, PaymentLink, StripeWebhookEvent  
**Portal:** PortalToken, ESignatureRequest  
**Integrations:** IntegrationConnection, WebhookEndpoint, WebhookDelivery, ApiKey  
**Analytics:** PipelineSnapshot  

---

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./mighty_crm.db` | PostgreSQL in production |
| `SECRET_KEY` | *(required in prod)* | JWT signing key |
| `REDIS_URL` | `redis://redis:6379/0` | Celery broker + backend |
| `AGENT_EXECUTOR` | `local` | `local` or `openclaw` |
| `STRIPE_SECRET_KEY` | *(empty)* | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | *(empty)* | Stripe webhook signing secret |
| `APP_BASE_URL` | `http://localhost:8000` | Used in Stripe redirect URLs |
| `PROVIDER_WEBHOOK_SECRET` | *(local default)* | Inbound webhook HMAC secret |
| `OPENCLAW_WEBHOOK_SECRET` | *(local default)* | OpenClaw callback HMAC secret |
| `ENVIRONMENT` | `local` | `local/staging/production` |
| `AUTO_CREATE_TABLES` | `true` | Set `false` and run Alembic in prod |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | Short-lived JWT lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh token lifetime |
