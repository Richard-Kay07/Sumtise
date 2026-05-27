"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { trpc } from "@/lib/trpc-client"
import { useOrganization } from "@/contexts/organization-context"

interface Line {
  description: string
  quantity:    number
  unitPrice:   number
  taxRate:     number
  accountId:   string
}

const EMPTY_LINE: Line = { description: "", quantity: 1, unitPrice: 0, taxRate: 20, accountId: "" }

export default function NewPurchaseOrderPage() {
  const router   = useRouter()
  const { orgId } = useOrganization()

  const [vendorId, setVendorId]       = useState("")
  const [date, setDate]               = useState(new Date().toISOString().split("T")[0])
  const [expectedDelivery, setExpDel] = useState("")
  const [currency, setCurrency]       = useState("GBP")
  const [notes, setNotes]             = useState("")
  const [lines, setLines]             = useState<Line[]>([{ ...EMPTY_LINE }])
  const [error, setError]             = useState<string | null>(null)

  const { data: vendorsData } = trpc.vendors.getAll.useQuery(
    { organizationId: orgId ?? "", page: 1, limit: 200 },
    { enabled: !!orgId }
  )

  const { data: allAccounts } = trpc.chartOfAccounts.getAll.useQuery(
    { organizationId: orgId ?? "" },
    { enabled: !!orgId }
  )

  const vendors  = (vendorsData as any)?.vendors ?? []
  const accounts = (allAccounts ?? []).filter((a: any) => a.type === "EXPENSE")

  const createMutation = trpc.purchaseOrders.create.useMutation({
    onSuccess: (po) => router.push(`/purchase-orders/${po.id}`),
    onError:   (e) => setError(e.message),
  })

  function updateLine(i: number, field: keyof Line, value: string | number) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  }

  function addLine() { setLines((prev) => [...prev, { ...EMPTY_LINE }]) }
  function removeLine(i: number) { setLines((prev) => prev.filter((_, idx) => idx !== i)) }

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
  const tax      = lines.reduce((s, l) => s + l.quantity * l.unitPrice * (l.taxRate / 100), 0)
  const total    = subtotal + tax

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!orgId) return
    if (!vendorId) { setError("Please select a vendor"); return }
    const invalid = lines.find((l) => !l.description || l.quantity <= 0 || l.unitPrice < 0)
    if (invalid) { setError("Please complete all line items"); return }
    createMutation.mutate({
      organizationId: orgId,
      vendorId,
      date,
      expectedDelivery: expectedDelivery || undefined,
      currency,
      notes: notes || undefined,
      lines: lines.map((l) => ({
        description: l.description,
        quantity:    l.quantity,
        unitPrice:   l.unitPrice,
        taxRate:     l.taxRate,
        accountId:   l.accountId || undefined,
      })),
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        crumbs={[
          { label: "Purchase Orders", href: "/purchase-orders/all" },
        ]}
        title="New Purchase Order"
      />
      <main className="container mx-auto py-6 max-w-4xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <Card>
            <CardHeader><CardTitle>PO Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Vendor *</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  required
                >
                  <option value="">Select vendor…</option>
                  {vendors.map((v: any) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Currency</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  {["GBP", "USD", "EUR"].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">PO Date *</label>
                <input
                  type="date"
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Expected Delivery</label>
                <input
                  type="date"
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={expectedDelivery}
                  onChange={(e) => setExpDel(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="text-sm font-medium">Notes</label>
                <textarea
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Line Items</CardTitle>
              <Button type="button" size="sm" variant="outline" onClick={addLine}>
                <Plus className="h-4 w-4 mr-1" /> Add Line
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-2 font-medium min-w-[180px]">Description</th>
                    <th className="text-left py-2 pr-2 font-medium w-20">Qty</th>
                    <th className="text-left py-2 pr-2 font-medium w-28">Unit Price</th>
                    <th className="text-left py-2 pr-2 font-medium w-20">Tax %</th>
                    <th className="text-left py-2 pr-2 font-medium min-w-[150px]">Account</th>
                    <th className="text-right py-2 font-medium w-28">Total</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lines.map((line, i) => {
                    const lineTotal = line.quantity * line.unitPrice * (1 + line.taxRate / 100)
                    return (
                      <tr key={i}>
                        <td className="py-2 pr-2">
                          <input
                            className="w-full border rounded px-2 py-1 text-sm bg-background"
                            value={line.description}
                            onChange={(e) => updateLine(i, "description", e.target.value)}
                            placeholder="Description"
                            required
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            min="0.0001"
                            step="0.0001"
                            className="w-full border rounded px-2 py-1 text-sm bg-background"
                            value={line.quantity}
                            onChange={(e) => updateLine(i, "quantity", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="w-full border rounded px-2 py-1 text-sm bg-background"
                            value={line.unitPrice}
                            onChange={(e) => updateLine(i, "unitPrice", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            className="w-full border rounded px-2 py-1 text-sm bg-background"
                            value={line.taxRate}
                            onChange={(e) => updateLine(i, "taxRate", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <select
                            className="w-full border rounded px-2 py-1 text-sm bg-background"
                            value={line.accountId}
                            onChange={(e) => updateLine(i, "accountId", e.target.value)}
                          >
                            <option value="">None</option>
                            {accounts.map((a: any) => (
                              <option key={a.id} value={a.id}>[{a.code}] {a.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 pr-2 text-right font-medium">
                          {currency} {lineTotal.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={lines.length === 1}
                            onClick={() => removeLine(i)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div className="mt-4 flex justify-end">
                <div className="w-64 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{currency} {subtotal.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{currency} {tax.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between font-semibold border-t pt-1"><span>Total</span><span>{currency} {total.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</span></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create Purchase Order"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
