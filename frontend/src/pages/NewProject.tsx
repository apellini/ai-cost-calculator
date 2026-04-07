import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, Upload, ArrowRight, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

export default function NewProject() {
  const [tab, setTab] = useState<'chat' | 'spec'>('chat')
  const [projectName, setProjectName] = useState('')
  const navigate = useNavigate()

  return (
    <div className="p-6 max-w-2xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-700 text-[#0f1117]">New Project</h1>
        <p className="text-sm text-[#6b7380] mt-0.5">Describe your project to get AI cost estimates</p>
      </div>

      {/* Project name */}
      <div className="mb-6">
        <label className="block text-xs text-[#6b7380] mb-1.5 font-mono uppercase tracking-wider">Project Name</label>
        <Input
          placeholder="e.g. TaskFlow — AI Project Manager"
          value={projectName}
          onChange={e => setProjectName(e.target.value)}
        />
      </div>

      {/* Budget */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-[#6b7380] mb-1.5 font-mono uppercase tracking-wider">Monthly Budget (USD)</label>
          <Input placeholder="5000" type="number" />
        </div>
        <div>
          <label className="block text-xs text-[#6b7380] mb-1.5 font-mono uppercase tracking-wider">Preferred Model (optional)</label>
          <Input placeholder="Leave blank for recommendations" />
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('chat')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
            tab === 'chat'
              ? 'bg-[#4f7dff]/10 text-[#0f1117] border border-[#4f7dff]/25'
              : 'bg-white text-[#6b7380] border border-black/10 hover:bg-black/3 shadow-sm'
          }`}
        >
          <MessageSquare size={14} /> Chat Interview
        </button>
        <button
          onClick={() => setTab('spec')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
            tab === 'spec'
              ? 'bg-[#4f7dff]/10 text-[#0f1117] border border-[#4f7dff]/25'
              : 'bg-white text-[#6b7380] border border-black/10 hover:bg-black/3 shadow-sm'
          }`}
        >
          <Upload size={14} /> Upload Spec
        </button>
      </div>

      {tab === 'chat' && (
        <Card className="animate-fade-in">
          <CardContent className="p-6">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4f7dff] to-[#a855f7] flex items-center justify-center text-xs font-bold text-white flex-none mt-0.5">AI</div>
              <div className="bg-[#f2f4f8] rounded-xl rounded-tl-none px-4 py-3 text-sm text-[#0f1117] max-w-sm border border-black/7">
                Hi! I'll ask you a few questions to understand what you're building, then generate a detailed cost breakdown. Ready to start?
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-black/8">
              <p className="text-xs text-[#9099b0]">The AI will guide you through 5–8 questions</p>
              <Button variant="primary" onClick={() => navigate('/chat')}>
                Start Interview <ArrowRight size={14} />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'spec' && (
        <Card className="animate-fade-in">
          <CardContent className="p-6">
            {/* Drop zone */}
            <div className="border-2 border-dashed border-black/14 rounded-xl p-8 text-center mb-4 hover:border-[#4f7dff]/40 hover:bg-[#4f7dff]/3 transition-all cursor-pointer group">
              <FileText size={28} className="text-[#9099b0] group-hover:text-[#4f7dff] mx-auto mb-2 transition-colors" />
              <div className="text-sm text-[#6b7380] group-hover:text-[#0f1117] transition-colors">Drop a .md file here</div>
              <div className="text-xs text-[#9099b0] mt-0.5">or click to browse</div>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px bg-black/8" />
              <span className="text-xs text-[#9099b0]">or paste directly</span>
              <div className="flex-1 h-px bg-black/8" />
            </div>
            <Textarea
              placeholder="# My Project Spec&#10;&#10;## Features&#10;- User authentication&#10;- ..."
              rows={8}
              className="font-mono text-xs"
            />
            <div className="flex justify-end mt-4">
              <Button variant="primary" onClick={() => navigate('/chat')}>
                Extract Features <ArrowRight size={14} />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
