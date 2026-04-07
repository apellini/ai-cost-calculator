import { useState } from 'react'
import { Search, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { MODELS, type ProviderName } from '@/mocks/data'

const PROVIDER_COLORS: Record<ProviderName, string> = {
  'NovaMind AI': '#4f7dff',
  'Cortex Labs': '#9333ea',
  'Zenith Systems': '#16a34a',
  'Helios Research': '#d97706',
  'OpenForge': '#dc2626',
}

function ScoreBar({ value, color = '#4f7dff' }: { value: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-black/8 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-xs font-mono text-[#6b7380] w-8">{value}</span>
    </div>
  )
}

export default function ModelCatalog() {
  const [search, setSearch] = useState('')
  const [providerFilter, setProviderFilter] = useState<string>('all')

  const providers = ['all', ...Array.from(new Set(MODELS.map(m => m.provider)))]
  const filtered = MODELS.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) || m.provider.toLowerCase().includes(search.toLowerCase())
    const matchProvider = providerFilter === 'all' || m.provider === providerFilter
    return matchSearch && matchProvider
  })

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-700 text-[#0f1117]">Model Catalog</h1>
        <p className="text-sm text-[#6b7380] mt-0.5">Browse and compare {MODELS.length} models across 5 providers</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9099b0]" />
          <Input
            placeholder="Search models…"
            className="pl-8"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {providers.map(p => (
            <button
              key={p}
              onClick={() => setProviderFilter(p)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all capitalize ${
                providerFilter === p
                  ? 'bg-[#4f7dff]/10 text-[#0f1117] border border-[#4f7dff]/25 font-medium'
                  : 'bg-white text-[#6b7380] border border-black/10 hover:bg-black/3 shadow-sm'
              }`}
            >
              {p === 'all' ? 'All providers' : p}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/7 bg-[#f8f9fb]">
                <th className="text-left px-5 py-3 text-xs font-mono uppercase tracking-wider text-[#9099b0]">Model</th>
                <th className="text-right px-4 py-3 text-xs font-mono uppercase tracking-wider text-[#9099b0]">Input $/1M</th>
                <th className="text-right px-4 py-3 text-xs font-mono uppercase tracking-wider text-[#9099b0]">Output $/1M</th>
                <th className="text-right px-4 py-3 text-xs font-mono uppercase tracking-wider text-green-600/80">Batch $/1M</th>
                <th className="text-left px-4 py-3 text-xs font-mono uppercase tracking-wider text-[#9099b0]">MMLU</th>
                <th className="text-left px-4 py-3 text-xs font-mono uppercase tracking-wider text-[#9099b0]">HumanEval</th>
                <th className="text-left px-4 py-3 text-xs font-mono uppercase tracking-wider text-[#9099b0]">Reasoning</th>
                <th className="text-right px-4 py-3 text-xs font-mono uppercase tracking-wider text-[#9099b0]">Speed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {filtered.map(model => {
                const provColor = PROVIDER_COLORS[model.provider] ?? '#6b7380'
                return (
                  <tr key={model.id} className="hover:bg-[#f8f9fb] transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-mono text-[#0f1117] font-medium">{model.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: provColor }} />
                        <span className="text-xs text-[#6b7380]">{model.provider}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[#0f1117]">${model.inputPer1M.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono text-[#0f1117]">${model.outputPer1M.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono text-green-700">${model.batchPer1M.toFixed(2)}</td>
                    <td className="px-4 py-3 w-28"><ScoreBar value={model.benchmarks.mmlu} color="#4f7dff" /></td>
                    <td className="px-4 py-3 w-28"><ScoreBar value={model.benchmarks.humanEval} color="#16a34a" /></td>
                    <td className="px-4 py-3 w-28"><ScoreBar value={model.benchmarks.reasoning} color="#9333ea" /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 text-xs text-[#6b7380]">
                        <TrendingUp size={10} />
                        <span className="font-mono">{model.benchmarks.speedTps} t/s</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-black/8 bg-[#f8f9fb] text-xs text-[#9099b0]">
          Showing {filtered.length} of {MODELS.length} models · <span className="text-[#6b7380]">Prices last updated 3 days ago</span> · <button className="text-[#4f7dff] hover:underline">Refresh</button>
        </div>
      </Card>
    </div>
  )
}
