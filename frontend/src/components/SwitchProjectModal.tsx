import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Loader2, Search, Shield, Share2 } from 'lucide-react'
import { api, type ProjectWithDetails, type BundleInfo } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

interface Props {
  onSwitch: (projectId: number) => void
  onClose: () => void
  currentProjectId: number | null
}

export default function SwitchProjectModal({ onSwitch, onClose, currentProjectId }: Props) {
  const [searchQuery, setSearchQuery] = useState('')

  const { data: projects, isLoading } = useQuery({
    queryKey: ['my-projects'],
    queryFn: api.projects.listWithDetails,
  })

  const filteredProjects = projects?.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  const handleSelect = (projectId: number) => {
    onSwitch(projectId)
    onClose()
  }

  const getBundleCost = (bundles: BundleInfo[], tier: string): number | null => {
    const bundle = bundles.find(b => b.tier === tier)
    return bundle?.total_cost ?? null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-display font-600 text-[#0f1117]">Switch Project</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#9099b0] hover:text-[#0f1117] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="mb-4 flex-shrink-0">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9099b0]" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#e8ebf0] bg-[#f9fafb] text-sm text-[#0f1117] placeholder-[#9099b0] focus:outline-none focus:ring-2 focus:ring-[#4f7dff]/25 focus:border-[#4f7dff] transition-all"
            />
          </div>
        </div>

        {/* Project List */}
        <div className="flex-1 overflow-y-auto -mx-2 px-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-[#4f7dff]" />
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="py-12 text-center text-[#9099b0] text-sm">
              No projects found
            </div>
          ) : (
            <div className="space-y-2">
              {filteredProjects.map(project => {
                const economyCost = getBundleCost(project.bundles, 'economy')
                const balancedCost = getBundleCost(project.bundles, 'balanced')
                const premiumCost = getBundleCost(project.bundles, 'premium')
                const updatedAt = new Date(project.updated_at).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                })
                const isCurrent = project.id === currentProjectId
                const isOwned = project.access_type === 'owner'

                return (
                  <div
                    key={project.id}
                    onClick={() => handleSelect(project.id)}
                    className={`
                      rounded-xl border p-4 cursor-pointer transition-all
                      ${isCurrent
                        ? 'border-[#4f7dff] bg-[#4f7dff]/5'
                        : 'border-[#e8ebf0] hover:border-[#4f7dff]/40 hover:bg-[#f9fafb]'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-[#0f1117] truncate">
                            {project.name}
                          </h3>
                          {isOwned ? (
                            <span title="You own this project">
                              <Shield size={12} className="text-[#4f7dff]" />
                            </span>
                          ) : (
                            <span title="Shared with you">
                              <Share2 size={12} className="text-[#9099b0]" />
                            </span>
                          )}
                          {isCurrent && (
                            <span className="text-xs text-[#4f7dff] font-medium">(current)</span>
                          )}
                        </div>
                        {project.description && (
                          <p className="text-xs text-[#9099b0] mt-0.5 line-clamp-1">
                            {project.description}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-[#9099b0] whitespace-nowrap ml-2">
                        {project.feature_count} features
                      </span>
                    </div>

                    {/* Cost details */}
                    <div className="flex items-center gap-4 text-xs">
                      {project.budget_monthly && (
                        <span className="text-[#9099b0]">
                          Budget: <span className="text-[#0f1117] font-medium">
                            {formatCurrency(project.budget_monthly)}/mo
                          </span>
                        </span>
                      )}
                      {economyCost !== null && (
                        <span className="text-[#9099b0]">
                          Econ: <span className="text-green-700 font-mono font-600">
                            {formatCurrency(economyCost)}
                          </span>
                        </span>
                      )}
                      {balancedCost !== null && (
                        <span className="text-[#9099b0]">
                          Bal: <span className="text-blue-700 font-mono font-600">
                            {formatCurrency(balancedCost)}
                          </span>
                        </span>
                      )}
                      {premiumCost !== null && (
                        <span className="text-[#9099b0]">
                          Prem: <span className="text-purple-700 font-mono font-600">
                            {formatCurrency(premiumCost)}
                          </span>
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-[#9099b0] mt-2">
                      Updated {updatedAt}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
