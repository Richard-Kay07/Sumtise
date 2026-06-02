"use client"

import { useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { Plus, RefreshCw, BookOpen, CheckCircle, Clock, XCircle, FileText, Send } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { trpc } from "@/lib/trpc-client"
import { useOrganization } from "@/contexts/organization-context"

type JournalStatus = "DRAFT" | "PENDING_APPROVAL" | "REJECTED" | "POSTED"

const STATUS_CONFIG: Record<string, { label: string; colour: string; icon: React.ReactNode }> = {
  DRAFT:            { label: "Draft",            colour: "bg-gray-100 text-gray-700",   icon: <FileText className="h-3 w-3" /> },
  PENDING_APPROVAL: { label: "Pending Approval", colour: "bg-yellow-100 text-yellow-700", icon: <Clock className="h-3 w-3" /> },
  REJECTED:         { label: "Rejected",         colour: "bg-red-100 text-red-700",     icon: <XCircle className="h-3 w-3" /> },
  POSTED:           { label: "Posted",           colour: "bg-green-100 text-green-700", icon: <CheckCircle className="h-3 w-3" /> },
}

const TABS: { value: JournalStatus | "ALL"; label: string }[] = [
  { value: "ALL",              label: "All" },
  { value: "DRAFT",            label: "Draft" },
  { value: "PENDING_APPROVAL", label: "Pending" },
  { value: "POSTED",           label: "Posted" },
  { value: "REJECTED",         label: "Rejected" },
]

export default function JournalEntriesPage() {
  const { orgId } = useOrganization()
  const [tab,       setTab]       = useState<JournalStatus | "ALL">("ALL")
  const [startDate, setStartDate] = useState("")
  const [endDate,   setEndDate]   = useState("")
  const [page,      setPage]      = useState(1)
  const limit = 25

  const { data, isLoading, refetch } = trpc.manualJournals.list.useQuery(
    {
      organizationId: orgId ?? "",
      status: tab === "ALL" ? undefined : tab,
      page,
      limit,
    },
    { enabled: !!orgId }
  )

  const journals    = data?.journals ?? []
  const total       = data?.total ?? 0
  const totalPages  = Math.ceil(total / limit)

  // Client-side date filter (list doesn't expose date params — filter in JS)
  const filtered = journals.filter((j) => {
    const d = new Date(j.date)
    if (startDate && d < new Date(startDate)) return false
    if (endDate   && d > new Date(endDate))   return false
    return true
  })

  function StatusBadge({ status }: { status: string }) {
    const cfg = STATUS_CONFIG[status] ?? { label: status, colour: "bg-gray-100 text-gray-600", icon: null }
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.colour}`}>
        {cfg.icon}{cfg.label}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        crumbs={[{ label: "Accounting", href: "/accounting" }]}
        title="Manual Journals"
      />

      <main className="container mx-auto py-6 space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* Status tabs */}
          <div className="flex gap-1.5 flex-wrap">
            {TABS.map(({ value, label }) => (
              <Button
                key={value}
                size="sm"
                variant={tab === value ? "default" : "outline"}
                onClick={() => { setTab(value); setPage(1) }}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Link href="/transactions/journal/new">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> New Journal
              </Button>
            </Link>
          </div>
        </div>

        {/* Date filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4">
              <div className="space-y-1">
                <Label>From</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
              </div>
              <div className="space-y-1">
                <Label>To</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
              </div>
              {(startDate || endDate) && (
                <div className="flex items-end">
                  <Button size="sm" variant="ghost" onClick={() => { setStartDate(""); setEndDate("") }}>
                    Clear
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Journal Entries
              {total > 0 && <span className="text-sm font-normal text-muted-foreground ml-1">({total})</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 text-center">
                <RefreshCw className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center">
                <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {tab === "ALL" ? "No journal entries yet" : `No ${STATUS_CONFIG[tab]?.label ?? tab} journals`}
                </p>
                <Link href="/transactions/journal/new">
                  <Button size="sm" className="mt-4">
                    <Plus className="h-4 w-4 mr-1" /> Create Journal Entry
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 pr-3 font-medium">Reference</th>
                      <th className="text-left py-2 pr-3 font-medium">Description</th>
                      <th className="text-left py-2 pr-3 font-medium">Date</th>
                      <th className="text-left py-2 pr-3 font-medium">Status</th>
                      <th className="text-right py-2 pr-3 font-medium">Debits</th>
                      <th className="text-right py-2 font-medium">Lines</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map((j: any) => {
                      const totalDebits = j.lines.reduce((s: number, l: any) => s + Number(l.debit), 0)
                      return (
                        <tr key={j.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-2.5 pr-3">
                            <Link
                              href={`/transactions/journal/${j.id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {j.reference}
                            </Link>
                          </td>
                          <td className="py-2.5 pr-3 text-muted-foreground max-w-[260px] truncate">
                            {j.description}
                          </td>
                          <td className="py-2.5 pr-3 text-muted-foreground whitespace-nowrap">
                            {format(new Date(j.date), "dd MMM yyyy")}
                          </td>
                          <td className="py-2.5 pr-3">
                            <StatusBadge status={j.status} />
                          </td>
                          <td className="py-2.5 pr-3 text-right font-medium">
                            {j.currency} {totalDebits.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 text-right text-muted-foreground">
                            {j.lines.length}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 text-sm">
                <span className="text-muted-foreground">
                  {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                    Previous
                  </Button>
                  <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
