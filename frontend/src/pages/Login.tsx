import { useNavigate } from 'react-router-dom'
import { Zap, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function Login() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-[#f2f4f8] flex items-center justify-center relative overflow-hidden">
      {/* Subtle background shapes */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#4f7dff]/6 rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-[#a855f7]/4 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm px-4 animate-fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#4f7dff] to-[#a855f7] flex items-center justify-center mb-4 shadow-lg shadow-[#4f7dff]/20">
            <Zap size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-display font-700 text-[#0f1117]">AI Cost Calculator</h1>
          <p className="text-sm text-[#6b7380] mt-1">Internal tool · v0.1 mockup</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-md">
          <h2 className="text-base font-display font-600 text-[#0f1117] mb-5">Sign in</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-[#6b7380] mb-1.5 font-mono uppercase tracking-wider">Email</label>
              <Input type="email" placeholder="marco@company.io" defaultValue="marco@company.io" />
            </div>
            <div>
              <label className="block text-xs text-[#6b7380] mb-1.5 font-mono uppercase tracking-wider">Password</label>
              <Input type="password" placeholder="••••••••" defaultValue="••••••••" />
            </div>
          </div>
          <Button
            variant="primary"
            size="lg"
            className="w-full mt-5"
            onClick={() => navigate('/dashboard')}
          >
            Sign in <ArrowRight size={15} />
          </Button>
        </div>

        <p className="text-center text-xs text-[#9099b0] mt-4">
          This is a <span className="text-[#6b7380]">UI mockup</span> — no backend connected
        </p>
      </div>
    </div>
  )
}
