import { useState, useRef, useEffect } from 'react'
import { X, Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/api'

interface ChatModalProps {
  onClose: () => void
}

export function ChatModal({ onClose }: ChatModalProps) {
  const [prompt, setPrompt] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { textareaRef.current?.focus() }, [])

  async function handleSend() {
    const text = prompt.trim()
    if (!text || loading) return
    setLoading(true)
    setError('')
    setResponse('')
    try {
      const res = await api.chat(text)
      setResponse(res.content)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend()
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-xl mx-4 bg-white rounded-2xl shadow-xl flex flex-col gap-4 p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">AI Chat</h2>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter your prompt… (⌘Enter to send)"
          rows={4}
          className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800 outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 resize-none"
        />

        <Button onClick={handleSend} disabled={!prompt.trim() || loading} className="gap-2 self-end">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send
        </Button>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {response && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800 whitespace-pre-wrap max-h-64 overflow-y-auto">
            {response}
          </div>
        )}
      </div>
    </div>
  )
}
