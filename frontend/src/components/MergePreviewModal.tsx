import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Product } from '@/api'

interface MergePreviewModalProps {
  product: Product | null
  sourceTitles: string[]
  onConfirm: (product: Product) => void
  onCancel: () => void
}

function AddOptionInput({ onAdd }: { onAdd: (value: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')

  function commit() {
    if (value.trim()) onAdd(value)
    setValue('')
    setEditing(false)
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full border border-dashed border-zinc-300 text-[11px] text-zinc-400 hover:border-zinc-400 hover:text-zinc-600 transition-colors"
      >
        <Plus className="h-2.5 w-2.5" /> Add
      </button>
    )
  }

  return (
    <input
      autoFocus
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') { setValue(''); setEditing(false) }
      }}
      onBlur={commit}
      placeholder="New option…"
      className="h-6 px-2 rounded-full border border-zinc-300 text-[11px] outline-none focus:border-zinc-900 transition-colors w-24"
    />
  )
}

function withVariantFallback(opts: Record<string, string[]>, sourceTitles: string[]): Record<string, string[]> {
  if (Object.keys(opts).length === 0) return { Variant: sourceTitles }
  return opts
}

export function MergePreviewModal({ product, sourceTitles, onConfirm, onCancel }: MergePreviewModalProps) {
  const [title, setTitle] = useState(product?.title ?? '')
  const [options, setOptions] = useState<Record<string, string[]>>(
    withVariantFallback(product?.options ?? {}, sourceTitles)
  )

  if (!product) return null

  function removeOption(feature: string, value: string) {
    setOptions((prev) => {
      const updated = prev[feature].filter((v) => v !== value)
      const next = updated.length === 0
        ? (() => { const { [feature]: _r, ...rest } = prev; return rest })()
        : { ...prev, [feature]: updated }
      return withVariantFallback(next, sourceTitles)
    })
  }

  function renameFeature(oldName: string, newName: string) {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === oldName) return
    setOptions((prev) => {
      const entries = Object.entries(prev)
      return Object.fromEntries(
        entries.map(([k, v]) => [k === oldName ? trimmed : k, v])
      )
    })
  }

  function addOption(feature: string, value: string) {
    const trimmed = value.trim()
    if (!trimmed) return
    setOptions((prev) => {
      if (prev[feature].includes(trimmed)) return prev
      return { ...prev, [feature]: [...prev[feature], trimmed] }
    })
  }

  function handleConfirm() {
    onConfirm({ ...product!, title, options })
  }

  const featureCount = Object.keys(options).length
  const totalOptions = Object.values(options).reduce((sum, v) => sum + v.length, 0)

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Merge Preview</DialogTitle>
          <p className="text-xs text-zinc-400">
            Review and edit the merged product before adding it to the import queue.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-5">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
              Product Name
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 px-3 rounded-lg border border-zinc-200 text-sm font-medium text-zinc-900 outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
            />
          </div>

          {/* Summary */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{featureCount} feature{featureCount !== 1 ? 's' : ''}</Badge>
            <Badge variant="secondary">{totalOptions} option{totalOptions !== 1 ? 's' : ''} total</Badge>
          </div>

          {/* Features */}
          {featureCount > 0 && (
            <div className="flex flex-col divide-y divide-zinc-100">
              {Object.entries(options).map(([feature, values]) => (
                <div key={feature} className="flex items-start gap-3 pt-3 pb-3 first:pt-0 last:pb-0">
                  <div className="w-28 shrink-0 pt-0.5">
                    <input
                      type="text"
                      defaultValue={feature}
                      onBlur={(e) => renameFeature(feature, e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                      className="w-full text-[10px] font-semibold text-zinc-500 uppercase tracking-widest bg-transparent border-b border-transparent hover:border-zinc-200 focus:border-zinc-400 outline-none transition-colors py-0.5"
                    />
                    <span className="block text-[10px] text-zinc-300 mt-0.5">
                      {values.length} option{values.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {values.map((v) => (
                      <span
                        key={v}
                        className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full border border-zinc-200 text-[11px] text-zinc-700 bg-white hover:border-red-200 group transition-colors"
                      >
                        {v}
                        <button
                          onClick={() => removeOption(feature, v)}
                          className="text-zinc-300 group-hover:text-red-400 transition-colors rounded-full hover:bg-red-50 p-0.5"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                    <AddOptionInput onAdd={(val) => addOption(feature, val)} />
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!title.trim() || featureCount === 0}>
            Add to Import Queue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
