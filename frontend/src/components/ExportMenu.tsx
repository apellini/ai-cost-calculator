import { useState, useRef, useEffect } from 'react'
import { Download, FileJson, FileText, FileType, Link, Check, Loader2, ChevronDown } from 'lucide-react'
import { api } from '@/lib/api'

interface ExportMenuProps {
  projectId: number
  projectName: string
}

type ExportState = 'idle' | 'loading' | 'done' | 'error'

export default function ExportMenu({ projectId, projectName }: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const [states, setStates] = useState<Record<string, ExportState>>({})
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const safeName = projectName.replace(/\s+/g, '_').toLowerCase()

  const handleDownload = async (format: 'json' | 'csv' | 'pdf') => {
    if (states[format] === 'loading') return
    setStates(s => ({ ...s, [format]: 'loading' }))
    try {
      await api.exports.download(projectId, format, `${safeName}_analysis.${format}`)
      setStates(s => ({ ...s, [format]: 'done' }))
      setTimeout(() => setStates(s => ({ ...s, [format]: 'idle' })), 2000)
    } catch {
      setStates(s => ({ ...s, [format]: 'error' }))
      setTimeout(() => setStates(s => ({ ...s, [format]: 'idle' })), 3000)
    }
  }

  const handleShare = async () => {
    if (states.share === 'loading') return
    setStates(s => ({ ...s, share: 'loading' }))
    try {
      const result = await api.exports.share(projectId)
      const fullUrl = `${window.location.origin}${result.url}`
      await navigator.clipboard.writeText(fullUrl)
      setShareUrl(fullUrl)
      setStates(s => ({ ...s, share: 'done' }))
      setTimeout(() => setStates(s => ({ ...s, share: 'idle' })), 3000)
    } catch {
      setStates(s => ({ ...s, share: 'error' }))
      setTimeout(() => setStates(s => ({ ...s, share: 'idle' })), 3000)
    }
  }

  const items = [
    { key: 'pdf', label: 'Export PDF', icon: FileType, action: () => handleDownload('pdf') },
    { key: 'csv', label: 'Export CSV', icon: FileText, action: () => handleDownload('csv') },
    { key: 'json', label: 'Export JSON', icon: FileJson, action: () => handleDownload('json') },
    { key: 'share', label: shareUrl ? 'Link copied!' : 'Copy share link', icon: Link, action: handleShare },
  ]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-black/12 bg-white text-[#6b7380] hover:bg-black/3 shadow-sm transition-all"
      >
        <Download size={13} />
        Export
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-xl border border-black/10 shadow-lg py-1 z-50">
          {items.map(({ key, label, icon: Icon, action }) => {
            const state = states[key] ?? 'idle'
            return (
              <button
                key={key}
                onClick={() => { action(); if (key !== 'share') setOpen(false) }}
                disabled={state === 'loading'}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-[#0f1117] hover:bg-[#f8f9fb] transition-colors disabled:opacity-50 text-left"
              >
                {state === 'loading'
                  ? <Loader2 size={13} className="animate-spin text-[#4f7dff]" />
                  : state === 'done'
                    ? <Check size={13} className="text-green-600" />
                    : <Icon size={13} className="text-[#9099b0]" />
                }
                {state === 'done' && key !== 'share' ? 'Downloaded!' : label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
