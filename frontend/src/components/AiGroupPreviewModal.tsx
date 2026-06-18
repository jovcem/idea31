import { useState } from 'react'
import { X, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface AiGroup {
  name: string
  products: string[]
}

interface Usage {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
}

interface AiGroupPreviewModalProps {
  groups: AiGroup[]
  usage: Usage | null
  onConfirm: (selected: AiGroup[]) => void
  onClose: () => void
}

export function AiGroupPreviewModal({ groups, usage, onConfirm, onClose }: AiGroupPreviewModalProps) {
  const [checked, setChecked] = useState<Set<number>>(new Set(groups.map((_, i) => i)))
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]))
  const [names, setNames] = useState<string[]>(groups.map(g => g.name))

  function toggleCheck(i: number) {
    setChecked(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })
  }

  function toggleExpand(i: number) {
    setExpanded(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })
  }

  function renameName(i: number, value: string) {
    setNames(prev => { const n = [...prev]; n[i] = value; return n })
  }

  const selectedGroups = groups
    .map((g, i) => ({ ...g, name: names[i] }))
    .filter((_, i) => checked.has(i))
  const totalProducts = selectedGroups.reduce((s, g) => s + g.products.length, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg mx-4 bg-white rounded-2xl shadow-xl flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Group preview</h2>
            <p className="text-xs text-zinc-400 mt-0.5">{groups.length} groups · {groups.reduce((s, g) => s + g.products.length, 0)} products</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Group list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-1">
          {groups.map((group, i) => (
            <div key={i} className={`rounded-xl border transition-colors ${checked.has(i) ? 'border-zinc-200 bg-white' : 'border-zinc-100 bg-zinc-50 opacity-60'}`}>
              <div className="flex items-center gap-2 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={checked.has(i)}
                  onChange={() => toggleCheck(i)}
                  className="h-4 w-4 rounded border-zinc-300 accent-zinc-900 cursor-pointer shrink-0"
                />
                <input
                  type="text"
                  value={names[i]}
                  onChange={e => renameName(i, e.target.value)}
                  onClick={e => e.stopPropagation()}
                  className="flex-1 min-w-0 text-sm font-medium text-zinc-800 bg-transparent border-0 border-b border-transparent hover:border-zinc-200 focus:border-zinc-400 focus:outline-none px-0 py-0 transition-colors"
                />
                <button
                  className="flex items-center gap-1 shrink-0"
                  onClick={() => toggleExpand(i)}
                >
                  <span className="text-xs text-zinc-400">{group.products.length} products</span>
                  {expanded.has(i)
                    ? <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                    : <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                  }
                </button>
              </div>
              {expanded.has(i) && (
                <ul className="px-9 pb-3 flex flex-col gap-0.5">
                  {group.products.map((name, j) => (
                    <li key={j} className="text-xs text-zinc-500 truncate">· {name}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100 shrink-0">
          <div className="flex items-center gap-3">
            {usage && (
              <span className="text-[11px] text-zinc-400">
                <span className="font-medium text-zinc-600">{usage.prompt_tokens ?? '—'}</span> in ·{' '}
                <span className="font-medium text-zinc-600">{usage.completion_tokens ?? '—'}</span> out
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button
              size="sm"
              disabled={checked.size === 0}
              onClick={() => onConfirm(selectedGroups)}
            >
              Add {checked.size > 0 ? `${checked.size} group${checked.size > 1 ? 's' : ''} (${totalProducts} products)` : ''} to queue
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
