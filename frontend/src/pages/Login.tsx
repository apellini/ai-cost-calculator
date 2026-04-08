// frontend/src/pages/Login.tsx
import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { Zap, ArrowRight, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { login } = useAuth()

  const urlEmail = searchParams.get('email') ?? ''
  const urlToken = searchParams.get('token') ?? ''

  const [email,    setEmail]    = useState(urlEmail || 'admin@example.com')
  const [password, setPassword] = useState(urlEmail ? '' : 'admin1234')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [inviteBanner, setInviteBanner] = useState<'pending' | 'valid' | 'expired' | null>(
    urlToken ? 'pending' : null
  )

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard'

  // Redeem invite token on mount (if present)
  useEffect(() => {
    if (!urlToken) return
    api.authUtils.redeemInvite(urlToken)
      .then(data => {
        setEmail(data.email)
        setInviteBanner('valid')
      })
      .catch(() => {
        setInviteBanner('expired')
        // Still pre-fill email from URL if token is expired
        if (urlEmail) setEmail(urlEmail)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f2f4f8] flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#4f7dff]/6 rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-[#a855f7]/4 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm px-4 animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#4f7dff] to-[#a855f7] flex items-center justify-center mb-4 shadow-lg shadow-[#4f7dff]/20">
            <Zap size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-display font-700 text-[#0f1117]">AI Cost Calculator</h1>
          <p className="text-sm text-[#6b7380] mt-1">Internal tool · v0.1</p>
        </div>

        {/* Invite banners */}
        {inviteBanner === 'valid' && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs">
            <CheckCircle size={13} /> You've been invited — enter your password to get started.
          </div>
        )}
        {inviteBanner === 'expired' && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs">
            <AlertCircle size={13} /> This invite link has expired. Ask an admin to send a new one.
          </div>
        )}

        <form onSubmit={handleSubmit} className="rounded-2xl border border-black/10 bg-white p-6 shadow-md">
          <h2 className="text-base font-display font-600 text-[#0f1117] mb-5">Sign in</h2>

          {error && (
            <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
              <AlertCircle size={13} /> {error}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-[#6b7380] mb-1.5 font-mono uppercase tracking-wider">Email</label>
              <Input
                type="email"
                placeholder="you@company.io"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#6b7380] mb-1.5 font-mono uppercase tracking-wider">Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full mt-5" disabled={loading}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        {!urlToken && (
          <p className="text-center text-xs text-[#9099b0] mt-4">
            Default: <span className="text-[#6b7380] font-mono">admin@example.com / admin1234</span>
          </p>
        )}
      </div>
    </div>
  )
}
