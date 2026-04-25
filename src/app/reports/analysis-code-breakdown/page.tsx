"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { trpc } from "@/lib/trpc-client"
import { RefreshCw, TrendingUp, TrendingDown, ArrowRight } from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts"
import Link from "next/link"

const BRAND = "#50B0E0"

export default function AnalysisCodeBreakdownPage() {
  const { data: orgs } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgs?.[0]?.id ?? ""

  const today = new Date()
  const y = today.getFullYear(), m = today.getMonth()

  const [periodStart, setPeriodStart] = useState(new Date(y, m, 1).toISOString().split("T")[0])
  const [periodEnd,   setPeriodEnd]   = useState(today.toISOString().split("T")[0])
  const [dimension,   setDimension]   = useState<"PROJECT" | "GRANT" | "RELATED_PARTY" | "WGA_CPID" | "CUSTOM">("PROJECT")
  const [compare,     setCompare]     = useState(false)

  const prevStart = new Date(new Date(periodStart).getFullYear(), new Date(periodStart).getMonth() - 1, 1)
  const prevEnd   = new Date(new Date(periodEnd).getFullYear(), new Date(periodEnd).getMonth() - 1 + 1, 0)

  const { data, isLoading } = trpc.tags.getAnalysisBreakdown.useQuery(
    {
      organizationId: orgId,
      periodStart:    new Date(periodStart),
      periodEnd:      new Date(periodEnd),
      dimension,
    },
    { enabled: !!orgId }
  )

  const { data: prevData } = trpc.tags.getAnalysisBreakdown.useQuery(
    {
      organizationId: orgId,
      periodStart:    prevStart,
      periodEnd:      prevEnd,
      dimension,
    },
    { enabled: !!orgId && compare }
  )

  const rows     = (data as any)?.rows ?? []
  const prevRows = (prevData as any)?.rows ?? []
  const totalNet = rows.reduce((s: number, r: any) => s + Number(r.net ?? 0), 0)

  const chartData = rows.map((r: any) => {
    const prev = prevRows.find((p: any) => p.code === r.code)
    return {
      name:     r.label ?? r.code ?? "—",
      Revenue:  Number(r.revenue ?? 0),
      Expenditure: Math.abs(Number(r.expenditure ?? 0)),
      "Prior Revenue":      compare ? Number(prev?.revenue ?? 0) : undefined,
      "Prior Expenditure":  compare ? Math.abs(Number(prev?.expenditure ?? 0)) : undefined,
    }
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 flex h-14 items-center">
          <h1 className="text-xl font-bold" style={{ color: "#1A1D24" }}>Analysis Code Breakdown</h1>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {/* Controls */}
        <Card className="rounded-xl">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <Label className="text-xs">Dimension</Label>
                <select className="border rounded-xl h-9 text-sm px-3 mt-1 block bg-white" value={dimension} onChange={(e) => setDimension(e.target.value as any)}>
                  <option value="PROJECT">Project</option>
                  <option value="GRANT">Grant</option>
                  <option value="RELATED_PARTY">Related Party</option>
                  <option value="WGA_CPID">WGA CPID</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Period start</Label>
                <Input type="date" className="h-9 rounded-xl mt-1 w-36" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Period end</Label>
                <Input type="date" className="h-9 rounded-xl mt-1 w-36" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer pb-1">
                <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
                Compare to prior period
              </label>
            </div>
          </CardContent>
        </Card>

        {isLoading
          ? <div className="py-16 text-center"><RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" /></div>
          : (
            <>
              {/* Chart */}
              <Card className="rounded-xl">
                <CardHeader><CardTitle className="text-sm">Revenue vs Expenditure by {dimension.replace(/_/g, " ")}</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartData} margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: any) => `£${Number(v).toLocaleString()}`} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="Revenue"      fill={BRAND}    radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Expenditure"  fill="#EF4444"  radius={[4, 4, 0, 0]} />
                      {compare && <Bar dataKey="Prior Revenue"     fill="#93C5FD" radius={[4, 4, 0, 0]} />}
                      {compare && <Bar dataKey="Prior Expenditure" fill="#FCA5A5" radius={[4, 4, 0, 0]} />}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Table */}
              <Card className="rounded-xl">
                <CardContent className="pt-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500">
                        <tr>
                          <th className="text-left px-4 py-3">Analysis code</th>
                          <th className="text-right px-4 py-3">Revenue</th>
                          <th className="text-right px-4 py-3">Expenditure</th>
                          <th className="text-right px-4 py-3">Net</th>
                          <th className="text-right px-4 py-3">% of total</th>
                          {compare && <th className="text-right px-4 py-3">vs prior</th>}
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.length === 0
                          ? <tr><td colSpan={7} className="text-center py-8 text-gray-400 text-xs italic">No tagged transactions for this period and dimension.</td></tr>
                          : rows.map((r: any, i: number) => {
                            const net       = Number(r.net ?? 0)
                            const pct       = totalNet !== 0 ? ((net / Math.abs(totalNet)) * 100) : 0
                            const prev      = prevRows.find((p: any) => p.code === r.code)
                            const prevNet   = prev ? Number(prev.net ?? 0) : null
                            const change    = prevNet != null && prevNet !== 0 ? ((net - prevNet) / Math.abs(prevNet)) * 100 : null
                            const drillUrl  = `/reports/tagged-transactions?${dimension.toLowerCase()}Id=${r.id ?? r.code}&dateFrom=${periodStart}&dateTo=${periodEnd}`
                            return (
                              <tr key={i} className="border-t hover:bg-gray-50">
                                <td className="px-4 py-3">
                                  <div className="font-medium">{r.label ?? r.code ?? "—"}</div>
                                  {r.code && r.label && <div className="text-xs text-gray-400 font-mono">{r.code}</div>}
                                </td>
                                <td className="px-4 py-3 text-right text-green-600">£{Number(r.revenue ?? 0).toLocaleString()}</td>
                                <td className="px-4 py-3 text-right text-red-500">£{Math.abs(Number(r.expenditure ?? 0)).toLocaleString()}</td>
                                <td className="px-4 py-3 text-right font-semibold">
                                  <span className={net >= 0 ? "text-green-600" : "text-red-500"}>
                                    {net >= 0 ? "" : "-"}£{Math.abs(net).toLocaleString()}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right text-gray-500">{pct.toFixed(1)}%</td>
                                {compare && (
                                  <td className="px-4 py-3 text-right">
                                    {change != null ? (
                                      <span className={`flex items-center justify-end gap-0.5 text-xs ${change >= 0 ? "text-green-600" : "text-red-500"}`}>
                                        {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                        {Math.abs(change).toFixed(1)}%
                                      </span>
                                    ) : <span className="text-gray-300 text-xs">—</span>}
                                  </td>
                                )}
                                <td className="px-4 py-3">
                                  <Link href={drillUrl} className="text-[#50B0E0] text-xs hover:underline flex items-center gap-1">
                                    Drill <ArrowRight className="h-3 w-3" />
                                  </Link>
                                </td>
                              </tr>
                            )
                          })
                        }
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )
        }
      </main>
    </div>
  )
}
