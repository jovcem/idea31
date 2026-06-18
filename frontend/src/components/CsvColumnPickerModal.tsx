import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export interface CsvColumnMapping {
  titleColumn: string
  productCodeColumn: string | null
  productUrlColumn: string | null
  widthColumn: string | null
  depthColumn: string | null
  heightColumn: string | null
  dimensionsUnitColumn: string | null
  productFamilyColumn: string | null
  productTypeColumn: string | null
  productVersionTypeColumn: string | null
  isArchtypeColumn: string | null
  productClassColumn: string | null
  // fieldKey → JSON property to extract from that column's value
  jsonProperties: Record<string, string>
}

interface FieldDef {
  key: keyof Omit<CsvColumnMapping, 'jsonProperties'>
  label: string
  required: boolean
  description: string
}

const FIELDS: FieldDef[] = [
  { key: 'titleColumn',             label: 'Product Name',         required: true,  description: 'Name displayed in the grid' },
  { key: 'productCodeColumn',       label: 'Product Code',         required: false, description: 'Unique product code or SKU' },
  { key: 'productUrlColumn',        label: 'Product Page URL',     required: false, description: 'Link to the product page' },
  { key: 'widthColumn',             label: 'Width',                required: false, description: 'Width dimension' },
  { key: 'depthColumn',             label: 'Depth',                required: false, description: 'Depth dimension' },
  { key: 'heightColumn',            label: 'Height',               required: false, description: 'Height dimension' },
  { key: 'dimensionsUnitColumn',    label: 'Dimensions Unit',      required: false, description: 'Unit for W/D/H (e.g. cm, mm)' },
  { key: 'productFamilyColumn',     label: 'Product Family',       required: false, description: 'Product family or range' },
  { key: 'productTypeColumn',       label: 'Product Type',         required: false, description: 'Product type category' },
  { key: 'productVersionTypeColumn',label: 'Product Version Type', required: false, description: 'Version or variant type' },
  { key: 'isArchtypeColumn',        label: 'Is Archtype',          required: false, description: 'Whether this is an archetype product' },
  { key: 'productClassColumn',      label: 'Product Class',        required: false, description: 'Product class or tier' },
]

// ── JSON helpers ─────────────────────────────────────────────────────────────

export function parseJsonValue(raw: string): unknown {
  if (!raw) return null
  try { return JSON.parse(raw) } catch { /* fall through */ }
  // handle multiple bare objects: {...},{...}
  try { return JSON.parse('[' + raw + ']') } catch { /* fall through */ }
  return null
}

export function extractJsonProp(raw: string, prop: string): string {
  const parsed = parseJsonValue(raw)
  if (!parsed) return raw
  const items: unknown[] = Array.isArray(parsed) ? parsed : [parsed]
  const vals = items
    .map(item => (item && typeof item === 'object' ? (item as Record<string, unknown>)[prop] : undefined))
    .filter(v => v !== undefined && v !== null)
    .map(String)
  return vals.join(', ') || raw
}

function getJsonKeys(col: string | null, sampleRows: Record<string, string>[]): string[] {
  if (!col) return []
  const keys = new Set<string>()
  for (const row of sampleRows) {
    const parsed = parseJsonValue(row[col] ?? '')
    if (!parsed) continue
    const items: unknown[] = Array.isArray(parsed) ? parsed : [parsed]
    for (const item of items) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        Object.keys(item as object).forEach(k => keys.add(k))
      }
    }
  }
  return [...keys]
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ColumnSelect({
  headers, value, required, onChange,
}: {
  headers: string[]
  value: string | null
  required: boolean
  onChange: (v: string | null) => void
}) {
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value === '' ? null : e.target.value)}
      className="h-7 w-full px-2 pr-6 rounded-md border border-zinc-200 bg-white text-xs text-zinc-800 outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-colors appearance-none cursor-pointer"
    >
      {!required && <option value="">(none)</option>}
      {headers.map(h => (
        <option key={h} value={h}>{h}</option>
      ))}
    </select>
  )
}

function JsonPropSelect({
  jsonKeys, value, onChange,
}: {
  jsonKeys: string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <span className="text-[10px] text-zinc-300 shrink-0">↳ JSON key</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-5 flex-1 px-1.5 pr-4 rounded border border-zinc-200 bg-zinc-50 text-[10px] text-zinc-500 outline-none focus:ring-1 focus:ring-zinc-900 appearance-none cursor-pointer"
      >
        <option value="">(raw value)</option>
        {jsonKeys.map(k => <option key={k} value={k}>{k}</option>)}
      </select>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface CsvColumnPickerModalProps {
  headers: string[]
  sampleRows: Record<string, string>[]
  initialMapping: CsvColumnMapping
  onConfirm: (mapping: CsvColumnMapping) => void
  onCancel: () => void
}

export function CsvColumnPickerModal({
  headers, sampleRows, initialMapping, onConfirm, onCancel,
}: CsvColumnPickerModalProps) {
  const [mapping, setMapping] = useState<CsvColumnMapping>(initialMapping)

  function setCol(key: keyof Omit<CsvColumnMapping, 'jsonProperties'>, value: string | null) {
    // clear any json property when switching columns
    setMapping(prev => {
      const jp = { ...prev.jsonProperties }
      delete jp[key as string]
      return { ...prev, [key]: value, jsonProperties: jp }
    })
  }

  function setJsonProp(fieldKey: string, prop: string) {
    setMapping(prev => {
      const jp = { ...prev.jsonProperties }
      if (prop) jp[fieldKey] = prop
      else delete jp[fieldKey]
      return { ...prev, jsonProperties: jp }
    })
  }

  function samplesFor(col: string | null, jsonProp?: string): string[] {
    if (!col) return []
    return sampleRows
      .map(r => {
        const raw = r[col]
        if (!raw?.trim()) return ''
        return jsonProp ? extractJsonProp(raw, jsonProp) : raw
      })
      .filter(v => v.trim())
      .slice(0, 3)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Map CSV Columns</DialogTitle>
          <p className="text-xs text-zinc-400">
            Assign which column maps to each product field. If a column contains JSON, pick which property to extract.
          </p>
        </DialogHeader>

        {sampleRows.length > 0 && (
          <div className="px-6 pb-2 flex-shrink-0">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-1.5">
              CSV Preview — first {Math.min(sampleRows.length, 3)} rows
            </p>
            <div className="overflow-x-auto rounded-md border border-zinc-100 bg-zinc-50">
              <table className="text-[11px] text-zinc-600 w-max min-w-full">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-100">
                    {headers.map(h => (
                      <th key={h} className="px-2.5 py-1.5 text-left font-semibold text-zinc-500 whitespace-nowrap max-w-[160px] truncate">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sampleRows.slice(0, 3).map((row, i) => (
                    <tr key={i} className="border-b border-zinc-100 last:border-0">
                      {headers.map(h => (
                        <td key={h} className="px-2.5 py-1.5 whitespace-nowrap max-w-[160px] truncate text-zinc-500" title={row[h] ?? ''}>
                          {row[h] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left pb-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-widest w-28">Field</th>
                <th className="text-left pb-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-widest w-44">Column</th>
                <th className="text-left pb-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-widest pl-4">Sample values</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {FIELDS.map(field => {
                const col = mapping[field.key] as string | null
                const jsonKeys = getJsonKeys(col, sampleRows)
                const jsonProp = mapping.jsonProperties[field.key as string] ?? ''
                const samples = samplesFor(col, jsonProp || undefined)
                return (
                  <tr key={field.key} className="group">
                    <td className="py-3 pr-3 align-top">
                      <span className="text-xs font-semibold text-zinc-700">{field.label}</span>
                      {field.required && <span className="text-red-400 ml-0.5 text-xs">*</span>}
                      <p className="text-[10px] text-zinc-400 mt-0.5 leading-tight">{field.description}</p>
                    </td>
                    <td className="py-3 pr-4 align-top">
                      <ColumnSelect
                        headers={headers}
                        value={col}
                        required={field.required}
                        onChange={v => setCol(field.key, v)}
                      />
                      {jsonKeys.length > 0 && (
                        <JsonPropSelect
                          jsonKeys={jsonKeys}
                          value={jsonProp}
                          onChange={v => setJsonProp(field.key as string, v)}
                        />
                      )}
                    </td>
                    <td className="py-3 pl-4 align-top">
                      {samples.length > 0
                        ? <div className="flex flex-col gap-0.5">
                            {samples.map((s, i) => (
                              <span key={i} className="text-[11px] text-zinc-400 truncate max-w-[180px] block">{s}</span>
                            ))}
                          </div>
                        : <span className="text-[11px] text-zinc-300 italic">—</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button
            onClick={() => onConfirm(mapping)}
            disabled={!mapping.titleColumn}
          >
            Load CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
