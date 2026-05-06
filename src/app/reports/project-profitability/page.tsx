"use client"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BarChart3, RefreshCw, AlertCircle } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { trpc } from "@/lib/trpc-client"

interface ProjectRow {
  id: string
  name: string
  status: string
  clientName: string
  revenue: number
  cost: number
  profit: number
  margin: number
}

function fmt(n: number) {
  return `£${n.toLocaleString()}`
}

export default function ProjectProfitabilityPage() {
  const { data: orgsData } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgsData?.[0]?.id ?? ""

  const { data: projectsData, isLoading } = trpc.projects.list.useQuery(
    { organizationId: orgId, limit: 50, page: 1 },
    { enabled: !!orgId }
  )

  const utils = trpc.useUtils()
  const [rows, setRows] = useState<ProjectRow[]>([])
  const [summariesLoading, setSummariesLoading] = useState(false)

  useEffect(() => {
    if (!projectsData?.projects.length || !orgId) return

    setSummariesLoading(true)
    Promise.all(
      projectsData.projects.map((project) =>
        utils.projects.getSummary.fetch({ organizationId: orgId, id: project.id }).then((summary) => ({
          id: project.id,
          name: project.name,
          status: project.status,
          clientName: (project as any).customer?.name ?? "—",
          revenue: Number(summary.totalRevenue),
          cost: Number(summary.totalCost),
          profit: Number(summary.margin),
          margin: Number(summary.totalRevenue) > 0
            ? Math.round((Number(summary.margin) / Number(summary.totalRevenue)) * 100)
            : 0,
        }))
      )
    )
      .then(setRows)
      .finally(() => setSummariesLoading(false))
  // projectsData.projects object identity changes on every refetch, so stabilise
  // on the comma-joined IDs string — reruns only when the actual project set changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectsData?.projects.map(p => p.id).join(","), orgId])

  const totals = rows.reduce(
    (a, r) => ({ revenue: a.revenue + r.revenue, cost: a.cost + r.cost, profit: a.profit + r.profit }),
    { revenue: 0, cost: 0, profit: 0 }
  )

  const chartData = rows.map((r) => ({
    name: r.name.split(" ")[0],
    revenue: r.revenue,
    cost:    r.cost,
    profit:  r.profit,
  }))

  if (isLoading || summariesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!projectsData?.projects.length) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-6 px-4">
          <h1 className="text-3xl font-bold tracking-tight mb-6" style={{ color: "#1A1D24" }}>Project Profitability</h1>
          <Card>
            <CardContent className="py-16 text-center">
              <AlertCircle className="mx-auto h-10 w-10 text-gray-300 mb-4" />
              <p className="text-gray-500">No projects found. Create projects to see profitability analysis.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#1A1D24" }}>Project Profitability</h1>
          <p className="text-gray-500">Revenue, cost, and margin analysis by project</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          {[
            { label: "Total Revenue", value: fmt(totals.revenue) },
            { label: "Total Cost",    value: fmt(totals.cost)    },
            { label: "Total Profit",  value: fmt(totals.profit)  },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-5">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-2xl font-bold">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {chartData.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />Revenue vs Cost by Project
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => `£${Number(v).toLocaleString()}`} />
                  <Legend />
                  <Bar dataKey="revenue" fill="#50B0E0" name="Revenue" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cost"    fill="#EF4444" name="Cost"    radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit"  fill="#10B981" name="Profit"  radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Project Breakdown</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="text-left py-3">Project</th>
                  <th className="text-left py-3">Client</th>
                  <th className="text-right py-3">Revenue</th>
                  <th className="text-right py-3">Cost</th>
                  <th className="text-right py-3">Profit</th>
                  <th className="text-right py-3">Margin</th>
                  <th className="text-center py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 font-medium">{r.name}</td>
                    <td className="py-3 text-gray-500">{r.clientName}</td>
                    <td className="text-right py-3">{fmt(r.revenue)}</td>
                    <td className="text-right py-3 text-red-500">{fmt(r.cost)}</td>
                    <td className={`text-right py-3 font-bold ${r.profit >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(r.profit)}</td>
                    <td className="text-right py-3">
                      <span className={`font-medium ${r.margin >= 40 ? "text-green-600" : r.margin >= 25 ? "text-orange-500" : "text-red-500"}`}>
                        {r.margin}%
                      </span>
                    </td>
                    <td className="text-center py-3">
                      <Badge className={
                        r.status === "COMPLETED" ? "bg-gray-100 text-gray-600" :
                        r.status === "ACTIVE"    ? "bg-blue-100 text-blue-800" :
                                                   "bg-yellow-100 text-yellow-800"
                      }>
                        {r.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
