"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc-client"
import { BarChart3, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react"

const BRAND = "#50B0E0"
const fmt = (n: number | string) =>
  `£${Number(n).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

export default function BudgetVariancePage() {
  const { data: orgs } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgs?.[0]?.id ?? ""

  const [selectedBudgetId, setSelectedBudgetId] = useState("")

  const { data: budgetsData } = trpc.budgets.list.useQuery(
    { organizationId: orgId, status: "ACTIVE", page: 1, limit: 50 },
    { enabled: !!orgId }
  )

  const { data: varianceData, isLoading } = trpc.budgets.getVarianceReport.useQuery(
    { organizationId: orgId, budgetId: selectedBudgetId },
    { enabled: !!orgId && !!selectedBudgetId }
  )

  const budgets  = (budgetsData as any)?.budgets ?? []
  const report   = varianceData as any
  const lines    = report?.lines ?? []
  const summary  = report?.summary

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex h-14 items-center">
          <BarChart3 className="h-5 w-5 mr-2" style={{ color: BRAND }} />
          <h1 className="text-xl font-bold" style={{ color: "#1A1D24" }}>Budget Variance</h1>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        {/* Budget selector */}
        <Card className="rounded-xl">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium text-gray-700 shrink-0">Select Budget:</p>
              <select
                value={selectedBudgetId}
                onChange={e => setSelectedBudgetId(e.target.value)}
                className="h-9 px-3 text-sm rounded-xl border border-gray-200 bg-white flex-1 max-w-sm"
              >
                <option value="">Choose a budget…</option>
                {budgets.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name} ({b.budgetType})</option>
                ))}
              </select>
              {budgets.length === 0 && orgId && (
                <p className="text-xs text-gray-400">No active budgets. <a href="/budgets" className="text-blue-500 hover:underline">Create one</a>.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {selectedBudgetId && (
          <>
            {/* Summary cards */}
            {summary && (
              <div className="grid gap-4 sm:grid-cols-4">
                {[
                  { label: "Total Budgeted",    value: fmt(summary.totalBudgeted) },
                  { label: "Total Actual",      value: fmt(summary.totalActual) },
                  { label: "Total Variance",    value: fmt(summary.totalVariance), positive: Number(summary.totalVariance) >= 0 },
                  { label: "Over-Budget Lines", value: summary.overBudgetLines.toString(), warn: summary.overBudgetLines > 0 },
                ].map(c => (
                  <Card key={c.label} className="rounded-xl">
                    <CardContent className="pt-5">
                      <p className="text-xs text-gray-500">{c.label}</p>
                      <p className={`text-2xl font-bold mt-1 ${
                        c.warn ? "text-red-600" :
                        c.positive === true ? "text-green-600" :
                        c.positive === false ? "text-red-600" : ""
                      }`}>{c.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Lines table */}
            <Card className="rounded-xl overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  {report?.budget?.name}
                  {report?.budget?.status && (
                    <Badge className="text-xs bg-green-100 text-green-700">{report.budget.status}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              {isLoading ? (
                <CardContent className="py-8 text-center text-gray-400 text-sm">Loading…</CardContent>
              ) : lines.length === 0 ? (
                <CardContent className="py-8 text-center text-gray-400 text-sm">No budget lines found.</CardContent>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr className="text-left text-xs text-gray-500">
                        <th className="px-4 py-3">Account</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3 text-right">Budgeted</th>
                        <th className="px-4 py-3 text-right">Actual</th>
                        <th className="px-4 py-3 text-right">Variance</th>
                        <th className="px-4 py-3 text-right">Var %</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line: any) => {
                        const variance    = Number(line.variance)
                        const varPct      = line.variancePercent != null ? Number(line.variancePercent) : null
                        const isOverBudget = line.isOverBudget
                        return (
                          <tr key={line.id} className={`border-b last:border-0 ${isOverBudget ? "bg-red-50/40" : ""}`}>
                            <td className="px-4 py-3 text-xs font-mono text-gray-500">
                              [{line.account?.code ?? "—"}] {line.account?.name}
                            </td>
                            <td className="px-4 py-3 text-gray-600">{line.description ?? "—"}</td>
                            <td className="px-4 py-3 text-right font-mono">{fmt(Number(line.budgetedAmount))}</td>
                            <td className="px-4 py-3 text-right font-mono">{fmt(Number(line.actualAmount))}</td>
                            <td className={`px-4 py-3 text-right font-mono font-semibold ${isOverBudget ? "text-red-600" : "text-green-600"}`}>
                              {isOverBudget ? "(" : ""}{fmt(Math.abs(variance))}{isOverBudget ? ")" : ""}
                            </td>
                            <td className="px-4 py-3 text-right text-xs">
                              {varPct != null ? (
                                <span className={isOverBudget ? "text-red-600" : "text-green-600"}>
                                  {Math.abs(varPct).toFixed(1)}%
                                </span>
                              ) : "—"}
                            </td>
                            <td className="px-4 py-3">
                              {isOverBudget
                                ? <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                                : variance > 0
                                  ? <TrendingDown className="h-3.5 w-3.5 text-green-500" />
                                  : null}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
