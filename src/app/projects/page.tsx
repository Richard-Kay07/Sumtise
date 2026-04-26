"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { trpc } from "@/lib/trpc-client"
import { FolderOpen, Plus, Search, ChevronRight } from "lucide-react"
import Link from "next/link"

const BRAND = "#50B0E0"

const STATUS_COLORS: Record<string, string> = {
  DRAFT:     "bg-gray-100 text-gray-500",
  ACTIVE:    "bg-green-100 text-green-700",
  ON_HOLD:   "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  CANCELLED: "bg-red-100 text-red-700",
}

const fmt = (n: number) =>
  `£${n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

export default function ProjectsPage() {
  const { data: orgs } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgs?.[0]?.id ?? ""

  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [page,   setPage]   = useState(1)

  const { data, isLoading } = trpc.projects.list.useQuery(
    {
      organizationId: orgId,
      search: search || undefined,
      status: status ? (status as any) : undefined,
      page,
      limit: 20,
    },
    { enabled: !!orgId }
  )

  const projects   = (data as any)?.projects ?? []
  const pagination = (data as any)?.pagination
  const activeCount = projects.filter((p: any) => p.status === "ACTIVE").length
  const totalBudget = projects.reduce((s: number, p: any) => s + Number(p.budget ?? 0), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" style={{ color: BRAND }} />
            <h1 className="text-xl font-bold" style={{ color: "#1A1D24" }}>Projects</h1>
          </div>
          <Link href="/projects/new">
            <Button className="rounded-xl text-xs gap-1" style={{ backgroundColor: BRAND }}>
              <Plus className="h-3.5 w-3.5" /> New Project
            </Button>
          </Link>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: "Total Projects",  value: (pagination?.total ?? 0).toString() },
            { label: "Active Projects", value: activeCount.toString() },
            { label: "Total Budget",    value: fmt(totalBudget) },
            { label: "On Hold",         value: projects.filter((p: any) => p.status === "ON_HOLD").length.toString() },
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
            <Input placeholder="Search projects…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="pl-8 h-8 text-xs rounded-xl w-48" />
          </div>
          {(["", "DRAFT", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] as const).map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(1) }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                status === s ? "text-white border-transparent" : "text-gray-600 border-gray-200 hover:border-gray-300"
              }`} style={status === s ? { backgroundColor: BRAND, borderColor: BRAND } : {}}>
              {s ? s.replace(/_/g, " ") : "All"}
            </button>
          ))}
        </div>

        <Card className="rounded-xl overflow-hidden">
          {isLoading ? (
            <CardContent className="py-12 text-center text-gray-400 text-sm">Loading…</CardContent>
          ) : projects.length === 0 ? (
            <CardContent className="py-12 text-center">
              <FolderOpen className="mx-auto h-10 w-10 text-gray-200 mb-3" />
              <p className="text-sm text-gray-500">No projects found.</p>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-left text-xs text-gray-500">
                    <th className="px-4 py-3">Ref</th>
                    <th className="px-4 py-3">Project Name</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3 text-right">Budget</th>
                    <th className="px-4 py-3 text-center">Entries</th>
                    <th className="px-4 py-3">Start</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p: any) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                      onClick={() => (window.location.href = `/projects/${p.id}`)}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.projectNumber}</td>
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-gray-500">{p.customer?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono">{p.budget ? fmt(Number(p.budget)) : "—"}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{p._count?.entries ?? 0}</td>
                      <td className="px-4 py-3 text-gray-500">{p.startDate ? new Date(p.startDate).toLocaleDateString("en-GB") : "—"}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${STATUS_COLORS[p.status] ?? "bg-gray-100 text-gray-500"}`}>
                          {p.status.replace(/_/g, " ")}
                        </Badge>
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
            <span>{pagination.total} projects</span>
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
