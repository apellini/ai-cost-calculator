// frontend/src/components/ShareProjectModal.tsx
import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Share2, X, Copy, Check, Loader2, AlertCircle, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, type ShareWithUsersResponse } from '@/lib/api'

interface Props {
  projectId: number
  onClose: () => void
}

export default function ShareProjectModal({ projectId, onClose }: Props) {
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedLinks, setCopiedLinks] = useState<Set<number>>(new Set())
  const [result, setResult] = useState<ShareWithUsersResponse | null>(null)

  // Fetch all users (admin only)
  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: api.users.list,
  })

  // Filter users based on search query
  const filteredUsers = users?.filter(user =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  const shareMutation = useMutation({
    mutationFn: () => api.sharing.withUsers(projectId, selectedUserIds),
    onSuccess: (data) => {
      setResult(data)
    },
  })

  const { data: existingLinks } = useQuery({
    queryKey: ['shareLinks', projectId],
    queryFn: () => api.sharing.list(projectId),
    enabled: !result,
  })

  const toggleUserSelection = (userId: number) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const copyLink = async (link: string, linkId: number) => {
    await navigator.clipboard.writeText(link)
    setCopiedLinks(prev => new Set(prev).add(linkId))
    setTimeout(() => {
      setCopiedLinks(prev => {
        const next = new Set(prev)
        next.delete(linkId)
        return next
      })
    }, 2000)
  }

  const canSubmit = selectedUserIds.length > 0 && !shareMutation.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-5 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Share2 size={16} className="text-[#4f7dff]" />
            <h2 className="text-sm font-display font-600 text-[#0f1117]">Share Project</h2>
          </div>
          <button onClick={onClose} className="text-[#9099b0] hover:text-[#0f1117]">
            <X size={16} />
          </button>
        </div>

        {result ? (
          /* ── Success: show generated links ── */
          <div className="space-y-4 overflow-y-auto flex-1">
            <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
              <Check size={16} /> Shared with {result.links.length} user{result.links.length !== 1 ? 's' : ''}
            </div>

            <div className="space-y-3">
              {result.links.map((link) => {
                const linkId = link.user_id // Use user_id as unique key
                return (
                  <div key={linkId} className="rounded-xl border border-[#e8ebf0] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[#0f1117]">{link.email}</span>
                      {link.expires_at && (
                        <span className="text-xs text-[#9099b0]">
                          Expires {new Date(link.expires_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={link.link}
                        className="flex-1 bg-[#f2f4f8] border border-black/10 rounded-lg px-3 py-2 text-xs font-mono text-[#6b7380] truncate"
                      />
                      <button
                        onClick={() => copyLink(link.link, linkId)}
                        className="flex items-center gap-1 text-xs text-[#4f7dff] hover:text-[#3a6ae0] font-medium px-3 py-2 rounded-lg border border-[#4f7dff]/25 bg-[#4f7dff]/5 transition-colors"
                      >
                        {copiedLinks.has(linkId) ? <Check size={12} /> : <Copy size={12} />}
                        {copiedLinks.has(linkId) ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex justify-end pt-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={() => { onClose() }}>Done</Button>
            </div>
          </div>
        ) : (
          /* ── Main: user selection ── */
          <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
            {existingLinks && existingLinks.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex-shrink-0">
                <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium mb-2">
                  <AlertCircle size={12} /> Existing shares will be reused
                </div>
                <div className="text-xs text-amber-800">
                  {existingLinks.length} active share link{existingLinks.length !== 1 ? 's' : ''}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-[#6b7380] mb-2 font-mono uppercase tracking-wider">
                Select users to share with
              </label>

              {loadingUsers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-[#4f7dff]" />
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Search by email or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="mb-3"
                  />

                  <div className="max-h-48 overflow-y-auto rounded-xl border border-[#e8ebf0]">
                    {filteredUsers.length === 0 ? (
                      <div className="p-4 text-center text-sm text-[#9099b0]">
                        <UserX size={24} className="mx-auto mb-2 opacity-50" />
                        {searchQuery ? 'No users found' : 'No users available'}
                      </div>
                    ) : (
                      <div className="divide-y divide-[#e8ebf0]">
                        {filteredUsers.map(user => {
                          const isSelected = selectedUserIds.includes(user.id)
                          const isAlreadyShared = existingLinks?.some(
                            link => link.shared_with_user_id === user.id && link.is_active
                          )

                          return (
                            <label
                              key={user.id}
                              className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                                isAlreadyShared
                                  ? 'bg-[#f2f4f8] cursor-not-allowed'
                                  : isSelected
                                  ? 'bg-[#4f7dff]/5'
                                  : 'hover:bg-[#f9fafb]'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isAlreadyShared ? false : isSelected}
                                disabled={isAlreadyShared}
                                onChange={() => toggleUserSelection(user.id)}
                                className="w-4 h-4 rounded border-[#c0c5d0] text-[#4f7dff] focus:ring-[#4f7dff]"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-[#0f1117] truncate">
                                  {user.name || user.email}
                                </div>
                                <div className="text-xs text-[#9099b0] truncate">{user.email}</div>
                              </div>
                              {isAlreadyShared && (
                                <span className="text-xs text-[#9099b0] whitespace-nowrap">Already shared</span>
                              )}
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className="mt-2 text-xs text-[#9099b0]">
                    {selectedUserIds.length} user{selectedUserIds.length !== 1 ? 's' : ''} selected
                  </div>
                </>
              )}
            </div>

            {shareMutation.isError && (
              <p className="text-xs text-red-600">{(shareMutation.error as Error).message}</p>
            )}

            <div className="flex justify-end gap-2 pt-2 flex-shrink-0">
              <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              <Button
                type="button"
                size="sm"
                disabled={!canSubmit}
                onClick={() => shareMutation.mutate()}
              >
                {shareMutation.isPending ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Share2 size={13} />
                )}
                {' '}Share Project
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
