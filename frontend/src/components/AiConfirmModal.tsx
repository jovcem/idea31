import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'

interface AiConfirmModalProps {
  estimatedTokens: number
  onConfirm: () => void
  onCancel: () => void
}

export function AiConfirmModal({ estimatedTokens, onConfirm, onCancel }: AiConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl shadow-xl p-6 w-80 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-zinc-500 shrink-0" />
          <h2 className="text-sm font-semibold text-zinc-900">Send to AI?</h2>
        </div>

        <div className="rounded-lg bg-zinc-50 border border-zinc-200 px-4 py-3 flex items-center justify-between">
          <span className="text-xs text-zinc-500">Estimated input tokens</span>
          <span className="text-sm font-semibold text-zinc-900">{estimatedTokens.toLocaleString()}</span>
        </div>

        <p className="text-xs text-zinc-400">
          This is an approximation (~4 chars / token). Actual usage will be shown after the response.
        </p>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" onClick={onConfirm}>Send</Button>
        </div>
      </div>
    </div>
  )
}
