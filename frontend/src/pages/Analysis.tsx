import { useState } from 'react'
import { AlertTriangle, ChevronRight, Clock, Download, RefreshCw, Sparkles, TrendingDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { BUNDLE_MONTHLY, FEATURES, MODELS, PROJECT_BUDGET, type TaskCategory } from '@/mocks/data'
import { formatCurrency, formatTokens } from '@/lib/utils'

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
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedTier, setSelectedTier] = useState<'economy' | 'balanced' | 'premium'>('balanced')

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const selectedBundle = BUNDLE_MONTHLY.find(b => b.tier === selectedTier)!
  const overBudget = selectedBundle.totalCost > PROJECT_BUDGET
  const featureCostMap = Object.fromEntries(selectedBundle.featureCosts.map(fc => [fc.featureId, fc]))

  const sortedByPriority = [...FEATURES].sort((a, b) => a.priority - b.priority)
  let runningCost = 0
  const excludedIds = new Set<string>()
  if (overBudget) {
    for (const f of sortedByPriority) {
      const fc = featureCostMap[f.id]
      if (runningCost + (selectedBundle.totalCost - fc.cost) <= PROJECT_BUDGET) break
      excludedIds.add(f.id)
      runningCost += fc.cost
      if (selectedBundle.totalCost - runningCost <= PROJECT_BUDGET) break
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-700 text-[#0f1117]">Cost Analysis</h1>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-[#6b7380]">
            <span>TaskFlow — AI Project Manager</span>
            <span>·</span>
            <Clock size={11} />
            <span>Prices last updated 3 days ago</span>
            <button className="text-[#4f7dff] hover:underline flex items-center gap-1"><RefreshCw size={10} /> Refresh</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm"><Download size={13} /> Export PDF</Button>
          <Button variant="secondary" size="sm"><Download size={13} /> CSV</Button>
        </div>
      </div>

      {/* Budget Warning */}
      {overBudget && (
        <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 animate-fade-in">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-500 flex-none mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-medium text-amber-800">Budget exceeded</span>
                <Badge variant="warning">Budget: {formatCurrency(PROJECT_BUDGET)}/mo</Badge>
                <ChevronRight size={12} className="text-amber-400" />
                <Badge variant="warning">Estimated ({TIER_CONFIG[selectedTier].label}): {formatCurrency(selectedBundle.totalCost)}/mo</Badge>
                <ChevronRight size={12} className="text-amber-400" />
                <Badge variant="warning">{excludedIds.size} feature{excludedIds.size > 1 ? 's' : ''} excluded</Badge>
              </div>
              {excludedIds.size > 0 && (
                <div className="mt-1.5 text-xs text-amber-700">
                  Excluded: {FEATURES.filter(f => excludedIds.has(f.id)).map(f => f.name).join(', ')}
                </div>
              )}
            </div>
            <div className="text-right flex-none">
              <div className="text-xs text-amber-600">Gap to cover all</div>
              <div className="text-sm font-mono text-amber-700 font-600">{formatCurrency(selectedBundle.totalCost - PROJECT_BUDGET)}/mo</div>
            </div>
          </div>
        </div>
      )}

      {/* Bundle cards */}
      <div className="grid grid-cols-3 gap-4 mb-6 animate-stagger">
        {BUNDLE_MONTHLY.map(bundle => {
          const cfg = TIER_CONFIG[bundle.tier]
          const isSelected = selectedTier === bundle.tier
          const withinBudget = bundle.totalCost <= PROJECT_BUDGET
          return (
            <button
              key={bundle.tier}
              onClick={() => setSelectedTier(bundle.tier)}
              className={`rounded-xl border p-4 text-left transition-all ${
                isSelected
                  ? 'shadow-md'
                  : 'border-black/10 bg-white hover:border-black/18 hover:shadow-sm shadow-sm'
              }`}
              style={isSelected ? { background: cfg.bg, borderColor: cfg.border, boxShadow: `0 4px 16px ${cfg.color}18` } : {}}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono uppercase tracking-wider font-600" style={{ color: isSelected ? cfg.color : '#9099b0' }}>{cfg.label}</span>
                {withinBudget
                  ? <Badge variant="economy"><TrendingDown size={9} /> Within budget</Badge>
                  : <Badge variant="warning"><AlertTriangle size={9} /> {Math.round(bundle.totalCost / PROJECT_BUDGET * 100)}% of budget</Badge>
                }
              </div>
              <div className="text-2xl font-display font-700 mb-0.5" style={{ color: cfg.color }}>
                {formatCurrency(bundle.totalCost)}
              </div>
              <div className="text-xs text-[#6b7380]">per month · worst-case</div>
              {isSelected && (
                <div className="mt-3 pt-3 border-t border-black/8">
                  <div className="text-xs text-[#6b7380]">Model strategy: <span style={{ color: cfg.color }} className="font-medium">
                    {bundle.tier === 'economy' ? 'cheapest within capability thresholds' :
                     bundle.tier === 'balanced' ? 'best cost/quality ratio per category' :
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
                <th className="text-left px-3 py-3 text-xs font-mono uppercase tracking-wider text-[#9099b0] whitespace-nowrap">Category</th>
                <th className="text-right px-3 py-3 text-xs font-mono uppercase tracking-wider text-[#9099b0] whitespace-nowrap">Tokens</th>
                <th className="text-right px-4 py-3 text-xs font-mono uppercase tracking-wider whitespace-nowrap" style={{ color: TIER_CONFIG.economy.color }}>Economy</th>
                <th className="text-right px-4 py-3 text-xs font-mono uppercase tracking-wider whitespace-nowrap" style={{ color: TIER_CONFIG.balanced.color }}>Balanced</th>
                <th className="text-right px-4 py-3 text-xs font-mono uppercase tracking-wider whitespace-nowrap" style={{ color: TIER_CONFIG.premium.color }}>Premium</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {FEATURES.map(feature => {
                const isOpen = expanded.has(feature.id)
                const isExcluded = excludedIds.has(feature.id)
                return (
                  <>
                    <tr
                      key={feature.id}
                      className={`transition-colors group ${isExcluded ? 'opacity-40' : 'hover:bg-[#f8f9fb]'} cursor-pointer`}
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
                            <div className="text-xs text-[#9099b0] mt-0.5">{feature.description.slice(0, 65)}…</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <Badge variant="muted">{CATEGORY_LABELS[feature.category]}</Badge>
                      </td>
                      <td className="px-3 py-3 text-right text-xs font-mono text-[#6b7380] whitespace-nowrap">
                        <span className="text-[#0f1117] font-medium">{formatTokens(feature.totalInputTokens + feature.totalOutputTokens)}</span>
                        <div className="text-[#9099b0]">in:{formatTokens(feature.totalInputTokens)} out:{formatTokens(feature.totalOutputTokens)}</div>
                      </td>
                      {(['economy', 'balanced', 'premium'] as const).map(tier => {
                        const bundle = BUNDLE_MONTHLY.find(b => b.tier === tier)!
                        const fc = bundle.featureCosts.find(c => c.featureId === feature.id)!
                        const model = MODELS.find(m => m.id === fc.modelId)!
                        const cfg = TIER_CONFIG[tier]
                        const isActiveTier = selectedTier === tier
                        return (
                          <td key={tier} className="px-4 py-3 text-right whitespace-nowrap" style={isActiveTier ? { background: `${cfg.color}06` } : {}}>
                            <div className="font-mono font-600 text-[13px]" style={{ color: cfg.color }}>
                              {formatCurrency(fc.cost)}
                            </div>
                            <div className="text-[10px] text-[#9099b0] mt-0.5 font-mono">{model.name}</div>
                          </td>
                        )
                      })}
                    </tr>

                    {/* Sub-task expansion */}
                    {isOpen && (
                      <tr key={`${feature.id}-exp`}>
                        <td colSpan={6} className="px-5 py-0 bg-[#f8f9fb]">
                          <div className="py-3 pl-8 border-l-2 border-[#4f7dff]/30 ml-3">
                            <div className="text-xs font-mono uppercase tracking-wider text-[#9099b0] mb-2">Sub-task decomposition</div>
                            <div className="space-y-2">
                              {feature.subTasks.map((st, i) => (
                                <div key={i} className="rounded-lg bg-white border border-black/8 p-3 shadow-sm">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-xs font-medium text-[#0f1117]">{st.name}</span>
                                        <Badge variant="muted">{CATEGORY_LABELS[st.category as TaskCategory]}</Badge>
                                      </div>
                                      <div className="text-xs text-[#6b7380] italic">"{st.reasoning}"</div>
                                    </div>
                                    <div className="text-xs font-mono text-[#6b7380] text-right whitespace-nowrap flex-none">
                                      <div>sys:{formatTokens(st.systemPromptTokens)} in:{formatTokens(st.inputContextTokens)} out:{formatTokens(st.outputTokens)}</div>
                                      <div className="text-[#9099b0]">×{st.interactionRounds} rounds · ×{st.worstCaseMultiplier} worst-case</div>
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
            {/* Totals row */}
            <tfoot>
              <tr className="border-t-2 border-black/10 bg-[#f2f4f8]">
                <td className="px-5 py-4 font-display font-600 text-[#0f1117]">
                  Total <span className="text-xs text-[#9099b0] font-mono font-400">(worst-case monthly)</span>
                </td>
                <td colSpan={2} />
                {(['economy', 'balanced', 'premium'] as const).map(tier => {
                  const bundle = BUNDLE_MONTHLY.find(b => b.tier === tier)!
                  const cfg = TIER_CONFIG[tier]
                  return (
                    <td key={tier} className="px-4 py-4 text-right" style={selectedTier === tier ? { background: `${cfg.color}06` } : {}}>
                      <div className="text-base font-display font-700" style={{ color: cfg.color }}>{formatCurrency(bundle.totalCost)}</div>
                      <div className="text-[10px] text-[#9099b0] font-mono">/month</div>
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Discount suggestions */}
      <div className="mt-4 p-4 rounded-xl border border-green-200 bg-green-50 flex items-start gap-3">
        <Sparkles size={15} className="text-green-600 flex-none mt-0.5" />
        <div>
          <div className="text-xs font-medium text-green-800 mb-1">Cost reduction opportunities</div>
          <div className="text-xs text-green-700 space-y-1">
            <div>· Meeting Summary Generator is async — <span className="font-medium">switch to Batch API pricing for ~50% savings</span></div>
            <div>· Code Review Assistant shares context across PRs — <span className="font-medium">enable prompt caching for ~60% input savings</span></div>
            <div>· At {formatCurrency(BUNDLE_MONTHLY[1].totalCost * 12)}/year, you qualify for <span className="font-medium">volume tier discounts from Helios Research</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
