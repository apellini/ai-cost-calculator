import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Trash2, RefreshCw, Shield, User, Eye, CheckCircle, Loader2, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { api, type UserOut } from '@/lib/api'
import ChangePasswordModal from '@/components/ChangePasswordModal'
import InviteUserModal from '@/components/InviteUserModal'

const ROLE_CONFIG = {
  admin: { label: 'Admin', icon: Shield, variant: 'danger' as const },
  analyst: { label: 'Analyst', icon: User, variant: 'balanced' as const },
  viewer: { label: 'Viewer', icon: Eye, variant: 'muted' as const },
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'never'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

export default function Settings() {
  const qc = useQueryClient()
  const [llmBackend, setLlmBackend] = useState<'ollama' | 'lmstudio' | 'openai_compat' | 'mock'>('mock')
  const [refreshInterval, setRefreshInterval] = useState<'daily' | 'weekly' | 'manual'>('daily')
  const [refreshDone, setRefreshDone] = useState(false)

  const { data: staleness } = useQuery({
    queryKey: ['staleness'],
    queryFn: api.snapshots.staleness,
    staleTime: 30_000,
    retry: false,
  })

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: api.users.list,
    retry: false,
  })

  const [changePwTarget, setChangePwTarget] = useState<UserOut | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: api.users.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const refreshMutation = useMutation({
    mutationFn: api.snapshots.refresh,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staleness'] })
      qc.invalidateQueries({ queryKey: ['models'] })
      setRefreshDone(true)
      setTimeout(() => setRefreshDone(false), 3000)
    },
  })

  return (
    <div className="p-6 max-w-3xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-700 text-[#0f1117]">Settings</h1>
        <p className="text-sm text-[#6b7380] mt-0.5">Configure the AI backend and data refresh schedule</p>
      </div>

      {/* LLM Backend */}
      <section className="mb-8">
        <h2 className="text-xs font-mono uppercase tracking-wider text-[#9099b0] mb-3">LLM Backend</h2>
        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <label className="block text-xs text-[#6b7380] mb-1.5 font-mono uppercase tracking-wider">Backend</label>
              <div className="grid grid-cols-4 gap-2">
                {(['ollama', 'lmstudio', 'openai_compat', 'mock'] as const).map(b => (
                  <button
                    key={b}
                    onClick={() => setLlmBackend(b)}
                    className={`px-3 py-2 rounded-lg text-xs text-center transition-all ${
                      llmBackend === b
                        ? 'bg-[#4f7dff]/10 text-[#0f1117] border border-[#4f7dff]/25 font-medium'
                        : 'bg-white text-[#6b7380] border border-black/10 hover:bg-black/3 shadow-sm'
                    }`}
                  >
                    {b === 'openai_compat' ? 'OpenAI-compat' : b === 'mock' ? 'Mock (dev)' : b.charAt(0).toUpperCase() + b.slice(1)}
                  </button>
                ))}
              </div>
              {llmBackend === 'mock' && (
                <p className="text-xs text-amber-600 mt-2 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  Mock mode: using pre-scripted responses. Switch to Ollama or LM Studio for real LLM analysis.
                </p>
              )}
            </div>
            {llmBackend !== 'mock' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[#6b7380] mb-1.5 font-mono uppercase tracking-wider">Base URL</label>
                    <Input placeholder={llmBackend === 'ollama' ? 'http://localhost:11434' : 'http://localhost:1234/v1'} />
                  </div>
                  <div>
                    <label className="block text-xs text-[#6b7380] mb-1.5 font-mono uppercase tracking-wider">Model</label>
                    <Input placeholder={llmBackend === 'ollama' ? 'llama3.1:8b' : 'local-model'} />
                  </div>
                </div>
                {llmBackend === 'openai_compat' && (
                  <div>
                    <label className="block text-xs text-[#6b7380] mb-1.5 font-mono uppercase tracking-wider">API Key (optional)</label>
                    <Input type="password" placeholder="sk-…" />
                  </div>
                )}
              </>
            )}
            <div className="flex justify-end">
              <Button variant="primary" size="sm"><Save size={13} /> Save & Test Connection</Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Data Refresh */}
      <section className="mb-8">
        <h2 className="text-xs font-mono uppercase tracking-wider text-[#9099b0] mb-3">Data Refresh Schedule</h2>
        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <label className="block text-xs text-[#6b7380] mb-1.5 font-mono uppercase tracking-wider">Auto-Refresh Interval</label>
              <div className="grid grid-cols-3 gap-2">
                {(['daily', 'weekly', 'manual'] as const).map(i => (
                  <button
                    key={i}
                    onClick={() => setRefreshInterval(i)}
                    className={`px-3 py-2 rounded-lg text-xs text-center transition-all capitalize ${
                      refreshInterval === i
                        ? 'bg-[#4f7dff]/10 text-[#0f1117] border border-[#4f7dff]/25 font-medium'
                        : 'bg-white text-[#6b7380] border border-black/10 hover:bg-black/3 shadow-sm'
                    }`}
                  >
                    {i}
                  </button>
                ))}
              </div>
              <p className="text-xs text-[#9099b0] mt-2">
                Managed by APScheduler inside the app process — no external cron needed.
              </p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-black/8">
              <div className="text-xs text-[#6b7380]">
                Last refresh:{' '}
                <span className={`font-medium ${staleness?.is_stale ? 'text-amber-600' : 'text-[#0f1117]'}`}>
                  {staleness ? formatRelative(staleness.last_updated) : '—'}
                </span>
                {staleness && (
                  <span className="text-[#9099b0] ml-1">({staleness.model_count} models)</span>
                )}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
              >
                {refreshMutation.isPending
                  ? <><Loader2 size={13} className="animate-spin" /> Refreshing…</>
                  : refreshDone
                    ? <><CheckCircle size={13} className="text-green-600" /> Done</>
                    : <><RefreshCw size={13} /> Refresh Now</>
                }
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* User Management */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-mono uppercase tracking-wider text-[#9099b0]">User Management</h2>
          <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)}>
            Invite User
          </Button>
        </div>
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/7 bg-[#f8f9fb]">
                <th className="text-left px-5 py-3 text-xs font-mono uppercase tracking-wider text-[#9099b0]">User</th>
                <th className="text-left px-4 py-3 text-xs font-mono uppercase tracking-wider text-[#9099b0]">Role</th>
                <th className="text-right px-4 py-3 text-xs font-mono uppercase tracking-wider text-[#9099b0]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {users.map(u => {
                const isAdmin = u.role === 'admin'
                return (
                  <tr key={u.id} className="hover:bg-[#f8f9fb] transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4f7dff]/30 to-[#a855f7]/30 flex items-center justify-center text-[10px] font-bold text-[#4f7dff]">
                          {u.email.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-medium text-[#0f1117]">{u.name || u.email}</div>
                          <div className="text-[10px] text-[#9099b0]">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-[#6b7380] capitalize">{u.role}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="Change password"
                          onClick={() => setChangePwTarget(u)}
                          className="p-1.5 rounded text-[#9099b0] hover:text-[#4f7dff] hover:bg-[#4f7dff]/8 transition-colors"
                        >
                          <KeyRound size={13} />
                        </button>
                        <button
                          title={isAdmin ? 'Admin users cannot be deleted' : 'Delete user'}
                          disabled={isAdmin}
                          onClick={() => !isAdmin && deleteMutation.mutate(u.id)}
                          className={`p-1.5 rounded transition-colors ${
                            isAdmin
                              ? 'text-[#d1d5de] cursor-not-allowed'
                              : 'text-[#9099b0] hover:text-red-500 hover:bg-red-50'
                          }`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      </section>

      {changePwTarget && (
        <ChangePasswordModal
          target={changePwTarget}
          onClose={() => setChangePwTarget(null)}
        />
      )}

      {inviteOpen && (
        <InviteUserModal
          onClose={() => setInviteOpen(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['users'] })
            setInviteOpen(false)
          }}
        />
      )}
    </div>
  )
}
