import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Building2, Briefcase, FolderOpen,
  MessageSquare, Zap, CheckSquare, Bell, AlertTriangle,
  FileText, Copy, LogOut, Settings,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const NAV = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  {
    section: 'CRM',
    items: [
      { label: 'Leads', to: '/crm/leads', icon: Users },
      { label: 'Contacts', to: '/crm/contacts', icon: Users },
      { label: 'Companies', to: '/crm/companies', icon: Building2 },
      { label: 'Deals', to: '/crm/deals', icon: Briefcase },
    ],
  },
  {
    section: 'Projects',
    items: [
      { label: 'Projects', to: '/pm/projects', icon: FolderOpen },
    ],
  },
  {
    section: 'Operations',
    items: [
      { label: 'Messenger', to: '/messenger', icon: MessageSquare },
      { label: 'Action Runs', to: '/actions', icon: Zap },
      { label: 'Approvals', to: '/approvals', icon: CheckSquare },
      { label: 'Supervisor', to: '/supervisor', icon: AlertTriangle },
      { label: 'Daily Brief', to: '/daily-brief', icon: FileText },
      { label: 'Duplicates', to: '/duplicates', icon: Copy },
      { label: 'Notifications', to: '/notifications', icon: Bell },
    ],
  },
]

function SidebarLink({ to, icon: Icon, label }) {
  return (
    <NavLink to={to} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
      <Icon size={16} />
      <span>{label}</span>
    </NavLink>
  )
}

export default function AppShell({ title }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span>MightyOps</span>
        </div>

        <nav className="sidebar-section">
          <SidebarLink to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
        </nav>

        {NAV.filter(n => n.section).map(group => (
          <div key={group.section} className="sidebar-section">
            <div className="sidebar-label">{group.section}</div>
            {group.items.map(item => (
              <SidebarLink key={item.to} to={item.to} icon={item.icon} label={item.label} />
            ))}
          </div>
        ))}

        <div className="sidebar-bottom">
          {user && (
            <div className="user-chip" onClick={handleLogout} title="Logout">
              <div className="avatar">{user.name?.[0]?.toUpperCase() || 'U'}</div>
              <div className="user-info">
                <strong>{user.name}</strong>
                <small>{user.role}</small>
              </div>
              <LogOut size={14} style={{ color: '#64748b', marginLeft: 'auto' }} />
            </div>
          )}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <span className="topbar-title">{title}</span>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
