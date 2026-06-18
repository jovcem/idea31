import { useState } from 'react'
import { X, Search, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface AnalysisDimension {
  name: string
  description: string
  examples: string[]
}

interface Props {
  loading: boolean
  error: string | null
  dimensions: AnalysisDimension[] | null
  onClose: () => void
  onGroupWithSelected: (selected: AnalysisDimension[], extraInfo: string) => void
}

export function AiAnalyzeModal({ loading, error, dimensions, onClose, onGroupWithSelected }: Props) {
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [extraInfo, setExtraInfo] = useState('')

  function toggle(i: number) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  function handleGroup() {
    if (!dimensions) return
    onGroupWithSelected(dimensions.filter((_, i) => checked.has(i)), extraInfo.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg mx-4 bg-white rounded-2xl shadow-xl flex flex-col gap-5 p-6 max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-900">Analyze for grouping</h2>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {loading && (
          <div className="flex items-center gap-3 py-6 text-sm text-zinc-500 justify-center">
            <svg className="animate-spin h-4 w-4 text-zinc-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Analyzing products…
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm font-semibold text-red-600 mb-0.5">Error</p>
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {dimensions && dimensions.length > 0 && (
          <div className="flex flex-col gap-2 overflow-y-auto">
           
            {dimensions.map((dim, i) => {
              const isChecked = checked.has(i)
              return (
                <label
                  key={i}
                  className={`flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
                    isChecked ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(i)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-zinc-900 cursor-pointer shrink-0"
                  />
                  <div className="flex flex-col gap-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-900">{dim.name}</p>
                    <p className="text-xs text-zinc-500">{dim.description}</p>
                    {dim.examples.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {dim.examples.slice(0, 4).map((ex, j) => (
                          <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200 truncate max-w-[200px]">
                            {ex}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              )
            })}
          </div>
        )}

        {dimensions && dimensions.length === 0 && (
          <p className="text-sm text-zinc-400 text-center py-4">No clear grouping dimensions found.</p>
        )}

        {dimensions && dimensions.length > 0 && (
          <div className="flex flex-col gap-1.5 shrink-0">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Extra grouping instructions <span className="normal-case tracking-normal font-normal text-zinc-400">(optional)</span>
            </label>
            <input
              type="text"
              value={extraInfo}
              onChange={e => setExtraInfo(e.target.value)}
              placeholder="e.g. keep single-seaters separate from sofas"
              className="w-full h-8 px-3 rounded-lg border border-zinc-200 bg-zinc-50 text-xs text-zinc-900 outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-colors placeholder:text-zinc-400"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 shrink-0 pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          {dimensions && dimensions.length > 0 && (
            <Button size="sm" disabled={checked.size === 0 && !extraInfo.trim()} onClick={handleGroup} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Group with selected
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
