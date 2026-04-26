"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc-client"
import { CreditCard, Plus, ChevronRight } from "lucide-react"
import Link from "next/link"

const BRAND = "#50B0E0"

const STATUS_COLORS: Record<string, string> = {
  PENDING:    "bg-yellow-100 text-yellow-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  COMPLETED:  "bg-green-100 text-green-700",
  FAILED:     "bg-red-100 text-red-700",
  CANCELLED:  "bg-gray-100 text-gray-500",
}

const fmt = (n: number) =>
  `£${Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function PaymentRunsPage() {
  const { data: orgs } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgs?.[0]?.id ?? ""

  const [status, setStatus] = useState("")
  const [page,   setPage]   = useState(1)

  const { data, isLoading } = trpc.paymentRuns.getAll.useQuery(
    {
      organizationId: orgId,
      status:         status ? (status as any) : undefined,
      page,
      limit: 20,
    },
    { enabled: !!orgId }
  )

  const runs       = (data as any)?.paymentRuns ?? []
  const pagination = (data as any)?.pagination
  const totalAmount = runs.reduce((s: number, r: any) => s + Number(r.totalAmount ?? 0), 0)
  const completedCount = runs.filter((r: any) => r.status === "COMPLETED").length
  const pendingCount   = runs.filter((r: any) => r.status === "PENDING" || r.status === "PROCESSING").length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" style={{ color: BRAND }} />
            <h1 className="text-xl font-bold" style={{ color: "#1A1D24" }}>Payment Runs</h1>
          </div>
          <Link href="/expenses/payment-run/new">
            <Button className="rounded-xl text-xs gap-1" style={{ backgroundColor: BRAND }}>
              <Plus className="h-3.5 w-3.5" /> New Payment Run
            </Button>
          </Link>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: "Total Runs",        value: (pagination?.total ?? 0).toString() },
            { label: "Completed",         value: completedCount.toString() },
            { label: "Pending / In Progress", value: pendingCount.toString() },
            { label: "Total Value (page)",   value: fmt(totalAmount) },
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
          {(["", "PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"] as const).map(s => (
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
          ) : runs.length === 0 ? (
            <CardContent className="py-12 text-center">
              <CreditCard className="mx-auto h-10 w-10 text-gray-200 mb-3" />
              <p className="text-sm text-gray-500">No payment runs yet.</p>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-left text-xs text-gray-500">
                    <th className="px-4 py-3">Run No.</th>
                    <th className="px-4 py-3">Bank Account</th>
                    <th className="px-4 py-3">Payment Date</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3 text-center">Payments</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3">Initiated By</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r: any) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                      onClick={() => (window.location.href = `/expenses/payment-run/${r.id}`)}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.runNumber}</td>
                      <td className="px-4 py-3 text-gray-600">{r.bankAccount?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-500">{r.paymentDate ? new Date(r.paymentDate).toLocaleDateString("en-GB") : "—"}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{(r.paymentMethod ?? "").replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{r._count?.payments ?? 0}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">{fmt(Number(r.totalAmount ?? 0))}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{r.initiator?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-500"}`}>{r.status}</Badge>
                      </td>
                      <td className="px-4 py-3"><ChevronRight className="h-4 w-4 text-gray-300" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{pagination.total} runs</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-7 rounded-lg" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <span className="px-3 py-1">{page} / {pagination.pages}</span>
              <Button variant="outline" size="sm" className="h-7 rounded-lg" disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
