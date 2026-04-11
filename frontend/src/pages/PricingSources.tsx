import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Shield, Clock, AlertCircle, Edit, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { api, type PricingSource } from '@/lib/api'
import PricingSourceModal from '@/components/PricingSourceModal'

function formatRelative(iso: string | null): string {
  if (!iso) return 'never'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

export default function PricingSources() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingSource, setEditingSource] = useState<PricingSource | null>(null)

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ['pricing-sources'],
    queryFn: api.pricingSources.list,
  })

  const deleteMutation = useMutation({
    mutationFn: api.pricingSources.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricing-sources'] }),
  })

  const triggerSync = useMutation({
    mutationFn: (sourceId: number) =>
      api.snapshots.refresh({ source_id: sourceId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricing-sources'] }),
  })

  const handleEdit = (source: PricingSource) => {
    setEditingSource(source)
    setShowModal(true)
  }

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this pricing source?')) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-display font-700 text-[#0f1117]">
            Pricing Sources
          </h1>
          <p className="text-sm text-[#6b7380] mt-0.5">
            Configure external API providers for automated price updates
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => { setEditingSource(null); setShowModal(true) }}>
          <Plus size={15} /> Add Source
        </Button>
      </div>

      {/* Status banner */}
      {sources.length === 0 ? (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-amber-600" size={20} />
              <div>
                <p className="text-sm text-amber-800 font-medium">
                  No pricing sources configured
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Add at least one pricing source to enable automated model price updates.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                className="ml-auto"
                onClick={() => setShowModal(true)}
              >
                Configure Source
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Sources list */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-[#9099b0]">
            <Loader2 size={20} className="animate-spin mr-2" />
            Loading sources...
          </div>
        ) : (
          sources.map(source => (
            <Card key={source.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-sm font-medium text-[#0f1117]">{source.name}</h3>
                      <Badge
                        variant={
                          source.provider_type === 'openrouter'
                            ? 'default'
                            : source.provider_type === 'litellm'
                              ? 'balanced'
                              : 'economy'
                        }
                      >
                        {source.provider_type}
                      </Badge>
                      {source.is_active ? (
                        <Badge variant="success" className="bg-green-100 text-green-700">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="warning">Disabled</Badge>
                      )}
                    </div>

                    {source.description && (
                      <p className="text-xs text-[#6b7380] mb-3 line-clamp-1">
                        {source.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-xs text-[#6b7380]">
                      <div className="flex items-center gap-1.5">
                        <Shield size={12} className={source.api_url ? '' : 'text-[#d1d5de]'} />
                        <span>
                          {source.api_url ? 'API configured' : 'No API key required'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} />
                        <span>Refresh: {source.default_refresh_interval}</span>
                      </div>
                      {source.last_sync_at && (
                        <div className="flex items-center gap-1.5">
                          <Check
                            size={12}
                            className={
                              source.last_sync_status === 'success'
                                ? 'text-green-600'
                                : 'text-red-600'
                            }
                          />
                          <span>
                            Last sync: {formatRelative(source.last_sync_at)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-none">
                    <button
                      onClick={() =>
                        triggerSync.mutate(source.id, {
                          onError: (err: any) =>
                            alert(`Sync failed: ${err.message}`),
                        })
                      }
                      disabled={triggerSync.isPending || !source.is_active}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#4f7dff] bg-[#4f7dff]/5 hover:bg-[#4f7dff]/10 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                      title="Sync now"
                    >
                      {triggerSync.isPending ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <>
                          Sync
                          <Clock size={12} />
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleEdit(source)}
                      className="p-1.5 rounded-lg text-[#9099b0] hover:text-[#4f7dff] hover:bg-[#4f7dff]/5 transition-colors"
                      title="Edit source"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(source.id)}
                      disabled={deleteMutation.isPending}
                      className="p-1.5 rounded-lg text-[#9099b0] hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="Delete source"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Sync error */}
                {source.last_sync_status === 'error' && source.last_sync_error && (
                  <div className="mt-3 flex items-start gap-2 text-xs text-red-600 bg-red-50 p-2 rounded-lg">
                    <AlertCircle size={14} className="mt-0.5 flex-none" />
                    <span>{source.last_sync_error}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Instructions */}
      {sources.length > 0 && (
        <div className="mt-8 rounded-xl border border-black/8 bg-[#f8f9fb] p-5">
          <h3 className="text-xs font-mono uppercase tracking-wider text-[#9099b0] mb-3">
            How It Works
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[#6b7380]">
            <div>
              <p className="font-medium text-[#0f1117] mb-1">1. Configure Provider</p>
              <p>
                Add API credentials for your preferred pricing source. Keys are encrypted in the database.
              </p>
            </div>
            <div>
              <p className="font-medium text-[#0f1117] mb-1">2. Set Refresh Schedule</p>
              <p>
                Each source has a default refresh interval. You can also set model-specific overrides.
              </p>
            </div>
            <div>
              <p className="font-medium text-[#0f1117] mb-1">3. Sync & Monitor</p>
              <p>
                Trigger manual syncs or wait for scheduled updates. View sync history in the table.
              </p>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <PricingSourceModal
          source={editingSource}
          onClose={() => {
            setShowModal(false)
            setEditingSource(null)
          }}
          onSuccess={() => {
            setShowModal(false)
            setEditingSource(null)
          }}
        />
      )}
    </div>
  )
}
