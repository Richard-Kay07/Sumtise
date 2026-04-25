"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { trpc } from "@/lib/trpc-client"
import { formatCurrency } from "@/lib/utils"
import {
  FileText,
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  PieChart,
  Table,
  Filter,
  Share2,
  Loader2,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from "recharts"
import { Logo } from "@/components/logo"
import Link from "next/link"

const COLORS = ["#50B0E0", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#82CA9D"]

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<string>("profit-loss")
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  })

  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = organizations?.[0]?.id ?? ""

  const { data: cashFlow, isLoading: cashFlowLoading } = trpc.reports.getCashFlow.useQuery(
    { organizationId: orgId, startDate: dateRange.start, endDate: dateRange.end },
    { enabled: !!orgId && (selectedReport === "profit-loss" || selectedReport === "expense-analysis") }
  )

  const { data: trialBalance, isLoading: trialBalanceLoading } = trpc.reports.getTrialBalance.useQuery(
    { organizationId: orgId, asOfDate: dateRange.end },
    { enabled: !!orgId && selectedReport === "expense-analysis" }
  )

  const reports = [
    { id: "income-statement", name: "Income Statement", description: "Comprehensive income statement", icon: FileText, color: "text-blue-600", href: "/reports/income-statement" },
    { id: "profit-loss", name: "Profit & Loss", description: "Revenue, expenses, and profit analysis", icon: TrendingUp, color: "text-green-600" },
    { id: "balance-sheet", name: "Balance Sheet", description: "Assets, liabilities, and equity", icon: BarChart3, color: "text-blue-600", href: "/reports/balance-sheet" },
    { id: "cash-flow", name: "Cash Flow", description: "Operating, investing, and financing activities", icon: DollarSign, color: "text-purple-600", href: "/reports/cashflow" },
    { id: "aged-receivables", name: "Aged Receivables", description: "Outstanding invoices by aging period", icon: Calendar, color: "text-orange-600", href: "/reports/aged-receivables" },
    { id: "aged-payables", name: "Aged Payables", description: "Outstanding bills by aging period", icon: Calendar, color: "text-orange-600", href: "/reports/aged-payables" },
    { id: "expense-analysis", name: "Expense Analysis", description: "Expense breakdown by account", icon: PieChart, color: "text-red-600" },
    { id: "trial-balance", name: "Trial Balance", description: "Account balances and totals", icon: Table, color: "text-gray-600", href: "/reports/trial-balance" },
    { id: "budget-variance", name: "Budget Variance", description: "Compare actual vs. budgeted amounts", icon: FileText, color: "text-blue-600", href: "/reports/budget-variance" },
    { id: "cost-analysis", name: "Cost Analysis", description: "Detailed cost breakdowns and analysis", icon: PieChart, color: "text-red-600", href: "/reports/cost-analysis" },
  ]

  const renderReport = () => {
    switch (selectedReport) {
      case "profit-loss": {
        if (cashFlowLoading) return <LoadingCard />
        const revenue = cashFlow?.operating.revenue ?? 0
        const expenses = cashFlow?.operating.expenses ?? 0
        const net = cashFlow?.operating.netCashFlow ?? 0
        const chartData = [
          { name: "Revenue", value: revenue },
          { name: "Expenses", value: expenses },
          { name: "Net", value: net },
        ]
        return (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Revenue</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(revenue)}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Expenses</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-red-600">{formatCurrency(expenses)}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Net Operating</CardTitle></CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${net >= 0 ? "text-blue-600" : "text-red-600"}`}>
                    {formatCurrency(net)}
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader><CardTitle>Period Summary</CardTitle><CardDescription>{dateRange.start} – {dateRange.end}</CardDescription></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    <Bar dataKey="value" fill="#50B0E0" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <p className="text-xs text-muted-foreground text-center">
              For a full month-by-month breakdown, use{" "}
              <Link href="/reports/income-statement" className="underline text-[#50B0E0]">Income Statement</Link>.
            </p>
          </div>
        )
      }

      case "expense-analysis": {
        if (trialBalanceLoading) return <LoadingCard />
        const expenseAccounts = (trialBalance?.groupedByType?.["EXPENSE"] ?? [])
          .filter((a: any) => a.debit > 0 || a.credit > 0)
          .map((a: any, i: number) => ({
            name: a.accountName,
            value: Math.abs(a.balance),
            color: COLORS[i % COLORS.length],
          }))
          .sort((a: any, b: any) => b.value - a.value)
          .slice(0, 8)

        const total = expenseAccounts.reduce((s: number, a: any) => s + a.value, 0)

        if (expenseAccounts.length === 0) {
          return (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No expense transactions found for the selected period.
              </CardContent>
            </Card>
          )
        }

        return (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Expense Categories</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                      <Pie data={expenseAccounts} cx="50%" cy="50%" innerRadius={60} outerRadius={120} paddingAngle={5} dataKey="value">
                        {expenseAccounts.map((_: any, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Expense Breakdown</CardTitle><CardDescription>As of {dateRange.end}</CardDescription></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {expenseAccounts.map((a: any, i: number) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{a.name}</span>
                          <span className="font-medium">{formatCurrency(a.value)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full"
                            style={{ width: `${total > 0 ? (a.value / total) * 100 : 0}%`, backgroundColor: a.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )
      }

      default:
        return (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Select a report to view</h3>
              <p className="text-muted-foreground">Choose from the available reports in the sidebar</p>
            </CardContent>
          </Card>
        )
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <a className="mr-6 flex items-center space-x-2" href="/">
              <Logo size={32} showText={true} />
            </a>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="w-full flex-1 md:w-auto md:flex-none">
              <h1 className="text-2xl font-bold">Financial Reports</h1>
            </div>
            <nav className="flex items-center space-x-2">
              <Button variant="outline"><Download className="mr-2 h-4 w-4" />Export</Button>
              <Button variant="outline"><Share2 className="mr-2 h-4 w-4" />Share</Button>
            </nav>
          </div>
        </div>
      </div>

      <main className="container mx-auto py-6">
        <div className="grid gap-6 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Reports</CardTitle>
                <CardDescription>Select a report to view</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {reports.map((report) => {
                    if (report.href) {
                      return (
                        <Link key={report.id} href={report.href}>
                          <Button variant="ghost" className="w-full justify-start">
                            <report.icon className={`mr-2 h-4 w-4 ${report.color}`} />
                            <div className="text-left">
                              <div className="font-medium text-sm">{report.name}</div>
                            </div>
                          </Button>
                        </Link>
                      )
                    }
                    return (
                      <Button
                        key={report.id}
                        variant={selectedReport === report.id ? "default" : "ghost"}
                        className="w-full justify-start"
                        onClick={() => setSelectedReport(report.id)}
                      >
                        <report.icon className={`mr-2 h-4 w-4 ${report.color}`} />
                        <div className="text-left">
                          <div className="font-medium text-sm">{report.name}</div>
                        </div>
                      </Button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader><CardTitle>Date Range</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input id="start-date" type="date" value={dateRange.start} onChange={(e) => setDateRange((p) => ({ ...p, start: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="end-date">End Date</Label>
                    <Input id="end-date" type="date" value={dateRange.end} onChange={(e) => setDateRange((p) => ({ ...p, end: e.target.value }))} />
                  </div>
                  <Button className="w-full">
                    <Filter className="mr-2 h-4 w-4" />Apply Filter
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">{renderReport()}</div>
        </div>
      </main>
    </div>
  )
}

function LoadingCard() {
  return (
    <Card>
      <CardContent className="py-12 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  )
}
