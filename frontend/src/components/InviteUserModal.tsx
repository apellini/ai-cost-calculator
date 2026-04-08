// frontend/src/components/InviteUserModal.tsx
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { UserPlus, X, Copy, Check, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, type InviteResponse } from '@/lib/api'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

export default function InviteUserModal({ onClose, onSuccess }: Props) {
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [role,     setRole]     = useState<'analyst' | 'viewer' | 'admin'>('analyst')
  const [password, setPassword] = useState('')
  const [result,   setResult]   = useState<InviteResponse | null>(null)
  const [copied,   setCopied]   = useState(false)

  const mutation = useMutation({
    mutationFn: () => api.users.invite({ name, email, role, password: password || undefined }),
    onSuccess: (data) => { setResult(data) },
  })

  const copyLink = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result.invite_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <UserPlus size={16} className="text-[#4f7dff]" />
            <h2 className="text-sm font-display font-600 text-[#0f1117]">Invite User</h2>
          </div>
          <button onClick={onClose} className="text-[#9099b0] hover:text-[#0f1117]"><X size={16} /></button>
        </div>

        {result ? (
          /* ── Success panel ── */
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
              <Check size={16} /> User <strong>{result.user.email}</strong> created
            </div>

            {result.generated_password && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium mb-2">
                  <AlertCircle size={12} /> Auto-generated password — shown once only
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white border border-amber-200 rounded px-3 py-1.5 text-sm font-mono text-[#0f1117]">
                    {result.generated_password}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(result.generated_password!)}
                    className="text-amber-600 hover:text-amber-800 p-1"
                    title="Copy password"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            )}

            <div>
              <div className="text-xs text-[#6b7380] mb-1.5 font-mono uppercase tracking-wider">Invite Link (valid 24h)</div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={result.invite_url}
                  className="flex-1 bg-[#f2f4f8] border border-black/10 rounded-lg px-3 py-2 text-xs font-mono text-[#6b7380] truncate"
                />
                <button
                  onClick={copyLink}
                  className="flex items-center gap-1 text-xs text-[#4f7dff] hover:text-[#3a6ae0] font-medium px-3 py-2 rounded-lg border border-[#4f7dff]/25 bg-[#4f7dff]/5 transition-colors"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => { onSuccess(); onClose() }}>Done</Button>
            </div>
          </div>
        ) : (
          /* ── Form ── */
          <form onSubmit={e => { e.preventDefault(); mutation.mutate() }} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#6b7380] mb-1.5 font-mono uppercase tracking-wider">Name</label>
                <Input placeholder="Jane Smith" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs text-[#6b7380] mb-1.5 font-mono uppercase tracking-wider">Email</label>
                <Input type="email" placeholder="jane@company.io" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#6b7380] mb-1.5 font-mono uppercase tracking-wider">Role</label>
              <div className="grid grid-cols-3 gap-2">
                {(['viewer', 'analyst', 'admin'] as const).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`px-3 py-2 rounded-lg text-xs capitalize text-center transition-all ${
                      role === r
                        ? 'bg-[#4f7dff]/10 text-[#0f1117] border border-[#4f7dff]/25 font-medium'
                        : 'bg-white text-[#6b7380] border border-black/10 hover:bg-black/3'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#6b7380] mb-1.5 font-mono uppercase tracking-wider">
                Password <span className="text-[#9099b0] normal-case">(leave blank to auto-generate)</span>
              </label>
              <Input
                type="password"
                placeholder="Auto-generated if blank"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {mutation.isError && (
              <p className="text-xs text-red-600">{(mutation.error as Error).message}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              <Button type="submit" size="sm" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
                Send Invite
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
