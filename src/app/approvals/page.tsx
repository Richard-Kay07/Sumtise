"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { trpc } from "@/lib/trpc-client"
import { useOrganization } from "@/contexts/organization-context"
import { RefreshCw, CheckCircle, Clock, AlertCircle } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"

function statusBadge(status: string) {
  if (status === "PENDING")  return <Badge variant="outline" className="text-yellow-600 border-yellow-400">Pending</Badge>
  if (status === "APPROVED") return <Badge variant="outline" className="text-green-600 border-green-400">Approved</Badge>
  if (status === "REJECTED") return <Badge variant="outline" className="text-red-600 border-red-400">Rejected</Badge>
  return <Badge variant="outline">{status}</Badge>
}

function ApprovalRow({ req }: { req: any }) {
  const journal = req.manualJournal
  const deadline = req.deadline ? new Date(req.deadline) : null
  const isOverdue = deadline && deadline < new Date()
  const totalDebits = journal?.lines?.reduce((s: number, l: any) => s + Number(l.debit), 0) ?? 0

  return (
    <Link href={`/approvals/${req.id}`} className="block hover:bg-muted/40 transition-colors">
      <div className="flex items-start justify-between px-1 py-3 gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{journal?.reference}</span>
            {statusBadge(req.status)}
            {isOverdue && req.status === "PENDING" && (
              <Badge variant="outline" className="text-red-600 border-red-400">
                <AlertCircle className="h-3 w-3 mr-1" />Overdue
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate mt-0.5">{journal?.description}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Submitted {journal?.submittedAt ? format(new Date(journal.submittedAt), "dd MMM yyyy HH:mm") : "—"}
            {deadline && (
              <span className={isOverdue ? " text-red-500" : ""}>
                {" · "}Due {format(deadline, "dd MMM yyyy HH:mm")}
              </span>
            )}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-medium">{journal?.currency} {totalDebits.toFixed(2)}</p>
        </div>
      </div>
    </Link>
  )
}

export default function ApprovalsPage() {
  const [tab, setTab] = useState<"mine" | "all">("mine")

  const { orgId } = useOrganization()

  const { data: mine, isLoading: loadingMine } = trpc.manualJournals.myPendingApprovals.useQuery(
    { organizationId: orgId || "" },
    { enabled: !!orgId }
  )
  const { data: allData, isLoading: loadingAll } = trpc.manualJournals.allApprovals.useQuery(
    { organizationId: orgId || "" },
    { enabled: !!orgId && tab === "all" }
  )

  const items = tab === "mine" ? (mine ?? []) : (allData?.requests ?? [])
  const isLoading = tab === "mine" ? loadingMine : loadingAll

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        crumbs={[{ label: "Accounting", href: "/accounting" }, { label: "Ledger & Banking", href: "/accounting/ledger-banking" }]}
        title="Approvals"
      />

      <main className="container mx-auto py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button variant={tab === "mine" ? "default" : "outline"} size="sm" onClick={() => setTab("mine")}>
              My Queue
              {mine && mine.length > 0 && (
                <span className="ml-2 rounded-full bg-yellow-500 text-white text-xs px-1.5">{mine.length}</span>
              )}
            </Button>
            <Button variant={tab === "all" ? "default" : "outline"} size="sm" onClick={() => setTab("all")}>
              All Pending
            </Button>
          </div>
          <Link href="/transactions/journal/new">
            <Button size="sm">New Journal</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {tab === "mine" ? "Journals awaiting your approval" : "All pending approvals"}
            </CardTitle>
            <CardDescription>Click a journal to review and approve or reject it</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 text-center">
                <RefreshCw className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <div className="py-12 text-center">
                <CheckCircle className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No approvals pending</p>
              </div>
            ) : (
              <div className="divide-y">
                {items.map((req: any) => <ApprovalRow key={req.id} req={req} />)}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
