import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Send, Check, X, ChevronDown, ChevronUp, BarChart3, Loader2, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useChat } from '@/hooks/useChat'
import { api } from '@/lib/api'

const CATEGORY_LABELS: Record<string, string> = {
  qa_chatbot: 'Q&A', reasoning_analysis: 'Reasoning', summarization: 'Summarization',
  code_review: 'Code Review', content_generation: 'Content Gen', code_generation: 'Code Gen',
  data_extraction: 'Data Extraction', translation: 'Translation',
}

export default function Chat() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()
  const projectId = Number(searchParams.get('project') ?? 1)

  const [input, setInput] = useState('')
  const [showFeatures, setShowFeatures] = useState(true)
  const [confirmed, setConfirmed] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const runAnalysis = useMutation({
    mutationFn: () => api.analysis.run(projectId),
    onSuccess: (data) => {
      qc.setQueryData(['analysis', projectId], data)
      navigate(`/analysis?project=${projectId}`)
    },
  })

  const handleAnalysisReady = useCallback((pid: number) => {
    qc.invalidateQueries({ queryKey: ['projects'] })
    qc.invalidateQueries({ queryKey: ['project', pid] })
    runAnalysis.mutate()
  }, [qc, runAnalysis])

  const { messages, features, connected, streaming, sendMessage, confirmFeatures, rejectFeatures } =
    useChat({ projectId, onAnalysisReady: handleAnalysisReady })

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, features])

  const handleSend = () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    sendMessage(text)
  }

  const handleConfirm = () => {
    setConfirmed(true)
    confirmFeatures()
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-black/8 bg-white flex-none">
        <div>
          <h1 className="text-lg font-display font-700 text-[#0f1117]">Chat Interview</h1>
          <p className="text-xs text-[#6b7380]">Project #{projectId}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 text-xs ${connected ? 'text-green-600' : 'text-[#9099b0]'}`}>
            {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {connected ? 'Connected' : 'Connecting…'}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center py-12 text-[#9099b0]">
            <Loader2 size={18} className="animate-spin mr-2" /> Connecting to AI…
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 animate-fade-in ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4f7dff] to-[#a855f7] flex items-center justify-center text-[10px] font-bold text-white flex-none mt-0.5">AI</div>
            )}
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-[#e8eaf0] flex items-center justify-center text-[10px] font-bold text-[#0f1117] flex-none mt-0.5">ME</div>
            )}
            <div className={`px-4 py-3 rounded-xl text-sm max-w-lg whitespace-pre-wrap ${
              msg.role === 'assistant'
                ? 'bg-white text-[#0f1117] rounded-tl-none border border-black/8 shadow-sm'
                : 'bg-[#4f7dff] text-white rounded-tr-none shadow-sm'
            }`}>
              {msg.content}
              {msg.streaming && (
                <span className="inline-block w-1.5 h-4 bg-[#4f7dff] ml-0.5 animate-pulse rounded-sm" />
              )}
            </div>
          </div>
        ))}

        {/* Feature extraction card */}
        {features.length > 0 && (
          <div className="rounded-xl border border-[#4f7dff]/25 bg-[#4f7dff]/5 overflow-hidden animate-fade-in">
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-[#0f1117] hover:bg-[#4f7dff]/5 transition-colors"
              onClick={() => setShowFeatures(v => !v)}
            >
              <div className="flex items-center gap-2">
                <BarChart3 size={15} className="text-[#4f7dff]" />
                <span>{features.length} features extracted — please review and confirm</span>
              </div>
              {showFeatures ? <ChevronUp size={15} className="text-[#6b7380]" /> : <ChevronDown size={15} className="text-[#6b7380]" />}
            </button>

            {showFeatures && (
              <div className="px-4 pb-4 space-y-2">
                {features.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-black/7">
                    <span className="text-xs text-[#9099b0] font-mono w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-[#0f1117] truncate">{f.name}</div>
                      <div className="text-xs text-[#9099b0] truncate">{f.description?.slice(0, 60)}</div>
                    </div>
                    <Badge variant="muted">{CATEGORY_LABELS[f.category] ?? f.category}</Badge>
                    <span className="text-xs text-[#9099b0] font-mono">P{f.priority}</span>
                  </div>
                ))}

                <div className="flex items-center justify-end gap-2 pt-2">
                  {confirmed ? (
                    <div className="flex items-center gap-2 text-[#6b7380] text-sm">
                      {runAnalysis.isPending
                        ? <><Loader2 size={14} className="animate-spin" /> Running analysis…</>
                        : <><Check size={14} className="text-green-600" /> Features confirmed</>
                      }
                    </div>
                  ) : (
                    <>
                      <Button variant="ghost" size="sm" onClick={rejectFeatures}>
                        <X size={13} /> Edit features
                      </Button>
                      <Button variant="primary" size="sm" onClick={handleConfirm}>
                        <Check size={13} /> Confirm & Analyze
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-none px-6 py-4 border-t border-black/8 bg-white">
        <div className="flex items-end gap-3">
          <textarea
            className="flex-1 bg-[#f2f4f8] border border-black/10 rounded-xl px-4 py-3 text-sm text-[#0f1117] placeholder:text-[#9099b0] resize-none focus:outline-none focus:border-[#4f7dff]/40 focus:bg-white transition-colors"
            placeholder={connected ? 'Type your reply…' : 'Connecting…'}
            rows={1}
            value={input}
            disabled={!connected || streaming || confirmed}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <Button
            variant="primary"
            size="md"
            className="py-2.5"
            disabled={!connected || streaming || !input.trim() || confirmed}
            onClick={handleSend}
          >
            {streaming ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </Button>
        </div>
        <div className="mt-1.5 text-xs text-[#9099b0]">Press Enter to send · Shift+Enter for new line</div>
      </div>
    </div>
  )
}
