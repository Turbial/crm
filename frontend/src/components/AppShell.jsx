import { useState, useEffect, useCallback } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Building2, Briefcase, FolderOpen,
  MessageSquare, Zap, CheckSquare, Bell, AlertTriangle,
  FileText, Copy, LogOut, Settings, Search,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { get } from '../api'
import SearchModal from './SearchModal'

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
  {
    section: 'Admin',
    items: [
      { label: 'Settings', to: '/settings', icon: Settings },
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
  const [searchOpen, setSearchOpen] = useState(false)

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => get('/notifications', { limit: 50 }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
  const unreadCount = notifications.filter(n => !n.read).length

  // ⌘K / Ctrl+K to open search
  const handleKeyDown = useCallback((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setSearchOpen(true)
    }
  }, [])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

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
          <div className="flex gap-2 items-center" style={{ marginLeft: 'auto' }}>
            <button
              className="btn btn-ghost btn-sm flex gap-1 items-center"
              onClick={() => setSearchOpen(true)}
              title="Search (⌘K)"
              style={{ color: 'var(--text-muted)', fontSize: 13 }}
            >
              <Search size={15} />
              <span style={{ display: 'none' }}>Search</span>
              <kbd style={{ fontSize: 10, background: 'var(--bg)', border: '1px solid var(--border-subtle)', borderRadius: 3, padding: '1px 4px' }}>⌘K</kbd>
            </button>

            <NavLink to="/notifications" className="btn btn-ghost btn-icon btn-sm" style={{ position: 'relative' }} title="Notifications">
              <Bell size={16} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: 2, right: 2,
                  background: 'var(--danger)', color: '#fff',
                  borderRadius: '50%', fontSize: 9, fontWeight: 700,
                  width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </NavLink>
          </div>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </div>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
