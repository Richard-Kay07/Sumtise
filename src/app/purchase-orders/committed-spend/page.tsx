"use client"

import { useState } from "react"
import { BarChart3, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { trpc } from "@/lib/trpc-client"
import { useOrganization } from "@/contexts/organization-context"

export default function CommittedSpendPage() {
  const { orgId } = useOrganization()
  const now = new Date()
  const [periodStart, setPeriodStart] = useState(`${now.getFullYear()}-04-01`)
  const [periodEnd,   setPeriodEnd]   = useState(now.toISOString().split("T")[0])

  const { data, isLoading, refetch } = trpc.purchaseOrders.committedSpend.useQuery(
    { organizationId: orgId ?? "", periodStart, periodEnd },
    { enabled: !!orgId }
  )

  const fmt = (n: number) => n.toLocaleString("en-GB", { minimumFractionDigits: 2 })

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        crumbs={[{ label: "Purchase Orders", href: "/purchase-orders/all" }]}
        title="Committed Spend Report"
      />
      <main className="container mx-auto py-6 space-y-6 max-w-5xl">
        {/* Period filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-1">
                <label className="text-sm font-medium">Period Start</label>
                <input
                  type="date"
                  className="border rounded-md px-3 py-2 text-sm bg-background"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Period End</label>
                <input
                  type="date"
                  className="border rounded-md px-3 py-2 text-sm bg-background"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
              <Button size="sm" variant="outline" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-1" /> Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="py-12 text-center"><RefreshCw className="mx-auto h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : data ? (
          <>
            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "Total Committed (PO'd)", value: `£${fmt(data.totals.totalCommitted)}`, colour: "text-blue-700" },
                { label: "Total Invoiced", value: `£${fmt(data.totals.totalInvoiced)}`, colour: "text-orange-700" },
                { label: "Uninvoiced Commitment", value: `£${fmt(data.totals.outstanding)}`, colour: "text-red-700" },
              ].map(({ label, value, colour }) => (
                <Card key={label}>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className={`text-xl font-semibold mt-0.5 ${colour}`}>{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* By account table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Budget vs Committed vs Invoiced
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {data.byAccount.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4">No budget data for this period. Set up budgets and approved POs to see the breakdown.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 pr-3 font-medium">Account</th>
                        <th className="text-right py-2 pr-3 font-medium">Budgeted</th>
                        <th className="text-right py-2 pr-3 font-medium">Committed</th>
                        <th className="text-right py-2 pr-3 font-medium">Invoiced</th>
                        <th className="text-right py-2 pr-3 font-medium">Remaining</th>
                        <th className="text-right py-2 font-medium">Utilisation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.byAccount.map((row: any) => {
                        const over = row.committed > row.budgeted
                        return (
                          <tr key={row.account.id} className={over ? "bg-red-50" : ""}>
                            <td className="py-2.5 pr-3">
                              <span className="text-muted-foreground text-xs">[{row.account.code}]</span>{" "}
                              {row.account.name}
                            </td>
                            <td className="py-2.5 pr-3 text-right">£{fmt(row.budgeted)}</td>
                            <td className={`py-2.5 pr-3 text-right font-medium ${over ? "text-red-600" : ""}`}>£{fmt(row.committed)}</td>
                            <td className="py-2.5 pr-3 text-right">£{fmt(row.invoiced)}</td>
                            <td className={`py-2.5 pr-3 text-right ${row.remaining < 0 ? "text-red-600 font-medium" : "text-green-700"}`}>
                              £{fmt(row.remaining)}
                            </td>
                            <td className="py-2.5 text-right">
                              {row.utilisation !== null ? (
                                <span className={row.utilisation > 100 ? "text-red-600 font-medium" : ""}>
                                  {row.utilisation}%
                                </span>
                              ) : "—"}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </main>
    </div>
  )
}
