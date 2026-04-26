"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { trpc } from "@/lib/trpc-client"
import { BarChart3, Plus, Search, ChevronRight } from "lucide-react"
import Link from "next/link"

const BRAND = "#50B0E0"

const STATUS_COLORS: Record<string, string> = {
  DRAFT:    "bg-gray-100 text-gray-500",
  APPROVED: "bg-blue-100 text-blue-700",
  ACTIVE:   "bg-green-100 text-green-700",
  CLOSED:   "bg-orange-100 text-orange-700",
  ARCHIVED: "bg-gray-100 text-gray-400",
}

const fmt = (n: number) =>
  `£${n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

export default function BudgetsPage() {
  const { data: orgs } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgs?.[0]?.id ?? ""

  const [search,     setSearch]     = useState("")
  const [status,     setStatus]     = useState("")
  const [budgetType, setBudgetType] = useState("")
  const [page,       setPage]       = useState(1)

  const { data, isLoading } = trpc.budgets.list.useQuery(
    {
      organizationId: orgId,
      status:     status     ? (status as any)     : undefined,
      budgetType: budgetType ? (budgetType as any)  : undefined,
      page,
      limit: 20,
    },
    { enabled: !!orgId }
  )

  const budgets    = (data as any)?.budgets ?? []
  const pagination = (data as any)?.pagination
  const activeCount = budgets.filter((b: any) => b.status === "ACTIVE" || b.status === "APPROVED").length

  // Filter by search client-side (no server search param in router)
  const filtered = search
    ? budgets.filter((b: any) => b.name?.toLowerCase().includes(search.toLowerCase()))
    : budgets

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" style={{ color: BRAND }} />
            <h1 className="text-xl font-bold" style={{ color: "#1A1D24" }}>Budgets</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/reports/budget-variance">
              <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1">
                <BarChart3 className="h-3.5 w-3.5" /> Variance Report
              </Button>
            </Link>
            <Link href="/budgets/new">
              <Button className="rounded-xl text-xs gap-1" style={{ backgroundColor: BRAND }}>
                <Plus className="h-3.5 w-3.5" /> New Budget
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Total Budgets",    value: (pagination?.total ?? 0).toString() },
            { label: "Active / Approved", value: activeCount.toString() },
            { label: "Draft Budgets",    value: budgets.filter((b: any) => b.status === "DRAFT").length.toString() },
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
            <Input placeholder="Search budgets…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs rounded-xl w-48" />
          </div>
          {(["", "DRAFT", "APPROVED", "ACTIVE", "CLOSED"] as const).map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(1) }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                status === s ? "text-white border-transparent" : "text-gray-600 border-gray-200 hover:border-gray-300"
              }`} style={status === s ? { backgroundColor: BRAND, borderColor: BRAND } : {}}>
              {s || "All"}
            </button>
          ))}
          <select value={budgetType} onChange={e => { setBudgetType(e.target.value); setPage(1) }}
            className="h-8 px-2 text-xs rounded-xl border border-gray-200 bg-white text-gray-600">
            <option value="">All Types</option>
            {["ANNUAL", "QUARTERLY", "MONTHLY", "PROJECT", "GRANT"].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <Card className="rounded-xl overflow-hidden">
          {isLoading ? (
            <CardContent className="py-12 text-center text-gray-400 text-sm">Loading…</CardContent>
          ) : filtered.length === 0 ? (
            <CardContent className="py-12 text-center">
              <BarChart3 className="mx-auto h-10 w-10 text-gray-200 mb-3" />
              <p className="text-sm text-gray-500">No budgets found.</p>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-left text-xs text-gray-500">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Period</th>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3 text-center">Lines</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b: any) => (
                    <tr key={b.id} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                      onClick={() => (window.location.href = `/budgets/${b.id}`)}>
                      <td className="px-4 py-3 font-medium">{b.name}</td>
                      <td className="px-4 py-3">
                        <Badge className="text-xs bg-blue-50 text-blue-600">{b.budgetType}</Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {b.periodStart ? new Date(b.periodStart).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "—"}
                        {b.periodEnd ? ` – ${new Date(b.periodEnd).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}` : ""}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{b.project?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{b._count?.lines ?? 0}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-500"}`}>{b.status}</Badge>
                      </td>
                      <td className="px-4 py-3"><ChevronRight className="h-4 w-4 text-gray-300" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{pagination.total} budgets</span>
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
