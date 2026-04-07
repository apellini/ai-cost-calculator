import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard, Plus, MessageSquare, BarChart3, GitCompare,
  Clock, Database, Settings, ChevronRight, Zap, LogOut
} from 'lucide-react'

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/new-project', icon: Plus, label: 'New Project' },
  { to: '/chat', icon: MessageSquare, label: 'Chat Interview' },
  { to: '/analysis', icon: BarChart3, label: 'Analysis' },
  { to: '/comparison', icon: GitCompare, label: 'Comparison' },
  { to: '/timeline', icon: Clock, label: 'Timeline' },
  { to: '/models', icon: Database, label: 'Model Catalog' },
  { to: '/settings', icon: Settings, label: 'Settings', adminOnly: true },
]

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const initials = user?.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? '??'

  const visibleNav = NAV.filter(item => !item.adminOnly || user?.role === 'admin')

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-none flex flex-col border-r border-black/8 bg-white">
        {/* Logo */}
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-black/8">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#4f7dff] to-[#a855f7] flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-display font-700 text-[#0f1117] leading-none">AI Cost</div>
            <div className="text-[10px] text-[#9099b0] font-mono mt-0.5">CALCULATOR</div>
          </div>
        </div>

        {/* Context indicator */}
        <div className="mx-3 mt-3 mb-1 px-3 py-2 rounded-lg bg-[#f2f4f8] border border-black/7">
          <div className="text-[10px] text-[#9099b0] uppercase tracking-wider mb-0.5 font-mono">Active Project</div>
          <div className="text-xs text-[#0f1117] font-medium truncate">TaskFlow - AI PM</div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {visibleNav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 group mb-0.5',
                isActive
                  ? 'bg-[#4f7dff]/10 text-[#0f1117] border border-[#4f7dff]/20'
                  : 'text-[#6b7380] hover:text-[#0f1117] hover:bg-black/4',
              )}
            >
              {({ isActive }) => (
                <>
                  <Icon size={15} className={isActive ? 'text-[#4f7dff]' : 'opacity-50 group-hover:opacity-80'} />
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight size={12} className="text-[#4f7dff]/50" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer — user info + logout */}
        <div className="p-3 border-t border-black/8">
          <div className="flex items-center gap-2.5 px-2 py-1.5 group">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#4f7dff] to-[#a855f7] flex items-center justify-center text-[10px] font-bold text-white flex-none">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-[#0f1117] truncate">{user?.name ?? '—'}</div>
              <div className="text-[10px] text-[#9099b0] capitalize">{user?.role}</div>
            </div>
            <button
              onClick={handleLogout}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-[#9099b0] hover:text-red-500 p-1 rounded"
              title="Sign out"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-[#f2f4f8]">
        <Outlet />
      </main>
    </div>
  )
}
