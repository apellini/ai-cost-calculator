import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, Minus, Loader2, AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { api, type ComparisonOut } from '@/lib/api'
import { formatCurrency, formatTokens } from '@/lib/utils'

const TIERS = ['economy', 'balanced', 'premium'] as const
type Tier = typeof TIERS[number]

const TIER_COLOR: Record<Tier, string> = {
  economy: '#16a34a',
  balanced: '#4f7dff',
  premium: '#9333ea',
}


export default function Comparison() {
  const [searchParams] = useSearchParams()
  const projectId = Number(searchParams.get('project') ?? 1)

  const [leftTier, setLeftTier] = useState<Tier>('economy')
  const [rightTier, setRightTier] = useState<Tier>('balanced')

  const { data, isLoading, error } = useQuery<ComparisonOut>({
    queryKey: ['comparison', projectId, leftTier, rightTier],
    queryFn: () => api.scenarios.compare(projectId, leftTier, rightTier),
    retry: false,
  })

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-700 text-[#0f1117]">Scenario Comparison</h1>
        <p className="text-sm text-[#6b7380] mt-0.5">Compare cost and model choices across bundle tiers</p>
      </div>

      {/* Tier selectors */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {([['left', leftTier, setLeftTier], ['right', rightTier, setRightTier]] as const).map(
          ([side, current, setter]) => (
            <div key={side}>
              <div className="text-xs font-mono uppercase tracking-wider text-[#9099b0] mb-2">
                {side === 'left' ? 'Left bundle' : 'Right bundle'}
              </div>
              <div className="flex gap-2">
                {TIERS.map(t => (
                  <button
                    key={t}
                    onClick={() => setter(t as Tier)}
                    disabled={t === (side === 'left' ? rightTier : leftTier)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs capitalize transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                      current === t
                        ? 'border font-medium text-[#0f1117]'
                        : 'bg-white text-[#6b7380] border border-black/10 hover:bg-black/3 shadow-sm'
                    }`}
                    style={current === t ? {
                      background: `${TIER_COLOR[t as Tier]}10`,
                      borderColor: `${TIER_COLOR[t as Tier]}30`,
                      color: TIER_COLOR[t as Tier],
                    } : {}}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-[#9099b0]">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading comparison…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          <AlertCircle size={15} />
          {String(error).includes('404')
            ? 'No analysis found for this project. Run an analysis first from the Analysis page.'
            : String(error)}
        </div>
      )}

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {([
              { tier: leftTier, total: data.left_total, label: data.left_label },
              { tier: rightTier, total: data.right_total, label: data.right_label },
            ] as const).map(({ tier, total, label }) => (
              <div
                key={tier}
                className="rounded-xl p-5 border shadow-sm"
                style={{
                  background: `${TIER_COLOR[tier]}08`,
                  borderColor: `${TIER_COLOR[tier]}25`,
                }}
              >
                <div className="text-xs font-mono uppercase tracking-wider mb-2 font-600" style={{ color: TIER_COLOR[tier] }}>
                  {label}
                </div>
                <div className="text-2xl font-display font-700 mb-0.5" style={{ color: TIER_COLOR[tier] }}>
                  {formatCurrency(total)}
                </div>
                <div className="text-xs text-[#6b7380]">per month</div>
              </div>
            ))}
          </div>

          {/* Delta bar */}
          <div className="mb-6 p-4 rounded-xl bg-white border border-black/10 shadow-sm flex items-center justify-between">
            <div className="text-sm text-[#6b7380]">
              Switching from{' '}
              <span className="font-medium" style={{ color: TIER_COLOR[leftTier] }}>{data.left_label}</span>
              {' '}to{' '}
              <span className="font-medium" style={{ color: TIER_COLOR[rightTier] }}>{data.right_label}</span>
            </div>
            <div className="flex items-center gap-2">
              {data.delta > 0
                ? <TrendingUp size={14} className="text-amber-500" />
                : data.delta < 0
                  ? <TrendingDown size={14} className="text-green-500" />
                  : <Minus size={14} className="text-[#9099b0]" />
              }
              <span className={`text-base font-display font-700 ${data.delta > 0 ? 'text-amber-700' : data.delta < 0 ? 'text-green-700' : 'text-[#6b7380]'}`}>
                {data.delta >= 0 ? '+' : ''}{formatCurrency(data.delta)}/mo
              </span>
              <span className="text-xs text-[#9099b0]">
                ({data.delta_pct > 0 ? '+' : ''}{data.delta_pct}%)
              </span>
            </div>
          </div>

          {/* Per-feature comparison table */}
          <Card>
            <div className="px-5 py-3.5 border-b border-black/8">
              <h2 className="text-sm font-display font-600 text-[#0f1117]">Per-Feature Comparison</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/7 bg-[#f8f9fb]">
                  <th className="text-left px-5 py-3 text-xs font-mono uppercase tracking-wider text-[#9099b0]">Feature</th>
                  <th className="text-right px-4 py-3 text-xs font-mono uppercase tracking-wider" style={{ color: TIER_COLOR[leftTier] }}>
                    {data.left_label} · Model
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-mono uppercase tracking-wider" style={{ color: TIER_COLOR[rightTier] }}>
                    {data.right_label} · Model
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-mono uppercase tracking-wider text-[#9099b0]">Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {data.feature_deltas.map(fd => (
                  <tr key={fd.feature_id} className="hover:bg-[#f8f9fb] transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-medium text-[#0f1117]">{fd.feature_name}</div>
                      <div className="text-xs text-[#9099b0]">
                        {formatTokens(fd.left_input_tokens + fd.left_output_tokens)} tokens
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-mono font-600" style={{ color: TIER_COLOR[leftTier] }}>
                        {formatCurrency(fd.left_cost)}
                      </div>
                      <div className="text-xs text-[#9099b0] font-mono">{fd.left_model}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-mono font-600" style={{ color: TIER_COLOR[rightTier] }}>
                        {formatCurrency(fd.right_cost)}
                      </div>
                      <div className="text-xs text-[#9099b0] font-mono">{fd.right_model}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className={`font-mono text-sm flex items-center justify-end gap-1 ${
                        fd.delta > 0 ? 'text-amber-600' : fd.delta < 0 ? 'text-green-600' : 'text-[#6b7380]'
                      }`}>
                        {fd.delta > 0
                          ? <TrendingUp size={12} />
                          : fd.delta < 0
                            ? <TrendingDown size={12} />
                            : <Minus size={12} />
                        }
                        {fd.delta >= 0 ? '+' : ''}{formatCurrency(fd.delta)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black/10 bg-[#f2f4f8]">
                  <td className="px-5 py-4 font-display font-600 text-[#0f1117]">Total</td>
                  <td className="px-4 py-4 text-right">
                    <div className="font-mono font-700 text-base" style={{ color: TIER_COLOR[leftTier] }}>
                      {formatCurrency(data.left_total)}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="font-mono font-700 text-base" style={{ color: TIER_COLOR[rightTier] }}>
                      {formatCurrency(data.right_total)}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className={`font-mono font-700 ${data.delta > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                      {data.delta >= 0 ? '+' : ''}{formatCurrency(data.delta)}
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </Card>
        </>
      )}
    </div>
  )
}
