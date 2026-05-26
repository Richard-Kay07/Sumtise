"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/page-header"
import { trpc } from "@/lib/trpc-client"
import { useOrganization } from "@/contexts/organization-context"
import { RefreshCw, CheckCircle, XCircle, Clock, AlertCircle, ArrowLeft, Bot } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"

function statusBadge(status: string) {
  if (status === "PENDING")  return <Badge variant="outline" className="text-yellow-600 border-yellow-400">Pending</Badge>
  if (status === "APPROVED") return <Badge variant="outline" className="text-green-600 border-green-400">Approved</Badge>
  if (status === "REJECTED") return <Badge variant="outline" className="text-red-600 border-red-400">Rejected</Badge>
  return <Badge variant="outline">{status}</Badge>
}

function journalStatusChip(status: string) {
  const map: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-700",
    PENDING_APPROVAL: "bg-yellow-100 text-yellow-700",
    APPROVED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
    POSTED: "bg-blue-100 text-blue-700",
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status.replace(/_/g, " ")}
    </span>
  )
}

export default function ApprovalDetailPage() {
  const params = useParams()
  const router = useRouter()
  const approvalId = params.id as string
  const { orgId } = useOrganization()

  const [comment, setComment] = useState("")

  const utils = trpc.useUtils()

  // Fetch all approvals and find the one matching our ID
  const { data: allData, isLoading } = trpc.manualJournals.allApprovals.useQuery(
    { organizationId: orgId || "", limit: 100 },
    { enabled: !!orgId }
  )
  const approval = allData?.requests?.find((r: any) => r.id === approvalId)

  const approveMutation = trpc.manualJournals.approve.useMutation({
    onSuccess: () => {
      utils.manualJournals.myPendingApprovals.invalidate()
      utils.manualJournals.allApprovals.invalidate()
      router.push("/approvals")
    },
    onError: (e) => alert(`Error: ${e.message}`),
  })

  const rejectMutation = trpc.manualJournals.reject.useMutation({
    onSuccess: () => {
      utils.manualJournals.myPendingApprovals.invalidate()
      utils.manualJournals.allApprovals.invalidate()
      router.push("/approvals")
    },
    onError: (e) => alert(`Error: ${e.message}`),
  })

  const handleApprove = () => {
    if (!approval?.manualJournalId || !orgId) return
    approveMutation.mutate({ id: approval.manualJournalId, organizationId: orgId, notes: comment || undefined })
  }

  const handleReject = () => {
    if (!approval?.manualJournalId || !orgId) return
    if (!comment.trim()) { alert("Please provide a reason for rejection"); return }
    rejectMutation.mutate({ id: approval.manualJournalId, organizationId: orgId, reason: comment })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader crumbs={[{ label: "Accounting", href: "/accounting" }, { label: "Approvals", href: "/approvals" }]} title="Approval" />
        <main className="container mx-auto py-6">
          <Card><CardContent className="py-12 text-center">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent></Card>
        </main>
      </div>
    )
  }

  if (!approval) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader crumbs={[{ label: "Accounting", href: "/accounting" }, { label: "Approvals", href: "/approvals" }]} title="Approval" />
        <main className="container mx-auto py-6">
          <Card><CardContent className="py-12 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Approval request not found</p>
            <Link href="/approvals"><Button variant="outline" className="mt-4">Back to Approvals</Button></Link>
          </CardContent></Card>
        </main>
      </div>
    )
  }

  const journal = (approval as any).manualJournal
  const agentAction = (approval as any).agentAction
  const actions = (approval as any).actions ?? []
  const deadline = (approval as any).deadline ? new Date((approval as any).deadline) : null
  const isOverdue = deadline && deadline < new Date()
  const isPending = (approval as any).status === "PENDING"
  const totalDebits = journal?.lines?.reduce((s: number, l: any) => s + Number(l.debit), 0) ?? 0
  const totalCredits = journal?.lines?.reduce((s: number, l: any) => s + Number(l.credit), 0) ?? 0

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        crumbs={[{ label: "Accounting", href: "/accounting" }, { label: "Approvals", href: "/approvals" }]}
        title={journal?.reference ?? "Approval"}
      />

      <main className="container mx-auto py-6 space-y-6 max-w-4xl">
        <Link href="/approvals">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Back to Approvals
          </Button>
        </Link>

        {/* Journal summary */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 flex-wrap">
                  {journal?.reference}
                  {journal?.status && journalStatusChip(journal.status)}
                </CardTitle>
                <CardDescription className="mt-1">{journal?.description}</CardDescription>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold">{journal?.currency} {totalDebits.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">
                  {journal?.date ? format(new Date(journal.date), "dd MMM yyyy") : "—"}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 text-sm mb-4">
              <div>
                <span className="text-muted-foreground">Approval status: </span>
                {statusBadge((approval as any).status)}
              </div>
              {deadline && (
                <div>
                  <span className="text-muted-foreground">Deadline: </span>
                  <span className={isOverdue && isPending ? "text-red-500 font-medium" : ""}>
                    {format(deadline, "dd MMM yyyy HH:mm")}
                    {isOverdue && isPending && " (overdue)"}
                  </span>
                </div>
              )}
            </div>

            {journal?.lines && journal.lines.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 font-medium">Account</th>
                      <th className="text-left py-2 font-medium">Description</th>
                      <th className="text-right py-2 font-medium">Debit</th>
                      <th className="text-right py-2 font-medium">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journal.lines.map((line: any, i: number) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2">{line.account?.name ?? line.accountId}</td>
                        <td className="py-2 text-muted-foreground">{line.description ?? "—"}</td>
                        <td className="py-2 text-right">{Number(line.debit) > 0 ? Number(line.debit).toFixed(2) : "—"}</td>
                        <td className="py-2 text-right">{Number(line.credit) > 0 ? Number(line.credit).toFixed(2) : "—"}</td>
                      </tr>
                    ))}
                    <tr className="font-medium border-t">
                      <td colSpan={2} className="py-2 text-right text-muted-foreground">Total</td>
                      <td className="py-2 text-right">{totalDebits.toFixed(2)}</td>
                      <td className="py-2 text-right">{totalCredits.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {journal?.notes && (
              <p className="mt-4 text-sm text-muted-foreground border-t pt-3">
                <span className="font-medium">Notes:</span> {journal.notes}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Agent metadata (shown when this approval was raised by an AI agent) */}
        {agentAction && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4 text-blue-500" /> Agent Proposal
              </CardTitle>
              <CardDescription>
                This entry was proposed by the <strong>{agentAction.agentType}</strong> agent
                and requires human approval before posting.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {agentAction.inputSummary && (
                <div>
                  <span className="font-medium text-muted-foreground">Task: </span>
                  {agentAction.inputSummary}
                </div>
              )}
              {agentAction.outputSummary && (
                <div>
                  <span className="font-medium text-muted-foreground">Reasoning: </span>
                  {agentAction.outputSummary}
                </div>
              )}
              <div className="flex gap-6 pt-1 text-muted-foreground text-xs">
                <span>Tools called: {agentAction.toolCallCount}</span>
                <span>Tokens used: {agentAction.tokensUsed?.toLocaleString()}</span>
                {agentAction.durationMs && <span>Duration: {(agentAction.durationMs / 1000).toFixed(1)}s</span>}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action history */}
        {actions.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Action History</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {actions.map((a: any) => (
                  <div key={a.id} className="flex gap-3 text-sm">
                    <div className="mt-0.5">
                      {a.actionType === "APPROVED" ? <CheckCircle className="h-4 w-4 text-green-500" />
                        : a.actionType === "REJECTED" ? <XCircle className="h-4 w-4 text-red-500" />
                        : <Clock className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1">
                      <span className="font-medium">{a.actionType.replace(/_/g, " ")}</span>
                      {a.notes && <span className="text-muted-foreground"> — {a.notes}</span>}
                      <span className="text-muted-foreground text-xs ml-2">
                        {format(new Date(a.createdAt), "dd MMM yyyy HH:mm")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Approve / Reject controls */}
        {isPending && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Decision</CardTitle>
              <CardDescription>Add an optional comment, then approve or reject this journal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="comment">Comment</Label>
                <textarea
                  id="comment"
                  placeholder="Optional comment (required if rejecting)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={approveMutation.isPending}
                  onClick={handleApprove}
                >
                  {approveMutation.isPending
                    ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    : <CheckCircle className="mr-2 h-4 w-4" />}
                  Approve & Post
                </Button>
                <Button
                  variant="destructive"
                  disabled={rejectMutation.isPending}
                  onClick={handleReject}
                >
                  {rejectMutation.isPending
                    ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    : <XCircle className="mr-2 h-4 w-4" />}
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
