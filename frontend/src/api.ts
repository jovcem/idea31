export interface CollectionCard {
  name: string
  url: string
  image_url: string
}

export interface Product {
  title: string
  price: string
  image_url: string
  product_url: string
  options: Record<string, string[]>
  // domain-specific CSV fields
  productCode?: string
  width?: string
  depth?: string
  height?: string
  dimensionsUnit?: string
  productFamily?: string
  productType?: string
  productVersionType?: string
  isArchtype?: string
  productClass?: string
}

export interface ProductsResult {
  url: string
  collection_title: string
  products: Product[]
  error: string
}

export interface ScrapeResult {
  url: string
  title: string
  text: string
  links: string[]
  error: string
}

export type ViewMode =
  | { type: 'home' }
  | { type: 'products'; result: ProductsResult; url: string }
  | { type: 'scrape'; result: ScrapeResult }

async function request<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? res.statusText)
  }
  return res.json()
}

export const api = {
  home: (url?: string) => request<CollectionCard[]>(url ? `/api/home?url=${encodeURIComponent(url)}` : '/api/home'),
  scrape: (url: string) => request<ScrapeResult>(`/api/scrape?url=${encodeURIComponent(url)}`),
  collections: (url: string) => request<ProductsResult>(`/api/collections?url=${encodeURIComponent(url)}`),
  csvUrl: (url: string) => `/api/collections/csv?url=${encodeURIComponent(url)}`,
  detailsCsvUrl: (url: string) => `/api/collections/details-csv?url=${encodeURIComponent(url)}`,
  chat: async (prompt: string, jsonMode = false) => {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], json_mode: jsonMode }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.detail ?? r.statusText)
    return data as { content: string; usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }
  },
  cmsAuth: async (email: string, password: string): Promise<{ sessionToken: string }> => {
    const r = await fetch('/api/cms/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.detail ?? r.statusText)
    return { sessionToken: data.session_token }
  },
  cmsImport: async (
    projectId: string,
    sessionToken: string,
    products: Product[],
  ): Promise<{ created: { id: string }[]; errors: string[] }> => {
    const r = await fetch('/api/cms/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, session_token: sessionToken, products }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.detail ?? r.statusText)
    return data as { created: { id: string }[]; errors: string[] }
  },
  cmsMaterials: async (
    projectId: string,
    customerId: number,
    sessionToken: string,
    familyName: string,
    materials: string[],
  ): Promise<{ created: number; errors: string[] }> => {
    const r = await fetch('/api/cms/materials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, customer_id: customerId, session_token: sessionToken, family_name: familyName, materials }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.detail ?? r.statusText)
    return data as { created: number; errors: string[] }
  },
}
