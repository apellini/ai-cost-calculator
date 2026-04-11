import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, BarChart3, Clock, TrendingDown, Calendar, ChevronRight, Sparkles, Loader2, AlertCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { api, type Project, type AnalysisOut } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import SwitchProjectModal from '@/components/SwitchProjectModal'

function ProjectCard({ project }: { project: Project }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => api.projects.delete(project.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
  const { data: analysis } = useQuery<AnalysisOut>({
    queryKey: ['analysis', project.id],
    queryFn: () => api.analysis.get(project.id),
    retry: false,
  })

  const economy = analysis?.bundles.find(b => b.tier === 'economy')
  const balanced = analysis?.bundles.find(b => b.tier === 'balanced')
  const premium = analysis?.bundles.find(b => b.tier === 'premium')
  const budget = project.budget_monthly ?? 0
  const balancedCost = balanced?.total_cost ?? 0
  const budgetPct = budget > 0 ? Math.round(balancedCost / budget * 100) : 0
  const overBudget = budget > 0 && balancedCost > budget

  const updatedAt = new Date(project.updated_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <Card hover className="mb-3 animate-fade-in group" onClick={() => !confirmDelete && navigate(`/analysis?project=${project.id}`)}>
      <CardContent className="p-0">
        <div className="flex items-center gap-4 p-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4f7dff]/15 to-[#a855f7]/15 border border-black/8 flex items-center justify-center flex-none">
            <Sparkles size={18} className="text-[#9333ea]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-medium text-[#0f1117]">{project.name}</span>
              <Badge variant="balanced">{project.feature_count} features</Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-[#6b7380]">
              <span className="flex items-center gap-1"><Calendar size={11} /> {updatedAt}</span>
              {budget > 0 && <span>Budget: <span className="text-[#0f1117] font-medium">{formatCurrency(budget)}/mo</span></span>}
              {overBudget && <Badge variant="warning">Budget exceeded (Balanced)</Badge>}
              {analysis && !overBudget && budget > 0 && <Badge variant="economy">Within budget</Badge>}
            </div>
          </div>
          <div className="flex items-center gap-4 text-right flex-none">
            {economy && (
              <div>
                <div className="text-xs text-[#9099b0] mb-0.5">Economy</div>
                <div className="text-sm font-mono text-green-700 font-600">{formatCurrency(economy.total_cost)}/mo</div>
              </div>
            )}
            {balanced && (
              <div>
                <div className="text-xs text-[#9099b0] mb-0.5">Balanced</div>
                <div className="text-sm font-mono text-blue-700 font-600">{formatCurrency(balanced.total_cost)}/mo</div>
              </div>
            )}
            {premium && (
              <div>
                <div className="text-xs text-[#9099b0] mb-0.5">Premium</div>
                <div className="text-sm font-mono text-purple-700 font-600">{formatCurrency(premium.total_cost)}/mo</div>
              </div>
            )}

            {/* Delete control */}
            {confirmDelete ? (
              <div
                className="flex items-center gap-2"
                onClick={e => e.stopPropagation()}
              >
                <span className="text-xs text-red-600 font-medium whitespace-nowrap">Delete project?</span>
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="px-2.5 py-1 rounded-md bg-red-500 text-white text-xs font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  {deleteMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : 'Yes, delete'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-2.5 py-1 rounded-md border border-black/10 text-xs text-[#6b7380] hover:bg-black/5 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={e => { e.stopPropagation(); setConfirmDelete(true) }}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[#9099b0] hover:text-red-500 hover:bg-red-50 transition-all"
                title="Delete project"
              >
                <Trash2 size={14} />
              </button>
            )}

            {!confirmDelete && <ChevronRight size={16} className="text-[#9099b0]" />}
          </div>
        </div>
        {analysis && budget > 0 && (
          <div className="px-5 pb-4">
            <div className="flex items-center justify-between text-xs text-[#9099b0] mb-1.5">
              <span>Budget utilization (Balanced bundle)</span>
              <span className={`font-medium ${overBudget ? 'text-amber-600' : 'text-green-600'}`}>{budgetPct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-black/8 overflow-hidden">
              <div
                className={`h-full rounded-full ${overBudget ? 'bg-gradient-to-r from-amber-400 to-red-400' : 'bg-green-400'}`}
                style={{ width: `${Math.min(100, budgetPct)}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user: currentUser } = useAuth()
  const qc = useQueryClient()

  // Active project state
  const [showSwitchModal, setShowSwitchModal] = useState(false)

  // Get active project from query params or localStorage
  const queryProjectId = searchParams.get('project')
  const storedProjectId = localStorage.getItem('activeProjectId')

  // Use query param if present, otherwise use localStorage
  const activeProjectId = queryProjectId
    ? parseInt(queryProjectId, 10)
    : (storedProjectId ? parseInt(storedProjectId, 10) : null)

  // Handle project switch
  const handleSwitchProject = (projectId: number) => {
    localStorage.setItem('activeProjectId', String(projectId))
    setSearchParams({ project: String(projectId) })
  }

  // Clear active project (for "Show All" behavior)
  const handleClearActiveProject = () => {
    localStorage.removeItem('activeProjectId')
    setSearchParams({})
  }

  const { data: projects = [], isLoading, error } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: api.projects.list,
  })

  // Filter projects based on active project selection
  const displayedProjects = activeProjectId
    ? projects.filter(p => p.id === activeProjectId)
    : projects

  const totalFeatures = projects.reduce((s, p) => s + p.feature_count, 0)

  const orphanedCount = projects.filter(p => p.feature_count === 0).length

  const cleanupMutation = useMutation({
    mutationFn: api.projects.deleteOrphaned,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      alert(`Removed ${data.deleted} orphaned project(s).`)
    },
  })

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-display font-700 text-[#0f1117]">Dashboard</h1>
          <p className="text-sm text-[#6b7380] mt-0.5">Your AI projects and cost analyses</p>
          {activeProjectId && (
            <button
              onClick={handleClearActiveProject}
              className="text-xs text-[#4f7dff] hover:underline mt-1 inline-block"
            >
              Clear selection
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="md"
            onClick={() => setShowSwitchModal(true)}
            disabled={projects.length === 0}
          >
            Switch Project
          </Button>
          <Button variant="primary" size="md" onClick={() => navigate('/new-project')}>
            <Plus size={15} /> New Project
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6 animate-stagger">
        {[
          {
            label: 'Active Projects',
            value: String(activeProjectId ? 1 : projects.length),
            sub: activeProjectId
              ? projects.find(p => p.id === activeProjectId)?.name ?? 'Selected project'
              : projects.length === 1
                ? projects[0]?.name ?? ''
                : `${projects.length} projects`,
            icon: BarChart3,
            color: '#4f7dff'
          },
          { label: 'Features Analyzed', value: String(totalFeatures), sub: 'Across all projects', icon: Sparkles, color: '#9333ea' },
          { label: 'Models Available', value: '12', sub: 'Across 5 providers', icon: TrendingDown, color: '#16a34a' },
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

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-mono uppercase tracking-wider text-[#9099b0]">Projects</h2>
      </div>

      {currentUser?.role === 'admin' && orphanedCount > 0 && (
        <div className="mb-4 flex items-center justify-between px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm">
          <span className="text-amber-700">
            <strong>{orphanedCount}</strong> project{orphanedCount > 1 ? 's have' : ' has'} no features and can be cleaned up.
          </span>
          <button
            onClick={() => {
              if (confirm(`Delete ${orphanedCount} orphaned project(s)? This cannot be undone.`)) {
                cleanupMutation.mutate()
              }
            }}
            disabled={cleanupMutation.isPending}
            className="text-xs font-medium text-amber-700 hover:text-amber-900 underline ml-4"
          >
            {cleanupMutation.isPending ? 'Cleaning up…' : 'Clean up'}
          </button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-[#9099b0]">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading projects…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-3">
          <AlertCircle size={15} /> Could not reach the backend. Is it running?
        </div>
      )}

      {!isLoading && displayedProjects.map(p => <ProjectCard key={p.id} project={p} />)}

      {/* Empty state / new project */}
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

      <div className="mt-6 flex items-center gap-2 text-xs text-[#9099b0]">
        <Clock size={12} />
        <span>Prices last updated <span className="text-[#6b7380]">3 days ago</span></span>
        <button className="text-[#4f7dff] hover:underline ml-1">Refresh now</button>
      </div>

      {showSwitchModal && (
        <SwitchProjectModal
          onSwitch={handleSwitchProject}
          onClose={() => setShowSwitchModal(false)}
          currentProjectId={activeProjectId}
        />
      )}
    </div>
  )
}
