import { useCallback, useEffect, useRef, useState } from 'react'

const WS_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000')
  .replace(/^http/, 'ws')

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

export interface ExtractedFeature {
  name: string
  description: string
  category: string
  priority: number
}

type ChatEvent =
  | { type: 'token'; text: string }
  | { type: 'done'; text: string }
  | { type: 'features'; features: ExtractedFeature[] }
  | { type: 'error'; text: string }
  | { type: 'analysis_ready'; project_id: number }

interface UseChatOptions {
  projectId: number
  onAnalysisReady: (projectId: number) => void
}

export function useChat({ projectId, onAnalysisReady }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [features, setFeatures] = useState<ExtractedFeature[]>([])
  const [connected, setConnected] = useState(false)
  const [streaming, setStreaming] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const streamingIdRef = useRef<string | null>(null)

  const send = useCallback((data: object) => {
    wsRef.current?.send(JSON.stringify(data))
  }, [])

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/ws/chat/${projectId}`)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)

    ws.onmessage = (evt) => {
      const event: ChatEvent = JSON.parse(evt.data)

      if (event.type === 'token') {
        setStreaming(true)
        setMessages(prev => {
          const streamingId = streamingIdRef.current
          if (streamingId) {
            // Append chunk to the streaming message
            return prev.map(m =>
              m.id === streamingId
                ? { ...m, content: m.content + event.text }
                : m
            )
          }
          // Start new streaming message
          const id = crypto.randomUUID()
          streamingIdRef.current = id
          return [...prev, { id, role: 'assistant', content: event.text, streaming: true }]
        })
      }

      if (event.type === 'done') {
        setStreaming(false)
        if (streamingIdRef.current) {
          // Mark streaming message as complete
          setMessages(prev =>
            prev.map(m =>
              m.id === streamingIdRef.current
                ? { ...m, content: event.text, streaming: false }
                : m
            )
          )
          streamingIdRef.current = null
        } else {
          // Non-streamed message (e.g. greeting)
          setMessages(prev => [
            ...prev,
            { id: crypto.randomUUID(), role: 'assistant', content: event.text },
          ])
        }
      }

      if (event.type === 'features') {
        setFeatures(event.features)
      }

      if (event.type === 'error') {
        setMessages(prev => [
          ...prev,
          { id: crypto.randomUUID(), role: 'assistant', content: `⚠ ${event.text}` },
        ])
      }

      if (event.type === 'analysis_ready') {
        onAnalysisReady(event.project_id)
      }
    }

    return () => ws.close()
  }, [projectId, onAnalysisReady])

  const sendMessage = useCallback((text: string) => {
    setMessages(prev => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content: text },
    ])
    send({ type: 'message', text })
  }, [send])

  const confirmFeatures = useCallback(() => send({ type: 'confirm_features' }), [send])
  const rejectFeatures = useCallback(() => {
    setFeatures([])
    send({ type: 'reject_features' })
  }, [send])

  return {
    messages,
    features,
    connected,
    streaming,
    sendMessage,
    confirmFeatures,
    rejectFeatures,
  }
}
