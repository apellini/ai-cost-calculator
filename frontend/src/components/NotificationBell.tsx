import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, BarChart3, AlertCircle, Clock } from 'lucide-react'
import { api, type NotificationOut } from '@/lib/api'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const TYPE_ICON: Record<string, typeof BarChart3> = {
  analysis_complete: BarChart3,
  analysis_failed: AlertCircle,
}

export default function NotificationBell() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: countData } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: api.notifications.unreadCount,
    refetchInterval: 30_000,
    retry: false,
  })

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: api.notifications.list,
    enabled: open,
    retry: false,
  })

  const markRead = useMutation({
    mutationFn: api.notifications.markRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications-count'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAllRead = useMutation({
    mutationFn: api.notifications.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications-count'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const unread = countData?.count ?? 0

  const handleNotifClick = (n: NotificationOut) => {
    if (!n.is_read) markRead.mutate(n.id)
    if (n.project_id) navigate(`/analysis?project=${n.project_id}`)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg text-[#6b7380] hover:bg-black/6 hover:text-[#0f1117] transition-all"
        title="Notifications"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-[#4f7dff] text-white text-[9px] font-bold flex items-center justify-center px-1">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-black/10 shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/7 bg-[#f8f9fb]">
            <span className="text-xs font-display font-600 text-[#0f1117]">
              Notifications {unread > 0 && <span className="text-[#4f7dff]">({unread} new)</span>}
            </span>
            {unread > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="text-[10px] text-[#4f7dff] hover:underline flex items-center gap-1"
              >
                <CheckCheck size={11} /> Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto divide-y divide-black/5">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#9099b0]">
                <Bell size={20} className="mx-auto mb-2 opacity-30" />
                No notifications yet
              </div>
            ) : (
              notifications.map(n => {
                const Icon = TYPE_ICON[n.type] ?? Clock
                const isFailed = n.type === 'analysis_failed'
                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    className={`w-full text-left px-4 py-3 hover:bg-[#f8f9fb] transition-colors flex gap-3 ${
                      n.is_read ? 'opacity-60' : ''
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full flex-none flex items-center justify-center mt-0.5 ${
                      isFailed ? 'bg-red-100' : 'bg-[#4f7dff]/10'
                    }`}>
                      <Icon size={13} className={isFailed ? 'text-red-500' : 'text-[#4f7dff]'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-medium text-[#0f1117] leading-tight">
                          {n.title}
                        </span>
                        {!n.is_read && (
                          <div className="w-1.5 h-1.5 rounded-full bg-[#4f7dff] flex-none mt-1" />
                        )}
                      </div>
                      <p className="text-[11px] text-[#6b7380] mt-0.5 leading-relaxed line-clamp-2">
                        {n.message}
                      </p>
                      <span className="text-[10px] text-[#9099b0] mt-1 block">{timeAgo(n.created_at)}</span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
