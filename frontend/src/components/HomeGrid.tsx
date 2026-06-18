import { useState, type FormEvent } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CollectionCard } from '@/api'

const SOURCE_URL = 'https://sobusobu.com/pages/sofas-at-sobu'

interface HomeGridProps {
  collections: CollectionCard[]
  loading: boolean
  onSelect: (url: string) => void
}

export function HomeGrid({ collections, loading, onSelect }: HomeGridProps) {
  const [url, setUrl] = useState(SOURCE_URL)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return
    const normalized = trimmed.startsWith('http') ? trimmed : 'https://' + trimmed
    setUrl(normalized)
    onSelect(normalized)
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Hero */}
      <div className="bg-white border-b border-zinc-200 px-8 pt-10 pb-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Sofas at SOBU</h1>
          <p className="mt-1.5 text-sm text-zinc-400">
            Collections from{' '}
            <a
              href={SOURCE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-zinc-600 hover:text-zinc-900 underline underline-offset-2 transition-colors"
            >
              sobusobu.com
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>

          <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-6 max-w-xl">
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://example.com/collections/..."
              className="flex-1 h-9 px-3 rounded-lg border border-zinc-200 bg-zinc-50 text-sm outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 focus:bg-white transition-colors placeholder:text-zinc-400"
            />
            <Button type="submit" disabled={loading} className="shrink-0">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Scrape'}
            </Button>
          </form>
        </div>
      </div>

      {/* Grid */}
      <div className="px-8 py-8 max-w-5xl mx-auto">
        {collections.length === 0 ? (
          <div className="flex items-center justify-center py-24 text-sm text-zinc-400">
            Loading collections…
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-5">
            {collections.map((c) => (
              <button
                key={c.url}
                onClick={() => onSelect(c.url)}
                className="group w-full text-left rounded-2xl border border-zinc-200 bg-white overflow-hidden
                           hover:shadow-lg hover:border-zinc-300 transition-all duration-200 cursor-pointer"
              >
                <div className="aspect-[4/3] overflow-hidden bg-zinc-100">
                  {c.image_url ? (
                    <img
                      src={c.image_url}
                      alt={c.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-zinc-300">
                      No image
                    </div>
                  )}
                </div>
                <div className="px-4 py-3.5">
                  <p className="font-semibold text-sm text-zinc-900 leading-snug">{c.name}</p>
                  <p className="text-xs text-zinc-400 mt-1 truncate">{c.url.replace(/^https?:\/\//, '')}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
