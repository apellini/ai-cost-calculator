import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Clock, Zap, User, Loader2, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { api, type TimelineOut } from '@/lib/api'

function dateToOffset(d: string, start: string): number {
  return Math.ceil((new Date(d).getTime() - new Date(start).getTime()) / 86400000)
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Timeline() {
  const [searchParams] = useSearchParams()
  const projectId = Number(searchParams.get('project') ?? 1)

  const { data, isLoading, error } = useQuery<TimelineOut>({
    queryKey: ['timeline', projectId],
    queryFn: () => api.timeline.get(projectId),
    retry: false,
  })

  const aiSavingsPct = data
    ? Math.round((1 - data.total_with_ai_days / data.total_without_ai_days) * 100)
    : 0

  const TOTAL_DAYS = data
    ? Math.ceil((new Date(data.end_date).getTime() - new Date(data.start_date).getTime()) / 86400000)
    : 1

  // Generate week markers
  const weekMarkers: number[] = []
  for (let d = 0; d <= TOTAL_DAYS; d += 7) weekMarkers.push(d)

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-700 text-[#0f1117]">Project Timeline</h1>
        <p className="text-sm text-[#6b7380] mt-0.5">ETA estimation with AI-assisted development speed</p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-[#9099b0]">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading timeline…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          <AlertCircle size={15} />
          {String(error).includes('404')
            ? 'No features found. Add features and run analysis first.'
            : String(error)}
        </div>
      )}

      {data && (
        <>
          {/* ROI Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="p-4">
              <div className="text-xs text-[#9099b0] font-mono uppercase tracking-wider mb-1">With AI Assistance</div>
              <div className="text-2xl font-display font-700 text-[#4f7dff]">{data.total_with_ai_days} days</div>
              <div className="text-xs text-[#6b7380] mt-0.5">≈ {Math.ceil(data.total_with_ai_days / 7)} weeks</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-[#9099b0] font-mono uppercase tracking-wider mb-1">Without AI</div>
              <div className="text-2xl font-display font-700 text-[#6b7380]">{data.total_without_ai_days} days</div>
              <div className="text-xs text-[#6b7380] mt-0.5">≈ {Math.ceil(data.total_without_ai_days / 7)} weeks</div>
            </Card>
            <Card className="p-4" style={{ background: 'rgba(22,163,74,0.04)', borderColor: 'rgba(22,163,74,0.18)' }}>
              <div className="text-xs text-[#9099b0] font-mono uppercase tracking-wider mb-1">AI Time Savings</div>
              <div className="text-2xl font-display font-700 text-green-700">{aiSavingsPct}%</div>
              <div className="text-xs text-green-600 mt-0.5">{data.total_without_ai_days - data.total_with_ai_days} days saved</div>
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
                    {weekMarkers.map(d => {
                      const pct = d / TOTAL_DAYS * 100
                      if (pct > 100) return null
                      const date = new Date(new Date(data.start_date).getTime() + d * 86400000)
                      return (
                        <div key={d} className="absolute top-0 text-[10px] text-[#9099b0] font-mono" style={{ left: `${pct}%` }}>
                          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Feature rows */}
                {data.features.map(f => {
                  const startPct = dateToOffset(f.start_date, data.start_date) / TOTAL_DAYS * 100
                  const endPct = dateToOffset(f.end_date, data.start_date) / TOTAL_DAYS * 100
                  const widthPct = Math.max(endPct - startPct, 1)

                  return (
                    <div key={f.feature_id} className="flex items-center border-b border-black/5 hover:bg-[#f8f9fb] transition-colors">
                      <div className="w-52 flex-none px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          {f.critical_path && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-none" />}
                          <span className="text-xs text-[#0f1117] leading-tight">{f.feature_name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-[#9099b0]">
                          <span className="flex items-center gap-0.5"><Zap size={9} className="text-[#4f7dff]" />{f.with_ai_days}d</span>
                          <span className="flex items-center gap-0.5"><User size={9} />{f.without_ai_days}d</span>
                        </div>
                      </div>
                      <div className="flex-1 relative py-3 pr-5 h-10">
                        {weekMarkers.map(d => {
                          const pct = d / TOTAL_DAYS * 100
                          if (pct > 100) return null
                          return <div key={d} className="absolute top-0 bottom-0 w-px bg-black/5" style={{ left: `${pct}%` }} />
                        })}
                        <div
                          className="absolute top-1.5 bottom-1.5 rounded"
                          style={{
                            left: `${startPct}%`,
                            width: `${widthPct}%`,
                            background: f.critical_path
                              ? 'rgba(245,158,11,0.3)'
                              : 'rgba(79,125,255,0.25)',
                            border: `1px solid ${f.critical_path ? 'rgba(245,158,11,0.5)' : 'rgba(79,125,255,0.4)'}`,
                          }}
                        >
                          <div className="px-2 h-full flex items-center">
                            <span className="text-[10px] font-mono text-[#0f1117]/60 truncate">
                              {formatDate(f.start_date)} → {formatDate(f.end_date)}
                            </span>
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

          {/* Per-feature breakdown */}
          <div className="mt-6">
            <div className="text-xs text-[#9099b0] font-mono uppercase tracking-wider mb-3">Time Breakdown per Feature</div>
            <div className="space-y-2">
              {data.features.map(f => {
                const maxDays = Math.max(...data.features.map(x => x.with_ai_days))
                return (
                  <div key={f.feature_id} className="flex items-center gap-4 text-xs">
                    <div className="w-48 flex-none text-[#6b7380] truncate">{f.feature_name}</div>
                    <div className="flex-1 flex items-center gap-2">
                      <div
                        className="h-1.5 rounded-full bg-[#4f7dff]/30"
                        style={{ width: `${(f.with_ai_days / maxDays) * 100}%`, maxWidth: '200px' }}
                      />
                      <span className="text-[#4f7dff] font-mono font-600">{f.with_ai_days}d</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#9099b0]">
                      <Clock size={10} />
                      <span>vs {f.without_ai_days}d</span>
                    </div>
                    {f.critical_path && <Badge variant="warning">Critical</Badge>}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
