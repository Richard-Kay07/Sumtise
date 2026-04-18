"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { trpc } from "@/lib/trpc-client"
import { formatCurrency, formatDate } from "@/lib/utils"
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
  Eye,
  Share2
} from "lucide-react"
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar,
  PieChart as RechartsPieChart,
  Cell
} from "recharts"
import { Logo } from "@/components/logo"
import Link from "next/link"

// Sample data for reports
const profitLossData = [
  { month: "Jan", revenue: 12000, expenses: 8000, profit: 4000 },
  { month: "Feb", revenue: 15000, expenses: 9000, profit: 6000 },
  { month: "Mar", revenue: 18000, expenses: 10000, profit: 8000 },
  { month: "Apr", revenue: 16000, expenses: 8500, profit: 7500 },
  { month: "May", revenue: 20000, expenses: 12000, profit: 8000 },
  { month: "Jun", revenue: 22000, expenses: 11000, profit: 11000 },
]

const balanceSheetData = {
  assets: {
    current: 45000,
    fixed: 120000,
    total: 165000
  },
  liabilities: {
    current: 25000,
    longTerm: 80000,
    total: 105000
  },
  equity: {
    retained: 45000,
    capital: 15000,
    total: 60000
  }
}

const cashFlowData = [
  { month: "Jan", operating: 4000, investing: -2000, financing: 1000, net: 3000 },
  { month: "Feb", operating: 6000, investing: -1500, financing: 0, net: 4500 },
  { month: "Mar", operating: 8000, investing: -3000, financing: 2000, net: 7000 },
  { month: "Apr", operating: 7500, investing: -1000, financing: -500, net: 6000 },
  { month: "May", operating: 8000, investing: -2500, financing: 1000, net: 6500 },
  { month: "Jun", operating: 11000, investing: -2000, financing: 0, net: 9000 },
]

const agedReceivables = [
  { customer: "ABC Corp", current: 5000, days30: 2000, days60: 1000, days90: 500, total: 8500 },
  { customer: "XYZ Ltd", current: 3000, days30: 1500, days60: 0, days90: 0, total: 4500 },
  { customer: "DEF Inc", current: 0, days30: 0, days60: 2000, days90: 1000, total: 3000 },
]

const expenseCategories = [
  { name: "Office Supplies", amount: 4000, percentage: 25 },
  { name: "Travel", amount: 3000, percentage: 19 },
  { name: "Marketing", amount: 2500, percentage: 16 },
  { name: "Utilities", amount: 2000, percentage: 13 },
  { name: "Professional Services", amount: 2000, percentage: 13 },
  { name: "Other", amount: 1500, percentage: 9 },
]

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<string>("profit-loss")
  const [dateRange, setDateRange] = useState({
    start: "2024-01-01",
    end: "2024-06-30"
  })

  // Get user's organizations
  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()

  const reports = [
    {
      id: "income-statement",
      name: "Income Statement",
      description: "Comprehensive income statement with date parameters",
      icon: FileText,
      color: "text-blue-600",
      href: "/reports/income-statement"
    },
    {
      id: "profit-loss",
      name: "Profit & Loss",
      description: "Revenue, expenses, and profit analysis",
      icon: TrendingUp,
      color: "text-green-600"
    },
    {
      id: "balance-sheet",
      name: "Balance Sheet",
      description: "Assets, liabilities, and equity with date parameters",
      icon: BarChart3,
      color: "text-blue-600",
      href: "/reports/balance-sheet"
    },
    {
      id: "cash-flow",
      name: "Cash Flow",
      description: "Operating, investing, and financing activities",
      icon: DollarSign,
      color: "text-purple-600",
      href: "/reports/cashflow"
    },
    {
      id: "aged-receivables",
      name: "Aged Receivables",
      description: "Outstanding invoices by aging period",
      icon: Calendar,
      color: "text-orange-600",
      href: "/reports/aged-receivables"
    },
    {
      id: "aged-payables",
      name: "Aged Payables",
      description: "Outstanding bills by aging period",
      icon: Calendar,
      color: "text-orange-600",
      href: "/reports/aged-payables"
    },
    {
      id: "expense-analysis",
      name: "Expense Analysis",
      description: "Expense breakdown by category",
      icon: PieChart,
      color: "text-red-600"
    },
    {
      id: "trial-balance",
      name: "Trial Balance",
      description: "Account balances and totals",
      icon: Table,
      color: "text-gray-600",
      href: "/reports/trial-balance"
    },
    {
      id: "budget-variance",
      name: "Budget Variance",
      description: "Compare actual vs. budgeted amounts",
      icon: FileText,
      color: "text-blue-600",
      href: "/reports/budget-variance"
    },
    {
      id: "cost-analysis",
      name: "Cost Analysis",
      description: "Detailed cost breakdowns and analysis",
      icon: PieChart,
      color: "text-red-600",
      href: "/reports/cost-analysis"
    }
  ]

  const renderReport = () => {
    switch (selectedReport) {
      case "profit-loss":
        return (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(profitLossData.reduce((sum, item) => sum + item.revenue, 0))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {formatCurrency(profitLossData.reduce((sum, item) => sum + item.expenses, 0))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrency(profitLossData.reduce((sum, item) => sum + item.profit, 0))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Profit & Loss Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={profitLossData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Line type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} name="Revenue" />
                    <Line type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2} name="Expenses" />
                    <Line type="monotone" dataKey="profit" stroke="#3B82F6" strokeWidth={2} name="Profit" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )

      case "balance-sheet":
        return (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-green-600">Assets</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span>Current Assets</span>
                      <span className="font-bold">{formatCurrency(balanceSheetData.assets.current)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fixed Assets</span>
                      <span className="font-bold">{formatCurrency(balanceSheetData.assets.fixed)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold">
                      <span>Total Assets</span>
                      <span>{formatCurrency(balanceSheetData.assets.total)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-red-600">Liabilities</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span>Current Liabilities</span>
                      <span className="font-bold">{formatCurrency(balanceSheetData.liabilities.current)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Long-term Liabilities</span>
                      <span className="font-bold">{formatCurrency(balanceSheetData.liabilities.longTerm)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold">
                      <span>Total Liabilities</span>
                      <span>{formatCurrency(balanceSheetData.liabilities.total)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-blue-600">Equity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span>Retained Earnings</span>
                      <span className="font-bold">{formatCurrency(balanceSheetData.equity.retained)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Share Capital</span>
                      <span className="font-bold">{formatCurrency(balanceSheetData.equity.capital)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold">
                      <span>Total Equity</span>
                      <span>{formatCurrency(balanceSheetData.equity.total)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )

      case "cash-flow":
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Cash Flow Statement</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={cashFlowData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Bar dataKey="operating" fill="#10B981" name="Operating" />
                    <Bar dataKey="investing" fill="#F59E0B" name="Investing" />
                    <Bar dataKey="financing" fill="#3B82F6" name="Financing" />
                    <Bar dataKey="net" fill="#8B5CF6" name="Net Cash Flow" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )

      case "aged-receivables":
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Aged Receivables Report</CardTitle>
                <CardDescription>
                  Outstanding invoices grouped by aging period
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Customer</th>
                        <th className="text-right p-2">Current</th>
                        <th className="text-right p-2">1-30 Days</th>
                        <th className="text-right p-2">31-60 Days</th>
                        <th className="text-right p-2">61-90 Days</th>
                        <th className="text-right p-2 font-bold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agedReceivables.map((item, index) => (
                        <tr key={index} className="border-b">
                          <td className="p-2 font-medium">{item.customer}</td>
                          <td className="p-2 text-right">{formatCurrency(item.current)}</td>
                          <td className="p-2 text-right">{formatCurrency(item.days30)}</td>
                          <td className="p-2 text-right">{formatCurrency(item.days60)}</td>
                          <td className="p-2 text-right">{formatCurrency(item.days90)}</td>
                          <td className="p-2 text-right font-bold">{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                      <tr className="border-t font-bold">
                        <td className="p-2">Total</td>
                        <td className="p-2 text-right">
                          {formatCurrency(agedReceivables.reduce((sum, item) => sum + item.current, 0))}
                        </td>
                        <td className="p-2 text-right">
                          {formatCurrency(agedReceivables.reduce((sum, item) => sum + item.days30, 0))}
                        </td>
                        <td className="p-2 text-right">
                          {formatCurrency(agedReceivables.reduce((sum, item) => sum + item.days60, 0))}
                        </td>
                        <td className="p-2 text-right">
                          {formatCurrency(agedReceivables.reduce((sum, item) => sum + item.days90, 0))}
                        </td>
                        <td className="p-2 text-right">
                          {formatCurrency(agedReceivables.reduce((sum, item) => sum + item.total, 0))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case "expense-analysis":
        return (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Expense Categories</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <RechartsPieChart.Pie
                        data={expenseCategories}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
                        paddingAngle={5}
                        dataKey="amount"
                      >
                        {expenseCategories.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </RechartsPieChart.Pie>
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Expense Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {expenseCategories.map((category, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">{category.name}</span>
                          <span className="text-sm font-medium">{formatCurrency(category.amount)}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="h-2 rounded-full" 
                            style={{ 
                              width: `${category.percentage}%`,
                              backgroundColor: COLORS[index % COLORS.length]
                            }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )

      default:
        return (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Select a report to view</h3>
              <p className="text-muted-foreground">
                Choose from the available reports in the sidebar
              </p>
            </CardContent>
          </Card>
        )
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button variant="outline">
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
            </nav>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto py-6">
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Report Selection */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Reports</CardTitle>
                <CardDescription>
                  Select a report to view
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {reports.map((report) => {
                    if (report.href) {
                      return (
                        <Link key={report.id} href={report.href}>
                          <Button
                            variant="ghost"
                            className="w-full justify-start"
                          >
                            <report.icon className={`mr-2 h-4 w-4 ${report.color}`} />
                            <div className="text-left">
                              <div className="font-medium">{report.name}</div>
                              <div className="text-xs text-muted-foreground">{report.description}</div>
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
                          <div className="font-medium">{report.name}</div>
                          <div className="text-xs text-muted-foreground">{report.description}</div>
                        </div>
                      </Button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Date Range */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Date Range</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-date">End Date</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    />
                  </div>
                  <Button className="w-full">
                    <Filter className="mr-2 h-4 w-4" />
                    Apply Filter
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Report Content */}
          <div className="lg:col-span-3">
            {renderReport()}
          </div>
        </div>
      </main>
    </div>
  )
}
