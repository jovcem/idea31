import { useState, useEffect, useRef } from 'react'
import { api, type CollectionCard, type ProductsResult, type ScrapeResult, type Product } from './api'
import { HomeGrid } from './components/HomeGrid'
import { ProductsGrid } from './components/ProductsGrid'
import { ScrapeView } from './components/ScrapeView'
import './index.css'

type View =
  | { type: 'home' }
  | { type: 'products'; result: ProductsResult }
  | { type: 'scrape'; result: ScrapeResult }

export default function App() {
  const [view, setView] = useState<View>({ type: 'home' })
  const [collections, setCollections] = useState<CollectionCard[]>([])
  const [loading, setLoading] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [currentUrl, setCurrentUrl] = useState('')
  const [csvProducts, setCsvProducts] = useState<Product[] | null>(null)

  useEffect(() => {
    setStatusText('Loading…')
    api.home()
      .then((data) => {
        setCollections(data)
        setStatusText('')
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e)
        setStatusText(`Error: ${msg}`)
      })
  }, [])

  async function handleScrape(url: string) {
    setLoading(true)
    setStatusText('Scraping…')
    setCurrentUrl(url)
    try {
      if (url.includes('/collections/')) {
        const result = await api.collections(url)
        setView({ type: 'products', result })
        setStatusText(result.error ? '' : `${result.products.length} products`)
        window.history.pushState(null, '', `/collection?url=${encodeURIComponent(url)}`)
      } else if (view.type === 'home') {
        const data = await api.home(url)
        setCollections(data)
        setStatusText(data.length ? `${data.length} collections` : 'No collections found')
      } else {
        const result = await api.scrape(url)
        setView({ type: 'scrape', result })
        setStatusText(result.error ? '' : `${result.links.length} links`)
        window.history.pushState(null, '', `/collection?url=${encodeURIComponent(url)}`)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setStatusText(`Error: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  function handleBack() {
    setView({ type: 'home' })
    setCurrentUrl('')
    setStatusText('')
    window.history.pushState(null, '', '/home')
  }

  // Keep a ref to the latest handlers so the popstate listener is never stale
  const handleScrapeRef = useRef(handleScrape)
  const handleBackRef = useRef(handleBack)
  useEffect(() => {
    handleScrapeRef.current = handleScrape
    handleBackRef.current = handleBack
  })

  // Set initial URL and handle browser back/forward
  useEffect(() => {
    const path = window.location.pathname
    const params = new URLSearchParams(window.location.search)
    if (path === '/collection') {
      const url = params.get('url')
      if (url) handleScrapeRef.current(url)
    } else if (path === '/' || path === '') {
      window.history.replaceState(null, '', '/home')
    }

    function onPopState() {
      const p = window.location.pathname
      if (p === '/collection') {
        const url = new URLSearchParams(window.location.search).get('url')
        if (url) handleScrapeRef.current(url)
      } else {
        handleBackRef.current()
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const isProducts = view.type === 'products'
  const exportUrl = isProducts ? currentUrl : null

  return (
    <div className="min-h-screen">
      {view.type === 'home' && (
        <HomeGrid collections={collections} loading={loading} onSelect={handleScrape} />
      )}
      {view.type === 'products' && (
        <ProductsGrid
          result={view.result}
          csvProducts={csvProducts}
          onLoadCsv={setCsvProducts}
          onClearCsv={() => setCsvProducts(null)}
          onBack={handleBack}
        />
      )}
      {view.type === 'scrape' && <ScrapeView result={view.result} />}
    </div>
  )
}
