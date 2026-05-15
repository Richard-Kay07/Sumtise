"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  CalendarDays,
  Repeat,
  Receipt,
} from "lucide-react"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts"
import { trpc } from "@/lib/trpc-client"
import { formatCurrency } from "@/lib/utils"

function fmt(n: number, currency = "GBP") {
  return formatCurrency(n, currency)
}

function pct(n: number) {
  const sign = n >= 0 ? "+" : ""
  return `${sign}${n.toFixed(1)}%`
}

const HIST_COLOR = "#94a3b8"
const FORECAST_REVENUE = "#50B0E0"
const FORECAST_EXPENSE = "#EF4444"
const FORECAST_PROFIT = "#10B981"

// Custom tooltip distinguishing historical vs forecast bars
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm min-w-[160px]">
      <p className="font-semibold text-gray-800 mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex justify-between gap-4">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="font-medium">{fmt(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function ForecastingPage() {
  const [historicalMonths, setHistoricalMonths] = useState(6)
  const [forecastMonths, setForecastMonths] = useState(6)

  const { data: orgsData } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgsData?.[0]?.id ?? ""

  const { data, isLoading, isError, refetch } = trpc.forecasts.getCashFlowForecast.useQuery(
    { organizationId: orgId, historicalMonths, forecastMonths },
    { enabled: !!orgId }
  )

  // Merge historical + forecast into one chart dataset
  const combinedChart = [
    ...(data?.historical ?? []).map(m => ({
      label: m.label,
      Revenue: m.revenue,
      Expenses: m.expenses,
      Profit: m.profit,
      _type: "historical",
    })),
    ...(data?.forecast ?? []).map(m => ({
      label: m.label,
      Revenue: m.revenue,
      Expenses: m.expenses,
      Profit: m.profit,
      _type: "forecast",
    })),
  ]

  // Cash inflow chart (forecast only) — shows how cash will land
  const inflowChart = (data?.forecast ?? []).map(m => ({
    label: m.label,
    "Projected Revenue": m.revenue - m.recurringRevenue,
    "Recurring Revenue": m.recurringRevenue,
    "Outstanding Collections": m.outstandingCollection,
    "Scheduled Bills": -m.scheduledBills,
  }))

  const s = data?.summary

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-red-400 mb-3" />
          <p className="text-gray-600">Failed to load forecasting data.</p>
        </div>
      </div>
    )
  }

  const noData = !data?.historical.some(m => m.revenue > 0 || m.expenses > 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#1A1D24" }}>
              Forecasting
            </h1>
            <p className="text-gray-500">
              Revenue &amp; expense projections based on historical trends and scheduled items
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>History:</span>
              {[3, 6, 12].map(n => (
                <button
                  key={n}
                  onClick={() => setHistoricalMonths(n)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    historicalMonths === n
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {n}m
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Forecast:</span>
              {[3, 6, 12].map(n => (
                <button
                  key={n}
                  onClick={() => setForecastMonths(n)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    forecastMonths === n
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {n}m
                </button>
              ))}
            </div>
            <button
              onClick={() => refetch()}
              className="p-2 rounded border border-gray-300 bg-white hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        </div>

        {noData && (
          <Card className="mb-6 border-yellow-200 bg-yellow-50">
            <CardContent className="py-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0" />
              <p className="text-sm text-yellow-800">
                No historical transactions found for the selected period. Forecasts are based on
                recurring invoices and outstanding receivables only.
              </p>
            </CardContent>
          </Card>
        )}

        {/* KPI Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <KpiCard
            label="Avg Monthly Revenue"
            value={fmt(s?.avgMonthlyRevenue ?? 0)}
            trend={s?.revenuetrend === "up" ? "up" : s?.revenuetrend === "down" ? "down" : "flat"}
            sub="based on last months"
          />
          <KpiCard
            label="Avg Monthly Expenses"
            value={fmt(s?.avgMonthlyExpenses ?? 0)}
            trend={s?.expenseTrend === "up" ? "up" : s?.expenseTrend === "down" ? "down" : "flat"}
            sub="based on last months"
            invertTrend
          />
          <KpiCard
            label={`${forecastMonths}m Forecast Revenue`}
            value={fmt(s?.totalForecastRevenue ?? 0)}
            sub={`incl. ${fmt(s?.totalRecurringRevenue ?? 0)} recurring`}
          />
          <KpiCard
            label="Outstanding Receivables"
            value={fmt(s?.totalOutstandingCollection ?? 0)}
            sub={`${s?.activeRecurringTemplates ?? 0} active recurring templates`}
          />
        </div>

        {/* Main chart: Historical + Forecast */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Revenue &amp; Expenses — Historical + Projected
              <Badge variant="outline" className="ml-2 text-xs">
                {historicalMonths}m history · {forecastMonths}m forecast
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Legend for historical vs forecast */}
            <div className="flex items-center gap-6 text-xs text-gray-500 mb-3">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: HIST_COLOR }} />
                Historical (actual)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block opacity-80" style={{ background: FORECAST_REVENUE }} />
                Forecast revenue
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block opacity-80" style={{ background: FORECAST_EXPENSE }} />
                Forecast expenses
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block opacity-80" style={{ background: FORECAST_PROFIT }} />
                Projected profit
              </span>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={combinedChart} barGap={2} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  x={data?.historical[data.historical.length - 1]?.label}
                  stroke="#cbd5e1"
                  strokeDasharray="4 4"
                  label={{ value: "Today →", position: "insideTopRight", fontSize: 10, fill: "#94a3b8" }}
                />
                <Bar
                  dataKey="Revenue"
                  fill={FORECAST_REVENUE}
                  radius={[3, 3, 0, 0]}
                  opacity={0.85}
                />
                <Bar
                  dataKey="Expenses"
                  fill={FORECAST_EXPENSE}
                  radius={[3, 3, 0, 0]}
                  opacity={0.85}
                />
                <Bar
                  dataKey="Profit"
                  fill={FORECAST_PROFIT}
                  radius={[3, 3, 0, 0]}
                  opacity={0.85}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2 mb-6">
          {/* Cash inflow breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="h-4 w-4 text-green-500" />
                Cash Flow Breakdown (Forecast)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={inflowChart} barGap={1} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#e2e8f0" />
                  <Bar dataKey="Projected Revenue" fill="#50B0E0" radius={[2, 2, 0, 0]} stackId="in" />
                  <Bar dataKey="Recurring Revenue" fill="#818cf8" radius={[2, 2, 0, 0]} stackId="in" />
                  <Bar dataKey="Outstanding Collections" fill="#34d399" radius={[2, 2, 0, 0]} stackId="in" />
                  <Bar dataKey="Scheduled Bills" fill="#fca5a5" radius={[0, 0, 2, 2]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Cumulative cash position */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4 text-blue-500" />
                Cumulative Cash Position (Forecast)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={data?.forecast ?? []}>
                  <defs>
                    <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#50B0E0" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#50B0E0" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => [fmt(v), "Cumulative Cash"]} />
                  <ReferenceLine y={0} stroke="#EF4444" strokeDasharray="4 4" />
                  <Area
                    type="monotone"
                    dataKey="cumulativeCash"
                    stroke="#50B0E0"
                    fill="url(#cashGradient)"
                    strokeWidth={2}
                    name="Cumulative Cash"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Month-by-month breakdown table */}
        <Card>
          <CardHeader>
            <CardTitle>Month-by-Month Projections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-gray-500 text-xs uppercase tracking-wide">
                    <th className="text-left py-3 pr-4">Month</th>
                    <th className="text-right py-3 px-3">Revenue</th>
                    <th className="text-right py-3 px-3">Recurring</th>
                    <th className="text-right py-3 px-3">Collections</th>
                    <th className="text-right py-3 px-3">Expenses</th>
                    <th className="text-right py-3 px-3">Bills Due</th>
                    <th className="text-right py-3 px-3">Net Profit</th>
                    <th className="text-right py-3 pl-3">Cum. Cash</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.historical.map(m => (
                    <tr key={m.month} className="border-b bg-gray-50 hover:bg-gray-100 text-gray-500">
                      <td className="py-2.5 pr-4 font-medium text-gray-600">{m.label}</td>
                      <td className="text-right px-3">{fmt(m.revenue)}</td>
                      <td className="text-right px-3 text-gray-400">—</td>
                      <td className="text-right px-3 text-gray-400">—</td>
                      <td className="text-right px-3">{fmt(m.expenses)}</td>
                      <td className="text-right px-3 text-gray-400">—</td>
                      <td className={`text-right px-3 font-semibold ${m.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {fmt(m.profit)}
                      </td>
                      <td className="text-right pl-3 text-gray-400">—</td>
                    </tr>
                  ))}
                  {data?.forecast.map(m => (
                    <tr key={m.month} className="border-b hover:bg-blue-50">
                      <td className="py-2.5 pr-4 font-medium">
                        <div className="flex items-center gap-1.5">
                          {m.label}
                          <Badge className="text-[10px] py-0 px-1.5 bg-blue-100 text-blue-700">forecast</Badge>
                        </div>
                      </td>
                      <td className="text-right px-3">{fmt(m.revenue)}</td>
                      <td className="text-right px-3 text-indigo-600">{m.recurringRevenue > 0 ? fmt(m.recurringRevenue) : "—"}</td>
                      <td className="text-right px-3 text-green-600">{m.outstandingCollection > 0 ? fmt(m.outstandingCollection) : "—"}</td>
                      <td className="text-right px-3">{fmt(m.expenses)}</td>
                      <td className="text-right px-3 text-red-500">{m.scheduledBills > 0 ? fmt(m.scheduledBills) : "—"}</td>
                      <td className={`text-right px-3 font-semibold ${m.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {fmt(m.profit)}
                      </td>
                      <td className={`text-right pl-3 font-bold ${m.cumulativeCash >= 0 ? "text-blue-700" : "text-red-600"}`}>
                        {fmt(m.cumulativeCash)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold bg-gray-50">
                    <td className="py-3 pr-4">Forecast Total</td>
                    <td className="text-right px-3">{fmt(s?.totalForecastRevenue ?? 0)}</td>
                    <td className="text-right px-3 text-indigo-600">{fmt(s?.totalRecurringRevenue ?? 0)}</td>
                    <td className="text-right px-3 text-green-600">{fmt(s?.totalOutstandingCollection ?? 0)}</td>
                    <td className="text-right px-3">{fmt(s?.totalForecastExpenses ?? 0)}</td>
                    <td className="text-right px-3 text-red-500">—</td>
                    <td className={`text-right px-3 ${(s?.totalForecastProfit ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {fmt(s?.totalForecastProfit ?? 0)}
                    </td>
                    <td className="text-right pl-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-4">
              Projections use a {historicalMonths}-month linear trend. Recurring revenue and outstanding invoices/bills are applied on their scheduled dates. This is not financial advice.
            </p>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}

function KpiCard({
  label, value, trend, sub, invertTrend,
}: {
  label: string
  value: string
  trend?: "up" | "down" | "flat"
  sub?: string
  invertTrend?: boolean
}) {
  const isPositive = invertTrend ? trend === "down" : trend === "up"
  const isNegative = invertTrend ? trend === "up" : trend === "down"

  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs text-gray-500 mb-1">{label}</p>
        <div className="flex items-center gap-2">
          <p className="text-2xl font-bold">{value}</p>
          {trend && trend !== "flat" && (
            <span className={`flex items-center text-xs font-medium ${isPositive ? "text-green-600" : isNegative ? "text-red-500" : "text-gray-400"}`}>
              {trend === "up"
                ? <ArrowUpRight className="h-4 w-4" />
                : <ArrowDownRight className="h-4 w-4" />}
            </span>
          )}
          {trend === "flat" && <Minus className="h-3 w-3 text-gray-400" />}
        </div>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )
}
