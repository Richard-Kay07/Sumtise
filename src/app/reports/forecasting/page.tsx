"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"

const data = [
  { month: "Jan", actual: 18000, forecast: 18500, expenses: 11000 },
  { month: "Feb", actual: 21000, forecast: 20000, expenses: 13000 },
  { month: "Mar", actual: 19000, forecast: 21000, expenses: 12000 },
  { month: "Apr", actual: 24000, forecast: 23000, expenses: 14000 },
  { month: "May", actual: null, forecast: 25000, expenses: 14500 },
  { month: "Jun", actual: null, forecast: 27000, expenses: 15000 },
  { month: "Jul", actual: null, forecast: 28500, expenses: 15500 },
  { month: "Aug", actual: null, forecast: 29000, expenses: 16000 },
]

const kpis = [
  { label: "Forecast Revenue (FY)", value: "£312,000", trend: "+18%" },
  { label: "Forecast Expenses (FY)", value: "£168,000", trend: "+8%" },
  { label: "Projected Net Profit", value: "£144,000", trend: "+28%" },
  { label: "Revenue Confidence", value: "87%", trend: "High" },
]

export default function ForecastingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#1A1D24" }}>Forecasting</h1>
          <p className="text-gray-500">Revenue and expense projections for the current financial year</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-4 mb-6">
          {kpis.map((k) => (
            <Card key={k.label}>
              <CardContent className="pt-5">
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className="text-xl font-bold">{k.value}</p>
                <p className="text-xs text-green-600 mt-1">{k.trend}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />Revenue Forecast vs Actual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `£${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => v ? `£${Number(v).toLocaleString()}` : "N/A"} />
                <Legend />
                <Line type="monotone" dataKey="actual" stroke="#50B0E0" strokeWidth={2} name="Actual Revenue" connectNulls={false} />
                <Line type="monotone" dataKey="forecast" stroke="#10B981" strokeWidth={2} strokeDasharray="5 5" name="Forecast Revenue" />
                <Line type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2} strokeDasharray="3 3" name="Forecast Expenses" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Monthly Forecast Detail</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-gray-500"><th className="text-left py-3">Month</th><th className="text-right py-3">Actual Revenue</th><th className="text-right py-3">Forecast Revenue</th><th className="text-right py-3">Forecast Expenses</th><th className="text-right py-3">Projected Profit</th></tr></thead>
              <tbody>{data.map((d) => (
                <tr key={d.month} className="border-b hover:bg-gray-50">
                  <td className="py-3 font-medium">{d.month}</td>
                  <td className="text-right py-3">{d.actual ? `£${d.actual.toLocaleString()}` : <span className="text-gray-300">—</span>}</td>
                  <td className="text-right py-3" style={{ color: "#50B0E0" }}>£{d.forecast.toLocaleString()}</td>
                  <td className="text-right py-3 text-red-500">£{d.expenses.toLocaleString()}</td>
                  <td className="text-right py-3 font-bold text-green-600">£{(d.forecast - d.expenses).toLocaleString()}</td>
                </tr>
              ))}</tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
