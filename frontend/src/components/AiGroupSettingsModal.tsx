import { useState } from 'react'
import { X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface GroupingRule {
  id: string
  label: string
  description: string
  promptLine: string
}

export const GROUPING_RULES: GroupingRule[] = [
  {
    id: 'family',
    label: 'Product family / name series',
    description: 'Products sharing a common series name (e.g. all "Belle" together)',
    promptLine: 'By product family or shared name series — products with the same base name belong in the same group',
  },
  {
    id: 'capacity',
    label: 'Seating capacity',
    description: '1-seater, 2-seater, 3-seater, sectional, etc.',
    promptLine: 'By seating capacity (1-seater, 2-seater, 3-seater, sectional, etc.) based on cues in the name',
  },
  {
    id: 'shape',
    label: 'Shape / configuration',
    description: 'Sofa, chaiselong, corner, ottoman, armchair…',
    promptLine: 'By shape or configuration (sofa, chaiselong / chaise longue, corner sofa, ottoman, armchair, etc.)',
  },
  {
    id: 'size',
    label: 'Size category',
    description: 'Compact, standard, large based on dimension keywords in the name',
    promptLine: 'By size category (compact / small, standard / medium, large / oversized) inferred from the name',
  },
  {
    id: 'orientation',
    label: 'Orientation',
    description: 'Left-hand vs right-hand configurations',
    promptLine: 'By orientation — separate left-hand and right-hand chaiselong or sectional configurations',
  },
  {
    id: 'style',
    label: 'Style / aesthetic',
    description: 'Modern, classic, Scandinavian, etc. inferred from the name',
    promptLine: 'By visual style or aesthetic (modern, classic, Scandinavian, contemporary, etc.) based on name cues',
  },
  {
    id: 'color',
    label: 'Color / material',
    description: 'Color or upholstery material keywords in the name',
    promptLine: 'By color or material keywords appearing in the product names (e.g. fabric, leather, velvet, oak)',
  },
]

const DEFAULT_CHECKED = new Set(['family', 'capacity', 'shape'])

interface AiGroupSettingsModalProps {
  productCount: number
  baseTokenEstimate: number
  onConfirm: (selectedRules: GroupingRule[]) => void
  onCancel: () => void
}

export function AiGroupSettingsModal({ productCount, baseTokenEstimate, onConfirm, onCancel }: AiGroupSettingsModalProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set(DEFAULT_CHECKED))

  function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectedRules = GROUPING_RULES.filter(r => checked.has(r.id))
  // each rule adds ~15 tokens to the prompt
  const estimatedTokens = baseTokenEstimate + selectedRules.length * 15

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="w-full max-w-md mx-4 bg-white rounded-2xl shadow-xl flex flex-col gap-5 p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-900">Group with AI</h2>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3 rounded-lg bg-zinc-50 border border-zinc-200 px-4 py-2.5">
          <span className="text-xs text-zinc-500">{productCount} products</span>
          <div className="w-px h-3 bg-zinc-200" />
          <span className="text-xs text-zinc-500">~<span className="font-semibold text-zinc-800">{estimatedTokens.toLocaleString()}</span> input tokens</span>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Group by</p>
          {GROUPING_RULES.map(rule => (
            <label
              key={rule.id}
              className="flex items-start gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-zinc-50 transition-colors"
            >
              <input
                type="checkbox"
                checked={checked.has(rule.id)}
                onChange={() => toggle(rule.id)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-zinc-900 cursor-pointer shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm text-zinc-800 font-medium leading-tight">{rule.label}</p>
                <p className="text-xs text-zinc-400 mt-0.5">{rule.description}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" disabled={checked.size === 0} onClick={() => onConfirm(selectedRules)} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
