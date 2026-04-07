import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ChevronRight, Loader2, Sparkles, TrendingDown, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api, type AnalysisOut, type BundleOut, type ProjectDetail } from '@/lib/api'
import { formatCurrency, formatTokens } from '@/lib/utils'
import ExportMenu from '@/components/ExportMenu'
import StalenessIndicator from '@/components/StalenessIndicator'

const CATEGORY_LABELS: Record<string, string> = {
  qa_chatbot: 'Q&A', reasoning_analysis: 'Reasoning', summarization: 'Summarization',
  code_review: 'Code Review', content_generation: 'Content Gen', code_generation: 'Code Gen',
  data_extraction: 'Data Extraction', translation: 'Translation',
}

const TIER_CONFIG = {
  economy: { label: 'Economy', color: '#16a34a', bg: 'rgba(22,163,74,0.06)', border: 'rgba(22,163,74,0.2)', textColor: 'text-green-700' },
  balanced: { label: 'Balanced', color: '#4f7dff', bg: 'rgba(79,125,255,0.06)', border: 'rgba(79,125,255,0.2)', textColor: 'text-blue-700' },
  premium: { label: 'Premium', color: '#9333ea', bg: 'rgba(147,51,234,0.06)', border: 'rgba(147,51,234,0.2)', textColor: 'text-purple-700' },
}

export default function Analysis() {
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()
  const projectId = Number(searchParams.get('project') ?? 1)

  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [selectedTier, setSelectedTier] = useState<'economy' | 'balanced' | 'premium'>('balanced')

  const toggle = (id: number) => setExpanded(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const { data: project } = useQuery<ProjectDetail>({
    queryKey: ['project', projectId],
    queryFn: () => api.projects.get(projectId),
  })

  const { data: analysis, isLoading: analysisLoading } = useQuery<AnalysisOut>({
    queryKey: ['analysis', projectId],
    queryFn: () => api.analysis.get(projectId),
    retry: false,
  })

  const runAnalysis = useMutation({
    mutationFn: () => api.analysis.run(projectId),
    onSuccess: (data) => {
      qc.setQueryData(['analysis', projectId], data)
    },
  })

  const budget = project?.budget_monthly ?? 0
  const selectedBundle: BundleOut | undefined = analysis?.bundles.find(b => b.tier === selectedTier)
  const overBudget = budget > 0 && !!selectedBundle && selectedBundle.total_cost > budget

  // Build excluded feature IDs from optimization result
  const excludedIds = new Set<number>()
  if (overBudget && selectedBundle) {
    const items = [...selectedBundle.feature_costs].sort((a, b) => {
      const fa = project?.features.find(f => f.id === a.feature_id)
      const fb = project?.features.find(f => f.id === b.feature_id)
      return (fa?.priority ?? 5) - (fb?.priority ?? 5)
    })
    let running = 0
    for (const fc of items) {
      if (selectedBundle.total_cost - running <= budget) break
      excludedIds.add(fc.feature_id)
      running += fc.cost
    }
  }

  const features = project?.features ?? []

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-700 text-[#0f1117]">Cost Analysis</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-[#9099b0]">{project?.name ?? '…'}</span>
            <StalenessIndicator />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {analysis && project && (
            <ExportMenu projectId={projectId} projectName={project.name} />
          )}
          <Button
            variant="primary" size="sm"
            onClick={() => runAnalysis.mutate()}
            disabled={runAnalysis.isPending}
          >
            {runAnalysis.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {analysis ? 'Re-run Analysis' : 'Run Analysis'}
          </Button>
        </div>
      </div>

      {/* Background queued banner */}
      {(analysis?.is_background || runAnalysis.data?.is_background) && analysis?.status === 'queued' && (
        <div className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-[#4f7dff]/6 border border-[#4f7dff]/20 text-sm text-[#4f7dff]">
          <Loader2 size={16} className="animate-spin flex-none" />
          <div>
            <div className="font-medium">Analysis running in background</div>
            <div className="text-xs text-[#4f7dff]/70 mt-0.5">
              This analysis requires LLM decomposition. You'll get a notification when it's ready.
            </div>
          </div>
        </div>
      )}

      {/* No analysis yet */}
      {!analysisLoading && !analysis && !runAnalysis.isPending && (
        <div className="mb-6 rounded-xl border border-black/10 bg-white p-8 text-center">
          <Sparkles size={32} className="text-[#4f7dff] mx-auto mb-3" />
          <div className="text-sm font-medium text-[#0f1117] mb-1">No analysis yet</div>
          <div className="text-xs text-[#6b7380] mb-4">Click "Run Analysis" to estimate costs using the mock LLM adapter</div>
          <Button variant="primary" size="sm" onClick={() => runAnalysis.mutate()}>
            <Sparkles size={13} /> Run Analysis
          </Button>
        </div>
      )}

      {/* Loading state */}
      {(analysisLoading || runAnalysis.isPending) && (
        <div className="flex items-center justify-center py-12 text-[#9099b0]">
          <Loader2 size={20} className="animate-spin mr-2" />
          {runAnalysis.isPending ? 'Running analysis…' : 'Loading…'}
        </div>
      )}

      {/* Error */}
      {runAnalysis.isError && (
        <div className="mb-5 flex items-center gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle size={15} /> {String(runAnalysis.error)}
        </div>
      )}

      {analysis && (
        <>
          {/* Budget Warning */}
          {overBudget && selectedBundle && (
            <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 animate-fade-in">
              <div className="flex items-start gap-3">
                <AlertTriangle size={16} className="text-amber-500 flex-none mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-medium text-amber-800">Budget exceeded</span>
                    <Badge variant="warning">Budget: {formatCurrency(budget)}/mo</Badge>
                    <ChevronRight size={12} className="text-amber-400" />
                    <Badge variant="warning">Estimated ({TIER_CONFIG[selectedTier].label}): {formatCurrency(selectedBundle.total_cost)}/mo</Badge>
                    <ChevronRight size={12} className="text-amber-400" />
                    <Badge variant="warning">{excludedIds.size} feature{excludedIds.size !== 1 ? 's' : ''} excluded</Badge>
                  </div>
                  {excludedIds.size > 0 && (
                    <div className="mt-1.5 text-xs text-amber-700">
                      Excluded: {features.filter(f => excludedIds.has(f.id)).map(f => f.name).join(', ')}
                    </div>
                  )}
                </div>
                <div className="text-right flex-none">
                  <div className="text-xs text-amber-600">Gap to cover all</div>
                  <div className="text-sm font-mono text-amber-700 font-600">{formatCurrency(selectedBundle.total_cost - budget)}/mo</div>
                </div>
              </div>
            </div>
          )}

          {/* Bundle cards */}
          <div className="grid grid-cols-3 gap-4 mb-6 animate-stagger">
            {(['economy', 'balanced', 'premium'] as const).map(tier => {
              const cfg = TIER_CONFIG[tier]
              const bundle = analysis.bundles.find(b => b.tier === tier)
              if (!bundle) return null
              const isSelected = selectedTier === tier
              const withinBudget = budget === 0 || bundle.total_cost <= budget
              return (
                <button
                  key={tier}
                  onClick={() => setSelectedTier(tier)}
                  className={`rounded-xl border p-4 text-left transition-all ${isSelected ? 'shadow-md' : 'border-black/10 bg-white hover:border-black/18 hover:shadow-sm shadow-sm'}`}
                  style={isSelected ? { background: cfg.bg, borderColor: cfg.border, boxShadow: `0 4px 16px ${cfg.color}18` } : {}}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono uppercase tracking-wider font-600" style={{ color: isSelected ? cfg.color : '#9099b0' }}>{cfg.label}</span>
                    {withinBudget
                      ? <Badge variant="economy"><TrendingDown size={9} /> Within budget</Badge>
                      : <Badge variant="warning"><AlertTriangle size={9} /> {Math.round(bundle.total_cost / budget * 100)}% of budget</Badge>
                    }
                  </div>
                  <div className="text-2xl font-display font-700 mb-0.5" style={{ color: cfg.color }}>
                    {formatCurrency(bundle.total_cost)}
                  </div>
                  <div className="text-xs text-[#6b7380]">per month · worst-case</div>
                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-black/8">
                      <div className="text-xs text-[#6b7380]">Strategy: <span style={{ color: cfg.color }} className="font-medium">
                        {tier === 'economy' ? 'cheapest within capability thresholds' :
                         tier === 'balanced' ? 'best cost/quality ratio per category' :
                         'highest-capability models regardless of cost'}
                      </span></div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Cost Table */}
          <Card>
            <div className="px-5 py-3.5 border-b border-black/8 flex items-center justify-between">
              <h2 className="text-sm font-display font-600 text-[#0f1117]">Feature Cost Breakdown</h2>
              <div className="flex items-center gap-3">
                {(['economy', 'balanced', 'premium'] as const).map(t => (
                  <div key={t} className="flex items-center gap-1 text-xs text-[#6b7380]">
                    <div className="w-2 h-2 rounded-full" style={{ background: TIER_CONFIG[t].color }} />
                    {TIER_CONFIG[t].label}
                  </div>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/7 bg-[#f8f9fb]">
                    <th className="text-left px-5 py-3 text-xs font-mono uppercase tracking-wider text-[#9099b0]">Feature</th>
                    <th className="text-left px-3 py-3 text-xs font-mono uppercase tracking-wider text-[#9099b0]">Category</th>
                    <th className="text-right px-3 py-3 text-xs font-mono uppercase tracking-wider text-[#9099b0]">Tokens</th>
                    {(['economy', 'balanced', 'premium'] as const).map(t => (
                      <th key={t} className="text-right px-4 py-3 text-xs font-mono uppercase tracking-wider" style={{ color: TIER_CONFIG[t].color }}>{TIER_CONFIG[t].label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {features.map(feature => {
                    const isOpen = expanded.has(feature.id)
                    const isExcluded = excludedIds.has(feature.id)
                    const totalTokens = (feature.total_input_tokens ?? 0) + (feature.total_output_tokens ?? 0)
                    return (
                      <>
                        <tr
                          key={feature.id}
                          className={`transition-colors ${isExcluded ? 'opacity-40' : 'hover:bg-[#f8f9fb]'} cursor-pointer`}
                          onClick={() => toggle(feature.id)}
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <ChevronRight size={13} className={`text-[#9099b0] flex-none transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                              <div>
                                <div className="font-medium text-[#0f1117] flex items-center gap-2">
                                  {feature.name}
                                  {isExcluded && <Badge variant="warning">Excluded</Badge>}
                                </div>
                                <div className="text-xs text-[#9099b0] mt-0.5">{(feature.description ?? '').slice(0, 65)}{feature.description && feature.description.length > 65 ? '…' : ''}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <Badge variant="muted">{CATEGORY_LABELS[feature.category ?? ''] ?? feature.category}</Badge>
                          </td>
                          <td className="px-3 py-3 text-right text-xs font-mono text-[#6b7380]">
                            <span className="text-[#0f1117] font-medium">{formatTokens(totalTokens)}</span>
                            <div className="text-[#9099b0]">in:{formatTokens(feature.total_input_tokens ?? 0)} out:{formatTokens(feature.total_output_tokens ?? 0)}</div>
                          </td>
                          {(['economy', 'balanced', 'premium'] as const).map(tier => {
                            const bundle = analysis.bundles.find(b => b.tier === tier)
                            const fc = bundle?.feature_costs.find(c => c.feature_id === feature.id)
                            const cfg = TIER_CONFIG[tier]
                            const isActiveTier = selectedTier === tier
                            return (
                              <td key={tier} className="px-4 py-3 text-right whitespace-nowrap" style={isActiveTier ? { background: `${cfg.color}06` } : {}}>
                                <div className="font-mono font-600 text-[13px]" style={{ color: cfg.color }}>
                                  {fc ? formatCurrency(fc.cost) : '—'}
                                </div>
                                <div className="text-[10px] text-[#9099b0] mt-0.5 font-mono">{fc?.model_slug ?? ''}</div>
                              </td>
                            )
                          })}
                        </tr>

                        {/* Sub-task expansion */}
                        {isOpen && feature.sub_tasks.length > 0 && (
                          <tr key={`${feature.id}-exp`}>
                            <td colSpan={7} className="px-5 py-0 bg-[#f8f9fb]">
                              <div className="py-3 pl-8 border-l-2 border-[#4f7dff]/30 ml-3">
                                <div className="text-xs font-mono uppercase tracking-wider text-[#9099b0] mb-2">Sub-task decomposition</div>
                                <div className="space-y-2">
                                  {feature.sub_tasks.map(st => (
                                    <div key={st.id} className="rounded-lg bg-white border border-black/8 p-3 shadow-sm">
                                      <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-xs font-medium text-[#0f1117]">{st.name}</span>
                                            <Badge variant="muted">{CATEGORY_LABELS[st.category] ?? st.category}</Badge>
                                          </div>
                                          {st.reasoning && <div className="text-xs text-[#6b7380] italic">"{st.reasoning}"</div>}
                                        </div>
                                        <div className="text-xs font-mono text-[#6b7380] text-right whitespace-nowrap flex-none">
                                          <div>sys:{formatTokens(st.system_prompt_tokens)} in:{formatTokens(st.input_context_tokens)} out:{formatTokens(st.output_tokens)}</div>
                                          <div className="text-[#9099b0]">×{st.interaction_rounds} rounds · ×{st.worst_case_multiplier} worst-case</div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-black/10 bg-[#f2f4f8]">
                    <td className="px-5 py-4 font-display font-600 text-[#0f1117]">Total <span className="text-xs text-[#9099b0] font-mono font-400">(worst-case monthly)</span></td>
                    <td colSpan={2} />
                    {(['economy', 'balanced', 'premium'] as const).map(tier => {
                      const bundle = analysis.bundles.find(b => b.tier === tier)
                      const cfg = TIER_CONFIG[tier]
                      return (
                        <td key={tier} className="px-4 py-4 text-right" style={selectedTier === tier ? { background: `${cfg.color}06` } : {}}>
                          <div className="text-base font-display font-700" style={{ color: cfg.color }}>{bundle ? formatCurrency(bundle.total_cost) : '—'}</div>
                          <div className="text-[10px] text-[#9099b0] font-mono">/month</div>
                        </td>
                      )
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* Elapsed time + warnings */}
          {analysis.elapsed_seconds != null && (
            <div className="mt-2 text-xs text-[#9099b0] text-right">
              Analysis completed in {analysis.elapsed_seconds}s
              {analysis.warnings.length > 0 && ` · ${analysis.warnings.length} sanity warning${analysis.warnings.length !== 1 ? 's' : ''}`}
            </div>
          )}

          {/* Discount suggestions */}
          <div className="mt-4 p-4 rounded-xl border border-green-200 bg-green-50 flex items-start gap-3">
            <Sparkles size={15} className="text-green-600 flex-none mt-0.5" />
            <div>
              <div className="text-xs font-medium text-green-800 mb-1">Cost reduction opportunities</div>
              <div className="text-xs text-green-700 space-y-1">
                <div>· Meeting Summary Generator is async — <span className="font-medium">switch to Batch API pricing for ~50% savings</span></div>
                <div>· Code Review Assistant shares context across PRs — <span className="font-medium">enable prompt caching for ~60% input savings</span></div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
