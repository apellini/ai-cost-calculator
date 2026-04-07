import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { BUNDLE_MONTHLY, FEATURES, MODELS, PROJECT_BUDGET } from '@/mocks/data'
import { formatCurrency, formatTokens } from '@/lib/utils'

const economyBundle = BUNDLE_MONTHLY[0]
const balancedBundle = BUNDLE_MONTHLY[1]

export default function Comparison() {
  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-700 text-[#0f1117]">Scenario Comparison</h1>
        <p className="text-sm text-[#6b7380] mt-0.5">TaskFlow — comparing Economy vs Balanced bundles</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {[
          { bundle: economyBundle, label: 'Economy', color: '#16a34a', bg: 'rgba(22,163,74,0.05)', border: 'rgba(22,163,74,0.2)' },
          { bundle: balancedBundle, label: 'Balanced', color: '#4f7dff', bg: 'rgba(79,125,255,0.05)', border: 'rgba(79,125,255,0.2)' },
        ].map(({ bundle, label, color, bg, border }) => (
          <div key={label} className="rounded-xl p-5 border shadow-sm" style={{ background: bg, borderColor: border }}>
            <div className="text-xs font-mono uppercase tracking-wider mb-2 font-600" style={{ color }}>{label}</div>
            <div className="text-2xl font-display font-700 mb-0.5" style={{ color }}>{formatCurrency(bundle.totalCost)}</div>
            <div className="text-xs text-[#6b7380]">per month</div>
            <div className="mt-3 flex items-center gap-2">
              {bundle.totalCost <= PROJECT_BUDGET
                ? <Badge variant="economy">Within $5k budget</Badge>
                : <Badge variant="warning">{Math.round(bundle.totalCost / PROJECT_BUDGET * 100)}% of budget</Badge>
              }
            </div>
          </div>
        ))}
      </div>

      {/* Delta bar */}
      <div className="mb-6 p-4 rounded-xl bg-white border border-black/10 shadow-sm flex items-center justify-between">
        <div className="text-sm text-[#6b7380]">
          Cost delta: switching from <span className="text-green-700 font-medium">Economy</span> to <span className="text-blue-700 font-medium">Balanced</span>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-amber-500" />
          <span className="text-base font-display font-700 text-amber-700">
            +{formatCurrency(balancedBundle.totalCost - economyBundle.totalCost)}/mo
          </span>
          <span className="text-xs text-[#9099b0]">({Math.round((balancedBundle.totalCost / economyBundle.totalCost - 1) * 100)}% more)</span>
        </div>
      </div>

      {/* Side-by-side feature comparison */}
      <Card>
        <div className="px-5 py-3.5 border-b border-black/8">
          <h2 className="text-sm font-display font-600 text-[#0f1117]">Per-Feature Comparison</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/7 bg-[#f8f9fb]">
              <th className="text-left px-5 py-3 text-xs font-mono uppercase tracking-wider text-[#9099b0]">Feature</th>
              <th className="text-right px-4 py-3 text-xs font-mono uppercase tracking-wider text-green-600/80">Economy · Model</th>
              <th className="text-right px-4 py-3 text-xs font-mono uppercase tracking-wider text-blue-600/80">Balanced · Model</th>
              <th className="text-right px-4 py-3 text-xs font-mono uppercase tracking-wider text-[#9099b0]">Delta</th>
              <th className="text-right px-4 py-3 text-xs font-mono uppercase tracking-wider text-[#9099b0]">Capability</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {FEATURES.map(feature => {
              const ec = economyBundle.featureCosts.find(c => c.featureId === feature.id)!
              const bc = balancedBundle.featureCosts.find(c => c.featureId === feature.id)!
              const eModel = MODELS.find(m => m.id === ec.modelId)!
              const bModel = MODELS.find(m => m.id === bc.modelId)!
              const delta = bc.cost - ec.cost
              const capDiff = bModel.benchmarks.reasoning - eModel.benchmarks.reasoning

              return (
                <tr key={feature.id} className="hover:bg-[#f8f9fb] transition-colors">
                  <td className="px-5 py-3">
                    <div className="font-medium text-[#0f1117]">{feature.name}</div>
                    <div className="text-xs text-[#9099b0]">{formatTokens(feature.totalInputTokens + feature.totalOutputTokens)} tokens</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-mono text-green-700 font-600">{formatCurrency(ec.cost)}</div>
                    <div className="text-xs text-[#9099b0] font-mono">{eModel.name}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-mono text-blue-700 font-600">{formatCurrency(bc.cost)}</div>
                    <div className="text-xs text-[#9099b0] font-mono">{bModel.name}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className={`font-mono text-sm flex items-center justify-end gap-1 ${delta > 0 ? 'text-amber-600' : delta < 0 ? 'text-green-600' : 'text-[#6b7380]'}`}>
                      {delta > 0 ? <TrendingUp size={12} /> : delta < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                      {delta >= 0 ? '+' : ''}{formatCurrency(delta)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className={`text-xs flex items-center justify-end gap-1 ${capDiff > 0 ? 'text-green-600' : 'text-[#6b7380]'}`}>
                      {capDiff > 0 ? <TrendingUp size={11} /> : <Minus size={11} />}
                      {capDiff > 0 ? `+${capDiff.toFixed(1)} pts` : 'Same'}
                    </div>
                    <div className="text-[10px] text-[#9099b0]">reasoning score</div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-black/10 bg-[#f2f4f8]">
              <td className="px-5 py-4 font-display font-600 text-[#0f1117]">Total</td>
              <td className="px-4 py-4 text-right">
                <div className="font-mono font-700 text-green-700 text-base">{formatCurrency(economyBundle.totalCost)}</div>
              </td>
              <td className="px-4 py-4 text-right">
                <div className="font-mono font-700 text-blue-700 text-base">{formatCurrency(balancedBundle.totalCost)}</div>
              </td>
              <td className="px-4 py-4 text-right">
                <div className="font-mono font-700 text-amber-600">+{formatCurrency(balancedBundle.totalCost - economyBundle.totalCost)}</div>
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </Card>
    </div>
  )
}
