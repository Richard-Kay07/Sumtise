"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { trpc } from "@/lib/trpc-client"
import { RefreshCw, Download, Tag, Filter, ChevronLeft, ChevronRight } from "lucide-react"

const BRAND = "#50B0E0"

const CATEGORY_COLOURS: Record<string, string> = {
  PROJECT:       "#8B5CF6",
  GRANT:         "#10B981",
  RELATED_PARTY: "#F59E0B",
  WGA_CPID:      "#EF4444",
  CUSTOM:        "#6B7280",
}

export default function TaggedTransactionsPage() {
  const { data: orgs } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgs?.[0]?.id ?? ""

  const today  = new Date()
  const y = today.getFullYear(), m = today.getMonth()

  const [dateFrom,    setDateFrom]    = useState(new Date(y, m, 1).toISOString().split("T")[0])
  const [dateTo,      setDateTo]      = useState(today.toISOString().split("T")[0])
  const [projectId,   setProjectId]   = useState("")
  const [grantId,     setGrantId]     = useState("")
  const [rpId,        setRpId]        = useState("")
  const [cpid,        setCpid]        = useState("")
  const [untaggedOnly, setUntaggedOnly] = useState(false)
  const [amountMin,   setAmountMin]   = useState("")
  const [amountMax,   setAmountMax]   = useState("")
  const [page,        setPage]        = useState(1)
  const limit = 50

  const { data: projectsData }   = trpc.projects.list.useQuery({ organizationId: orgId, page: 1, limit: 100 }, { enabled: !!orgId })
  const { data: grantsData }     = trpc.grants.list.useQuery({ organizationId: orgId, page: 1, limit: 100 }, { enabled: !!orgId })
  const { data: partiesData }    = trpc.tags.listRelatedParties.useQuery({ organizationId: orgId }, { enabled: !!orgId })
  const { data: moduleSettings } = trpc.modules.getSettings.useQuery({ organizationId: orgId }, { enabled: !!orgId })

  const ms = moduleSettings as any

  const { data, isLoading } = trpc.tags.getTaggedTransactions.useQuery(
    {
      organizationId: orgId,
      periodStart:    new Date(dateFrom),
      periodEnd:      new Date(dateTo),
      projectId:      projectId || undefined,
      grantId:        grantId   || undefined,
      relatedPartyId: rpId      || undefined,
      cpid:           cpid      || undefined,
      untaggedOnly,
      amountMin:      amountMin ? parseFloat(amountMin) : undefined,
      amountMax:      amountMax ? parseFloat(amountMax) : undefined,
      page,
      limit,
    },
    { enabled: !!orgId }
  )

  const rows       = (data as any)?.transactions ?? []
  const pagination = (data as any)?.pagination ?? {}

  const exportCSV = () => {
    const header = "Date,Reference,Description,Account,Amount,Tags\n"
    const body   = rows.map((r: any) =>
      `"${new Date(r.date).toLocaleDateString("en-GB")}","${r.reference ?? ""}","${r.description ?? ""}","${r.account?.name ?? ""}","${r.amount}","${(r.tags ?? []).map((t: any) => t.name).join("; ")}"`
    ).join("\n")
    const blob = new Blob([header + body], { type: "text/csv" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a"); a.href = url; a.download = "tagged-transactions.csv"; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 flex h-14 items-center justify-between">
          <h1 className="text-xl font-bold" style={{ color: "#1A1D24" }}>Tagged Transactions</h1>
          <Button variant="outline" className="rounded-xl text-xs gap-1" onClick={exportCSV} disabled={rows.length === 0}>
            <Download className="h-3 w-3" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 py-6 flex gap-5">
        {/* Filter sidebar */}
        <aside className="w-60 flex-shrink-0 space-y-4">
          <Card className="rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1"><Filter className="h-3.5 w-3.5" /> Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Date from</Label>
                <Input type="date" className="h-8 text-xs rounded-xl mt-1" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Date to</Label>
                <Input type="date" className="h-8 text-xs rounded-xl mt-1" value={dateTo}   onChange={(e) => setDateTo(e.target.value)} />
              </div>

              {ms?.enableProjectTagging && (
                <div>
                  <Label className="text-xs">Project</Label>
                  <select className="w-full border rounded-xl h-8 text-xs px-2 mt-1 bg-white" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                    <option value="">All projects</option>
                    {((projectsData as any)?.projects ?? []).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.projectNumber} — {p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {ms?.enableGrantTagging && (
                <div>
                  <Label className="text-xs">Grant</Label>
                  <select className="w-full border rounded-xl h-8 text-xs px-2 mt-1 bg-white" value={grantId} onChange={(e) => setGrantId(e.target.value)}>
                    <option value="">All grants</option>
                    {((grantsData as any)?.grants ?? []).map((g: any) => (
                      <option key={g.id} value={g.id}>{g.grantNumber} — {g.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {ms?.enableRelatedPartyTagging && (
                <div>
                  <Label className="text-xs">Related party</Label>
                  <select className="w-full border rounded-xl h-8 text-xs px-2 mt-1 bg-white" value={rpId} onChange={(e) => setRpId(e.target.value)}>
                    <option value="">All parties</option>
                    {((partiesData as any) ?? []).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {ms?.enableWGACPIDCodes && (
                <div>
                  <Label className="text-xs">WGA CPID</Label>
                  <Input className="h-8 text-xs rounded-xl mt-1" placeholder="e.g. DWP001" value={cpid} onChange={(e) => setCpid(e.target.value)} />
                </div>
              )}

              <div>
                <Label className="text-xs">Amount range</Label>
                <div className="flex gap-1 mt-1">
                  <Input type="number" className="h-8 text-xs rounded-xl" placeholder="Min" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} />
                  <Input type="number" className="h-8 text-xs rounded-xl" placeholder="Max" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" checked={untaggedOnly} onChange={(e) => setUntaggedOnly(e.target.checked)} />
                Untagged only
              </label>
            </CardContent>
          </Card>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">
          <Card className="rounded-xl">
            <CardContent className="pt-4">
              {isLoading
                ? <div className="py-12 text-center"><RefreshCw className="h-5 w-5 animate-spin mx-auto text-gray-400" /></div>
                : (
                  <>
                    <p className="text-xs text-gray-500 mb-3">{pagination.total ?? 0} transactions</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs text-gray-500">
                          <tr>
                            <th className="text-left px-4 py-3">Date</th>
                            <th className="text-left px-4 py-3">Reference</th>
                            <th className="text-left px-4 py-3">Description</th>
                            <th className="text-left px-4 py-3">Account</th>
                            <th className="text-right px-4 py-3">Amount</th>
                            <th className="text-left px-4 py-3">Tags</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.length === 0
                            ? <tr><td colSpan={6} className="text-center py-8 text-gray-400 text-xs italic">No transactions match the selected filters.</td></tr>
                            : rows.map((r: any) => (
                              <tr key={r.id} className="border-t hover:bg-gray-50">
                                <td className="px-4 py-3 text-xs">{new Date(r.date).toLocaleDateString("en-GB")}</td>
                                <td className="px-4 py-3 font-mono text-xs">{r.reference ?? "—"}</td>
                                <td className="px-4 py-3 text-xs max-w-[180px] truncate">{r.description}</td>
                                <td className="px-4 py-3 text-xs text-gray-600">{r.account?.name ?? "—"}</td>
                                <td className="px-4 py-3 text-right font-medium">£{Number(r.amount ?? 0).toLocaleString()}</td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-wrap gap-1">
                                    {(r.tags ?? []).length === 0
                                      ? <span className="text-xs text-gray-300 italic">none</span>
                                      : (r.tags ?? []).map((t: any) => (
                                        <span key={t.id} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] text-white" style={{ backgroundColor: CATEGORY_COLOURS[t.categoryType] ?? "#6B7280" }}>
                                          {t.code ? `${t.code}: ` : ""}{t.name ?? t.tagName}
                                        </span>
                                      ))
                                    }
                                  </div>
                                </td>
                              </tr>
                            ))
                          }
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4">
                        <span className="text-xs text-gray-500">Page {page} of {pagination.totalPages}</span>
                        <div className="flex gap-2">
                          <Button variant="outline" className="h-8 rounded-xl text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                            <ChevronLeft className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" className="h-8 rounded-xl text-xs" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )
              }
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
