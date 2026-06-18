import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import type { ScrapeResult } from '@/api'

interface ScrapeViewProps {
  result: ScrapeResult
}

export function ScrapeView({ result }: ScrapeViewProps) {
  if (result.error) {
    return (
      <div className="px-6 py-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          Error: {result.error}
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-6 flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{result.title}</CardTitle>
          <p className="text-xs text-zinc-400">{result.url}</p>
        </CardHeader>
      </Card>

      <Tabs defaultValue="text">
        <TabsList>
          <TabsTrigger value="text">Text</TabsTrigger>
          <TabsTrigger value="links">Links ({result.links.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="text">
          <textarea
            readOnly
            value={result.text}
            rows={20}
            className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm font-mono text-zinc-700 outline-none resize-none"
          />
        </TabsContent>
        <TabsContent value="links">
          <Card>
            <CardContent className="pt-4 flex flex-col gap-1">
              {result.links.map((link) => (
                <a
                  key={link}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-500 hover:underline break-all"
                >
                  {link}
                </a>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
