import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Check, X, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CHAT_MESSAGES, FEATURES } from '@/mocks/data'

const CATEGORY_LABELS: Record<string, string> = {
  qa_chatbot: 'Q&A / Chatbot', reasoning_analysis: 'Reasoning', summarization: 'Summarization',
  code_review: 'Code Review', content_generation: 'Content Gen', code_generation: 'Code Gen',
  data_extraction: 'Data Extraction', translation: 'Translation',
}

export default function Chat() {
  const navigate = useNavigate()
  const [showFeatures, setShowFeatures] = useState(true)
  const [confirmed, setConfirmed] = useState(false)

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-black/8 bg-white flex-none">
        <div>
          <h1 className="text-lg font-display font-700 text-[#0f1117]">Chat Interview</h1>
          <p className="text-xs text-[#6b7380]">TaskFlow — AI Project Manager</p>
        </div>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className={`w-2 h-2 rounded-full ${i <= 5 ? 'bg-[#4f7dff]' : 'bg-black/12'}`} />
          ))}
          <span className="text-xs text-[#6b7380] ml-2">5/6 steps</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 animate-stagger">
        {CHAT_MESSAGES.map((msg) => (
          <div key={msg.id} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4f7dff] to-[#a855f7] flex items-center justify-center text-[10px] font-bold text-white flex-none mt-0.5">AI</div>
            )}
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-[#e8eaf0] flex items-center justify-center text-[10px] font-bold text-[#0f1117] flex-none mt-0.5">MP</div>
            )}
            <div className={`px-4 py-3 rounded-xl text-sm max-w-lg ${
              msg.role === 'assistant'
                ? 'bg-white text-[#0f1117] rounded-tl-none border border-black/8 shadow-sm'
                : 'bg-[#4f7dff] text-white rounded-tr-none shadow-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {/* Feature extraction card */}
        <div className="rounded-xl border border-[#4f7dff]/25 bg-[#4f7dff]/5 overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-[#0f1117] hover:bg-[#4f7dff]/5 transition-colors"
            onClick={() => setShowFeatures(v => !v)}
          >
            <div className="flex items-center gap-2">
              <BarChart3 size={15} className="text-[#4f7dff]" />
              <span>8 features extracted — please review and confirm</span>
            </div>
            {showFeatures ? <ChevronUp size={15} className="text-[#6b7380]" /> : <ChevronDown size={15} className="text-[#6b7380]" />}
          </button>
          {showFeatures && (
            <div className="px-4 pb-4 space-y-2">
              {FEATURES.map((f, i) => (
                <div key={f.id} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-black/7">
                  <span className="text-xs text-[#9099b0] font-mono w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-[#0f1117] truncate">{f.name}</div>
                    <div className="text-xs text-[#9099b0] truncate">{f.description.slice(0, 60)}…</div>
                  </div>
                  <Badge variant={f.category === 'code_generation' ? 'balanced' : f.category === 'reasoning_analysis' ? 'premium' : 'muted'}>
                    {CATEGORY_LABELS[f.category]}
                  </Badge>
                  <span className="text-xs text-[#9099b0] font-mono">P{f.priority}</span>
                </div>
              ))}
              <div className="flex items-center justify-end gap-2 pt-2">
                {confirmed ? (
                  <div className="flex items-center gap-2 text-green-700 text-sm">
                    <Check size={14} /> Features confirmed — running analysis…
                  </div>
                ) : (
                  <>
                    <Button variant="ghost" size="sm"><X size={13} /> Edit features</Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => { setConfirmed(true); setTimeout(() => navigate('/analysis'), 1200) }}
                    >
                      <Check size={13} /> Confirm & Analyze
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="flex-none px-6 py-4 border-t border-black/8 bg-white">
        <div className="flex items-end gap-3">
          <div className="flex-1 bg-[#f2f4f8] border border-black/10 rounded-xl px-4 py-3 min-h-[44px] text-sm text-[#9099b0] flex items-center">
            Type your reply…
          </div>
          <Button variant="primary" size="md" className="py-2.5">
            <Send size={15} />
          </Button>
        </div>
      </div>
    </div>
  )
}
