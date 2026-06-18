import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Product } from '@/api'

interface SplitPreviewModalProps {
  product: Product
  onConfirm: (products: Product[]) => void
  onCancel: () => void
}

export function SplitPreviewModal({ product, onConfirm, onCancel }: SplitPreviewModalProps) {
  const features = Object.entries(product.options).filter(([, opts]) => opts.length >= 2)
  const [selectedFeature, setSelectedFeature] = useState<string>(features[0]?.[0] ?? '')

  const splitOptions = product.options[selectedFeature] ?? []

  const [titles, setTitles] = useState<string[]>(() =>
    (product.options[features[0]?.[0] ?? ''] ?? []).map(opt => `${product.title} ${opt}`)
  )

  function changeFeature(feature: string) {
    setSelectedFeature(feature)
    setTitles((product.options[feature] ?? []).map(opt => `${product.title} ${opt}`))
  }

  function buildProducts(): Product[] {
    const { [selectedFeature]: _dropped, ...otherOptions } = product.options
    return splitOptions.map((opt, i) => ({
      ...product,
      title: titles[i]?.trim() || `${product.title} ${opt}`,
      options: otherOptions,
      productCode: undefined,
      product_url: `${product.product_url}:split:${encodeURIComponent(opt)}`,
    }))
  }

  const remainingFeatures = Object.entries(product.options).filter(([k]) => k !== selectedFeature)

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Split Product</DialogTitle>
          <p className="text-xs text-zinc-400">
            Creates one product per option of the chosen feature.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-5">
          {/* Source product */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Source</label>
            <p className="text-sm font-semibold text-zinc-900">{product.title}</p>
          </div>

          {/* Feature picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Split by</label>
            <div className="flex flex-wrap gap-1.5">
              {features.map(([f, opts]) => (
                <button
                  key={f}
                  onClick={() => changeFeature(f)}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                    selectedFeature === f
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                  }`}
                >
                  {f} <span className="opacity-60">({opts.length})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Resulting products */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
              {splitOptions.length} resulting products
            </label>
            <div className="flex flex-col divide-y divide-zinc-100">
              {splitOptions.map((opt, i) => (
                <div key={opt} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <Badge variant="outline" className="shrink-0 text-[11px] font-normal">{opt}</Badge>
                  <input
                    type="text"
                    value={titles[i] ?? ''}
                    onChange={e => {
                      const next = [...titles]
                      next[i] = e.target.value
                      setTitles(next)
                    }}
                    className="flex-1 h-8 px-2.5 rounded-md border border-zinc-200 text-xs outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Remaining features */}
          {remainingFeatures.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
                Carried over to all
              </label>
              <div className="flex flex-wrap gap-2">
                {remainingFeatures.map(([f, opts]) => (
                  <span key={f} className="text-[11px] text-zinc-500">
                    <span className="text-zinc-400 mr-0.5">{f}</span>({opts.length})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button
            onClick={() => onConfirm(buildProducts())}
            disabled={titles.some(t => !t?.trim())}
          >
            Add {splitOptions.length} to Import Queue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
