"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { trpc } from "@/lib/trpc-client"
import {
  Bot, Send, Lightbulb, TrendingUp, AlertCircle, CheckCircle,
  Loader2, ScanLine, Upload, X, ArrowRight, Info, RefreshCw,
  AlertTriangle, Sparkles, ChevronDown, Zap, Brain, Eye,
} from "lucide-react"
import Link from "next/link"

const BRAND = "#50B0E0"

const EXAMPLE_QUERIES = [
  "Which customers owe us money?",
  "Show me overdue invoices",
  "What are our top expense categories?",
  "What was our revenue last month?",
  "Show outstanding bills by vendor",
  "Find duplicate transactions",
  "What's our cash flow this quarter?",
  "Show me our net profit for this year",
]

type Tab = "chat" | "scanner" | "insights"

// ── Model picker ──────────────────────────────────────────────────────────────

type ModelTier = "FAST" | "SMART" | "VISION" | "REASONING"

const TIER_META: Record<ModelTier, { label: string; icon: React.ReactNode; color: string; hint: string }> = {
  FAST:      { label: "Fast",      icon: <Zap className="h-3.5 w-3.5" />,   color: "#F59E0B", hint: "Low latency, low cost" },
  SMART:     { label: "Smart",     icon: <Brain className="h-3.5 w-3.5" />, color: BRAND,     hint: "Best accuracy" },
  VISION:    { label: "Vision",    icon: <Eye className="h-3.5 w-3.5" />,   color: "#8B5CF6", hint: "Image understanding" },
  REASONING: { label: "Reasoning", icon: <Sparkles className="h-3.5 w-3.5" />, color: "#10B981", hint: "Deep analysis" },
}

function ModelBadge({ modelId, tier }: { modelId?: string; tier?: ModelTier }) {
  if (!modelId && !tier) return null
  const meta = tier ? TIER_META[tier] : null
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-100 text-gray-500 border border-gray-200">
      {meta && <span style={{ color: meta.color }}>{meta.icon}</span>}
      {modelId ?? tier}
    </span>
  )
}

function ModelPicker({
  orgId,
  selectedTier,
  onSelectTier,
  resolvedModel,
}: {
  orgId: string
  selectedTier: ModelTier
  onSelectTier: (tier: ModelTier) => void
  resolvedModel?: string
}) {
  const [open, setOpen] = useState(false)
  const { data: modelData } = trpc.ai.getModels.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId, staleTime: 60 * 60 * 1000 }
  )

  const snapshot = modelData as any
  const tiers = snapshot?.tiers as Record<ModelTier, { modelId: string; displayName: string; description: string }> | undefined
  const resolvedId = tiers?.[selectedTier]?.modelId ?? resolvedModel

  const source: "live" | "fallback" = snapshot?.source ?? "fallback"

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 text-xs font-medium text-gray-700 bg-white transition-colors"
      >
        <span style={{ color: TIER_META[selectedTier].color }}>{TIER_META[selectedTier].icon}</span>
        {TIER_META[selectedTier].label}
        {resolvedId && <span className="font-mono text-gray-400 text-[10px]">({resolvedId})</span>}
        <ChevronDown className="h-3 w-3 text-gray-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-xl shadow-lg border border-gray-100 z-50 py-1">
            <div className="px-3 py-2 border-b border-gray-50 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600">Model Tier</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${source === "live" ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                {source === "live" ? "● Live from OpenAI" : "○ Cached defaults"}
              </span>
            </div>
            {(["FAST", "SMART", "VISION", "REASONING"] as ModelTier[]).map(tier => {
              const meta = TIER_META[tier]
              const modelId = tiers?.[tier]?.modelId
              const desc   = tiers?.[tier]?.description ?? meta.hint
              return (
                <button
                  key={tier}
                  onClick={() => { onSelectTier(tier); setOpen(false) }}
                  className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors ${selectedTier === tier ? "bg-gray-50" : ""}`}
                >
                  <span className="mt-0.5 flex-shrink-0" style={{ color: meta.color }}>{meta.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{meta.label}</span>
                      {selectedTier === tier && <span className="text-[10px] px-1 py-0.5 rounded bg-blue-50 text-blue-600">active</span>}
                    </div>
                    {modelId && <span className="block text-[10px] font-mono text-gray-400">{modelId}</span>}
                    <span className="block text-xs text-gray-500 mt-0.5">{desc}</span>
                  </div>
                </button>
              )
            })}
            {snapshot?.allModels?.length > 0 && (
              <div className="border-t border-gray-50 px-3 py-2">
                <p className="text-[10px] text-gray-400">
                  {snapshot.allModels.length} models available · refreshed {new Date(snapshot.resolvedAt).toLocaleTimeString()}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Chat Message ──────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  suggestions?: string[]
  data?: any
  intent?: string
}

function DataTable({ data, intent }: { data: any; intent?: string }) {
  if (!data || typeof data !== "object") return null

  if (intent === "OVERDUE_INVOICES" && data.invoices?.length > 0) {
    return (
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs border-t">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left px-2 py-1.5">Invoice</th>
              <th className="text-left px-2 py-1.5">Customer</th>
              <th className="text-right px-2 py-1.5">Total</th>
              <th className="text-right px-2 py-1.5">Days overdue</th>
            </tr>
          </thead>
          <tbody>
            {data.invoices.slice(0, 8).map((inv: any, i: number) => (
              <tr key={i} className="border-t">
                <td className="px-2 py-1.5 font-mono">{inv.invoiceNumber}</td>
                <td className="px-2 py-1.5">{inv.customer}</td>
                <td className="px-2 py-1.5 text-right">£{Number(inv.total).toLocaleString()}</td>
                <td className="px-2 py-1.5 text-right text-red-500">{inv.daysOverdue}d</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if ((intent === "TOP_EXPENSES" || intent === "REVENUE_SUMMARY") && (data.accounts?.length > 0)) {
    return (
      <div className="mt-3 space-y-1.5">
        {data.accounts.slice(0, 6).map((acc: any, i: number) => (
          <div key={i} className="flex justify-between text-xs">
            <span className="text-gray-600">{acc.name}</span>
            <span className="font-medium">£{Number(acc.total).toLocaleString()}</span>
          </div>
        ))}
      </div>
    )
  }

  if ((intent === "OUTSTANDING_RECEIVABLES" || intent === "OUTSTANDING_PAYABLES") && (data.customers || data.vendors)) {
    const rows = data.customers ?? data.vendors ?? []
    const key = data.customers ? "customer" : "vendor"
    return (
      <div className="mt-3 space-y-1.5">
        {rows.slice(0, 6).map((row: any, i: number) => (
          <div key={i} className="flex justify-between text-xs">
            <span className="text-gray-600">{row[key]}</span>
            <span className="font-medium">£{Number(row.total).toLocaleString()}</span>
          </div>
        ))}
      </div>
    )
  }

  return null
}

function ChatTab({ orgId, tier, resolvedModel }: { orgId: string; tier: ModelTier; resolvedModel?: string }) {
  const [query, setQuery] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const endRef = useRef<HTMLDivElement>(null)

  const { data: modelData } = trpc.ai.getModels.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId, staleTime: 60 * 60 * 1000 }
  )
  const tiers = (modelData as any)?.tiers
  const smartModel = tiers?.[tier]?.modelId ?? tiers?.SMART?.modelId

  const processQuery = trpc.ai.processQuery.useMutation({
    onSuccess: (result) => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: result.answer,
        suggestions: result.suggestions,
        data: result.data,
        intent: result.intent,
        modelUsed: (result as any).modelUsed ?? smartModel,
      }])
    },
    onError: (err) => {
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${err.message}` }])
    },
  })

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, processQuery.isPending])

  const handleQuery = () => {
    const q = query.trim()
    if (!q || !orgId) return
    setQuery("")
    setMessages(prev => [...prev, { role: "user", content: q }])
    processQuery.mutate({
      organizationId: orgId,
      query: q,
      modelOverrides: smartModel ? { smart: smartModel } : undefined,
    })
  }

  return (
    <Card className="h-[620px] flex flex-col rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bot className="h-4 w-4" style={{ color: BRAND }} />
          Ask about your finances
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden pt-0">
        <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1">
          {messages.length === 0 ? (
            <div className="text-center text-gray-400 py-10">
              <Bot className="mx-auto h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Ask about overdue invoices, top expenses, cash flow…</p>
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {EXAMPLE_QUERIES.slice(0, 4).map((ex, i) => (
                  <button key={i} onClick={() => setQuery(ex)}
                    className="text-xs px-3 py-1.5 rounded-full border border-gray-200 hover:border-[#50B0E0] hover:text-[#50B0E0] transition-colors">
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          ) : messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] p-3 rounded-xl text-sm ${
                msg.role === "user"
                  ? "text-white"
                  : "bg-gray-50 border border-gray-100 text-gray-800"
              }`} style={msg.role === "user" ? { backgroundColor: BRAND } : {}}>
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                {msg.role === "assistant" && msg.data && (
                  <DataTable data={msg.data} intent={msg.intent} />
                )}
                {msg.role === "assistant" && (msg as any).modelUsed && (
                  <div className="mt-2">
                    <ModelBadge modelId={(msg as any).modelUsed} />
                  </div>
                )}
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {msg.suggestions.map((s, j) => (
                      <button key={j} onClick={() => setQuery(s)}
                        className="text-xs px-2 py-1 rounded-full border border-gray-200 hover:bg-gray-100 transition-colors text-gray-600">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {processQuery.isPending && (
            <div className="flex justify-start">
              <div className="bg-gray-50 border border-gray-100 p-3 rounded-xl flex items-center gap-2 text-xs text-gray-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Querying your data…
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="e.g. Which customers owe us money?"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleQuery() } }}
            disabled={processQuery.isPending || !orgId}
            className="rounded-xl"
          />
          <Button onClick={handleQuery} disabled={processQuery.isPending || !query.trim() || !orgId}
            className="rounded-xl" style={{ backgroundColor: BRAND }}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Receipt Scanner ───────────────────────────────────────────────────────────

function ScannerTab({ orgId, tier }: { orgId: string; tier: ModelTier }) {
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [mimeType, setMimeType] = useState<"image/jpeg" | "image/png" | "image/webp">("image/jpeg")
  const [scanned, setScanned] = useState<any>(null)
  const [vendorId, setVendorId] = useState("")
  const [accountId, setAccountId] = useState("")
  const [created, setCreated] = useState<{ billId: string; billNumber: string } | null>(null)

  const { data: vendorsData } = trpc.vendors.getAll.useQuery(
    { organizationId: orgId, page: 1, limit: 100 },
    { enabled: !!orgId }
  )
  const { data: coaData } = trpc.chartOfAccounts.getAll.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  )

  const { data: modelData } = trpc.ai.getModels.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId, staleTime: 60 * 60 * 1000 }
  )
  const tiers = (modelData as any)?.tiers
  const visionModel = tiers?.["VISION"]?.modelId
  const fastModel   = tiers?.["FAST"]?.modelId

  const scanMutation = trpc.ai.scanReceipt.useMutation({
    onSuccess: (data) => {
      setScanned(data)
      if (data.suggestedAccount?.id) setAccountId(data.suggestedAccount.id)
    },
  })

  const createBillMutation = trpc.ai.createBillFromScan.useMutation({
    onSuccess: (data) => setCreated(data),
  })

  const handleFile = useCallback((file: File) => {
    const mime = file.type as any
    setMimeType(["image/jpeg", "image/png", "image/webp"].includes(mime) ? mime : "image/jpeg")
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setImagePreview(dataUrl)
      const base64 = dataUrl.split(",")[1]
      setImageBase64(base64)
    }
    reader.readAsDataURL(file)
  }, [])

  const vendors = (vendorsData as any)?.vendors ?? []
  const expenseAccounts = ((coaData as any)?.accounts ?? []).filter((a: any) => a.type === "EXPENSE")

  const handleCreate = () => {
    if (!scanned || !vendorId || !accountId || !orgId) return
    const today = new Date().toISOString().split("T")[0]
    const due30 = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]
    createBillMutation.mutate({
      organizationId: orgId,
      vendorId,
      invoiceReference: scanned.invoiceReference,
      date: scanned.date ?? today,
      dueDate: scanned.dueDate ?? due30,
      currency: scanned.currency ?? "GBP",
      notes: scanned.notes,
      items: (scanned.items?.length > 0 ? scanned.items : [{
        description: scanned.vendorName ? `Receipt: ${scanned.vendorName}` : "Receipt",
        quantity: 1,
        unitPrice: scanned.subtotal ?? scanned.total ?? 0,
        taxRate: scanned.taxRate ?? 0,
      }]).map((item: any) => ({ ...item, accountId })),
    })
  }

  if (created) {
    return (
      <Card className="rounded-xl">
        <CardContent className="pt-8 pb-8 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <p className="font-semibold text-gray-800">Bill created: {created.billNumber}</p>
          <div className="mt-4 flex justify-center gap-3">
            <Link href={`/expenses`}>
              <Button variant="outline" className="rounded-xl text-sm">View Bills</Button>
            </Link>
            <Button className="rounded-xl text-sm" style={{ backgroundColor: BRAND }}
              onClick={() => { setCreated(null); setScanned(null); setImageBase64(null); setImagePreview(null) }}>
              Scan another
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      {/* Upload */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Upload className="h-4 w-4" style={{ color: BRAND }} />
            Upload Receipt / Invoice
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label
            className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl h-48 cursor-pointer hover:border-[#50B0E0] transition-colors"
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          >
            {imagePreview ? (
              <img src={imagePreview} alt="preview" className="max-h-44 max-w-full object-contain rounded-lg" />
            ) : (
              <div className="text-center text-gray-400">
                <Upload className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Drag & drop or click to upload</p>
                <p className="text-xs mt-1">JPEG, PNG, WebP</p>
              </div>
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </label>

          {imageBase64 && !scanned && (
            <Button className="w-full rounded-xl gap-2" style={{ backgroundColor: BRAND }}
              disabled={scanMutation.isPending}
              onClick={() => scanMutation.mutate({
              organizationId: orgId,
              imageBase64,
              mimeType,
              modelOverrides: { vision: visionModel, fast: fastModel },
            })}>
              {scanMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Scanning…</> : <><ScanLine className="h-4 w-4" /> Scan Receipt</>}
            </Button>
          )}

          {imageBase64 && scanned && (
            <button onClick={() => { setScanned(null); setImageBase64(null); setImagePreview(null) }}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <X className="h-3 w-3" /> Clear and scan again
            </button>
          )}
        </CardContent>
      </Card>

      {/* Extracted data + create bill */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color: BRAND }} />
            Extracted Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!scanned ? (
            <div className="text-center text-gray-400 py-10">
              <ScanLine className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Upload an image to extract bill details</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ["Vendor", scanned.vendorName],
                  ["Reference", scanned.invoiceReference],
                  ["Date", scanned.date],
                  ["Due date", scanned.dueDate],
                  ["Subtotal", scanned.subtotal != null ? `£${Number(scanned.subtotal).toLocaleString()}` : null],
                  ["Tax", scanned.taxAmount != null ? `£${Number(scanned.taxAmount).toLocaleString()}` : null],
                  ["Total", scanned.total != null ? `£${Number(scanned.total).toLocaleString()}` : null],
                ].filter(([, v]) => v != null).map(([k, v]) => (
                  <div key={k as string}>
                    <span className="text-xs text-gray-400">{k}</span>
                    <p className="font-medium">{v}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2 pt-1 border-t">
                <div>
                  <Label className="text-xs">Vendor *</Label>
                  <select className="w-full border rounded-xl h-9 text-sm px-3 mt-1 bg-white"
                    value={vendorId} onChange={e => setVendorId(e.target.value)}>
                    <option value="">Select vendor</option>
                    {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Expense account *
                    {scanned.suggestedAccount && (
                      <span className="ml-1 text-[#50B0E0]">(AI suggested: {scanned.suggestedAccount.name})</span>
                    )}
                  </Label>
                  <select className="w-full border rounded-xl h-9 text-sm px-3 mt-1 bg-white"
                    value={accountId} onChange={e => setAccountId(e.target.value)}>
                    <option value="">Select account</option>
                    {expenseAccounts.map((a: any) => (
                      <option key={a.id} value={a.id}>[{a.code}] {a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-400">Confidence:</span>
                  <span className={`text-xs font-medium ${scanned.confidence >= 0.8 ? "text-green-600" : scanned.confidence >= 0.6 ? "text-yellow-600" : "text-red-500"}`}>
                    {Math.round((scanned.confidence ?? 0) * 100)}%
                  </span>
                  <ModelBadge modelId={visionModel} tier="VISION" />
                </div>
                <Button className="w-full rounded-xl gap-2" style={{ backgroundColor: BRAND }}
                  disabled={!vendorId || !accountId || createBillMutation.isPending}
                  onClick={handleCreate}>
                  {createBillMutation.isPending
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating bill…</>
                    : <><ArrowRight className="h-4 w-4" /> Create Bill Draft</>}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Insights Tab ──────────────────────────────────────────────────────────────

function InsightsTab({ orgId, tier }: { orgId: string; tier: ModelTier }) {
  const { data: modelData } = trpc.ai.getModels.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId, staleTime: 60 * 60 * 1000 }
  )
  const tiers = (modelData as any)?.tiers
  const smartModel = tiers?.[tier]?.modelId ?? tiers?.SMART?.modelId

  const { data: insights, isLoading, refetch } = trpc.ai.generateInsights.useQuery(
    { organizationId: orgId, modelOverrides: smartModel ? { smart: smartModel } : undefined },
    { enabled: !!orgId }
  )

  const { data: anomalies, isLoading: anomalyLoading } = trpc.ai.detectAnomalies.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  )

  const typeIcon = (type: string) => {
    if (type === "positive") return <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
    if (type === "warning") return <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
    return <Info className="h-4 w-4 text-blue-400 flex-shrink-0" />
  }

  const severityColor = (s: string) => s === "high" ? "bg-red-100 text-red-700" : s === "medium" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <Card className="rounded-xl">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" style={{ color: BRAND }} />
            Financial Insights
            <ModelBadge modelId={smartModel} tier={tier} />
          </CardTitle>
          <button onClick={() => refetch()} disabled={isLoading} className="text-gray-400 hover:text-gray-600">
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-300" /></div>
          ) : (insights as any[])?.length ? (
            <div className="space-y-4">
              {(insights as any[]).map((ins, i) => (
                <div key={i} className="flex items-start gap-3">
                  {typeIcon(ins.type)}
                  <p className="text-sm text-gray-700 leading-snug">{ins.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">No insights yet — transactions are needed to generate insights.</p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4" style={{ color: BRAND }} />
            Anomaly Detection
            <span className="text-xs font-normal text-gray-400">(last 30 days)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {anomalyLoading ? (
            <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-300" /></div>
          ) : (anomalies as any[])?.length ? (
            <div className="space-y-3">
              {(anomalies as any[]).slice(0, 8).map((a, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Badge className={`text-xs shrink-0 ${severityColor(a.severity)}`}>{a.severity}</Badge>
                  <p className="text-xs text-gray-700 leading-snug">{a.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No anomalies detected in recent transactions.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AIPage() {
  const [tab, setTab]   = useState<Tab>("chat")
  const [tier, setTier] = useState<ModelTier>("SMART")
  const { data: orgs }  = trpc.organization.getUserOrganizations.useQuery()
  const orgId           = orgs?.[0]?.id ?? ""

  const { data: modelData } = trpc.ai.getModels.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId, staleTime: 60 * 60 * 1000 }
  )
  const resolvedModel = (modelData as any)?.tiers?.[tier]?.modelId

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: "chat",     label: "Ask AI",          icon: <Bot className="h-4 w-4" /> },
    { id: "scanner",  label: "Receipt Scanner",  icon: <ScanLine className="h-4 w-4" /> },
    { id: "insights", label: "Insights",         icon: <Sparkles className="h-4 w-4" /> },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 flex h-14 items-center gap-4">
          <h1 className="text-xl font-bold" style={{ color: "#1A1D24" }}>AI Assistant</h1>
          <div className="flex items-center gap-1 ml-2">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tab === t.id ? "text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
                style={tab === t.id ? { backgroundColor: BRAND } : {}}>
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
          {orgId && (
            <div className="ml-auto">
              <ModelPicker
                orgId={orgId}
                selectedTier={tier}
                onSelectTier={setTier}
                resolvedModel={resolvedModel}
              />
            </div>
          )}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {!orgId ? (
          <div className="text-center py-20 text-gray-400">
            <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No organisation found. Please set up your organisation first.</p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {tab === "chat"     && <ChatTab orgId={orgId} tier={tier} resolvedModel={resolvedModel} />}
              {tab === "scanner"  && <ScannerTab orgId={orgId} tier={tier} />}
              {tab === "insights" && <InsightsTab orgId={orgId} tier={tier} />}
            </div>

            {/* Sidebar */}
            <div className="space-y-5">
              {tab === "chat" && (
                <Card className="rounded-xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Lightbulb className="h-4 w-4" style={{ color: BRAND }} />
                      Example queries
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {EXAMPLE_QUERIES.map((ex, i) => (
                        <button key={i} className="w-full text-left text-xs px-3 py-2 rounded-lg border border-gray-100 hover:border-[#50B0E0] hover:text-[#50B0E0] transition-colors text-gray-600">
                          {ex}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">AI Capabilities</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      ["Ask AI",          "Query real financial data in plain English"],
                      ["Receipt Scanner", "OCR receipts → auto-create bill drafts"],
                      ["Insights",        "AI-generated insights from your actual P&L"],
                      ["Anomaly detection","Spot duplicates and unusual transactions"],
                      ["Expense matching", "Match expenses to your chart of accounts"],
                    ].map(([title, desc]) => (
                      <div key={title} className="flex items-start gap-2">
                        <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-gray-700">{title}</p>
                          <p className="text-xs text-gray-400">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
