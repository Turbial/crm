import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import AppShell from './components/AppShell'
import Spinner from './components/Spinner'

import Login from './pages/Login'
import Signup from './pages/Signup'
import VerifyEmail from './pages/VerifyEmail'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'

// CRM
import Leads from './pages/crm/Leads'
import LeadDetail from './pages/crm/LeadDetail'
import Contacts from './pages/crm/Contacts'
import ContactDetail from './pages/crm/ContactDetail'
import Companies from './pages/crm/Companies'
import CompanyDetail from './pages/crm/CompanyDetail'
import Deals from './pages/crm/Deals'
import DealDetail from './pages/crm/DealDetail'
import Opportunities from './pages/crm/Opportunities'
import Tasks from './pages/crm/Tasks'
import Communications from './pages/crm/Communications'
import Notes from './pages/crm/Notes'

// Sales
import Appointments from './pages/sales/Appointments'
import Products from './pages/sales/Products'
import Quotes from './pages/sales/Quotes'
import CallLogs from './pages/sales/CallLogs'
import Reviews from './pages/sales/Reviews'
import QuoteDetail from './pages/sales/QuoteDetail'
import QuotePrint from './pages/sales/QuotePrint'

// Marketing
import Campaigns from './pages/marketing/Campaigns'
import Sequences from './pages/marketing/Sequences'
import EmailTemplates from './pages/marketing/EmailTemplates'
import ScheduledMessages from './pages/marketing/ScheduledMessages'

// PM
import Projects from './pages/pm/Projects'
import ProjectBoard from './pages/pm/ProjectBoard'
import PMExecutive from './pages/pm/PMExecutive'

// Operations
import MessengerInbox from './pages/messenger/MessengerInbox'
import ConversationView from './pages/messenger/ConversationView'
import ActionRuns from './pages/actions/ActionRuns'
import Approvals from './pages/actions/Approvals'
import Supervisor from './pages/Supervisor'
import DailyBrief from './pages/DailyBrief'
import Duplicates from './pages/Duplicates'
import ActivityFeed from './pages/ActivityFeed'
import Notifications from './pages/Notifications'
import Workflows from './pages/Workflows'
import InboxThreads from './pages/InboxThreads'

// Analytics & Admin
import Analytics from './pages/Analytics'
import Intelligence from './pages/Intelligence'
import Webhooks from './pages/Webhooks'
import Integrations from './pages/Integrations'
import Billing from './pages/Billing'
import AuditLog from './pages/AuditLog'
import Settings from './pages/Settings'
import CustomerPortal from './pages/CustomerPortal'
import FileManager from './pages/FileManager'
import AgentMemory from './pages/AgentMemory'
import Pipeline from './pages/Pipeline'

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

const TITLES = {
  '/dashboard': 'Dashboard',
  '/crm/leads': 'Leads', '/crm/contacts': 'Contacts', '/crm/companies': 'Companies', '/crm/deals': 'Deals',
  '/crm/leads/': 'Lead', '/crm/contacts/': 'Contact', '/crm/companies/': 'Company', '/crm/deals/': 'Deal',
  '/crm/opportunities': 'Opportunities', '/crm/tasks': 'Tasks',
  '/crm/communications': 'Communications', '/crm/notes': 'Notes',
  '/sales/appointments': 'Appointments', '/sales/products': 'Products & Services',
  '/sales/quotes': 'Quotes', '/sales/quotes/': 'Quote', '/sales/quotes/print': 'Quote Preview', '/sales/calls': 'Call Logs', '/sales/reviews': 'Reviews',
  '/pipeline': 'Pipeline',
  '/marketing/campaigns': 'Campaigns', '/marketing/sequences': 'Sequences',
  '/marketing/email-templates': 'Email Templates', '/marketing/scheduled': 'Scheduled Messages',
  '/pm/projects': 'Projects', '/pm/executive': 'PM Executive',
  '/pm/projects/': 'Project Board',
  '/messenger': 'Messenger',
  '/inbox': 'Inbox Threads',
  '/workflows': 'Workflows',
  '/actions': 'Action Runs',
  '/approvals': 'Approvals',
  '/supervisor': 'Supervisor',
  '/daily-brief': 'Daily Brief',
  '/duplicates': 'Duplicates',
  '/activity': 'Activity Feed',
  '/notifications': 'Notifications',
  '/analytics': 'Analytics',
  '/intelligence': 'Intelligence',
  '/portal': 'Customer Portal',
  '/files': 'File Manager',
  '/agent-memory': 'Agent Memory',
  '/webhooks': 'Webhooks',
  '/integrations': 'Integrations',
  '/billing': 'Billing',
  '/audit': 'Audit Log',
  '/settings': 'Settings',
  '/signup': 'Sign Up',
  '/verify-email': 'Verify Email',
  '/forgot-password': 'Forgot Password',
  '/reset-password': 'Reset Password',
}

function ProtectedRoute() {
  const { user } = useAuth()
  if (user === undefined) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  const title = Object.entries(TITLES).find(([k]) => location.pathname.startsWith(k))?.[1] || 'MightyOps'
  return <AppShell title={title} />
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user && user !== undefined ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />

        {/* CRM */}
        <Route path="/crm/leads" element={<Leads />} />
        <Route path="/crm/leads/:id" element={<LeadDetail />} />
        <Route path="/crm/contacts" element={<Contacts />} />
        <Route path="/crm/contacts/:id" element={<ContactDetail />} />
        <Route path="/crm/companies" element={<Companies />} />
        <Route path="/crm/companies/:id" element={<CompanyDetail />} />
        <Route path="/crm/deals" element={<Deals />} />
        <Route path="/crm/deals/:id" element={<DealDetail />} />
        <Route path="/crm/opportunities" element={<Opportunities />} />
        <Route path="/crm/tasks" element={<Tasks />} />
        <Route path="/crm/communications" element={<Communications />} />
        <Route path="/crm/notes" element={<Notes />} />

        {/* Sales */}
        <Route path="/sales/appointments" element={<Appointments />} />
        <Route path="/sales/products" element={<Products />} />
        <Route path="/sales/quotes" element={<Quotes />} />
        <Route path="/sales/quotes/:id" element={<QuoteDetail />} />
        <Route path="/sales/quotes/:id/print" element={<QuotePrint />} />
        <Route path="/sales/calls" element={<CallLogs />} />
        <Route path="/sales/reviews" element={<Reviews />} />

        {/* Marketing */}
        <Route path="/marketing/campaigns" element={<Campaigns />} />
        <Route path="/marketing/sequences" element={<Sequences />} />
        <Route path="/marketing/email-templates" element={<EmailTemplates />} />
        <Route path="/marketing/scheduled" element={<ScheduledMessages />} />

        {/* PM */}
        <Route path="/pm/projects" element={<Projects />} />
        <Route path="/pm/projects/:id" element={<ProjectBoard />} />
        <Route path="/pm/executive" element={<PMExecutive />} />

        {/* Operations */}
        <Route path="/messenger" element={<MessengerInbox />} />
        <Route path="/messenger/:id" element={<ConversationView />} />
        <Route path="/inbox" element={<InboxThreads />} />
        <Route path="/workflows" element={<Workflows />} />
        <Route path="/actions" element={<ActionRuns />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/supervisor" element={<Supervisor />} />
        <Route path="/daily-brief" element={<DailyBrief />} />
        <Route path="/duplicates" element={<Duplicates />} />
        <Route path="/activity" element={<ActivityFeed />} />
        <Route path="/notifications" element={<Notifications />} />

        {/* Analytics & Admin */}
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/intelligence" element={<Intelligence />} />
        <Route path="/portal" element={<CustomerPortal />} />
        <Route path="/files" element={<FileManager />} />
        <Route path="/agent-memory" element={<AgentMemory />} />
        <Route path="/webhooks" element={<Webhooks />} />
        <Route path="/integrations" element={<Integrations />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/audit" element={<AuditLog />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
