import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Search, TrendingUp, Loader2,
  ChevronUp, ChevronDown, LayoutGrid, List, ChevronRight,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { api, type Model } from '@/lib/api'
import StalenessIndicator from '@/components/StalenessIndicator'
import BenchmarkRadar from '@/components/BenchmarkRadar'

// ── Constants ─────────────────────────────────────────────────────────────────

const PROVIDER_COLORS: Record<string, string> = {
  'NovaMind AI':    '#4f7dff',
  'Cortex Labs':    '#9333ea',
  'Zenith Systems': '#16a34a',
  'Helios Research':'#d97706',
  'OpenForge':      '#dc2626',
}

const TASK_LABELS: Record<string, string> = {
  qa_chatbot:        'Q&A',
  reasoning_analysis:'Reasoning',
  summarization:     'Summarize',
  code_review:       'Code Review',
  content_generation:'Content Gen',
  code_generation:   'Code Gen',
  data_extraction:   'Data Extract',
  translation:       'Translation',
}

type SortKey = 'name' | 'input' | 'output' | 'mmlu' | 'speed'
type SortDir = 'asc' | 'desc'
type View = 'table' | 'grid'

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreBar({ value, color = '#4f7dff' }: { value: number | null; color?: string }) {
  if (value == null) return <span className="text-xs text-[#9099b0]">—</span>
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-black/8 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-xs font-mono text-[#6b7380] w-7 text-right">{value.toFixed(0)}</span>
    </div>
  )
}

function TaskFitGrid({ taskFit }: { taskFit: Record<string, number> | null }) {
  if (!taskFit || Object.keys(taskFit).length === 0) {
    return <span className="text-xs text-[#9099b0]">No task-fit data</span>
  }
  const entries = Object.entries(taskFit).sort((a, b) => b[1] - a[1])
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {entries.map(([key, score]) => {
        const pct = Math.round(score * 100)
        const color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#4f7dff' : pct >= 40 ? '#d97706' : '#9099b0'
        return (
          <div key={key} className="flex items-center gap-2">
            <div className="w-16 flex-none text-[10px] text-[#6b7380] truncate">
              {TASK_LABELS[key] ?? key}
            </div>
            <div className="flex-1 h-1 bg-black/8 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="text-[10px] font-mono w-6 text-right" style={{ color }}>{pct}</span>
          </div>
        )
      })}
    </div>
  )
}

function PriceBadge({ label, value, highlight = false }: { label: string; value: number | null; highlight?: boolean }) {
  if (value == null) return null
  return (
    <div className={`rounded-lg px-2.5 py-1.5 text-center ${highlight ? 'bg-green-50 border border-green-200' : 'bg-[#f8f9fb] border border-black/8'}`}>
      <div className="text-[9px] font-mono uppercase tracking-wider text-[#9099b0] mb-0.5">{label}</div>
      <div className={`text-sm font-mono font-600 ${highlight ? 'text-green-700' : 'text-[#0f1117]'}`}>
        ${value.toFixed(2)}
      </div>
    </div>
  )
}

// ── Expanded row detail panel ─────────────────────────────────────────────────

function ModelDetail({ model, color }: { model: Model; color: string }) {
  return (
    <tr className="bg-gradient-to-b from-[#f8f9ff] to-white">
      <td colSpan={8} className="px-5 pb-5 pt-3">
        <div className="grid grid-cols-3 gap-6">
          {/* Radar chart */}
          <div className="flex flex-col items-center gap-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#9099b0]">Benchmark Profile</div>
            <BenchmarkRadar benchmark={model.benchmark} color={color} size={150} />
          </div>

          {/* Task fit */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#9099b0] mb-3">Task Fit Scores</div>
            <TaskFitGrid taskFit={model.task_fit} />
          </div>

          {/* Pricing detail */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#9099b0] mb-3">Pricing (per 1M tokens)</div>
            <div className="grid grid-cols-2 gap-2">
              <PriceBadge label="Input" value={model.input_per_1m} />
              <PriceBadge label="Output" value={model.output_per_1m} />
              <PriceBadge label="Batch" value={model.batch_per_1m} highlight />
              <PriceBadge label="Cached In" value={model.cached_input_per_1m} highlight />
            </div>
            {model.context_window && (
              <div className="mt-3 text-xs text-[#6b7380]">
                Context window:{' '}
                <span className="font-mono font-600 text-[#0f1117]">
                  {(model.context_window / 1000).toFixed(0)}K tokens
                </span>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  )
}

// ── Grid card view ────────────────────────────────────────────────────────────

function ModelCard({ model, color }: { model: Model; color: string }) {
  const [expanded, setExpanded] = useState(false)
  const topTask = model.task_fit
    ? Object.entries(model.task_fit).sort((a, b) => b[1] - a[1])[0]
    : null

  return (
    <div
      className="bg-white rounded-xl border border-black/8 shadow-sm overflow-hidden cursor-pointer hover:border-black/15 transition-all"
      onClick={() => setExpanded(e => !e)}
    >
      {/* Color accent bar */}
      <div className="h-1" style={{ background: color }} />

      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-sm font-mono font-600 text-[#0f1117] leading-tight">{model.display_name}</div>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
              <span className="text-[11px] text-[#6b7380]">{model.provider.name}</span>
            </div>
          </div>
          <ChevronRight size={14} className={`text-[#9099b0] transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>

        {/* Mini radar */}
        <div className="flex justify-center mb-3">
          <BenchmarkRadar benchmark={model.benchmark} color={color} size={120} />
        </div>

        {/* Pricing pills */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1 text-center bg-[#f8f9fb] rounded-lg py-1.5 px-2">
            <div className="text-[9px] text-[#9099b0] font-mono uppercase">In</div>
            <div className="text-xs font-mono font-600">${model.input_per_1m.toFixed(2)}</div>
          </div>
          <div className="flex-1 text-center bg-[#f8f9fb] rounded-lg py-1.5 px-2">
            <div className="text-[9px] text-[#9099b0] font-mono uppercase">Out</div>
            <div className="text-xs font-mono font-600">${model.output_per_1m.toFixed(2)}</div>
          </div>
          {model.batch_per_1m != null && (
            <div className="flex-1 text-center bg-green-50 border border-green-200 rounded-lg py-1.5 px-2">
              <div className="text-[9px] text-green-600 font-mono uppercase">Batch</div>
              <div className="text-xs font-mono font-600 text-green-700">${model.batch_per_1m.toFixed(2)}</div>
            </div>
          )}
        </div>

        {/* Best task fit */}
        {topTask && (
          <div className="text-[11px] text-[#6b7380]">
            Best for: <span className="font-medium text-[#0f1117]">{TASK_LABELS[topTask[0]] ?? topTask[0]}</span>
            <span className="text-[#9099b0] ml-1">({Math.round(topTask[1] * 100)}%)</span>
          </div>
        )}
      </div>

      {/* Expanded task fit */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-black/7 pt-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-[#9099b0] mb-2">Task Fit</div>
          <TaskFitGrid taskFit={model.task_fit} />
        </div>
      )}
    </div>
  )
}

// ── Sortable header ───────────────────────────────────────────────────────────

function SortHeader({
  label, sortKey, current, dir, onClick, className = ''
}: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir; onClick: (k: SortKey) => void; className?: string
}) {
  const active = current === sortKey
  return (
    <th
      className={`py-3 text-xs font-mono uppercase tracking-wider cursor-pointer select-none hover:text-[#0f1117] transition-colors ${className} ${active ? 'text-[#4f7dff]' : 'text-[#9099b0]'}`}
      onClick={() => onClick(sortKey)}
    >
      <div className={`flex items-center gap-1 ${className.includes('right') ? 'justify-end' : ''}`}>
        {label}
        {active
          ? dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
          : <ChevronDown size={11} className="opacity-30" />
        }
      </div>
    </th>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ModelCatalog() {
  const [search, setSearch] = useState('')
  const [providerFilter, setProviderFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [view, setView] = useState<View>('table')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const { data: models = [], isLoading } = useQuery<Model[]>({
    queryKey: ['models'],
    queryFn: () => api.models.list(),
  })

  const { data: providerNames = [] } = useQuery<string[]>({
    queryKey: ['model-providers'],
    queryFn: api.models.providers,
  })

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    let list = models.filter(m => {
      const matchSearch = !q
        || m.display_name.toLowerCase().includes(q)
        || m.slug.toLowerCase().includes(q)
        || m.provider.name.toLowerCase().includes(q)
      const matchProvider = providerFilter === 'all' || m.provider.name === providerFilter
      return matchSearch && matchProvider
    })

    list = [...list].sort((a, b) => {
      let va: number | string = 0
      let vb: number | string = 0
      switch (sortKey) {
        case 'name':   va = a.display_name; vb = b.display_name; break
        case 'input':  va = a.input_per_1m;  vb = b.input_per_1m; break
        case 'output': va = a.output_per_1m; vb = b.output_per_1m; break
        case 'mmlu':   va = a.benchmark?.mmlu ?? -1; vb = b.benchmark?.mmlu ?? -1; break
        case 'speed':  va = a.benchmark?.speed_tps ?? -1; vb = b.benchmark?.speed_tps ?? -1; break
      }
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va)
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })

    return list
  }, [models, search, providerFilter, sortKey, sortDir])

  const providers = ['all', ...providerNames]

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-700 text-[#0f1117]">Model Catalog</h1>
          <StalenessIndicator />
        </div>
        <p className="text-sm text-[#6b7380] mt-0.5">
          Browse and compare {models.length} models across {providerNames.length} providers
        </p>
      </div>

      {/* Filters + view toggle */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative w-60">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9099b0]" />
          <Input
            placeholder="Search models or providers…"
            className="pl-8"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-1.5 flex-wrap flex-1">
          {providers.map(p => (
            <button
              key={p}
              onClick={() => setProviderFilter(p)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap ${
                providerFilter === p
                  ? 'bg-[#4f7dff]/10 text-[#0f1117] border border-[#4f7dff]/25 font-medium'
                  : 'bg-white text-[#6b7380] border border-black/10 hover:bg-black/3 shadow-sm'
              }`}
              style={providerFilter === p && p !== 'all' ? {
                background: `${PROVIDER_COLORS[p] ?? '#4f7dff'}12`,
                borderColor: `${PROVIDER_COLORS[p] ?? '#4f7dff'}30`,
                color: PROVIDER_COLORS[p] ?? '#4f7dff',
              } : {}}
            >
              {p === 'all' ? 'All providers' : p}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex border border-black/10 rounded-lg overflow-hidden bg-white shadow-sm">
          {(['table', 'grid'] as View[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 transition-colors ${view === v ? 'bg-[#4f7dff]/10 text-[#4f7dff]' : 'text-[#9099b0] hover:bg-black/3'}`}
            >
              {v === 'table' ? <List size={14} /> : <LayoutGrid size={14} />}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-[#9099b0]">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading models…
        </div>
      )}

      {/* Table view */}
      {!isLoading && view === 'table' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/7 bg-[#f8f9fb]">
                  <SortHeader label="Model" sortKey="name" current={sortKey} dir={sortDir} onClick={handleSort} className="px-5 text-left" />
                  <SortHeader label="Input $/1M" sortKey="input" current={sortKey} dir={sortDir} onClick={handleSort} className="px-4 text-right" />
                  <SortHeader label="Output $/1M" sortKey="output" current={sortKey} dir={sortDir} onClick={handleSort} className="px-4 text-right" />
                  <th className="text-right px-4 py-3 text-xs font-mono uppercase tracking-wider text-green-600/80">Batch</th>
                  <SortHeader label="MMLU" sortKey="mmlu" current={sortKey} dir={sortDir} onClick={handleSort} className="px-4 text-left" />
                  <th className="text-left px-4 py-3 text-xs font-mono uppercase tracking-wider text-[#9099b0]">HumanEval</th>
                  <th className="text-left px-4 py-3 text-xs font-mono uppercase tracking-wider text-[#9099b0]">Reasoning</th>
                  <SortHeader label="Speed" sortKey="speed" current={sortKey} dir={sortDir} onClick={handleSort} className="px-4 text-right" />
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(model => {
                  const color = PROVIDER_COLORS[model.provider.name] ?? '#6b7380'
                  const isExpanded = expanded.has(model.id)
                  return [
                    <tr
                      key={`row-${model.id}`}
                      onClick={() => toggleExpand(model.id)}
                      className="border-b border-black/5 hover:bg-[#f8f9fb] transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-none" style={{ background: color }} />
                          <div>
                            <div className="font-mono text-[#0f1117] font-medium text-xs">{model.display_name}</div>
                            <div className="text-[10px] text-[#9099b0]">{model.provider.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[#0f1117] text-xs">${model.input_per_1m.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-mono text-[#0f1117] text-xs">${model.output_per_1m.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-mono text-green-700 text-xs">
                        {model.batch_per_1m != null ? `$${model.batch_per_1m.toFixed(2)}` : <span className="text-[#9099b0]">—</span>}
                      </td>
                      <td className="px-4 py-3 w-28"><ScoreBar value={model.benchmark?.mmlu ?? null} color="#4f7dff" /></td>
                      <td className="px-4 py-3 w-28"><ScoreBar value={model.benchmark?.human_eval ?? null} color="#16a34a" /></td>
                      <td className="px-4 py-3 w-28"><ScoreBar value={model.benchmark?.reasoning ?? null} color="#9333ea" /></td>
                      <td className="px-4 py-3 text-right">
                        {model.benchmark?.speed_tps != null ? (
                          <div className="flex items-center justify-end gap-1 text-xs text-[#6b7380]">
                            <TrendingUp size={10} />
                            <span className="font-mono">{model.benchmark.speed_tps}t/s</span>
                          </div>
                        ) : <span className="text-xs text-[#9099b0]">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight size={13} className={`text-[#9099b0] transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </td>
                    </tr>,
                    isExpanded && <ModelDetail key={`detail-${model.id}`} model={model} color={color} />,
                  ]
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-black/8 bg-[#f8f9fb] text-xs text-[#9099b0]">
            {filtered.length} of {models.length} models · Click a row to expand benchmark + task-fit detail
          </div>
        </Card>
      )}

      {/* Grid view */}
      {!isLoading && view === 'grid' && (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(model => (
            <ModelCard
              key={model.id}
              model={model}
              color={PROVIDER_COLORS[model.provider.name] ?? '#6b7380'}
            />
          ))}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="py-16 text-center text-[#9099b0] text-sm">
          No models match your search.
        </div>
      )}
    </div>
  )
}
