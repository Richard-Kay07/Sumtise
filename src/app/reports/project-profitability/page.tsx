"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BarChart3 } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"

const projects = [
  { name: "Website Redesign", client: "ABC Corp", revenue: 18000, cost: 9500, profit: 8500, margin: 47, status: "Completed" },
  { name: "ERP Implementation", client: "XYZ Ltd", revenue: 45000, cost: 28000, profit: 17000, margin: 38, status: "Active" },
  { name: "Marketing Campaign", client: "Retail Co", revenue: 12000, cost: 5500, profit: 6500, margin: 54, status: "Completed" },
  { name: "Data Migration", client: "FinTech Inc", revenue: 22000, cost: 16000, profit: 6000, margin: 27, status: "Active" },
  { name: "Mobile App MVP", client: "StartupXYZ", revenue: 35000, cost: 19000, profit: 16000, margin: 46, status: "Active" },
]

const chartData = projects.map((p) => ({ name: p.name.split(" ")[0], revenue: p.revenue, cost: p.cost, profit: p.profit }))

export default function ProjectProfitabilityPage() {
  const totals = projects.reduce((a, p) => ({ revenue: a.revenue + p.revenue, cost: a.cost + p.cost, profit: a.profit + p.profit }), { revenue: 0, cost: 0, profit: 0 })
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#1A1D24" }}>Project Profitability</h1>
          <p className="text-gray-500">Revenue, cost, and margin analysis by project</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          {[
            { label: "Total Revenue", value: `£${totals.revenue.toLocaleString()}` },
            { label: "Total Cost", value: `£${totals.cost.toLocaleString()}` },
            { label: "Total Profit", value: `£${totals.profit.toLocaleString()}` },
          ].map((s) => (
            <Card key={s.label}><CardContent className="pt-5"><p className="text-xs text-gray-500">{s.label}</p><p className="text-2xl font-bold">{s.value}</p></CardContent></Card>
          ))}
        </div>

        <Card className="mb-6">
          <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Revenue vs Cost by Project</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `£${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => `£${Number(v).toLocaleString()}`} />
                <Legend />
                <Bar dataKey="revenue" fill="#50B0E0" name="Revenue" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cost" fill="#EF4444" name="Cost" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" fill="#10B981" name="Profit" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Project Breakdown</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-gray-500"><th className="text-left py-3">Project</th><th className="text-left py-3">Client</th><th className="text-right py-3">Revenue</th><th className="text-right py-3">Cost</th><th className="text-right py-3">Profit</th><th className="text-right py-3">Margin</th><th className="text-center py-3">Status</th></tr></thead>
              <tbody>{projects.map((p) => (
                <tr key={p.name} className="border-b hover:bg-gray-50">
                  <td className="py-3 font-medium">{p.name}</td>
                  <td className="py-3 text-gray-500">{p.client}</td>
                  <td className="text-right py-3">£{p.revenue.toLocaleString()}</td>
                  <td className="text-right py-3 text-red-500">£{p.cost.toLocaleString()}</td>
                  <td className="text-right py-3 font-bold text-green-600">£{p.profit.toLocaleString()}</td>
                  <td className="text-right py-3">
                    <span className={`font-medium ${p.margin >= 40 ? "text-green-600" : p.margin >= 25 ? "text-orange-500" : "text-red-500"}`}>{p.margin}%</span>
                  </td>
                  <td className="text-center py-3"><Badge className={p.status === "Completed" ? "bg-gray-100 text-gray-600" : "bg-blue-100 text-blue-800"}>{p.status}</Badge></td>
                </tr>
              ))}</tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
