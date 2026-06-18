import { useState, useRef, useEffect } from 'react'
import { ExternalLink, ArrowRight, X, Merge, Scissors, Upload, Sparkles, Search, Settings, CloudUpload, CheckCircle2, SquareArrowOutUpRight, FlaskConical, Home } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MergePreviewModal } from '@/components/MergePreviewModal'
import { SplitPreviewModal } from '@/components/SplitPreviewModal'
import { AiGroupPreviewModal, type AiGroup } from '@/components/AiGroupPreviewModal'
import { AiGroupSettingsModal, type GroupingRule } from '@/components/AiGroupSettingsModal'
import { AiAnalyzeModal, type AnalysisDimension } from '@/components/AiAnalyzeModal'
import { FindMaterialsModal, type MaterialFeature } from '@/components/FindMaterialsModal'
import { CsvColumnPickerModal, type CsvColumnMapping, extractJsonProp } from '@/components/CsvColumnPickerModal'
import { api } from '@/api'
import type { Product, ProductsResult } from '@/api'

// ── CSV helpers ─────────────────────────────────────────────────────────────

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let fields: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++ }
        else inQ = false
      } else {
        cur += ch
      }
    } else {
      if (ch === '"') { inQ = true }
      else if (ch === ',') { fields.push(cur); cur = '' }
      else if (ch === '\r') { /* skip */ }
      else if (ch === '\n') {
        fields.push(cur); cur = ''
        if (fields.some(f => f.trim())) rows.push(fields)
        fields = []
      } else { cur += ch }
    }
  }
  if (cur || fields.length > 0) {
    fields.push(cur)
    if (fields.some(f => f.trim())) rows.push(fields)
  }
  return rows
}

function parseCsvHeaders(text: string): { headers: string[]; sampleRows: Record<string, string>[] } {
  const rows = parseCsvRows(text)
  if (rows.length < 1) return { headers: [], sampleRows: [] }
  const headers = rows[0].map(h => h.trim())
  const sampleRows = rows.slice(1, 6).map(vals => {
    const row: Record<string, string> = {}
    headers.forEach((h, j) => { row[h] = (vals[j] ?? '').trim() })
    return row
  })
  return { headers, sampleRows }
}

function detectInitialMapping(headers: string[], _sampleRows: Record<string, string>[]): CsvColumnMapping {
  const find = (...terms: string[]) =>
    headers.find(h => terms.some(t => h.toLowerCase() === t)) ??
    headers.find(h => terms.some(t => h.toLowerCase().includes(t))) ??
    null

  const titleColumn =
    find('product name', 'name', 'title') ?? headers[0]

  return {
    titleColumn,
    productCodeColumn:        find('product code', 'code', 'sku', 'item number', 'id'),
    productUrlColumn:         find('product page url', 'product url', 'url', 'link'),
    widthColumn:              find('width'),
    depthColumn:              find('depth'),
    heightColumn:             find('height'),
    dimensionsUnitColumn:     find('dimensions unit', 'unit'),
    productFamilyColumn:      find('product family', 'family'),
    productTypeColumn:        find('product type', 'type'),
    productVersionTypeColumn: find('product version type', 'version type', 'version'),
    isArchtypeColumn:         find('is archtype', 'archtype'),
    productClassColumn:       find('product class', 'class'),
    jsonProperties:           {},
  }
}

function csvTextToProducts(text: string, mapping: CsvColumnMapping): Product[] {
  const rows = parseCsvRows(text)
  if (rows.length < 2) return []
  const allHeaders = rows[0].map(h => h.trim())

  return rows.slice(1).map((vals, i) => {
    const row: Record<string, string> = {}
    allHeaders.forEach((h, j) => { row[h] = (vals[j] ?? '').trim() })

    const col = (colName: string | null, fieldKey?: string) => {
      if (!colName) return ''
      const raw = row[colName] ?? ''
      const jsonProp = fieldKey ? mapping.jsonProperties[fieldKey] : undefined
      return jsonProp ? extractJsonProp(raw, jsonProp) : raw
    }
    const productCode = col(mapping.productCodeColumn, 'productCodeColumn')
    return {
      title: col(mapping.titleColumn, 'titleColumn'),
      price: '',
      image_url: '',
      product_url: col(mapping.productUrlColumn, 'productUrlColumn') || `csv:${i}:${productCode}`,
      options: {},
      productCode:        productCode || undefined,
      width:              col(mapping.widthColumn, 'widthColumn') || undefined,
      depth:              col(mapping.depthColumn, 'depthColumn') || undefined,
      height:             col(mapping.heightColumn, 'heightColumn') || undefined,
      dimensionsUnit:     col(mapping.dimensionsUnitColumn, 'dimensionsUnitColumn') || undefined,
      productFamily:      col(mapping.productFamilyColumn, 'productFamilyColumn') || undefined,
      productType:        col(mapping.productTypeColumn, 'productTypeColumn') || undefined,
      productVersionType: col(mapping.productVersionTypeColumn, 'productVersionTypeColumn') || undefined,
      isArchtype:         col(mapping.isArchtypeColumn, 'isArchtypeColumn') || undefined,
      productClass:       col(mapping.productClassColumn, 'productClassColumn') || undefined,
    }
  })
}

// ── Shared product row UI ────────────────────────────────────────────────────

function mergeProducts(products: Product[]): Product {
  const base = products[0]
  const mergedOptions: Record<string, string[]> = {}
  for (const p of products) {
    for (const [feature, options] of Object.entries(p.options)) {
      if (!mergedOptions[feature]) mergedOptions[feature] = []
      for (const opt of options) {
        if (!mergedOptions[feature].includes(opt)) mergedOptions[feature].push(opt)
      }
    }
  }
  return {
    title: base.title,
    price: base.price,
    image_url: base.image_url,
    product_url: base.product_url,
    options: mergedOptions,
    productCode:        base.productCode,
    width:              base.width,
    depth:              base.depth,
    height:             base.height,
    dimensionsUnit:     base.dimensionsUnit,
    productFamily:      base.productFamily,
    productType:        base.productType,
    productVersionType: base.productVersionType,
    isArchtype:         base.isArchtype,
    productClass:       base.productClass,
  }
}

function ProductInfo({ p, collapseFeatures, showAllFields = false, onRenameFeature }: { p: Product; collapseFeatures: boolean; showAllFields?: boolean; onRenameFeature?: (oldName: string, newName: string) => void }) {
  const featureCount = Object.keys(p.options).length
  const isCsvProduct = p.product_url.startsWith('csv:') || !!p.productCode
  const hasUrl = p.product_url && !p.product_url.startsWith('csv:')
  const [editingFeature, setEditingFeature] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const editRef = useRef<HTMLInputElement>(null)

  const dims = [p.width, p.depth, p.height].filter(Boolean)
  const dimsStr = dims.length ? dims.join(' × ') + (p.dimensionsUnit ? ` ${p.dimensionsUnit}` : '') : null

  const tags: { label: string; value: string }[] = [
    p.productFamily      ? { label: 'Family',  value: p.productFamily }      : null,
    p.productType        ? { label: 'Type',    value: p.productType }        : null,
    p.productClass       ? { label: 'Class',   value: p.productClass }       : null,
    p.productVersionType ? { label: 'Version', value: p.productVersionType } : null,
    p.isArchtype         ? { label: 'Archtype',value: p.isArchtype }         : null,
  ].filter((t): t is { label: string; value: string } => t !== null)

  const allFields: { label: string; value: string | undefined }[] = [
    { label: 'Code',     value: p.productCode },
    { label: 'Family',   value: p.productFamily },
    { label: 'Type',     value: p.productType },
    { label: 'Version',  value: p.productVersionType },
    { label: 'Dims',     value: dimsStr ?? undefined },
  ]

  return (
    <div className="flex flex-col flex-1 min-w-0 gap-2">
      {/* Thumbnail + title block */}
      <div className="flex items-start gap-2.5">
        {p.image_url && (
          <img src={p.image_url} alt={p.title} className="w-9 h-9 rounded-lg object-cover shrink-0 border border-zinc-100" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <p className="text-sm font-semibold text-zinc-900 leading-snug flex-1 min-w-0">{p.title}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              {p.price && <span className="text-xs font-semibold text-zinc-600">{p.price}</span>}
              {hasUrl && (
                <a href={p.product_url} target="_blank" rel="noopener noreferrer" className="text-zinc-300 hover:text-zinc-600 transition-colors">
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
          {/* Meta strip — compact panel only */}
          {!showAllFields && (p.productCode || dimsStr || tags.length > 0 || (!isCsvProduct && featureCount > 0)) && (
            <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
              {p.productCode && (
                <span className="text-[10px] font-mono bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">{p.productCode}</span>
              )}
              {dimsStr && <span className="text-[10px] text-zinc-400">{dimsStr}</span>}
              {tags.map(t => (
                <span key={t.label} className="text-[10px] text-zinc-400">
                  <span className="text-zinc-300 mr-0.5">{t.label}</span>{t.value}
                </span>
              ))}
              {!isCsvProduct && featureCount > 0 && (
                <span className="text-[10px] text-zinc-300">{featureCount} feature{featureCount !== 1 ? 's' : ''}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Metadata grid — queue panel */}
      {showAllFields && (
        <div className="grid grid-cols-3 gap-x-4 gap-y-0.5">
          {allFields.map(f => (
            <div key={f.label} className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 shrink-0">{f.label}</span>
              <span className={`text-[11px] truncate ${f.value ? 'text-zinc-700' : 'text-zinc-300'}`}>{f.value ?? '—'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Features */}
      {(!isCsvProduct || showAllFields) && featureCount > 0 && !collapseFeatures && (
        <div
          className="flex flex-col divide-y divide-zinc-100"
        >
          {Object.entries(p.options).map(([feature, options]) => (
            <div key={feature} className="flex items-start gap-2 pt-2 pb-2 first:pt-0 last:pb-0">
              <div className="w-24 shrink-0">
                {editingFeature === feature && onRenameFeature ? (
                  <input
                    ref={editRef}
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const trimmed = editValue.trim()
                        if (trimmed && trimmed !== feature) onRenameFeature(feature, trimmed)
                        setEditingFeature(null)
                      }
                      if (e.key === 'Escape') setEditingFeature(null)
                    }}
                    onBlur={() => {
                      const trimmed = editValue.trim()
                      if (trimmed && trimmed !== feature) onRenameFeature(feature, trimmed)
                      setEditingFeature(null)
                    }}
                    className="w-full text-[10px] font-semibold uppercase tracking-widest bg-white border border-zinc-300 rounded px-1 py-0 outline-none focus:border-zinc-500"
                    autoFocus
                  />
                ) : (
                  <span
                    className={`text-[10px] font-semibold text-zinc-400 uppercase tracking-widest leading-none ${onRenameFeature ? 'cursor-pointer hover:text-zinc-700 transition-colors' : ''}`}
                    title={onRenameFeature ? 'Click to rename' : undefined}
                    onClick={() => { if (onRenameFeature) { setEditingFeature(feature); setEditValue(feature) } }}
                  >
                    {feature}
                    <span className="normal-case tracking-normal font-normal text-zinc-300 ml-1">({options.length})</span>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {options.map((v) => (
                  <Badge key={v} variant="outline" className="text-[10px] py-0">{v}</Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

interface ProductsGridProps {
  result: ProductsResult
  csvProducts: Product[] | null
  onLoadCsv: (products: Product[]) => void
  onClearCsv: () => void
  onBack: () => void
}

export function ProductsGrid({ result, csvProducts, onLoadCsv, onClearCsv, onBack }: ProductsGridProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [queue, setQueue] = useState<Product[]>([])
  const [queueSources, setQueueSources] = useState<Product[][]>([])
  const [highlightedUrl, setHighlightedUrl] = useState<string | null>(null)
  const [mergePreview, setMergePreview] = useState<Product | null>(null)
  const [splitPreview, setSplitPreview] = useState<Product | null>(null)
  const [mergeSourceTitles, setMergeSourceTitles] = useState<string[]>([])
  const [mergeSourceProducts, setMergeSourceProducts] = useState<Product[]>([])
  const [showGroupSettings, setShowGroupSettings] = useState(false)
  const [collapseFeatures, setCollapseFeatures] = useState(true)
  const [pendingNames, setPendingNames] = useState<string[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiGroups, setAiGroups] = useState<AiGroup[] | null>(null)
  const [aiUsage, setAiUsage] = useState<{ prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null>(null)
  const [aiError, setAiError] = useState('')
  const [showAnalyzeModal, setShowAnalyzeModal] = useState(false)
  const [analyzeResult, setAnalyzeResult] = useState<AnalysisDimension[] | null>(null)
  const [analyzeLoading, setAnalyzeLoading] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [csvPending, setCsvPending] = useState<{ text: string; headers: string[]; sampleRows: Record<string, string>[]; initialMapping: CsvColumnMapping } | null>(null)

  const [filter, setFilter] = useState('')
  const [queueFilter, setQueueFilter] = useState('')

  const [materialsLoading, setMaterialsLoading] = useState(false)
  const [materialsResult, setMaterialsResult] = useState<{ materials: MaterialFeature[]; nonMaterials: MaterialFeature[] } | null>(null)
  const [materialsError, setMaterialsError] = useState<string | null>(null)

  const [queueSelected, setQueueSelected] = useState<Set<number>>(new Set())
  const [cmsConfig, setCmsConfig] = useState<{ projectId: string; sessionToken: string; materialProjectId: string; materialCustomerId: string }>(() => {
    try {
      const saved = localStorage.getItem('cms-config')
      return saved ? { materialProjectId: '', materialCustomerId: '', ...JSON.parse(saved) } : { projectId: '', sessionToken: '', materialProjectId: '', materialCustomerId: '' }
    } catch {
      return { projectId: '', sessionToken: '', materialProjectId: '', materialCustomerId: '' }
    }
  })
  const [showCmsConfig, setShowCmsConfig] = useState(false)
  const [cmsEmail, setCmsEmail] = useState('')
  const [cmsPassword, setCmsPassword] = useState('')
  const [cmsConnecting, setCmsConnecting] = useState(false)
  const [cmsConnectError, setCmsConnectError] = useState('')
  const [cmsImporting, setCmsImporting] = useState(false)
  const [cmsResult, setCmsResult] = useState<{ created: number; errors: string[] } | null>(null)

  useEffect(() => {
    localStorage.setItem('cms-config', JSON.stringify(cmsConfig))
  }, [cmsConfig])

  async function handleCmsConnect() {
    setCmsConnecting(true)
    setCmsConnectError('')
    try {
      const { sessionToken } = await api.cmsAuth(cmsEmail, cmsPassword)
      setCmsConfig(prev => ({ ...prev, sessionToken }))
      setShowCmsConfig(false)
    } catch (e) {
      setCmsConnectError(e instanceof Error ? e.message : String(e))
    } finally {
      setCmsConnecting(false)
    }
  }

  async function handleCmsImport() {
    if (!cmsConfig.sessionToken || queue.length === 0) return
    if (queueSelected.size === 0) {
      setQueueSelected(new Set(queue.map((_, i) => i)))
      return
    }
    const toImport = queue.filter((_, i) => queueSelected.has(i))
    setCmsImporting(true)
    setCmsResult(null)
    try {
      const result = await api.cmsImport(cmsConfig.projectId, cmsConfig.sessionToken, toImport)
      setCmsResult({ created: result.created.length, errors: result.errors })
    } catch (e) {
      setCmsResult({ created: 0, errors: [e instanceof Error ? e.message : String(e)] })
    } finally {
      setCmsImporting(false)
    }
  }

  function toggleQueueItem(i: number) {
    setQueueSelected(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const displayedProducts = csvProducts ?? result.products
  const isCsvMode = csvProducts !== null
  const filteredProducts = filter.trim()
    ? displayedProducts.filter(p => p.title.toLowerCase().includes(filter.toLowerCase()))
    : displayedProducts

  const filteredQueue = queueFilter.trim()
    ? queue.map((p, i) => ({ p, i })).filter(({ p }) => p.title.toLowerCase().includes(queueFilter.toLowerCase()))
    : queue.map((p, i) => ({ p, i }))

  const splitCandidate = selected.size === 1
    ? filteredProducts.find(p => selected.has(p.product_url)) ?? null
    : null
  const canSplit = !!splitCandidate && Object.values(splitCandidate.options).some(opts => opts.length >= 2)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const { headers, sampleRows } = parseCsvHeaders(text)
      const initialMapping = detectInitialMapping(headers, sampleRows)
      setCsvPending({ text, headers, sampleRows, initialMapping })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleColumnPickerConfirm(mapping: CsvColumnMapping) {
    if (!csvPending) return
    onLoadCsv(csvTextToProducts(csvPending.text, mapping))
    setSelected(new Set())
    setFilter('')
    setCsvPending(null)
  }

  function toggleSelect(url: string) {
    setSelected(prev => { const n = new Set(prev); n.has(url) ? n.delete(url) : n.add(url); return n })
  }

  function generateProductCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  function addToQueue(product: Product, sources: Product[] = [product]) {
    const enriched: Product = {
      ...product,
      productVersionType: 'ModelReview',
      productType: 'Production',
      productCode: product.productCode || generateProductCode(),
    }
    setQueue(prev => [...prev, enriched])
    setQueueSources(prev => [...prev, sources])
  }

  function mergeSelected() {
    const toMerge = filteredProducts.filter(p => selected.has(p.product_url))
    if (toMerge.length < 2) return
    setMergeSourceTitles(toMerge.map(p => p.title))
    setMergeSourceProducts(toMerge)
    setMergePreview(mergeProducts(toMerge))
  }

  function confirmMerge(product: Product) {
    addToQueue(product, mergeSourceProducts)
    setMergePreview(null)
    setSelected(new Set())
  }

  function handleSplitSelected() {
    if (!splitCandidate) return
    setSplitPreview(splitCandidate)
  }

  function confirmSplit(products: Product[]) {
    for (const p of products) addToQueue(p, [splitPreview!])
    setSplitPreview(null)
    setSelected(new Set())
  }

  function renameFeatureInQueue(queueIndex: number, oldName: string, newName: string) {
    setQueue(prev => prev.map((p, i) => {
      if (i !== queueIndex) return p
      const next: Record<string, string[]> = {}
      for (const [k, v] of Object.entries(p.options)) next[k === oldName ? newName : k] = v
      return { ...p, options: next }
    }))
  }

  function removeFromQueue(index: number) {
    setQueue(prev => prev.filter((_, i) => i !== index))
    setQueueSources(prev => prev.filter((_, i) => i !== index))
    setQueueSelected(prev => {
      const next = new Set<number>()
      for (const idx of prev) {
        if (idx < index) next.add(idx)
        else if (idx > index) next.add(idx - 1)
      }
      return next
    })
  }

  function highlightProduct(url: string) {
    setHighlightedUrl(url)
    document.querySelector(`[data-product-url="${CSS.escape(url)}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    setTimeout(() => setHighlightedUrl(null), 2000)
  }

  function handleAnalyzeForGrouping() {
    const products = filteredProducts.filter(p => selected.has(p.product_url))
    setPendingNames(products.map(p => p.title))
    setAnalyzeResult(null)
    setAnalyzeError(null)
    setShowAnalyzeModal(true)
    sendToAnalyze(products)
  }

  function handleGroupFromAnalysis(dimensions: AnalysisDimension[], extraInfo: string) {
    setShowAnalyzeModal(false)
    const rules: GroupingRule[] = dimensions.map(dim => ({
      id: dim.name.toLowerCase().replace(/\s+/g, '_'),
      label: dim.name,
      description: dim.description,
      promptLine: `By ${dim.name} — ${dim.description}`,
    }))
    sendToAi(rules, extraInfo)
  }

  async function sendToAnalyze(products: Product[]) {
    setAnalyzeLoading(true)

    const productList = products.map(p => {
      const parts: string[] = [`- ${p.title}`]
      const meta: string[] = []
      if (p.productCode)        meta.push(`code: ${p.productCode}`)
      if (p.productFamily)      meta.push(`family: ${p.productFamily}`)
      if (p.productType)        meta.push(`type: ${p.productType}`)
      if (p.productClass)       meta.push(`class: ${p.productClass}`)
      if (p.productVersionType) meta.push(`version: ${p.productVersionType}`)
      if (p.isArchtype)         meta.push(`archtype: ${p.isArchtype}`)
      const dims = [p.width, p.depth, p.height].filter(Boolean)
      if (dims.length)          meta.push(`dimensions: ${dims.join('×')}${p.dimensionsUnit ? ' ' + p.dimensionsUnit : ''}`)
      if (meta.length) parts.push(`  (${meta.join(', ')})`)
      return parts.join('\n')
    }).join('\n')

    const prompt =
      `You are a product organisation assistant. Below is a list of furniture products with their attributes.\n` +
      `Analyze them and identify what dimensions or attributes they could be meaningfully grouped by.\n` +
      `Consider the product name, family, type, class, version, dimensions, and any other patterns you observe.\n\n` +
      `Return ONLY a JSON object in this exact format, no other text:\n` +
      `{"dimensions":[{"name":"Dimension name","description":"What you observed","examples":["Exact product name 1","Exact product name 2"]}]}\n\n` +
      `Use exact product names from the list as examples.\n\n` +
      `Products:\n${productList}`

    try {
      const res = await api.chat(prompt, true)
      const parsed = JSON.parse(res.content) as { dimensions: AnalysisDimension[] }
      if (!Array.isArray(parsed.dimensions)) throw new Error('Unexpected response shape')
      setAnalyzeResult(parsed.dimensions)
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : String(e))
    } finally {
      setAnalyzeLoading(false)
    }
  }

  function handleGroupWithAi() {
    const names = filteredProducts
      .filter(p => selected.has(p.product_url))
      .map(p => p.title)
    setPendingNames(names)
    setShowGroupSettings(true)
  }

  async function sendToAi(rules: GroupingRule[], extraInfo = '') {
    const names = pendingNames
    setShowGroupSettings(false)
    setPendingNames([])
    setAiGroups(null)
    setAiError('')
    setAiUsage(null)
    setAiLoading(true)

    const nameList = names.map(n => `- ${n}`).join('\n')
    const ruleLines = rules.map(r => `- ${r.promptLine}`).join('\n')
    const isSingleRule = rules.length === 1
    const groupingInstruction = isSingleRule
      ? `Group them by this criterion:\n${ruleLines}\n\nEach product must appear in exactly ONE group.`
      : `Create compound groups by combining ALL criteria together:\n${ruleLines}\n\nEach product must appear in exactly ONE group. Group names must reflect all criteria (e.g. "Belle – 2-seater – Chaiselong").`

    const extraLine = extraInfo ? `\nAdditional instructions: ${extraInfo}\n` : ''

    const prompt =
      `You are a product organisation assistant. Below is a list of furniture product names.\n` +
      `${groupingInstruction}\n${extraLine}\n` +
      `Return ONLY a JSON object in this exact format, no other text:\n` +
      `{"groups":[{"name":"Group Name","products":["Exact product name 1","Exact product name 2"]}]}\n\n` +
      `Use the exact product names from the list below.\n\n` +
      `Products:\n${nameList}`

    try {
      const res = await api.chat(prompt, true)
      setAiUsage(res.usage ?? null)
      const parsed = JSON.parse(res.content) as { groups: AiGroup[] }
      if (!Array.isArray(parsed.groups)) throw new Error('Unexpected response shape')
      setAiGroups(parsed.groups)
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e))
    } finally {
      setAiLoading(false)
    }
  }

  function confirmGroups(selectedGroups: AiGroup[]) {
    for (const group of selectedGroups) {
      const matched = filteredProducts.filter(p =>
        group.products.some(name => name.trim().toLowerCase() === p.title.trim().toLowerCase())
      )
      if (matched.length === 0) continue
      const merged = matched.length === 1 ? { ...matched[0] } : mergeProducts(matched)
      merged.title = group.name
      if (Object.keys(merged.options).length === 0) {
        merged.options = { Variant: matched.map(p => p.title) }
      }
      addToQueue(merged, matched)
    }
    setAiGroups(null)
    setAiUsage(null)
  }

  async function handleFindMaterials(products: Product[]) {
    setMaterialsResult(null)
    setMaterialsError(null)
    setMaterialsLoading(true)

    // Aggregate features across all products, dedup options per feature name
    const featureMap = new Map<string, Set<string>>()
    for (const product of products) {
      for (const [name, opts] of Object.entries(product.options)) {
        if (!featureMap.has(name)) featureMap.set(name, new Set())
        for (const v of opts) {
          const key = v.trim()
          if (key) featureMap.get(name)!.add(key)
        }
      }
    }
    const features: MaterialFeature[] = Array.from(featureMap.entries())
      .map(([name, optSet]) => ({ name, options: Array.from(optSet) }))
      .filter(f => f.options.length > 0)

    if (features.length === 0) {
      setMaterialsResult({ materials: [], nonMaterials: [] })
      setMaterialsLoading(false)
      return
    }

    const featureLines = features
      .map(f => `- ${f.name}: ${f.options.join(', ')}`)
      .join('\n')

    const prompt =
      `You are a product data assistant. Classify the following ${features.length} features into exactly two groups: materials and nonMaterials.\n\n` +
      `Rules:\n` +
      `- Every feature must appear in exactly one group — never both, never omitted.\n` +
      `- A feature is MATERIALS if its options are physical/surface material names (e.g. leather, oak, fabric, velvet, wool, linen, walnut, pine, metal, brass).\n` +
      `- A feature is NON-MATERIALS if its options represent size, configuration, orientation, color codes, or dimensions.\n` +
      `- Copy feature names character-for-character from the input list. Do not paraphrase, split, merge, or invent names.\n` +
      `- The combined count of both arrays must equal ${features.length}.\n\n` +
      `Input features (${features.length} total):\n${featureLines}\n\n` +
      `Return ONLY valid JSON, no markdown, no explanation:\n` +
      `{"materials":["ExactFeatureName"],"nonMaterials":["ExactFeatureName"]}`

    try {
      const res = await api.chat(prompt, true)
      const parsed = JSON.parse(res.content) as { materials: string[]; nonMaterials: string[] }
      if (!Array.isArray(parsed.materials) || !Array.isArray(parsed.nonMaterials)) throw new Error('Unexpected response shape')
      // Map back to feature objects; deduplicate by name in case the model repeated any
      const byName = Object.fromEntries(features.map(f => [f.name, f]))
      const seen = new Set<string>()
      const dedup = (names: string[]) => names
        .filter(n => byName[n] && !seen.has(n) && seen.add(n) !== undefined)
        .map(n => byName[n])
      setMaterialsResult({
        materials: dedup(parsed.materials),
        nonMaterials: dedup(parsed.nonMaterials),
      })
    } catch (e) {
      setMaterialsError(e instanceof Error ? e.message : String(e))
    } finally {
      setMaterialsLoading(false)
    }
  }

  function handleClear() {
    onClearCsv()
    setSelected(new Set())
    setFilter('')
  }

  if (result.error) {
    return (
      <div className="px-6 py-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          Error: {result.error}
        </div>
      </div>
    )
  }

  const selectedCount = selected.size
  const matchCount = filteredProducts.length

  return (
    <>
    <div className="flex h-screen gap-3 p-3 bg-zinc-200">
      {/* Left — product list (scraped or CSV) */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white rounded-2xl shadow-md">
        <div className="flex flex-col border-b border-zinc-200 shrink-0">
          {/* Row 1: source label + csv controls + filter */}
          <div className="flex items-center gap-2 px-4 py-2.5">
            <button onClick={onBack} className="shrink-0 text-zinc-400 hover:text-zinc-700 transition-colors">
              <Home className="h-4 w-4" />
            </button>
            <div className="w-px h-3.5 bg-zinc-200 shrink-0" />
            <h2 className="text-sm font-semibold text-zinc-900 shrink-0">
              Raw Data
            </h2>
            <Badge variant="secondary" className="shrink-0">
              {filter.trim() ? `${matchCount} / ${displayedProducts.length}` : displayedProducts.length}
            </Badge>

            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter by name…"
              className="flex-1 h-7 px-2.5 rounded-md border border-zinc-200 bg-zinc-50 text-xs outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-colors placeholder:text-zinc-400"
            />

            <label className="flex items-center gap-1.5 shrink-0 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={collapseFeatures}
                onChange={e => setCollapseFeatures(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-zinc-300 accent-zinc-900 cursor-pointer"
              />
              <span className="text-xs text-zinc-400">Collapse features</span>
            </label>

            <div className="flex items-center gap-1 shrink-0">
              {isCsvMode && (
                <Button size="sm" variant="ghost" className="h-7 text-xs text-zinc-400 hover:text-zinc-700 px-2 gap-1" onClick={handleClear}>
                  <X className="h-3 w-3" />
                  Clear
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs px-2.5" onClick={() => fileRef.current?.click()}>
                <Upload className="h-3 w-3" />
                {isCsvMode ? 'Load another' : 'Load CSV'}
              </Button>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            </div>
          </div>

          {/* Row 2: selection actions — always visible, disabled when no/insufficient selection */}
          <div className="flex items-center gap-2 px-4 py-2 border-t border-zinc-100 bg-zinc-50">
            <span className={`text-xs font-semibold shrink-0 whitespace-nowrap ${selectedCount > 0 ? 'text-zinc-700' : 'text-zinc-400'}`}>
              {selectedCount > 0 ? `${selectedCount} selected` : 'None selected'}
            </span>

            <div className="w-px h-3.5 bg-zinc-200 shrink-0" />

            <button
              className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors shrink-0"
              onClick={() => {
                const allSelected = selectedCount > 0 && filteredProducts.every(p => selected.has(p.product_url))
                setSelected(allSelected ? new Set() : new Set(filteredProducts.map(p => p.product_url)))
              }}
            >
              {selectedCount > 0 && filteredProducts.every(p => selected.has(p.product_url)) ? 'Deselect all' : 'Select all'}
            </button>

            {selectedCount >= 2 && (
              <>
                <div className="w-px h-3.5 bg-zinc-200 shrink-0" />
                <button
                  className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors shrink-0"
                  onClick={() => {
                    const arr = [...selected]
                    const shuffled = arr.sort(() => Math.random() - 0.5)
                    setSelected(new Set(shuffled.slice(0, Math.ceil(arr.length / 2))))
                  }}
                >
                  Remove half
                </button>
              </>
            )}

            <div className="flex items-center gap-1.5 ml-auto">
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs px-2.5"
                disabled={selectedCount < 2}
                onClick={handleAnalyzeForGrouping}
              >
                <Sparkles className="h-3 w-3" />
                Analyze for merging
              </Button>
              {/* <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs px-2.5"
                disabled={selectedCount === 0}
                onClick={handleGroupWithAi}
              >
                <Sparkles className="h-3 w-3" />
                Group with AI
              </Button> */}
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs px-2.5"
                disabled={!canSplit}
                onClick={handleSplitSelected}
              >
                <Scissors className="h-3 w-3" />
                Split
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs px-2.5"
                disabled={selectedCount < 2}
                onClick={mergeSelected}
              >
                <Merge className="h-3 w-3" />
                Merge
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-2 px-4 py-4">
            {filteredProducts.map((p, i) => {
              const isSelected = selected.has(p.product_url)
              return (
                <div
                  key={p.product_url}
                  data-product-url={p.product_url}
                  className={`flex items-start gap-2 px-3 py-3 rounded-xl border transition-colors cursor-pointer ${
                    highlightedUrl === p.product_url
                      ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200'
                      : isSelected ? 'bg-zinc-50 border-zinc-300' : 'bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                  }`}
                  onClick={() => toggleSelect(p.product_url)}
                >
                  <span className="shrink-0 text-[10px] text-zinc-400 w-5 text-right mt-0.5 select-none">{i + 1}</span>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(p.product_url)}
                    onClick={e => e.stopPropagation()}
                    className="shrink-0 h-4 w-4 rounded border-zinc-300 accent-zinc-900 cursor-pointer mt-0.5"
                  />
                  <ProductInfo p={p} collapseFeatures={collapseFeatures} />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100"
                    onClick={e => { e.stopPropagation(); addToQueue(p) }}
                    title="Add to import queue"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Right — import queue */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white rounded-2xl shadow-md">
        <div className="flex flex-col border-b border-zinc-200 shrink-0">
          {/* Row 1: title + filter + settings */}
          <div className="flex items-center gap-2 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-zinc-900 shrink-0">Import Queue</h2>
            <Badge variant="secondary" className="shrink-0">
              {queueFilter.trim() ? `${filteredQueue.length} / ${queue.length}` : queue.length}
            </Badge>
            <input
              type="text"
              value={queueFilter}
              onChange={e => setQueueFilter(e.target.value)}
              placeholder="Filter by name…"
              className="flex-1 h-7 px-2.5 rounded-md border border-zinc-200 bg-zinc-50 text-xs outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-colors placeholder:text-zinc-400"
            />
            <button
              onClick={() => { setShowCmsConfig(v => !v); setCmsConnectError('') }}
              title="CMS settings"
              className="shrink-0 text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              {cmsConfig.sessionToken
                ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                : <Settings className="h-4 w-4" />
              }
            </button>
          </div>

          {/* CMS config panel */}
          {showCmsConfig && (
            <div className="px-4 pb-3 border-t border-zinc-100 bg-zinc-50 flex flex-col gap-2 pt-2.5">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 mb-0.5 block">Project ID</label>
                  <input
                    type="text"
                    value={cmsConfig.projectId}
                    onChange={e => setCmsConfig(prev => ({ ...prev, projectId: e.target.value }))}
                    className="w-full h-7 px-2.5 rounded-md border border-zinc-200 bg-white text-xs outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900"
                    placeholder="123"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 mb-0.5 block">Material Project ID</label>
                  <input
                    type="text"
                    value={cmsConfig.materialProjectId}
                    onChange={e => setCmsConfig(prev => ({ ...prev, materialProjectId: e.target.value }))}
                    className="w-full h-7 px-2.5 rounded-md border border-zinc-200 bg-white text-xs outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900"
                    placeholder="uuid"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 mb-0.5 block">Customer ID</label>
                  <input
                    type="number"
                    value={cmsConfig.materialCustomerId}
                    onChange={e => setCmsConfig(prev => ({ ...prev, materialCustomerId: e.target.value }))}
                    className="w-full h-7 px-2.5 rounded-md border border-zinc-200 bg-white text-xs outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900"
                    placeholder="4508"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={cmsEmail}
                  onChange={e => setCmsEmail(e.target.value)}
                  className="flex-1 h-7 px-2.5 rounded-md border border-zinc-200 bg-white text-xs outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900"
                  placeholder="Email"
                  autoComplete="email"
                />
                <input
                  type="password"
                  value={cmsPassword}
                  onChange={e => setCmsPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCmsConnect()}
                  className="flex-1 h-7 px-2.5 rounded-md border border-zinc-200 bg-white text-xs outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900"
                  placeholder="Password"
                  autoComplete="current-password"
                />
                <Button
                  size="sm"
                  className="h-7 text-xs px-3 shrink-0"
                  disabled={cmsConnecting || !cmsEmail || !cmsPassword}
                  onClick={handleCmsConnect}
                >
                  {cmsConnecting ? 'Connecting…' : cmsConfig.sessionToken ? 'Reconnect' : 'Connect'}
                </Button>
              </div>
              {cmsConnectError && (
                <p className="text-[11px] text-red-500">{cmsConnectError}</p>
              )}
              {cmsConfig.sessionToken && !cmsConnectError && (
                <p className="text-[11px] text-emerald-600">Connected</p>
              )}
            </div>
          )}

          {/* Row 2: queue selection + import action */}
          <div className="flex items-center gap-2 px-4 py-2 border-t border-zinc-100 bg-zinc-50">
            <button
              className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors shrink-0"
              onClick={() => {
                const allSelected = queue.length > 0 && queue.every((_, i) => queueSelected.has(i))
                setQueueSelected(allSelected ? new Set() : new Set(queue.map((_, i) => i)))
              }}
              disabled={queue.length === 0}
            >
              {queue.length > 0 && queue.every((_, i) => queueSelected.has(i)) ? 'Deselect all' : 'Select all'}
            </button>
            {queueSelected.size > 0 && (
              <span className="text-xs text-zinc-500 shrink-0">{queueSelected.size} selected</span>
            )}
            <div className="flex items-center gap-2 ml-auto shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs px-2.5"
                disabled={queueSelected.size === 0}
                onClick={() => handleFindMaterials(queue.filter((_, i) => queueSelected.has(i)))}
              >
                <FlaskConical className="h-3 w-3" />
                Find Materials
              </Button>
              {cmsResult && (
                <span className={`text-xs shrink-0 ${cmsResult.errors.length > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                  {cmsResult.created > 0 && `✓ ${cmsResult.created} created`}
                  {cmsResult.errors.length > 0 && ` ${cmsResult.errors[0].slice(0, 40)}`}
                </span>
              )}
              <Button
                size="sm"
                className="h-7 gap-1.5 text-xs px-2.5"
                disabled={!cmsConfig.sessionToken || !cmsConfig.projectId || queue.length === 0 || cmsImporting}
                onClick={handleCmsImport}
                title={!cmsConfig.sessionToken ? 'Connect to CMS first' : !cmsConfig.projectId ? 'Set a Project ID first' : ''}
              >
                <CloudUpload className="h-3 w-3" />
                {cmsImporting ? 'Importing…' : 'Import to CMS'}
              </Button>
              {cmsConfig.projectId && (
                <a
                  href={`https://cms.cylin.dev/project?id=${encodeURIComponent(cmsConfig.projectId)}&tab=production&code=`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open project in CMS"
                >
                  <Button size="sm" variant="outline" className="h-7 px-2">
                    <SquareArrowOutUpRight className="h-3 w-3" />
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {queue.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-400">No products yet</p>
                <p className="text-xs text-zinc-300 mt-1">Use → to add or select multiple and merge</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 px-4 py-4">
              {filteredQueue.map(({ p, i }) => {
                const sources = queueSources[i] ?? []
                const showSources = sources.length > 1 || (sources.length === 1 && sources[0].title !== p.title)
                return (
                  <div key={i} className={`rounded-xl border transition-all overflow-hidden ${queueSelected.has(i) ? 'bg-zinc-50 border-zinc-300 shadow-sm' : 'bg-white border-zinc-200 hover:border-zinc-300 hover:shadow-sm'}`}>
                    <div className="flex items-start gap-2 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={queueSelected.has(i)}
                        onChange={() => toggleQueueItem(i)}
                        onClick={e => e.stopPropagation()}
                        className="shrink-0 h-4 w-4 rounded border-zinc-300 accent-zinc-900 cursor-pointer mt-0.5"
                      />
                      <ProductInfo p={p} collapseFeatures={collapseFeatures} showAllFields onRenameFeature={(old, next) => renameFeatureInQueue(i, old, next)} />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="shrink-0 text-zinc-300 hover:text-red-500 hover:bg-red-50"
                        onClick={() => removeFromQueue(i)}
                        title="Remove from queue"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {showSources && (
                      <div className="flex flex-wrap gap-1.5 px-3 pb-3 border-t border-zinc-100 pt-2">
                        <span className="text-[10px] text-zinc-300 self-center mr-0.5">from</span>
                        {sources.map((s, j) => (
                          <button
                            key={j}
                            onClick={() => highlightProduct(s.product_url)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-50 border border-zinc-200 hover:border-amber-300 hover:bg-amber-50 transition-colors group"
                          >
                            {s.image_url && (
                              <img src={s.image_url} alt="" className="h-3.5 w-3.5 rounded-full object-cover shrink-0" />
                            )}
                            <span className="text-[10px] text-zinc-500 group-hover:text-amber-700 max-w-[120px] truncate">{s.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>

    {csvPending && (
      <CsvColumnPickerModal
        headers={csvPending.headers}
        sampleRows={csvPending.sampleRows}
        initialMapping={csvPending.initialMapping}
        onConfirm={handleColumnPickerConfirm}
        onCancel={() => setCsvPending(null)}
      />
    )}
    {mergePreview && (
      <MergePreviewModal
        product={mergePreview}
        sourceTitles={mergeSourceTitles}
        onConfirm={confirmMerge}
        onCancel={() => setMergePreview(null)}
      />
    )}
    {splitPreview && (
      <SplitPreviewModal
        product={splitPreview}
        onConfirm={confirmSplit}
        onCancel={() => setSplitPreview(null)}
      />
    )}
    {showGroupSettings && (
      <AiGroupSettingsModal
        productCount={pendingNames.length}
        baseTokenEstimate={Math.ceil(pendingNames.join('\n').length / 4)}
        onConfirm={sendToAi}
        onCancel={() => { setShowGroupSettings(false); setPendingNames([]) }}
      />
    )}
    {aiLoading && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl shadow-xl px-8 py-6 flex items-center gap-3 text-sm text-zinc-600">
          <svg className="animate-spin h-4 w-4 text-zinc-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Grouping products…
        </div>
      </div>
    )}
    {aiError && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setAiError('')}>
        <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm mx-4">
          <p className="text-sm font-semibold text-red-600 mb-1">Error</p>
          <p className="text-sm text-zinc-600">{aiError}</p>
          <button className="mt-4 text-xs text-zinc-400 hover:text-zinc-700" onClick={() => setAiError('')}>Dismiss</button>
        </div>
      </div>
    )}
    {aiGroups && (
      <AiGroupPreviewModal
        groups={aiGroups}
        usage={aiUsage}
        onConfirm={confirmGroups}
        onClose={() => { setAiGroups(null); setAiUsage(null) }}
      />
    )}
    {showAnalyzeModal && (
      <AiAnalyzeModal
        loading={analyzeLoading}
        error={analyzeError}
        dimensions={analyzeResult}
        onClose={() => setShowAnalyzeModal(false)}
        onGroupWithSelected={handleGroupFromAnalysis}
      />
    )}
    {(materialsLoading || materialsResult || materialsError) && (
      <FindMaterialsModal
        title={`Import Queue — ${queue.length} product${queue.length !== 1 ? 's' : ''}`}
        loading={materialsLoading}
        error={materialsError}
        materials={materialsResult?.materials ?? null}
        nonMaterials={materialsResult?.nonMaterials ?? null}
        canCreate={!!cmsConfig.sessionToken && !!cmsConfig.materialProjectId && !!cmsConfig.materialCustomerId}
        onCreateMaterials={(mats, familyName) => api.cmsMaterials(cmsConfig.materialProjectId, parseInt(cmsConfig.materialCustomerId), cmsConfig.sessionToken, familyName, mats)}
        onClose={() => { setMaterialsResult(null); setMaterialsError(null) }}
      />
    )}
    </>
  )
}
