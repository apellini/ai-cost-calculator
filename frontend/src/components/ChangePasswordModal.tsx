import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { KeyRound, X, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, type UserOut } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

interface Props {
  target: UserOut           // the user whose password is being changed
  onClose: () => void
}

export default function ChangePasswordModal({ target, onClose }: Props) {
  const { user: currentUser } = useAuth()
  const isSelf = currentUser?.id === target.id

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw]         = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [done, setDone]           = useState(false)
  const [err, setErr]             = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      isSelf
        ? api.users.changeOwnPassword(currentPw, newPw)
        : api.users.changePassword(target.id, newPw),
    onSuccess: () => setDone(true),
    onError: (e: Error) => setErr(e.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    if (newPw !== confirmPw) { setErr('Passwords do not match'); return }
    if (newPw.length < 8)    { setErr('Password must be at least 8 characters'); return }
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-[#4f7dff]" />
            <h2 className="text-sm font-display font-600 text-[#0f1117]">
              {isSelf ? 'Change Your Password' : `Reset Password — ${target.email}`}
            </h2>
          </div>
          <button onClick={onClose} className="text-[#9099b0] hover:text-[#0f1117]"><X size={16} /></button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-4 text-green-600">
            <Check size={28} />
            <p className="text-sm font-medium">Password updated</p>
            <Button variant="outline" size="sm" onClick={onClose}>Done</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {isSelf && (
              <div>
                <label className="block text-xs text-[#6b7380] mb-1.5 font-mono uppercase tracking-wider">Current Password</label>
                <Input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} required />
              </div>
            )}
            <div>
              <label className="block text-xs text-[#6b7380] mb-1.5 font-mono uppercase tracking-wider">New Password</label>
              <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs text-[#6b7380] mb-1.5 font-mono uppercase tracking-wider">Confirm Password</label>
              <Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required />
            </div>
            {err && <p className="text-xs text-red-600">{err}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              <Button type="submit" size="sm" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
                Save
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
