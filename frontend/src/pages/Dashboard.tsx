import { useNavigate } from 'react-router-dom'
import { Plus, BarChart3, Clock, TrendingDown, Calendar, ChevronRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BUNDLE_MONTHLY, PROJECT_BUDGET } from '@/mocks/data'
import { formatCurrency } from '@/lib/utils'

const economyCost = BUNDLE_MONTHLY[0].totalCost
const balancedCost = BUNDLE_MONTHLY[1].totalCost
const premiumCost = BUNDLE_MONTHLY[2].totalCost

export default function Dashboard() {
  const navigate = useNavigate()

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-display font-700 text-[#0f1117]">Dashboard</h1>
          <p className="text-sm text-[#6b7380] mt-0.5">Your AI projects and cost analyses</p>
        </div>
        <Button variant="primary" size="md" onClick={() => navigate('/new-project')}>
          <Plus size={15} /> New Project
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-6 animate-stagger">
        {[
          { label: 'Active Projects', value: '1', sub: 'TaskFlow', icon: BarChart3, color: '#4f7dff' },
          { label: 'Economy Budget', value: formatCurrency(economyCost), sub: `${Math.round(economyCost / PROJECT_BUDGET * 100)}% of $5k budget`, icon: TrendingDown, color: '#16a34a' },
          { label: 'Balanced Budget', value: formatCurrency(balancedCost), sub: `${Math.round(balancedCost / PROJECT_BUDGET * 100)}% of $5k budget`, icon: BarChart3, color: '#4f7dff' },
          { label: 'Features Analyzed', value: '8', sub: 'Across 3 bundle tiers', icon: Sparkles, color: '#9333ea' },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-[#9099b0] font-mono uppercase tracking-wider mb-2">{stat.label}</div>
                <div className="text-xl font-display font-700" style={{ color: stat.color }}>{stat.value}</div>
                <div className="text-xs text-[#6b7380] mt-0.5">{stat.sub}</div>
              </div>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${stat.color}14` }}>
                <stat.icon size={15} style={{ color: stat.color }} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Projects */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-mono uppercase tracking-wider text-[#9099b0]">Projects</h2>
      </div>

      {/* Demo project card */}
      <Card hover className="mb-3 animate-fade-in" onClick={() => navigate('/analysis')}>
        <CardContent className="p-0">
          <div className="flex items-center gap-4 p-5">
            {/* Icon */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4f7dff]/15 to-[#a855f7]/15 border border-black/8 flex items-center justify-center flex-none">
              <Sparkles size={18} className="text-[#9333ea]" />
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-medium text-[#0f1117]">TaskFlow - AI-Powered Project Manager</span>
                <Badge variant="balanced">8 features</Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-[#6b7380]">
                <span className="flex items-center gap-1"><Calendar size={11} /> Updated Apr 7, 2026</span>
                <span>Budget: <span className="text-[#0f1117] font-medium">${PROJECT_BUDGET.toLocaleString()}/mo</span></span>
                <Badge variant="warning">Budget exceeded (Balanced)</Badge>
              </div>
            </div>
            {/* Bundle costs */}
            <div className="flex items-center gap-4 text-right flex-none">
              <div>
                <div className="text-xs text-[#9099b0] mb-0.5">Economy</div>
                <div className="text-sm font-mono text-green-700 font-600">{formatCurrency(economyCost)}/mo</div>
              </div>
              <div>
                <div className="text-xs text-[#9099b0] mb-0.5">Balanced</div>
                <div className="text-sm font-mono text-blue-700 font-600">{formatCurrency(balancedCost)}/mo</div>
              </div>
              <div>
                <div className="text-xs text-[#9099b0] mb-0.5">Premium</div>
                <div className="text-sm font-mono text-purple-700 font-600">{formatCurrency(premiumCost)}/mo</div>
              </div>
              <ChevronRight size={16} className="text-[#9099b0]" />
            </div>
          </div>
          {/* Progress bar: budget utilization */}
          <div className="px-5 pb-4">
            <div className="flex items-center justify-between text-xs text-[#9099b0] mb-1.5">
              <span>Budget utilization (Balanced bundle)</span>
              <span className="text-amber-600 font-medium">{Math.round(balancedCost / PROJECT_BUDGET * 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-black/8 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-red-400" style={{ width: `${Math.min(100, Math.round(balancedCost / PROJECT_BUDGET * 100))}%` }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Empty state for new project */}
      <div
        className="border border-dashed border-black/14 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-[#4f7dff]/40 hover:bg-[#4f7dff]/3 transition-all cursor-pointer group"
        onClick={() => navigate('/new-project')}
      >
        <div className="w-10 h-10 rounded-xl bg-black/4 group-hover:bg-[#4f7dff]/10 border border-black/10 flex items-center justify-center mb-3 transition-colors">
          <Plus size={18} className="text-[#9099b0] group-hover:text-[#4f7dff] transition-colors" />
        </div>
        <div className="text-sm font-medium text-[#6b7380] group-hover:text-[#0f1117] transition-colors">Start a new project</div>
        <div className="text-xs text-[#9099b0] mt-0.5">Chat interview or upload a spec</div>
      </div>

      {/* Pricing staleness */}
      <div className="mt-6 flex items-center gap-2 text-xs text-[#9099b0]">
        <Clock size={12} />
        <span>Prices last updated <span className="text-[#6b7380]">3 days ago</span></span>
        <button className="text-[#4f7dff] hover:underline ml-1">Refresh now</button>
      </div>
    </div>
  )
}
