"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { trpc } from "@/lib/trpc-client"
import { RefreshCw, Plus, Search, ChevronRight, PlayCircle, Loader2 } from "lucide-react"
import Link from "next/link"

const BRAND = "#50B0E0"

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    "bg-green-100 text-green-700",
  PAUSED:    "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  CANCELLED: "bg-red-100 text-red-700",
}

const FREQ_LABELS: Record<string, string> = {
  WEEKLY:      "Weekly",
  FORTNIGHTLY: "Fortnightly",
  MONTHLY:     "Monthly",
  QUARTERLY:   "Quarterly",
  ANNUALLY:    "Annually",
}

const fmt = (n: number) =>
  `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function RecurringInvoicesPage() {
  const { data: orgs } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgs?.[0]?.id ?? ""

  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [page,   setPage]   = useState(1)
  const [runningId, setRunningId] = useState<string | null>(null)

  const { data, isLoading, refetch } = trpc.recurringInvoices.list.useQuery(
    {
      organizationId: orgId,
      status: status ? (status as any) : undefined,
      page,
      limit: 20,
    },
    { enabled: !!orgId }
  )

  const runNow = trpc.recurringInvoices.runNow.useMutation({
    onSuccess: () => { setRunningId(null); refetch() },
    onError:   () => setRunningId(null),
  })

  const templates  = (data as any)?.templates ?? []
  const pagination = (data as any)?.pagination

  // Client-side search filter
  const filtered = search
    ? templates.filter((t: any) =>
        t.title?.toLowerCase().includes(search.toLowerCase()) ||
        t.customer?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : templates

  const activeCount = templates.filter((t: any) => t.status === "ACTIVE").length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" style={{ color: BRAND }} />
            <h1 className="text-xl font-bold" style={{ color: "#1A1D24" }}>Recurring Invoices</h1>
          </div>
          <Link href="/invoices/recurring/new">
            <Button className="rounded-xl text-xs gap-1" style={{ backgroundColor: BRAND }}>
              <Plus className="h-3.5 w-3.5" /> New Template
            </Button>
          </Link>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: "Total Templates",   value: (pagination?.total ?? 0).toString() },
            { label: "Active",            value: activeCount.toString() },
            { label: "Paused",            value: templates.filter((t: any) => t.status === "PAUSED").length.toString() },
            { label: "Total Invoices Generated", value: templates.reduce((s: number, t: any) => s + (t._count?.generatedInvoices ?? 0), 0).toString() },
          ].map(c => (
            <Card key={c.label} className="rounded-xl">
              <CardContent className="pt-5">
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className="text-2xl font-bold mt-1">{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
            <Input placeholder="Search templates…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs rounded-xl w-48" />
          </div>
          {(["", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"] as const).map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(1) }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                status === s ? "text-white border-transparent" : "text-gray-600 border-gray-200 hover:border-gray-300"
              }`} style={status === s ? { backgroundColor: BRAND, borderColor: BRAND } : {}}>
              {s || "All"}
            </button>
          ))}
        </div>

        <Card className="rounded-xl overflow-hidden">
          {isLoading ? (
            <CardContent className="py-12 text-center text-gray-400 text-sm">Loading…</CardContent>
          ) : filtered.length === 0 ? (
            <CardContent className="py-12 text-center">
              <RefreshCw className="mx-auto h-10 w-10 text-gray-200 mb-3" />
              <p className="text-sm text-gray-500">No recurring invoice templates yet.</p>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-left text-xs text-gray-500">
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Frequency</th>
                    <th className="px-4 py-3">Next Run</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-center">Generated</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t: any) => (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium cursor-pointer"
                        onClick={() => (window.location.href = `/invoices/recurring/${t.id}`)}>
                        {t.title}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{t.customer?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-500">{FREQ_LABELS[t.frequency] ?? t.frequency}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {t.nextRunDate ? new Date(t.nextRunDate).toLocaleDateString("en-GB") : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{fmt(Number(t.total ?? 0))}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{t._count?.generatedInvoices ?? 0}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${STATUS_COLORS[t.status] ?? "bg-gray-100 text-gray-500"}`}>{t.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {t.status === "ACTIVE" && (
                            <button
                              onClick={() => { setRunningId(t.id); runNow.mutate({ organizationId: orgId, templateId: t.id }) }}
                              disabled={runNow.isPending && runningId === t.id}
                              title="Run now"
                              className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-[#50B0E0] transition-colors"
                            >
                              {runNow.isPending && runningId === t.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <PlayCircle className="h-3.5 w-3.5" />}
                            </button>
                          )}
                          <ChevronRight className="h-4 w-4 text-gray-300 cursor-pointer"
                            onClick={() => (window.location.href = `/invoices/recurring/${t.id}`)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{pagination.total} templates</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-7 rounded-lg" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <span className="px-3 py-1">{page} / {pagination.totalPages}</span>
              <Button variant="outline" size="sm" className="h-7 rounded-lg" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
