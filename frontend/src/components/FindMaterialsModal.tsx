import { useState } from 'react'
import { X, FlaskConical, CloudUpload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export interface MaterialFeature {
  name: string
  options: string[]
}

interface Props {
  title: string
  loading: boolean
  error: string | null
  materials: MaterialFeature[] | null
  nonMaterials: MaterialFeature[] | null
  canCreate?: boolean
  onCreateMaterials?: (materials: string[], familyName: string) => Promise<{ created: number; errors: string[] }>
  onClose: () => void
}

function FeatureBlock({ feature, variant }: { feature: MaterialFeature; variant: 'material' | 'non' }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 flex flex-col gap-1.5 ${
      variant === 'material' ? 'bg-emerald-50 border-emerald-100' : 'bg-zinc-50 border-zinc-200'
    }`}>
      <p className={`text-[10px] font-semibold uppercase tracking-wider ${
        variant === 'material' ? 'text-emerald-700' : 'text-zinc-400'
      }`}>
        {feature.name}
      </p>
      <div className="flex flex-wrap gap-1">
        {feature.options.map((opt, i) => (
          <Badge
            key={i}
            variant="outline"
            className={`text-[10px] py-0 ${
              variant === 'material'
                ? 'border-emerald-200 text-emerald-800 bg-white'
                : 'border-zinc-200 text-zinc-500 bg-white'
            }`}
          >
            {opt}
          </Badge>
        ))}
      </div>
    </div>
  )
}

export function FindMaterialsModal({ title, loading, error, materials, nonMaterials, canCreate, onCreateMaterials, onClose }: Props) {
  const [creating, setCreating] = useState(false)
  const [createResult, setCreateResult] = useState<{ created: number; errors: string[] } | null>(null)
  const [familyName, setFamilyName] = useState('')

  const flatMaterials = materials?.flatMap(f => f.options) ?? []

  async function handleCreate() {
    if (!onCreateMaterials || flatMaterials.length === 0 || !familyName.trim()) return
    setCreating(true)
    setCreateResult(null)
    try {
      const res = await onCreateMaterials(flatMaterials, familyName.trim())
      setCreateResult({ created: res.created, errors: res.errors })
    } catch (e) {
      setCreateResult({ created: 0, errors: [e instanceof Error ? e.message : String(e)] })
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-xl mx-4 bg-white rounded-2xl shadow-xl flex flex-col gap-5 p-6 max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-zinc-500" />
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Find Materials</h2>
              <p className="text-xs text-zinc-400 truncate max-w-xs">{title}</p>
            </div>
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
            Identifying material features…
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm font-semibold text-red-600 mb-0.5">Error</p>
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {materials && nonMaterials && (
          <div className="flex gap-5 overflow-y-auto">
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider shrink-0">
                Materials{' '}
                <span className="normal-case tracking-normal font-normal text-zinc-300">({materials.length})</span>
              </p>
              {materials.length === 0
                ? <p className="text-xs text-zinc-300 italic">None found</p>
                : materials.map((f, i) => <FeatureBlock key={i} feature={f} variant="material" />)
              }
            </div>
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider shrink-0">
                Non-materials{' '}
                <span className="normal-case tracking-normal font-normal text-zinc-300">({nonMaterials.length})</span>
              </p>
              {nonMaterials.length === 0
                ? <p className="text-xs text-zinc-300 italic">None found</p>
                : nonMaterials.map((f, i) => <FeatureBlock key={i} feature={f} variant="non" />)
              }
            </div>
          </div>
        )}

        {materials && materials.length > 0 && onCreateMaterials && (
          <div className="flex flex-col gap-1.5 shrink-0">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Family name
            </label>
            <input
              type="text"
              value={familyName}
              onChange={e => setFamilyName(e.target.value)}
              placeholder="e.g. Upholstery Materials"
              className="w-full h-8 px-3 rounded-lg border border-zinc-200 bg-zinc-50 text-xs text-zinc-900 outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-colors placeholder:text-zinc-400"
            />
          </div>
        )}

        <div className="flex items-center justify-between shrink-0 pt-1">
          <div className="flex items-center gap-2">
            {createResult && createResult.created > 0 && (
              <span className="text-xs text-emerald-600">✓ {createResult.created} created</span>
            )}
            {createResult && createResult.errors.length > 0 && (
              <span className="text-xs text-red-500">{createResult.errors[0].slice(0, 60)}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
            {materials && materials.length > 0 && onCreateMaterials && (
              <Button
                size="sm"
                className="gap-1.5"
                disabled={!canCreate || creating || flatMaterials.length === 0 || !familyName.trim()}
                onClick={handleCreate}
                title={!canCreate ? 'Connect to CMS and set Material Project ID first' : undefined}
              >
                <CloudUpload className="h-3.5 w-3.5" />
                {creating ? 'Creating…' : `Create Materials (${flatMaterials.length})`}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
