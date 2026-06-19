import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import AppShell from './components/AppShell'
import Spinner from './components/Spinner'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Leads from './pages/crm/Leads'
import LeadDetail from './pages/crm/LeadDetail'
import Contacts from './pages/crm/Contacts'
import Companies from './pages/crm/Companies'
import Deals from './pages/crm/Deals'
import Projects from './pages/pm/Projects'
import ProjectBoard from './pages/pm/ProjectBoard'
import MessengerInbox from './pages/messenger/MessengerInbox'
import ConversationView from './pages/messenger/ConversationView'
import ActionRuns from './pages/actions/ActionRuns'
import Approvals from './pages/actions/Approvals'
import Supervisor from './pages/Supervisor'
import DailyBrief from './pages/DailyBrief'
import Duplicates from './pages/Duplicates'
import Notifications from './pages/Notifications'

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

// Route titles for the topbar
const TITLES = {
  '/dashboard': 'Dashboard',
  '/crm/leads': 'Leads', '/crm/contacts': 'Contacts', '/crm/companies': 'Companies', '/crm/deals': 'Deals',
  '/pm/projects': 'Projects',
  '/messenger': 'Messenger',
  '/actions': 'Action Runs',
  '/approvals': 'Approvals',
  '/supervisor': 'Supervisor',
  '/daily-brief': 'Daily Brief',
  '/duplicates': 'Duplicates',
  '/notifications': 'Notifications',
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
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/crm/leads" element={<Leads />} />
        <Route path="/crm/leads/:id" element={<LeadDetail />} />
        <Route path="/crm/contacts" element={<Contacts />} />
        <Route path="/crm/companies" element={<Companies />} />
        <Route path="/crm/deals" element={<Deals />} />
        <Route path="/pm/projects" element={<Projects />} />
        <Route path="/pm/projects/:id" element={<ProjectBoard />} />
        <Route path="/messenger" element={<MessengerInbox />} />
        <Route path="/messenger/:id" element={<ConversationView />} />
        <Route path="/actions" element={<ActionRuns />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/supervisor" element={<Supervisor />} />
        <Route path="/daily-brief" element={<DailyBrief />} />
        <Route path="/duplicates" element={<Duplicates />} />
        <Route path="/notifications" element={<Notifications />} />
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
