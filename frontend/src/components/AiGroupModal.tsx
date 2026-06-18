import { X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Usage {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
}

interface AiGroupModalProps {
  response: string
  loading: boolean
  usage: Usage | null
  onClose: () => void
}

export function AiGroupModal({ response, loading, usage, onClose }: AiGroupModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-xl flex flex-col gap-4 p-6 max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between shrink-0">
          <h2 className="text-sm font-semibold text-zinc-900">AI Product Grouping</h2>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Grouping products…</span>
          </div>
        ) : (
          <div className="overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800 whitespace-pre-wrap">
            {response}
          </div>
        )}

        {usage && !loading && (
          <div className="flex items-center gap-4 pt-1 border-t border-zinc-100 shrink-0">
            <span className="text-[11px] text-zinc-400">Tokens</span>
            <span className="text-[11px] text-zinc-500">
              <span className="font-medium text-zinc-700">{usage.prompt_tokens ?? '—'}</span> in
            </span>
            <span className="text-[11px] text-zinc-500">
              <span className="font-medium text-zinc-700">{usage.completion_tokens ?? '—'}</span> out
            </span>
            <span className="text-[11px] text-zinc-500">
              <span className="font-medium text-zinc-700">{usage.total_tokens ?? '—'}</span> total
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
