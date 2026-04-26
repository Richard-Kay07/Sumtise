"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { trpc } from "@/lib/trpc-client"
import { Award, Plus, Search, ChevronRight, Flag } from "lucide-react"
import Link from "next/link"

const BRAND = "#50B0E0"

const STATUS_COLORS: Record<string, string> = {
  PENDING:   "bg-yellow-100 text-yellow-700",
  ACTIVE:    "bg-green-100 text-green-700",
  REPORTING: "bg-blue-100 text-blue-700",
  CLOSED:    "bg-gray-100 text-gray-500",
  CANCELLED: "bg-red-100 text-red-700",
}

const TYPE_COLORS: Record<string, string> = {
  RESTRICTED:   "bg-purple-100 text-purple-700",
  UNRESTRICTED: "bg-teal-100 text-teal-700",
  CAPITAL:      "bg-orange-100 text-orange-700",
  REVENUE:      "bg-blue-100 text-blue-700",
}

const fmt = (n: number) =>
  `£${n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

export default function GrantsPage() {
  const { data: orgs } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgs?.[0]?.id ?? ""

  const [search,    setSearch]    = useState("")
  const [status,    setStatus]    = useState("")
  const [grantType, setGrantType] = useState("")
  const [page,      setPage]      = useState(1)

  const { data, isLoading } = trpc.grants.list.useQuery(
    {
      organizationId: orgId,
      search:    search    || undefined,
      status:    status    ? (status as any)    : undefined,
      grantType: grantType ? (grantType as any) : undefined,
      page,
      limit: 20,
    },
    { enabled: !!orgId }
  )

  const grants     = (data as any)?.grants ?? []
  const pagination = (data as any)?.pagination

  const totalAmount   = grants.reduce((s: number, g: any) => s + Number(g.totalAmount ?? 0), 0)
  const totalReceived = grants.reduce((s: number, g: any) => s + Number(g.receivedAmount ?? 0), 0)
  const totalSpent    = grants.reduce((s: number, g: any) => s + Number(g.spentAmount ?? 0), 0)
  const activeCount   = grants.filter((g: any) => g.status === "ACTIVE").length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5" style={{ color: BRAND }} />
            <h1 className="text-xl font-bold" style={{ color: "#1A1D24" }}>Grants</h1>
          </div>
          <Link href="/grants/new">
            <Button className="rounded-xl text-xs gap-1" style={{ backgroundColor: BRAND }}>
              <Plus className="h-3.5 w-3.5" /> New Grant
            </Button>
          </Link>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: "Total Awarded",  value: fmt(totalAmount) },
            { label: "Total Received", value: fmt(totalReceived) },
            { label: "Total Spent",    value: fmt(totalSpent) },
            { label: "Active Grants",  value: activeCount.toString() },
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
            <Input placeholder="Search grants…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="pl-8 h-8 text-xs rounded-xl w-48" />
          </div>
          {(["", "PENDING", "ACTIVE", "REPORTING", "CLOSED"] as const).map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(1) }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                status === s ? "text-white border-transparent" : "text-gray-600 border-gray-200 hover:border-gray-300"
              }`} style={status === s ? { backgroundColor: BRAND, borderColor: BRAND } : {}}>
              {s || "All"}
            </button>
          ))}
          <select value={grantType} onChange={e => { setGrantType(e.target.value); setPage(1) }}
            className="h-8 px-2 text-xs rounded-xl border border-gray-200 bg-white text-gray-600">
            <option value="">All Types</option>
            {["RESTRICTED", "UNRESTRICTED", "CAPITAL", "REVENUE"].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <Card className="rounded-xl overflow-hidden">
          {isLoading ? (
            <CardContent className="py-12 text-center text-gray-400 text-sm">Loading…</CardContent>
          ) : grants.length === 0 ? (
            <CardContent className="py-12 text-center">
              <Award className="mx-auto h-10 w-10 text-gray-200 mb-3" />
              <p className="text-sm text-gray-500">No grants found.</p>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-left text-xs text-gray-500">
                    <th className="px-4 py-3">Ref</th>
                    <th className="px-4 py-3">Grant Name</th>
                    <th className="px-4 py-3">Funder</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Received</th>
                    <th className="px-4 py-3 text-right">Spent</th>
                    <th className="px-4 py-3">Milestones</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {grants.map((g: any) => (
                    <tr key={g.id} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                      onClick={() => (window.location.href = `/grants/${g.id}`)}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{g.grantNumber}</td>
                      <td className="px-4 py-3 font-medium">{g.name}</td>
                      <td className="px-4 py-3 text-gray-500">{g.funder}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${TYPE_COLORS[g.grantType] ?? "bg-gray-100 text-gray-500"}`}>{g.grantType}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{fmt(Number(g.totalAmount ?? 0))}</td>
                      <td className="px-4 py-3 text-right font-mono text-green-600">{fmt(Number(g.receivedAmount ?? 0))}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-500">{fmt(Number(g.spentAmount ?? 0))}</td>
                      <td className="px-4 py-3">
                        {(g._count?.milestones ?? 0) > 0 && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Flag className="h-3 w-3" /> {g._count.milestones}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${STATUS_COLORS[g.status] ?? "bg-gray-100 text-gray-500"}`}>{g.status}</Badge>
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
            <span>{pagination.total} grants</span>
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
