import { Clock, Zap, User, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { TIMELINE_FEATURES } from '@/mocks/data'

const START_DATE = new Date('2026-04-14')
const END_DATE = new Date('2026-05-30')
const TOTAL_DAYS = Math.ceil((END_DATE.getTime() - START_DATE.getTime()) / 86400000)

function dateToOffset(d: string): number {
  return Math.ceil((new Date(d).getTime() - START_DATE.getTime()) / 86400000)
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Timeline() {
  const totalWithAI = Math.max(...TIMELINE_FEATURES.map(f => dateToOffset(f.end)))
  const totalWithoutAI = TIMELINE_FEATURES.reduce((sum, f) => sum + f.withoutAiDays, 0)
  const aiSavingsPct = Math.round((1 - totalWithAI / totalWithoutAI) * 100)

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-700 text-[#0f1117]">Project Timeline</h1>
        <p className="text-sm text-[#6b7380] mt-0.5">ETA estimation with AI-assisted development speed</p>
      </div>

      {/* ROI Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6 animate-stagger">
        <Card className="p-4">
          <div className="text-xs text-[#9099b0] font-mono uppercase tracking-wider mb-1">With AI Assistance</div>
          <div className="text-2xl font-display font-700 text-[#4f7dff]">{totalWithAI} days</div>
          <div className="text-xs text-[#6b7380] mt-0.5">≈ {Math.ceil(totalWithAI / 7)} weeks</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-[#9099b0] font-mono uppercase tracking-wider mb-1">Without AI</div>
          <div className="text-2xl font-display font-700 text-[#6b7380]">{totalWithoutAI} days</div>
          <div className="text-xs text-[#6b7380] mt-0.5">≈ {Math.ceil(totalWithoutAI / 7)} weeks</div>
        </Card>
        <Card className="p-4" style={{ background: 'rgba(22,163,74,0.04)', borderColor: 'rgba(22,163,74,0.18)' }}>
          <div className="text-xs text-[#9099b0] font-mono uppercase tracking-wider mb-1">AI Time Savings</div>
          <div className="text-2xl font-display font-700 text-green-700">{aiSavingsPct}%</div>
          <div className="text-xs text-green-600 mt-0.5">{totalWithoutAI - totalWithAI} days saved</div>
        </Card>
      </div>

      {/* Gantt Chart */}
      <Card>
        <div className="px-5 py-3.5 border-b border-black/8">
          <h2 className="text-sm font-display font-600 text-[#0f1117]">Gantt Chart</h2>
        </div>
        <CardContent className="p-0 overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Date header */}
            <div className="flex border-b border-black/7 bg-[#f8f9fb] px-5 py-2">
              <div className="w-52 flex-none" />
              <div className="flex-1 relative h-5">
                {[0, 7, 14, 21, 28, 35, 42].map(d => {
                  const pct = d / TOTAL_DAYS * 100
                  if (pct > 100) return null
                  const date = new Date(START_DATE.getTime() + d * 86400000)
                  return (
                    <div key={d} className="absolute top-0 text-[10px] text-[#9099b0] font-mono" style={{ left: `${pct}%` }}>
                      {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Feature rows */}
            {TIMELINE_FEATURES.map(f => {
              const startPct = dateToOffset(f.start) / TOTAL_DAYS * 100
              const endPct = dateToOffset(f.end) / TOTAL_DAYS * 100
              const widthPct = endPct - startPct

              return (
                <div key={f.id} className="flex items-center border-b border-black/5 hover:bg-[#f8f9fb] transition-colors">
                  <div className="w-52 flex-none px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      {f.criticalPath && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-none" />}
                      <span className="text-xs text-[#0f1117] leading-tight">{f.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-[#9099b0]">
                      <span className="flex items-center gap-0.5"><Zap size={9} className="text-[#4f7dff]" />{f.withAiDays}d</span>
                      <span className="flex items-center gap-0.5"><User size={9} />{f.withoutAiDays}d</span>
                    </div>
                  </div>
                  <div className="flex-1 relative py-3 pr-5 h-10">
                    {[0, 7, 14, 21, 28, 35, 42].map(d => {
                      const pct = d / TOTAL_DAYS * 100
                      if (pct > 100) return null
                      return <div key={d} className="absolute top-0 bottom-0 w-px bg-black/5" style={{ left: `${pct}%` }} />
                    })}
                    <div
                      className="absolute top-1.5 bottom-1.5 rounded"
                      style={{
                        left: `${startPct}%`,
                        width: `${widthPct}%`,
                        background: f.criticalPath
                          ? 'rgba(245,158,11,0.3)'
                          : 'rgba(79,125,255,0.25)',
                        border: `1px solid ${f.criticalPath ? 'rgba(245,158,11,0.5)' : 'rgba(79,125,255,0.4)'}`,
                      }}
                    >
                      <div className="px-2 h-full flex items-center">
                        <span className="text-[10px] font-mono text-[#0f1117]/60 truncate">{formatDate(f.start)} → {formatDate(f.end)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
        <div className="px-5 py-3 border-t border-black/8 bg-[#f8f9fb] flex items-center gap-4 text-xs text-[#6b7380]">
          <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-amber-400/40 border border-amber-400/60" /> Critical path</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-blue-400/30 border border-blue-400/50" /> Non-critical</div>
          <div className="flex items-center gap-1.5"><Zap size={11} className="text-[#4f7dff]" /> With AI · <User size={11} /> Without AI</div>
        </div>
      </Card>

      {/* Feature dependency legend */}
      <div className="mt-4">
        <div className="text-xs text-[#9099b0] font-mono uppercase tracking-wider mb-2">Dependencies</div>
        <div className="space-y-1.5">
          {TIMELINE_FEATURES.filter(f => f.dependencies.length > 0).map(f => (
            <div key={f.id} className="flex items-center gap-2 text-xs text-[#6b7380]">
              <span className="text-[#0f1117] font-medium">{f.name}</span>
              <ArrowRight size={10} />
              <span>requires</span>
              {f.dependencies.map(dep => {
                const depF = TIMELINE_FEATURES.find(x => x.id === dep)
                return <Badge key={dep} variant="muted">{depF?.name ?? dep}</Badge>
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Per-feature breakdown */}
      <div className="mt-6">
        <div className="text-xs text-[#9099b0] font-mono uppercase tracking-wider mb-3">Time Breakdown per Feature</div>
        <div className="space-y-2">
          {TIMELINE_FEATURES.map(f => (
            <div key={f.id} className="flex items-center gap-4 text-xs">
              <div className="w-48 flex-none text-[#6b7380] truncate">{f.name}</div>
              <div className="flex-1 flex items-center gap-2">
                <div className="h-1.5 rounded-full bg-[#4f7dff]/30" style={{ width: `${f.withAiDays / 18 * 100}%`, maxWidth: '200px' }} />
                <span className="text-[#4f7dff] font-mono font-600">{f.withAiDays}d</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#9099b0]">
                <Clock size={10} />
                <span>vs {f.withoutAiDays}d</span>
              </div>
              {f.criticalPath && <Badge variant="warning">Critical</Badge>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
