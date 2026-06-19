/**
 * @turbile/crm-api — typed API client for the Mighty CRM backend.
 *
 * Usage:
 *   import { CrmClient } from '@turbile/crm-api'
 *   const crm = new CrmClient({ baseUrl: 'http://localhost:8000', token: '...' })
 *   const leads = await crm.leads.list()
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type UserRole = 'owner' | 'manager' | 'employee' | 'agent'
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost'
export type ConversationChannel = 'web' | 'sms' | 'email' | 'whatsapp' | 'api'
export type ConversationStatus = 'open' | 'resolved' | 'snoozed' | 'spam'
export type ActionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
export type PermissionLevel = 'view' | 'edit' | 'delete' | 'admin'
export type DailyBriefStatus = 'generated' | 'delivered' | 'failed'

export interface TokenOut {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface UserOut {
  id: string
  organization_id: string
  name: string
  email: string
  role: UserRole
}

export interface OrganizationOut {
  id: string
  name: string
  industry?: string
  plan: string
  settings: Record<string, unknown>
}

export interface Lead {
  id: string
  organization_id: string
  name: string
  company?: string
  email?: string
  phone?: string
  source: string
  status: LeadStatus
  score: number
  address?: string
  city?: string
  state?: string
  website?: string
  metadata_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  organization_id: string
  name: string
  email?: string
  phone?: string
  company?: string
  title?: string
  created_at: string
  updated_at: string
}

export interface Company {
  id: string
  organization_id: string
  name: string
  domain?: string
  industry?: string
  size?: string
  created_at: string
  updated_at: string
}

export interface Deal {
  id: string
  organization_id: string
  name: string
  lead_id?: string
  company_id?: string
  contact_id?: string
  stage_id?: string
  value: number
  currency: string
  close_date?: string
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  organization_id: string
  channel: ConversationChannel
  status: ConversationStatus
  subject?: string
  lead_id?: string
  contact_id?: string
  assigned_to_id?: string
  created_at: string
  updated_at: string
}

export interface ConversationMessage {
  id: string
  conversation_id: string
  sender_type: string
  sender_name?: string
  body: string
  metadata_json: Record<string, unknown>
  created_at: string
}

export interface ActionRun {
  id: string
  organization_id: string
  action_key: string
  status: ActionStatus
  requested_by_id?: string
  input_payload: Record<string, unknown>
  output_payload?: Record<string, unknown>
  error_message?: string
  log_lines: string[]
  approval_status?: string
  created_at: string
  updated_at: string
}

export interface ApprovalRequest {
  id: string
  organization_id: string
  action_run_id: string
  requested_by_id?: string
  assigned_to_id?: string
  status: string
  reason?: string
  expires_at?: string
  resolved_at?: string
  created_at: string
  updated_at: string
}

export interface DuplicateCandidate {
  id: string
  organization_id: string
  entity_type: string
  entity_id_a: string
  entity_id_b: string
  score: number
  matched_fields: string[]
  status: string
  resolved_by_user_id?: string
  resolved_at?: string
  created_at: string
  updated_at: string
}

export interface SLARule {
  id: string
  organization_id: string
  name: string
  entity_type: string
  sla_hours: number
  condition_json: Record<string, unknown>
  escalate_to_user_id?: string
  escalate_via: string
  action_on_breach: string
  escalation_action_key?: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface RecordPermission {
  id: string
  organization_id: string
  entity_type: string
  entity_id: string
  permission: PermissionLevel
  user_id?: string
  role?: string
  granted_by_user_id?: string
  expires_at?: string
  created_at: string
  updated_at: string
}

export interface DailyBrief {
  id: string
  organization_id: string
  user_id?: string
  brief_date: string
  sections: Record<string, unknown>
  summary_text?: string
  status: DailyBriefStatus
  delivered_at?: string
  metadata_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface SupervisorStats {
  total_runs: number
  completed: number
  failed: number
  pending: number
  running: number
  stuck: number
  avg_duration_seconds?: number
}

export interface Notification {
  id: string
  organization_id: string
  user_id?: string
  title: string
  body?: string
  type: string
  read: boolean
  metadata_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface MessengerProposeOut {
  intent: string
  action_key: string
  confidence: number
  linked_entities: Record<string, unknown>
  proposed_payload: Record<string, unknown>
  requires_approval: boolean
  missing_fields: string[]
  definition_display_name?: string
  definition_category?: string
}

export interface MessengerChatOut {
  conversation_id: string
  user_message_id: string
  assistant_message_id: string
  assistant_text: string
  intent: string
  confidence: number
  action_key: string
  linked_entities: Record<string, unknown>
  card: Record<string, unknown>
}

// ── HTTP helpers ───────────────────────────────────────────────────────────────

export interface ClientConfig {
  baseUrl: string
  token?: string
  /** Called after a successful login to persist the token externally. */
  onToken?: (token: TokenOut) => void
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: unknown,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

class Http {
  constructor(private cfg: ClientConfig) {}

  private headers(): HeadersInit {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.cfg.token) h['Authorization'] = `Bearer ${this.cfg.token}`
    return h
  }

  setToken(t: string) {
    this.cfg.token = t
  }

  async request<T>(method: string, path: string, body?: unknown, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    let url = `${this.cfg.baseUrl}${path}`
    if (params) {
      const qs = Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
      if (qs) url += `?${qs}`
    }
    const res = await fetch(url, {
      method,
      headers: this.headers(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      let detail: unknown
      try { detail = await res.json() } catch { detail = await res.text() }
      throw new ApiError(res.status, detail, `${method} ${path} → ${res.status}`)
    }
    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
  }

  get<T>(path: string, params?: Record<string, string | number | boolean | undefined>) {
    return this.request<T>('GET', path, undefined, params)
  }
  post<T>(path: string, body?: unknown) { return this.request<T>('POST', path, body) }
  patch<T>(path: string, body?: unknown) { return this.request<T>('PATCH', path, body) }
  put<T>(path: string, body?: unknown) { return this.request<T>('PUT', path, body) }
  delete<T = void>(path: string, params?: Record<string, string | number | boolean | undefined>) {
    return this.request<T>('DELETE', path, undefined, params)
  }
}

// ── Resource modules ───────────────────────────────────────────────────────────

class AuthResource {
  constructor(private http: Http, private cfg: ClientConfig) {}

  async login(email: string, password: string): Promise<TokenOut> {
    const t = await this.http.post<TokenOut>('/auth/login', { email, password })
    this.http.setToken(t.access_token)
    this.cfg.onToken?.(t)
    return t
  }

  async refresh(refresh_token: string): Promise<TokenOut> {
    const t = await this.http.post<TokenOut>('/auth/refresh', { refresh_token })
    this.http.setToken(t.access_token)
    this.cfg.onToken?.(t)
    return t
  }

  me(): Promise<UserOut> { return this.http.get('/auth/me') }
}

class LeadsResource {
  constructor(private http: Http) {}
  list(params?: { status?: LeadStatus; limit?: number; offset?: number }): Promise<Lead[]> {
    return this.http.get('/leads', params as Record<string, string | number | boolean | undefined>)
  }
  get(id: string): Promise<Lead> { return this.http.get(`/leads/${id}`) }
  create(body: Partial<Lead>): Promise<Lead> { return this.http.post('/leads', body) }
  update(id: string, body: Partial<Lead>): Promise<Lead> { return this.http.patch(`/leads/${id}`, body) }
  delete(id: string): Promise<void> { return this.http.delete(`/leads/${id}`) }
}

class ContactsResource {
  constructor(private http: Http) {}
  list(params?: { limit?: number; offset?: number }): Promise<Contact[]> {
    return this.http.get('/contacts', params as Record<string, string | number | boolean | undefined>)
  }
  get(id: string): Promise<Contact> { return this.http.get(`/contacts/${id}`) }
  create(body: Partial<Contact>): Promise<Contact> { return this.http.post('/contacts', body) }
  update(id: string, body: Partial<Contact>): Promise<Contact> { return this.http.patch(`/contacts/${id}`, body) }
}

class CompaniesResource {
  constructor(private http: Http) {}
  list(params?: { limit?: number; offset?: number }): Promise<Company[]> {
    return this.http.get('/companies', params as Record<string, string | number | boolean | undefined>)
  }
  get(id: string): Promise<Company> { return this.http.get(`/companies/${id}`) }
  create(body: Partial<Company>): Promise<Company> { return this.http.post('/companies', body) }
  update(id: string, body: Partial<Company>): Promise<Company> { return this.http.patch(`/companies/${id}`, body) }
  leads(id: string): Promise<Lead[]> { return this.http.get(`/companies/${id}/leads`) }
  contacts(id: string): Promise<Contact[]> { return this.http.get(`/companies/${id}/contacts`) }
}

class DealsResource {
  constructor(private http: Http) {}
  list(params?: { lead_id?: string; company_id?: string; limit?: number }): Promise<Deal[]> {
    return this.http.get('/deals', params as Record<string, string | number | boolean | undefined>)
  }
  get(id: string): Promise<Deal> { return this.http.get(`/deals/${id}`) }
  create(body: Partial<Deal>): Promise<Deal> { return this.http.post('/deals', body) }
  update(id: string, body: Partial<Deal>): Promise<Deal> { return this.http.patch(`/deals/${id}`, body) }
  delete(id: string): Promise<void> { return this.http.delete(`/deals/${id}`) }
}

class ConversationsResource {
  constructor(private http: Http) {}
  list(params?: { status?: ConversationStatus; channel?: ConversationChannel; limit?: number }): Promise<Conversation[]> {
    return this.http.get('/conversations', params as Record<string, string | number | boolean | undefined>)
  }
  get(id: string): Promise<Conversation> { return this.http.get(`/conversations/${id}`) }
  create(body: Partial<Conversation>): Promise<Conversation> { return this.http.post('/conversations', body) }
  messages(id: string, params?: { limit?: number }): Promise<ConversationMessage[]> {
    return this.http.get(`/conversations/${id}/messages`, params as Record<string, string | number | boolean | undefined>)
  }
  addMessage(id: string, body: { body: string; sender_type?: string }): Promise<ConversationMessage> {
    return this.http.post(`/conversations/${id}/messages`, body)
  }
  resolve(id: string): Promise<Conversation> { return this.http.post(`/conversations/${id}/resolve`) }
  assign(id: string, user_id: string): Promise<Conversation> {
    return this.http.post(`/conversations/${id}/assign`, { user_id })
  }
}

class MessengerAiResource {
  constructor(private http: Http) {}
  classify(text: string): Promise<{ intent: string; action_key: string; confidence: number }> {
    return this.http.post('/messenger-ai/classify', { text })
  }
  propose(text: string): Promise<MessengerProposeOut> {
    return this.http.post('/messenger-ai/propose', { text })
  }
  execute(text: string, opts?: { min_confidence?: number; payload_override?: Record<string, unknown> }): Promise<{ status: string; run_id: string; action_key: string; output?: Record<string, unknown>; error?: string }> {
    return this.http.post('/messenger-ai/execute', { text, ...opts })
  }
  chat(text: string, opts?: { conversation_id?: string; auto_execute?: boolean }): Promise<MessengerChatOut> {
    return this.http.post('/messenger-ai/chat', { text, ...opts })
  }
}

class ActionRunsResource {
  constructor(private http: Http) {}
  list(params?: { action_key?: string; status?: ActionStatus; limit?: number }): Promise<ActionRun[]> {
    return this.http.get('/action-runs', params as Record<string, string | number | boolean | undefined>)
  }
  get(id: string): Promise<ActionRun> { return this.http.get(`/action-runs/${id}`) }
}

class ApprovalsResource {
  constructor(private http: Http) {}
  list(params?: { status?: string; limit?: number }): Promise<ApprovalRequest[]> {
    return this.http.get('/approvals', params as Record<string, string | number | boolean | undefined>)
  }
  get(id: string): Promise<ApprovalRequest> { return this.http.get(`/approvals/${id}`) }
  approve(id: string, reason?: string): Promise<ApprovalRequest> {
    return this.http.post(`/approvals/${id}/approve`, { reason })
  }
  reject(id: string, reason?: string): Promise<ApprovalRequest> {
    return this.http.post(`/approvals/${id}/reject`, { reason })
  }
}

class SupervisorResource {
  constructor(private http: Http) {}
  stats(since_hours?: number): Promise<SupervisorStats> {
    return this.http.get('/supervisor/stats', { since_hours })
  }
  stuck(): Promise<ActionRun[]> { return this.http.get('/supervisor/stuck') }
  overdueApprovals(): Promise<ApprovalRequest[]> { return this.http.get('/supervisor/overdue-approvals') }
  inactiveLeads(): Promise<Lead[]> { return this.http.get('/supervisor/inactive-leads') }
  scan(): Promise<{ escalated: number }> { return this.http.post('/supervisor/scan') }
}

class DailyBriefResource {
  constructor(private http: Http) {}
  latest(): Promise<DailyBrief> { return this.http.get('/daily-brief/latest') }
  get(id: string): Promise<DailyBrief> { return this.http.get(`/daily-brief/${id}`) }
  generate(): Promise<DailyBrief> { return this.http.post('/daily-brief/generate') }
}

class DuplicatesResource {
  constructor(private http: Http) {}
  list(params?: { entity_type?: string; status?: string; limit?: number; offset?: number }): Promise<DuplicateCandidate[]> {
    return this.http.get('/duplicates', params as Record<string, string | number | boolean | undefined>)
  }
  dismiss(id: string): Promise<DuplicateCandidate> {
    return this.http.post(`/duplicates/${id}/dismiss`)
  }
  mergeLeads(keep_id: string, merge_id: string): Promise<{ ok: boolean; merged_into: string; lead_name: string }> {
    return this.http.post(`/duplicates/merge-leads?keep_id=${encodeURIComponent(keep_id)}&merge_id=${encodeURIComponent(merge_id)}`)
  }
  scanLead(lead_id: string): Promise<{ found: number }> {
    return this.http.post(`/duplicates/scan-lead/${lead_id}`)
  }
}

class SlaRulesResource {
  constructor(private http: Http) {}
  list(entity_type?: string): Promise<SLARule[]> {
    return this.http.get('/sla-rules', entity_type ? { entity_type } : undefined)
  }
  create(body: Partial<SLARule>): Promise<SLARule> { return this.http.post('/sla-rules', body) }
  update(id: string, body: Partial<SLARule>): Promise<SLARule> { return this.http.patch(`/sla-rules/${id}`, body) }
  delete(id: string): Promise<void> { return this.http.delete(`/sla-rules/${id}`) }
  runCheck(): Promise<{ checked: number; breached: number }> { return this.http.post('/sla-rules/run-check') }
}

class RecordPermissionsResource {
  constructor(private http: Http) {}
  list(entity_type: string, entity_id: string): Promise<RecordPermission[]> {
    return this.http.get(`/permissions/${entity_type}/${entity_id}`)
  }
  grant(entity_type: string, entity_id: string, body: { permission: PermissionLevel; user_id?: string; role?: string; expires_at?: string }): Promise<RecordPermission> {
    return this.http.post(`/permissions/${entity_type}/${entity_id}`, body)
  }
  revoke(entity_type: string, entity_id: string, params: { user_id?: string; role?: string }): Promise<void> {
    return this.http.delete(`/permissions/${entity_type}/${entity_id}`, params as Record<string, string | number | boolean | undefined>)
  }
  check(entity_type: string, entity_id: string, required?: PermissionLevel): Promise<{ allowed: boolean; required: string }> {
    return this.http.get(`/permissions/${entity_type}/${entity_id}/check`, required ? { required } : undefined)
  }
}

class NotificationsResource {
  constructor(private http: Http) {}
  list(params?: { unread_only?: boolean; limit?: number }): Promise<Notification[]> {
    return this.http.get('/notifications', params as Record<string, string | number | boolean | undefined>)
  }
  unreadCount(): Promise<{ count: number }> { return this.http.get('/notifications/unread-count') }
  markRead(id: string): Promise<Notification> { return this.http.post(`/notifications/${id}/read`) }
  markAllRead(): Promise<{ updated: number }> { return this.http.post('/notifications/read-all') }
}

// ── Main client ───────────────────────────────────────────────────────────────

export class CrmClient {
  readonly auth: AuthResource
  readonly leads: LeadsResource
  readonly contacts: ContactsResource
  readonly companies: CompaniesResource
  readonly deals: DealsResource
  readonly conversations: ConversationsResource
  readonly messengerAi: MessengerAiResource
  readonly actionRuns: ActionRunsResource
  readonly approvals: ApprovalsResource
  readonly supervisor: SupervisorResource
  readonly dailyBrief: DailyBriefResource
  readonly duplicates: DuplicatesResource
  readonly slaRules: SlaRulesResource
  readonly permissions: RecordPermissionsResource
  readonly notifications: NotificationsResource

  constructor(config: ClientConfig) {
    const http = new Http(config)
    this.auth = new AuthResource(http, config)
    this.leads = new LeadsResource(http)
    this.contacts = new ContactsResource(http)
    this.companies = new CompaniesResource(http)
    this.deals = new DealsResource(http)
    this.conversations = new ConversationsResource(http)
    this.messengerAi = new MessengerAiResource(http)
    this.actionRuns = new ActionRunsResource(http)
    this.approvals = new ApprovalsResource(http)
    this.supervisor = new SupervisorResource(http)
    this.dailyBrief = new DailyBriefResource(http)
    this.duplicates = new DuplicatesResource(http)
    this.slaRules = new SlaRulesResource(http)
    this.permissions = new RecordPermissionsResource(http)
    this.notifications = new NotificationsResource(http)
  }
}

export default CrmClient
