"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import {
  ArrowLeft, CheckCircle, XCircle, Undo2, Trash2,
  Send, Pencil, RefreshCw, BookOpen, Clock, FileText,
  Plus, Trash,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/page-header"
import { trpc } from "@/lib/trpc-client"
import { useOrganization } from "@/contexts/organization-context"

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; colour: string }> = {
  DRAFT:            { label: "Draft",            colour: "bg-gray-100 text-gray-700" },
  PENDING_APPROVAL: { label: "Pending Approval", colour: "bg-yellow-100 text-yellow-700" },
  REJECTED:         { label: "Rejected",         colour: "bg-red-100 text-red-700" },
  POSTED:           { label: "Posted",           colour: "bg-green-100 text-green-700" },
}

const ACTION_LABELS: Record<string, string> = {
  SUBMITTED: "Submitted",
  APPROVED:  "Approved",
  REJECTED:  "Rejected",
  WITHDRAWN: "Withdrawn",
  DELEGATED: "Delegated",
  ESCALATED: "Escalated",
}

function StatusChip({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, colour: "bg-gray-100 text-gray-600" }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.colour}`}>
      {cfg.label}
    </span>
  )
}

// ─── Inline edit form ─────────────────────────────────────────────────────────

interface EditLine { accountId: string; description: string; debit: string; credit: string }
const emptyLine = (): EditLine => ({ accountId: "", description: "", debit: "", credit: "" })

function EditForm({
  journal,
  accounts,
  orgId,
  onSaved,
  onCancel,
}: {
  journal: any
  accounts: any[]
  orgId: string
  onSaved: () => void
  onCancel: () => void
}) {
  const [reference,   setReference]   = useState(journal.reference)
  const [description, setDescription] = useState(journal.description)
  const [date,        setDate]        = useState(journal.date.slice(0, 10))
  const [notes,       setNotes]       = useState(journal.notes ?? "")
  const [lines, setLines] = useState<EditLine[]>(
    journal.lines.map((l: any) => ({
      accountId:   l.accountId,
      description: l.description ?? "",
      debit:       Number(l.debit)  > 0 ? String(Number(l.debit))  : "",
      credit:      Number(l.credit) > 0 ? String(Number(l.credit)) : "",
    }))
  )
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const updateMutation = trpc.manualJournals.update.useMutation()
  const submitMutation = trpc.manualJournals.submit.useMutation()

  const totalDebits  = lines.reduce((s, l) => s + (parseFloat(l.debit)  || 0), 0)
  const totalCredits = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0)
  const isBalanced   = Math.abs(totalDebits - totalCredits) < 0.01
  const hasData      = lines.some((l) => l.accountId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))

  const updateLine = (i: number, field: keyof EditLine, value: string) =>
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))

  const buildPayload = () => ({
    id:             journal.id,
    organizationId: orgId,
    reference,
    description,
    date,
    notes: notes || undefined,
    lines: lines.filter((l) => l.accountId).map((l, i) => ({
      accountId:   l.accountId,
      description: l.description || undefined,
      debit:       parseFloat(l.debit)  || 0,
      credit:      parseFloat(l.credit) || 0,
      sortOrder:   i,
    })),
  })

  const handleSave = async () => {
    setError(null); setSaving(true)
    try {
      await updateMutation.mutateAsync(buildPayload())
      onSaved()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  const handleSaveAndSubmit = async () => {
    setError(null); setSaving(true)
    try {
      await updateMutation.mutateAsync(buildPayload())
      await submitMutation.mutateAsync({ id: journal.id, organizationId: orgId })
      onSaved()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      <Card>
        <CardHeader><CardTitle>Journal Details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Reference *</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="JNL-001" />
          </div>
          <div className="space-y-1">
            <Label>Date *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label>Description *</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label>Notes</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Journal Lines</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setLines((p) => [...p, emptyLine()])}>
            <Plus className="h-4 w-4 mr-1" /> Add Line
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 pr-2 font-medium w-[38%]">Account</th>
                <th className="text-left py-2 pr-2 font-medium">Description</th>
                <th className="text-right py-2 pr-2 font-medium w-24">Debit</th>
                <th className="text-right py-2 pr-2 font-medium w-24">Credit</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-1.5 pr-2">
                    <select
                      value={line.accountId}
                      onChange={(e) => updateLine(i, "accountId", e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    >
                      <option value="">— Select account —</option>
                      {accounts.map((a: any) => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input value={line.description} onChange={(e) => updateLine(i, "description", e.target.value)} placeholder="Line description" className="h-8 text-sm" />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input type="number" min="0" step="0.01" value={line.debit} onChange={(e) => updateLine(i, "debit", e.target.value)} className="h-8 text-sm text-right" placeholder="0.00" />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input type="number" min="0" step="0.01" value={line.credit} onChange={(e) => updateLine(i, "credit", e.target.value)} className="h-8 text-sm text-right" placeholder="0.00" />
                  </td>
                  <td className="py-1.5">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={() => setLines((p) => p.filter((_, j) => j !== i))} disabled={lines.length <= 2}>
                      <Trash className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              <tr className="font-medium text-sm">
                <td colSpan={2} className="pt-3 text-right text-muted-foreground">Totals</td>
                <td className={`pt-3 text-right ${!isBalanced && hasData ? "text-red-500" : ""}`}>{totalDebits.toFixed(2)}</td>
                <td className={`pt-3 text-right ${!isBalanced && hasData ? "text-red-500" : ""}`}>{totalCredits.toFixed(2)}</td>
                <td />
              </tr>
            </tbody>
          </table>
          {!isBalanced && hasData && (
            <p className="mt-2 text-sm text-red-500">
              Difference: {Math.abs(totalDebits - totalCredits).toFixed(2)} — debits and credits must balance.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button variant="outline" onClick={handleSave} disabled={saving || !reference || !description}>
          {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Draft
        </Button>
        <Button onClick={handleSaveAndSubmit} disabled={saving || !reference || !description || !isBalanced || !hasData}>
          {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Save &amp; Submit
        </Button>
      </div>
    </div>
  )
}

// ─── Main detail page ─────────────────────────────────────────────────────────

export default function JournalDetailPage() {
  const params   = useParams<{ id: string }>()
  const router   = useRouter()
  const { orgId } = useOrganization()
  const utils    = trpc.useUtils()

  const [editing,      setEditing]      = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [showReject,   setShowReject]   = useState(false)
  const [actionError,  setActionError]  = useState<string | null>(null)

  const { data: journal, isLoading } = trpc.manualJournals.get.useQuery(
    { id: params.id, organizationId: orgId ?? "" },
    { enabled: !!orgId && !!params.id }
  )

  const { data: allAccounts } = trpc.chartOfAccounts.getAll.useQuery(
    { organizationId: orgId ?? "" },
    { enabled: !!orgId }
  )
  const accounts = allAccounts ?? []

  const invalidate = () => utils.manualJournals.get.invalidate()

  const submitMutation   = trpc.manualJournals.submit.useMutation({   onSuccess: invalidate, onError: (e) => setActionError(e.message) })
  const approveMutation  = trpc.manualJournals.approve.useMutation({  onSuccess: invalidate, onError: (e) => setActionError(e.message) })
  const rejectMutation   = trpc.manualJournals.reject.useMutation({   onSuccess: () => { invalidate(); setShowReject(false) }, onError: (e) => setActionError(e.message) })
  const withdrawMutation = trpc.manualJournals.withdraw.useMutation({ onSuccess: invalidate, onError: (e) => setActionError(e.message) })
  const deleteMutation   = trpc.manualJournals.delete.useMutation({
    onSuccess: () => router.push("/transactions/journal"),
    onError:   (e) => setActionError(e.message),
  })

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )

  if (!journal) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Journal not found.</p>
    </div>
  )

  const totalDebits  = journal.lines.reduce((s: number, l: any) => s + Number(l.debit),  0)
  const totalCredits = journal.lines.reduce((s: number, l: any) => s + Number(l.credit), 0)

  const canEdit     = ["DRAFT", "REJECTED"].includes(journal.status)
  const canSubmit   = ["DRAFT", "REJECTED"].includes(journal.status)
  const canApprove  = journal.status === "PENDING_APPROVAL"
  const canReject   = journal.status === "PENDING_APPROVAL"
  const canWithdraw = journal.status === "PENDING_APPROVAL"
  const canDelete   = ["DRAFT", "REJECTED"].includes(journal.status)

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        crumbs={[{ label: "Journals", href: "/transactions/journal" }]}
        title={journal.reference}
      />

      {/* Reject modal */}
      {showReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold">Reject Journal</h2>
            <div className="space-y-1">
              <Label>Reason *</Label>
              <textarea
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={3}
                placeholder="State reason for rejection…"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowReject(false)}>Cancel</Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                onClick={() => rejectMutation.mutate({ id: journal.id, organizationId: orgId!, reason: rejectReason })}
              >
                {rejectMutation.isPending ? "Rejecting…" : "Confirm Reject"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="container mx-auto py-6 max-w-4xl space-y-6">
        {/* Action bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <StatusChip status={journal.status} />
          </div>
          {!editing && (
            <div className="flex flex-wrap gap-2">
              {canEdit     && <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4 mr-1" />Edit</Button>}
              {canSubmit   && !editing && (
                <Button size="sm" onClick={() => submitMutation.mutate({ id: journal.id, organizationId: orgId! })} disabled={submitMutation.isPending}>
                  <Send className="h-4 w-4 mr-1" />{submitMutation.isPending ? "Submitting…" : "Submit for Approval"}
                </Button>
              )}
              {canApprove  && <Button size="sm" onClick={() => approveMutation.mutate({ id: journal.id, organizationId: orgId! })} disabled={approveMutation.isPending}><CheckCircle className="h-4 w-4 mr-1" />{approveMutation.isPending ? "Approving…" : "Approve & Post"}</Button>}
              {canReject   && <Button size="sm" variant="destructive" onClick={() => setShowReject(true)}><XCircle className="h-4 w-4 mr-1" />Reject</Button>}
              {canWithdraw && <Button size="sm" variant="outline" onClick={() => withdrawMutation.mutate({ id: journal.id, organizationId: orgId! })} disabled={withdrawMutation.isPending}><Undo2 className="h-4 w-4 mr-1" />{withdrawMutation.isPending ? "Withdrawing…" : "Withdraw"}</Button>}
              {canDelete   && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => { if (confirm("Delete this journal? This cannot be undone.")) deleteMutation.mutate({ id: journal.id, organizationId: orgId! }) }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-1" />Delete
                </Button>
              )}
            </div>
          )}
        </div>

        {actionError && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{actionError}</div>
        )}

        {/* Edit mode */}
        {editing ? (
          <EditForm
            journal={journal}
            accounts={accounts}
            orgId={orgId!}
            onSaved={() => { setEditing(false); invalidate() }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            {/* Journal header card */}
            <Card>
              <CardHeader><CardTitle>Journal Details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div><p className="text-muted-foreground">Reference</p><p className="font-medium">{journal.reference}</p></div>
                <div><p className="text-muted-foreground">Date</p><p className="font-medium">{format(new Date(journal.date), "dd MMM yyyy")}</p></div>
                <div><p className="text-muted-foreground">Currency</p><p className="font-medium">{journal.currency}</p></div>
                {journal.submittedAt && <div><p className="text-muted-foreground">Submitted</p><p className="font-medium">{format(new Date(journal.submittedAt), "dd MMM yyyy HH:mm")}</p></div>}
                {journal.postedAt    && <div><p className="text-muted-foreground">Posted</p><p className="font-medium">{format(new Date(journal.postedAt), "dd MMM yyyy HH:mm")}</p></div>}
                {journal.notes && <div className="col-span-2 sm:col-span-3"><p className="text-muted-foreground">Notes</p><p className="whitespace-pre-wrap">{journal.notes}</p></div>}
                <div className="col-span-2 sm:col-span-3"><p className="text-muted-foreground">Description</p><p className="font-medium">{journal.description}</p></div>
              </CardContent>
            </Card>

            {/* Lines table */}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" />Journal Lines</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 pr-3 font-medium">Account</th>
                      <th className="text-left py-2 pr-3 font-medium">Description</th>
                      <th className="text-right py-2 pr-3 font-medium">Debit</th>
                      <th className="text-right py-2 font-medium">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {journal.lines.map((line: any) => (
                      <tr key={line.id}>
                        <td className="py-2.5 pr-3">
                          <span className="text-muted-foreground text-xs">[{line.account?.code}]</span>{" "}
                          {line.account?.name}
                        </td>
                        <td className="py-2.5 pr-3 text-muted-foreground">{line.description ?? "—"}</td>
                        <td className="py-2.5 pr-3 text-right">
                          {Number(line.debit) > 0
                            ? <span className="font-medium">{journal.currency} {Number(line.debit).toLocaleString("en-GB", { minimumFractionDigits: 2 })}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-2.5 text-right">
                          {Number(line.credit) > 0
                            ? <span className="font-medium">{journal.currency} {Number(line.credit).toLocaleString("en-GB", { minimumFractionDigits: 2 })}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-semibold">
                      <td colSpan={2} className="pt-2 text-right text-muted-foreground text-sm">Totals</td>
                      <td className="pt-2 pr-3 text-right">{journal.currency} {totalDebits.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</td>
                      <td className="pt-2 text-right">{journal.currency} {totalCredits.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</td>
                    </tr>
                    {Math.abs(totalDebits - totalCredits) < 0.01 ? (
                      <tr>
                        <td colSpan={4} className="pt-1 text-right text-xs text-green-600">
                          <CheckCircle className="inline h-3 w-3 mr-1" />Balanced
                        </td>
                      </tr>
                    ) : null}
                  </tfoot>
                </table>
              </CardContent>
            </Card>

            {/* Approval history */}
            {journal.approvalRequest?.actions?.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Approval History</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {journal.approvalRequest.actions.map((a: any) => (
                      <div key={a.id} className="flex items-start gap-3 text-sm">
                        <span className="text-muted-foreground w-36 shrink-0">{format(new Date(a.createdAt), "dd MMM yyyy HH:mm")}</span>
                        <Badge variant="outline">{ACTION_LABELS[a.actionType] ?? a.actionType}</Badge>
                        {a.notes && <span className="text-muted-foreground">{a.notes}</span>}
                      </div>
                    ))}
                  </div>

                  {journal.approvalRequest.status === "PENDING" && journal.approvalRequest.deadline && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Deadline: {format(new Date(journal.approvalRequest.deadline), "dd MMM yyyy HH:mm")}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Posted ledger note */}
            {journal.status === "POSTED" && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-green-700 text-sm">
                    <CheckCircle className="h-5 w-5" />
                    <span>
                      This journal has been posted to the ledger.{" "}
                      <Link href="/transactions/all" className="underline font-medium">View transactions →</Link>
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  )
}
