"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { trpc } from "@/lib/trpc-client"
import { Plus, Search, Building2, RefreshCw } from "lucide-react"
import Link from "next/link"

const BRAND = "#50B0E0"

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:             "bg-green-100 text-green-700",
  DISPOSED:           "bg-red-100 text-red-700",
  FULLY_DEPRECIATED:  "bg-gray-100 text-gray-500",
  UNDER_MAINTENANCE:  "bg-yellow-100 text-yellow-700",
  WRITTEN_OFF:        "bg-orange-100 text-orange-700",
}

const CATEGORY_LABELS: Record<string, string> = {
  LAND_AND_BUILDINGS:     "Land & Buildings",
  PLANT_AND_MACHINERY:    "Plant & Machinery",
  VEHICLES:               "Vehicles",
  FURNITURE_AND_FIXTURES: "Furniture",
  COMPUTER_EQUIPMENT:     "Computer Equipment",
  INTANGIBLE:             "Intangible",
  OTHER:                  "Other",
}

const fmt = (n: number) =>
  `£${n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

export default function FixedAssetsPage() {
  const { data: orgs } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgs?.[0]?.id ?? ""

  const [search,   setSearch]   = useState("")
  const [status,   setStatus]   = useState("")
  const [category, setCategory] = useState("")
  const [page,     setPage]     = useState(1)

  const { data, isLoading, refetch } = trpc.fixedAssets.list.useQuery(
    {
      organizationId: orgId,
      search:   search   || undefined,
      status:   status   ? (status as any)   : undefined,
      category: category ? (category as any) : undefined,
      page,
      limit: 20,
    },
    { enabled: !!orgId }
  )

  const { data: summary } = trpc.fixedAssets.getBalanceSheetSummary.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  )

  const runDep = trpc.fixedAssets.runPeriodDepreciation.useMutation({
    onSuccess: () => refetch(),
  })

  const assets     = (data as any)?.assets ?? []
  const pagination = (data as any)?.pagination
  const rows       = (summary as any)?.rows ?? []
  const totalCost  = rows.reduce((s: number, r: any) => s + Number(r.totalCost ?? 0), 0)
  const totalAccDep = rows.reduce((s: number, r: any) => s + Number(r.totalAccumulatedDepreciation ?? 0), 0)
  const totalNBV   = totalCost - totalAccDep

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5" style={{ color: BRAND }} />
            <h1 className="text-xl font-bold" style={{ color: "#1A1D24" }}>Fixed Assets</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1.5"
              disabled={!orgId || runDep.isPending}
              onClick={() => runDep.mutate({ organizationId: orgId, periodEnd: new Date() })}>
              <RefreshCw className={`h-3.5 w-3.5 ${runDep.isPending ? "animate-spin" : ""}`} />
              {runDep.isSuccess ? `Posted ${(runDep.data as any)?.posted ?? 0}` : "Run Depreciation"}
            </Button>
            <Link href="/accounting/fixed-assets/new">
              <Button className="rounded-xl text-xs gap-1" style={{ backgroundColor: BRAND }}>
                <Plus className="h-3.5 w-3.5" /> New Asset
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: "Total Cost",             value: fmt(totalCost) },
            { label: "Acc. Depreciation",      value: fmt(totalAccDep) },
            { label: "Net Book Value",          value: fmt(Math.max(0, totalNBV)) },
            { label: "Total Assets",            value: (pagination?.total ?? 0).toString() },
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
            <Input placeholder="Search assets…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="pl-8 h-8 text-xs rounded-xl w-48" />
          </div>
          {(["", "ACTIVE", "FULLY_DEPRECIATED", "DISPOSED", "WRITTEN_OFF"] as const).map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(1) }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                status === s ? "text-white border-transparent" : "text-gray-600 border-gray-200 hover:border-gray-300"
              }`} style={status === s ? { backgroundColor: BRAND, borderColor: BRAND } : {}}>
              {s ? s.replace(/_/g, " ") : "All"}
            </button>
          ))}
          <select value={category} onChange={e => { setCategory(e.target.value); setPage(1) }}
            className="h-8 px-2 text-xs rounded-xl border border-gray-200 bg-white text-gray-600">
            <option value="">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        <Card className="rounded-xl overflow-hidden">
          {isLoading ? (
            <CardContent className="py-12 text-center text-gray-400 text-sm">Loading…</CardContent>
          ) : assets.length === 0 ? (
            <CardContent className="py-12 text-center">
              <Building2 className="mx-auto h-10 w-10 text-gray-200 mb-3" />
              <p className="text-sm text-gray-500">No assets found.</p>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-left text-xs text-gray-500">
                    <th className="px-4 py-3">Asset No.</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3 text-right">Cost</th>
                    <th className="px-4 py-3 text-right">Acc. Dep.</th>
                    <th className="px-4 py-3 text-right">NBV</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a: any) => {
                    const cost   = Number(a.purchasePrice)
                    const accDep = Number(a.accumulatedDepreciation ?? 0)
                    return (
                      <tr key={a.id} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                        onClick={() => (window.location.href = `/accounting/fixed-assets/${a.id}`)}>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{a.assetNumber}</td>
                        <td className="px-4 py-3 font-medium">{a.name}</td>
                        <td className="px-4 py-3 text-gray-500">{CATEGORY_LABELS[a.category] ?? a.category}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">{a.depreciationMethod.replace(/_/g, " ")}</td>
                        <td className="px-4 py-3 text-right font-mono">{fmt(cost)}</td>
                        <td className="px-4 py-3 text-right font-mono text-gray-500">({fmt(accDep)})</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">{fmt(Math.max(0, cost - accDep))}</td>
                        <td className="px-4 py-3">
                          <Badge className={`text-xs ${STATUS_COLORS[a.status] ?? "bg-gray-100 text-gray-500"}`}>
                            {a.status.replace(/_/g, " ")}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{pagination.total} assets</span>
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
