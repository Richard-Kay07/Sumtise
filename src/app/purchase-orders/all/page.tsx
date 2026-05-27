"use client"

import { useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { Plus, RefreshCw, ShoppingCart } from "lucide-react"
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

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function PurchaseOrdersPage() {
  const { orgId } = useOrganization()
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)

  const { data, isLoading, refetch } = trpc.purchaseOrders.getAll.useQuery(
    { organizationId: orgId ?? "", status: statusFilter as any },
    { enabled: !!orgId }
  )

  const pos = data?.purchaseOrders ?? []

  const STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "PARTIALLY_RECEIVED", "FULLY_RECEIVED", "CLOSED"]

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        crumbs={[{ label: "Accounting", href: "/accounting" }]}
        title="Purchase Orders"
      />
      <main className="container mx-auto py-6 space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-1.5 flex-wrap">
            <Button
              size="sm"
              variant={!statusFilter ? "default" : "outline"}
              onClick={() => setStatusFilter(undefined)}
            >
              All
            </Button>
            {STATUSES.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "outline"}
                onClick={() => setStatusFilter(s)}
              >
                {statusLabel(s)}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Link href="/purchase-orders/new">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> New PO
              </Button>
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Purchase Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 text-center">
                <RefreshCw className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : pos.length === 0 ? (
              <div className="py-12 text-center">
                <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No purchase orders found</p>
                <Link href="/purchase-orders/new">
                  <Button size="sm" className="mt-4"><Plus className="h-4 w-4 mr-1" /> Create your first PO</Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 pr-4 font-medium">PO Number</th>
                      <th className="text-left py-2 pr-4 font-medium">Vendor</th>
                      <th className="text-left py-2 pr-4 font-medium">Date</th>
                      <th className="text-left py-2 pr-4 font-medium">Status</th>
                      <th className="text-right py-2 pr-4 font-medium">Total</th>
                      <th className="text-right py-2 font-medium">Received %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pos.map((po: any) => {
                      const orderedQty  = po.lines.reduce((s: number, l: any) => s + Number(l.quantity), 0)
                      const receivedQty = po.lines.reduce((s: number, l: any) => s + Number(l.receivedQty), 0)
                      const pct = orderedQty > 0 ? Math.round((receivedQty / orderedQty) * 100) : 0
                      return (
                        <tr key={po.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-2.5 pr-4">
                            <Link href={`/purchase-orders/${po.id}`} className="font-medium text-primary hover:underline">
                              {po.poNumber}
                            </Link>
                          </td>
                          <td className="py-2.5 pr-4 text-muted-foreground">{po.vendor?.name}</td>
                          <td className="py-2.5 pr-4 text-muted-foreground">{format(new Date(po.date), "dd MMM yyyy")}</td>
                          <td className="py-2.5 pr-4">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOUR[po.status] ?? ""}`}>
                              {statusLabel(po.status)}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 text-right font-medium">
                            {po.currency} {Number(po.total).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 text-right text-muted-foreground">{pct}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
