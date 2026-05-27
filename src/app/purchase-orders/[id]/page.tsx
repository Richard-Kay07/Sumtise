"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import {
  CheckCircle, XCircle, Package, Link2, BarChart3,
  RefreshCw, ArrowLeft, Pencil,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { trpc } from "@/lib/trpc-client"
import { useOrganization } from "@/contexts/organization-context"

const STATUS_COLOUR: Record<string, string> = {
  DRAFT:              "bg-gray-100 text-gray-700",
  SUBMITTED:          "bg-yellow-100 text-yellow-700",
  APPROVED:           "bg-blue-100 text-blue-700",
  REJECTED:           "bg-red-100 text-red-700",
  PARTIALLY_RECEIVED: "bg-orange-100 text-orange-700",
  FULLY_RECEIVED:     "bg-green-100 text-green-700",
  CLOSED:             "bg-slate-100 text-slate-600",
  CANCELLED:          "bg-red-50 text-red-500",
}

function sl(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) }

function ReceiveModal({ po, onClose, orgId }: { po: any; onClose: () => void; orgId: string }) {
  const utils = trpc.useUtils()
  const [receipts, setReceipts] = useState<Record<string, number>>(
    Object.fromEntries(po.lines.map((l: any) => [l.id, 0]))
  )
  const [error, setError] = useState<string | null>(null)
  const receive = trpc.purchaseOrders.receive.useMutation({
    onSuccess: () => { utils.purchaseOrders.getById.invalidate(); onClose() },
    onError:   (e) => setError(e.message),
  })

  function submit() {
    const entries = Object.entries(receipts).filter(([, qty]) => qty > 0)
    if (entries.length === 0) { setError("Enter at least one receipt quantity"); return }
    receive.mutate({
      organizationId: orgId,
      id: po.id,
      receipts: entries.map(([lineId, qty]) => ({ lineId, qty })),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold">Record Goods Receipt</h2>
        {error && <div className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</div>}
        <div className="space-y-2">
          {po.lines.map((l: any) => {
            const remaining = Number(l.quantity) - Number(l.receivedQty)
            return (
              <div key={l.id} className="flex items-center gap-3 text-sm">
                <span className="flex-1 truncate">{l.description}</span>
                <span className="text-muted-foreground w-24 text-right">
                  {Number(l.receivedQty)}/{Number(l.quantity)} rcvd
                </span>
                <input
                  type="number"
                  min={0}
                  max={remaining}
                  step="0.0001"
                  className="w-24 border rounded px-2 py-1 text-sm bg-background"
                  value={receipts[l.id] ?? 0}
                  onChange={(e) => setReceipts((r) => ({ ...r, [l.id]: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            )
          })}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={receive.isPending}>
            {receive.isPending ? "Saving…" : "Confirm Receipt"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function MatchBillModal({ po, onClose, orgId }: { po: any; onClose: () => void; orgId: string }) {
  const utils = trpc.useUtils()
  const [billId, setBillId] = useState("")
  const [error, setError]   = useState<string | null>(null)

  const { data: billsData } = trpc.bills.getAll.useQuery(
    { organizationId: orgId, vendorId: po.vendorId, page: 1, limit: 100 },
    { enabled: !!orgId }
  )

  const bills = ((billsData as any)?.bills ?? []).filter((b: any) => !b.purchaseOrderId || b.purchaseOrderId === po.id)

  const match = trpc.purchaseOrders.matchBill.useMutation({
    onSuccess: () => { utils.purchaseOrders.getById.invalidate(); onClose() },
    onError:   (e) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold">Match Purchase Invoice</h2>
        {error && <div className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</div>}
        <div className="space-y-1">
          <label className="text-sm font-medium">Select Bill</label>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            value={billId}
            onChange={(e) => setBillId(e.target.value)}
          >
            <option value="">Choose bill…</option>
            {bills.map((b: any) => (
              <option key={b.id} value={b.id}>
                {b.billNumber} — {b.currency} {Number(b.total).toFixed(2)} ({b.status})
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            disabled={!billId || match.isPending}
            onClick={() => match.mutate({ organizationId: orgId, id: po.id, billId })}
          >
            {match.isPending ? "Linking…" : "Match Bill"}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function PurchaseOrderDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { orgId } = useOrganization()
  const utils = trpc.useUtils()

  const [showReceive,   setShowReceive]   = useState(false)
  const [showMatchBill, setShowMatchBill] = useState(false)
  const [rejectReason,  setRejectReason]  = useState("")
  const [showReject,    setShowReject]    = useState(false)

  const { data: po, isLoading } = trpc.purchaseOrders.getById.useQuery(
    { id: params.id, organizationId: orgId ?? "" },
    { enabled: !!orgId && !!params.id }
  )

  const submit  = trpc.purchaseOrders.submit.useMutation({ onSuccess: () => utils.purchaseOrders.getById.invalidate() })
  const approve = trpc.purchaseOrders.approve.useMutation({ onSuccess: () => utils.purchaseOrders.getById.invalidate() })
  const reject  = trpc.purchaseOrders.reject.useMutation({ onSuccess: () => { utils.purchaseOrders.getById.invalidate(); setShowReject(false) } })
  const close   = trpc.purchaseOrders.close.useMutation({ onSuccess: () => utils.purchaseOrders.getById.invalidate() })

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )

  if (!po) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Purchase order not found.</p>
    </div>
  )

  const orderedTotal  = Number(po.total)
  const invoicedTotal = (po.bills ?? []).filter((b: any) => b.status !== "CANCELLED").reduce((s: number, b: any) => s + Number(b.total), 0)
  const receivedPct   = po.lines.length > 0
    ? Math.round((po.lines.reduce((s: any, l: any) => s + Number(l.receivedQty), 0) / po.lines.reduce((s: any, l: any) => s + Number(l.quantity), 0)) * 100)
    : 0

  const canSubmit  = po.status === "DRAFT"
  const canApprove = ["SUBMITTED", "DRAFT"].includes(po.status)
  const canReject  = po.status === "SUBMITTED"
  const canReceive = ["APPROVED", "PARTIALLY_RECEIVED"].includes(po.status)
  const canMatch   = ["APPROVED", "PARTIALLY_RECEIVED", "FULLY_RECEIVED"].includes(po.status)
  const canClose   = ["APPROVED", "PARTIALLY_RECEIVED", "FULLY_RECEIVED"].includes(po.status)
  const canEdit    = ["DRAFT", "REJECTED"].includes(po.status)

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        crumbs={[{ label: "Purchase Orders", href: "/purchase-orders/all" }]}
        title={po.poNumber}
      />

      {showReceive   && <ReceiveModal   po={po} orgId={orgId!} onClose={() => setShowReceive(false)} />}
      {showMatchBill && <MatchBillModal po={po} orgId={orgId!} onClose={() => setShowMatchBill(false)} />}

      {showReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold">Reject Purchase Order</h2>
            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              rows={3}
              placeholder="Reason for rejection…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowReject(false)}>Cancel</Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={!rejectReason.trim() || reject.isPending}
                onClick={() => reject.mutate({ organizationId: orgId!, id: po.id, reason: rejectReason })}
              >
                {reject.isPending ? "Rejecting…" : "Confirm Reject"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="container mx-auto py-6 space-y-6 max-w-5xl">
        {/* Header bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLOUR[po.status] ?? ""}`}>
              {sl(po.status)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit    && <Link href={`/purchase-orders/${po.id}/edit`}><Button size="sm" variant="outline"><Pencil className="h-4 w-4 mr-1" />Edit</Button></Link>}
            {canSubmit  && <Button size="sm" onClick={() => submit.mutate({ organizationId: orgId!, id: po.id })} disabled={submit.isPending}>{submit.isPending ? "Submitting…" : "Submit for Approval"}</Button>}
            {canApprove && <Button size="sm" variant="default" onClick={() => approve.mutate({ organizationId: orgId!, id: po.id })} disabled={approve.isPending}><CheckCircle className="h-4 w-4 mr-1" />{approve.isPending ? "Approving…" : "Approve"}</Button>}
            {canReject  && <Button size="sm" variant="destructive" onClick={() => setShowReject(true)}><XCircle className="h-4 w-4 mr-1" />Reject</Button>}
            {canReceive && <Button size="sm" variant="outline" onClick={() => setShowReceive(true)}><Package className="h-4 w-4 mr-1" />Receive Goods</Button>}
            {canMatch   && <Button size="sm" variant="outline" onClick={() => setShowMatchBill(true)}><Link2 className="h-4 w-4 mr-1" />Match Bill</Button>}
            {canClose   && <Button size="sm" variant="outline" onClick={() => close.mutate({ organizationId: orgId!, id: po.id })} disabled={close.isPending}>Close PO</Button>}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "PO Total", value: `${po.currency} ${orderedTotal.toLocaleString("en-GB", { minimumFractionDigits: 2 })}` },
            { label: "Invoiced", value: `${po.currency} ${invoicedTotal.toLocaleString("en-GB", { minimumFractionDigits: 2 })}` },
            { label: "Outstanding", value: `${po.currency} ${(orderedTotal - invoicedTotal).toLocaleString("en-GB", { minimumFractionDigits: 2 })}` },
            { label: "Received", value: `${receivedPct}%` },
          ].map(({ label, value }) => (
            <Card key={label}>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-semibold mt-0.5">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* PO info */}
        <Card>
          <CardHeader><CardTitle>Purchase Order Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div><p className="text-muted-foreground">Vendor</p><p className="font-medium">{po.vendor?.name}</p></div>
            <div><p className="text-muted-foreground">PO Date</p><p className="font-medium">{format(new Date(po.date), "dd MMM yyyy")}</p></div>
            {po.expectedDelivery && <div><p className="text-muted-foreground">Expected Delivery</p><p className="font-medium">{format(new Date(po.expectedDelivery), "dd MMM yyyy")}</p></div>}
            {po.approvedAt && <div><p className="text-muted-foreground">Approved</p><p className="font-medium">{format(new Date(po.approvedAt), "dd MMM yyyy")}</p></div>}
            {po.notes && <div className="col-span-2 sm:col-span-3"><p className="text-muted-foreground">Notes</p><p>{po.notes}</p></div>}
          </CardContent>
        </Card>

        {/* Lines */}
        <Card>
          <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 pr-3 font-medium">Description</th>
                  <th className="text-left py-2 pr-3 font-medium">Account</th>
                  <th className="text-right py-2 pr-3 font-medium">Qty</th>
                  <th className="text-right py-2 pr-3 font-medium">Received</th>
                  <th className="text-right py-2 pr-3 font-medium">Unit Price</th>
                  <th className="text-right py-2 pr-3 font-medium">Tax %</th>
                  <th className="text-right py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {po.lines.map((line: any) => (
                  <tr key={line.id}>
                    <td className="py-2.5 pr-3">{line.description}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground text-xs">
                      {line.account ? `[${line.account.code}] ${line.account.name}` : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-right">{Number(line.quantity).toLocaleString()}</td>
                    <td className="py-2.5 pr-3 text-right">
                      <span className={Number(line.receivedQty) >= Number(line.quantity) ? "text-green-600 font-medium" : "text-muted-foreground"}>
                        {Number(line.receivedQty).toLocaleString()}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right">{po.currency} {Number(line.unitPrice).toFixed(2)}</td>
                    <td className="py-2.5 pr-3 text-right">{Number(line.taxRate).toFixed(0)}%</td>
                    <td className="py-2.5 text-right font-medium">{po.currency} {Number(line.total).toLocaleString("en-GB", { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t">
                  <td colSpan={6} className="pt-2 text-right text-muted-foreground text-sm">Subtotal</td>
                  <td className="pt-2 text-right font-medium">{po.currency} {Number(po.subtotal).toLocaleString("en-GB", { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td colSpan={6} className="text-right text-muted-foreground text-sm">Tax</td>
                  <td className="text-right font-medium">{po.currency} {Number(po.taxAmount).toLocaleString("en-GB", { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td colSpan={6} className="text-right font-semibold">Total</td>
                  <td className="text-right font-semibold">{po.currency} {Number(po.total).toLocaleString("en-GB", { minimumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>

        {/* Matched bills */}
        {po.bills?.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" />Matched Bills</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-3 font-medium">Bill Number</th>
                    <th className="text-left py-2 pr-3 font-medium">Date</th>
                    <th className="text-left py-2 pr-3 font-medium">Status</th>
                    <th className="text-right py-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {po.bills.map((b: any) => (
                    <tr key={b.id}>
                      <td className="py-2.5 pr-3 font-medium text-primary">
                        <Link href={`/expenses/${b.id}`} className="hover:underline">{b.billNumber}</Link>
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground">{format(new Date(b.date), "dd MMM yyyy")}</td>
                      <td className="py-2.5 pr-3"><Badge variant="outline">{b.status}</Badge></td>
                      <td className="py-2.5 text-right font-medium">{po.currency} {Number(b.total).toLocaleString("en-GB", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Approval trail */}
        {po.approvalRequest?.actions?.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Approval History</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {po.approvalRequest.actions.map((a: any) => (
                  <div key={a.id} className="flex items-start gap-3 text-sm">
                    <span className="text-muted-foreground w-36 shrink-0">{format(new Date(a.createdAt), "dd MMM yyyy HH:mm")}</span>
                    <Badge variant="outline">{a.actionType}</Badge>
                    {a.notes && <span className="text-muted-foreground">{a.notes}</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
