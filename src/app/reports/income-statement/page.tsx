"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc-client"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Logo } from "@/components/logo"
import { 
  Download, 
  Calendar, 
  TrendingUp, 
  TrendingDown,
  FileText,
  RefreshCw,
  Printer
} from "lucide-react"
import { useDebounce } from "@/lib/hooks/useDebounce"

interface IncomeStatementData {
  revenue: {
    sales: number
    otherIncome: number
    total: number
  }
  costOfGoodsSold: {
    materials: number
    labor: number
    overhead: number
    total: number
  }
  grossProfit: number
  operatingExpenses: {
    salaries: number
    rent: number
    utilities: number
    marketing: number
    depreciation: number
    other: number
    total: number
  }
  operatingIncome: number
  otherIncomeExpense: {
    interestIncome: number
    interestExpense: number
    otherIncome: number
    otherExpense: number
    total: number
  }
  netIncome: number
}

export default function IncomeStatementPage() {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 1)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [isLoading, setIsLoading] = useState(false)

  // Debounce date changes to avoid excessive API calls
  const debouncedStartDate = useDebounce(startDate, 500)
  const debouncedEndDate = useDebounce(endDate, 500)

  // Get user's organizations
  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()

  // Fetch transactions for the date range
  const { data: transactionsData, isLoading: transactionsLoading } = trpc.transactions.getAll.useQuery(
    {
      organizationId: organizations?.[0]?.id || "",
      page: 1,
      limit: 1000,
      sortBy: "date",
      sortOrder: "asc",
      startDate: debouncedStartDate ? new Date(debouncedStartDate) : undefined,
      endDate: debouncedEndDate ? new Date(debouncedEndDate) : undefined,
    },
    { 
      enabled: !!organizations?.[0]?.id && !!debouncedStartDate && !!debouncedEndDate,
      refetchOnWindowFocus: false
    }
  )

  // Fetch invoices for revenue calculation
  const { data: invoicesData } = trpc.invoices.getAll.useQuery(
    {
      organizationId: organizations?.[0]?.id || "",
      page: 1,
      limit: 1000,
      sortBy: "date",
      sortOrder: "asc",
    },
    { 
      enabled: !!organizations?.[0]?.id,
      refetchOnWindowFocus: false
    }
  )

  // Calculate Income Statement data from transactions and invoices
  const incomeStatement = useMemo(() => {
    if (!transactionsData?.transactions || !invoicesData?.invoices) {
      return null
    }

    const transactions = transactionsData.transactions
    const invoices = invoicesData.invoices

    // Filter transactions by date range
    const filteredTransactions = transactions.filter(t => {
      const tDate = new Date(t.date)
      const start = new Date(debouncedStartDate)
      const end = new Date(debouncedEndDate)
      return tDate >= start && tDate <= end
    })

    // Filter invoices by date range
    const filteredInvoices = invoices.filter(inv => {
      const invDate = new Date(inv.date)
      const start = new Date(debouncedStartDate)
      const end = new Date(debouncedEndDate)
      return invDate >= start && invDate <= end
    })

    // Calculate Revenue (from invoices)
    const sales = filteredInvoices
      .filter(inv => inv.status === "PAID" || inv.status === "SENT")
      .reduce((sum, inv) => sum + Number(inv.total), 0)

    // Calculate revenue from transactions (credit entries to revenue accounts)
    const revenueTransactions = filteredTransactions.filter(t => 
      t.type === "CREDIT" && t.account?.category === "REVENUE"
    )
    const otherIncome = revenueTransactions.reduce((sum, t) => sum + Number(t.amount), 0)

    // Calculate Cost of Goods Sold (from transactions)
    const cogsTransactions = filteredTransactions.filter(t => 
      t.account?.category === "COST_OF_GOODS_SOLD" || t.account?.category === "EXPENSE"
    )
    const materials = cogsTransactions
      .filter(t => t.account?.name?.toLowerCase().includes("materials") || 
                   t.account?.name?.toLowerCase().includes("inventory"))
      .reduce((sum, t) => sum + Number(t.amount), 0)
    const labor = cogsTransactions
      .filter(t => t.account?.name?.toLowerCase().includes("labor") || 
                   t.account?.name?.toLowerCase().includes("wages"))
      .reduce((sum, t) => sum + Number(t.amount), 0)
    const overhead = cogsTransactions
      .filter(t => !t.account?.name?.toLowerCase().includes("materials") && 
                   !t.account?.name?.toLowerCase().includes("labor") &&
                   !t.account?.name?.toLowerCase().includes("wages"))
      .reduce((sum, t) => sum + Number(t.amount), 0)

    // Calculate Operating Expenses
    const expenseTransactions = filteredTransactions.filter(t => 
      t.type === "DEBIT" && 
      (t.account?.category === "EXPENSE" || t.account?.category === "OPERATING_EXPENSE")
    )

    const salaries = expenseTransactions
      .filter(t => t.account?.name?.toLowerCase().includes("salary") || 
                   t.account?.name?.toLowerCase().includes("wages"))
      .reduce((sum, t) => sum + Number(t.amount), 0)
    const rent = expenseTransactions
      .filter(t => t.account?.name?.toLowerCase().includes("rent"))
      .reduce((sum, t) => sum + Number(t.amount), 0)
    const utilities = expenseTransactions
      .filter(t => t.account?.name?.toLowerCase().includes("utility"))
      .reduce((sum, t) => sum + Number(t.amount), 0)
    const marketing = expenseTransactions
      .filter(t => t.account?.name?.toLowerCase().includes("marketing") || 
                   t.account?.name?.toLowerCase().includes("advertising"))
      .reduce((sum, t) => sum + Number(t.amount), 0)
    const depreciation = expenseTransactions
      .filter(t => t.account?.name?.toLowerCase().includes("depreciation"))
      .reduce((sum, t) => sum + Number(t.amount), 0)
    const other = expenseTransactions
      .filter(t => !t.account?.name?.toLowerCase().includes("salary") &&
                   !t.account?.name?.toLowerCase().includes("wages") &&
                   !t.account?.name?.toLowerCase().includes("rent") &&
                   !t.account?.name?.toLowerCase().includes("utility") &&
                   !t.account?.name?.toLowerCase().includes("marketing") &&
                   !t.account?.name?.toLowerCase().includes("advertising") &&
                   !t.account?.name?.toLowerCase().includes("depreciation"))
      .reduce((sum, t) => sum + Number(t.amount), 0)

    // Calculate Other Income/Expense
    const interestIncome = filteredTransactions
      .filter(t => t.type === "CREDIT" && t.account?.name?.toLowerCase().includes("interest"))
      .reduce((sum, t) => sum + Number(t.amount), 0)
    const interestExpense = filteredTransactions
      .filter(t => t.type === "DEBIT" && t.account?.name?.toLowerCase().includes("interest"))
      .reduce((sum, t) => sum + Number(t.amount), 0)
    const otherIncomeItems = filteredTransactions
      .filter(t => t.type === "CREDIT" && 
                   t.account?.category !== "REVENUE" &&
                   !t.account?.name?.toLowerCase().includes("interest"))
      .reduce((sum, t) => sum + Number(t.amount), 0)
    const otherExpenseItems = filteredTransactions
      .filter(t => t.type === "DEBIT" && 
                   t.account?.category !== "EXPENSE" &&
                   !t.account?.name?.toLowerCase().includes("interest"))
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const data: IncomeStatementData = {
      revenue: {
        sales,
        otherIncome,
        total: sales + otherIncome
      },
      costOfGoodsSold: {
        materials,
        labor,
        overhead,
        total: materials + labor + overhead
      },
      grossProfit: (sales + otherIncome) - (materials + labor + overhead),
      operatingExpenses: {
        salaries,
        rent,
        utilities,
        marketing,
        depreciation,
        other,
        total: salaries + rent + utilities + marketing + depreciation + other
      },
      operatingIncome: (sales + otherIncome) - (materials + labor + overhead) - (salaries + rent + utilities + marketing + depreciation + other),
      otherIncomeExpense: {
        interestIncome,
        interestExpense,
        otherIncome: otherIncomeItems,
        otherExpense: otherExpenseItems,
        total: interestIncome - interestExpense + otherIncomeItems - otherExpenseItems
      },
      netIncome: ((sales + otherIncome) - (materials + labor + overhead) - (salaries + rent + utilities + marketing + depreciation + other)) + (interestIncome - interestExpense + otherIncomeItems - otherExpenseItems)
    }

    return data
  }, [transactionsData, invoicesData, debouncedStartDate, debouncedEndDate])

  const handleRefresh = () => {
    setIsLoading(true)
    // Force refetch
    setTimeout(() => setIsLoading(false), 1000)
  }

  const handleExport = () => {
    // Export functionality would go here
    alert("Export functionality will be implemented")
  }

  const handlePrint = () => {
    window.print()
  }

  const quickDateRanges = [
    { label: "This Month", start: () => {
      const date = new Date()
      date.setDate(1)
      return date.toISOString().split('T')[0]
    }, end: () => new Date().toISOString().split('T')[0] },
    { label: "Last Month", start: () => {
      const date = new Date()
      date.setMonth(date.getMonth() - 1)
      date.setDate(1)
      return date.toISOString().split('T')[0]
    }, end: () => {
      const date = new Date()
      date.setDate(0)
      return date.toISOString().split('T')[0]
    }},
    { label: "This Quarter", start: () => {
      const date = new Date()
      const quarter = Math.floor(date.getMonth() / 3)
      date.setMonth(quarter * 3)
      date.setDate(1)
      return date.toISOString().split('T')[0]
    }, end: () => new Date().toISOString().split('T')[0] },
    { label: "This Year", start: () => {
      const date = new Date()
      date.setMonth(0)
      date.setDate(1)
      return date.toISOString().split('T')[0]
    }, end: () => new Date().toISOString().split('T')[0] },
    { label: "Last Year", start: () => {
      const date = new Date()
      date.setFullYear(date.getFullYear() - 1)
      date.setMonth(0)
      date.setDate(1)
      return date.toISOString().split('T')[0]
    }, end: () => {
      const date = new Date()
      date.setFullYear(date.getFullYear() - 1)
      date.setMonth(11)
      date.setDate(31)
      return date.toISOString().split('T')[0]
    }},
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <a className="mr-6" href="/">
              <Logo size={32} showText={true} />
            </a>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="w-full flex-1 md:w-auto md:flex-none">
              <h1 className="text-2xl font-bold">Income Statement</h1>
            </div>
            <nav className="flex items-center space-x-2">
              <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
            </nav>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto py-6">
        {/* Date Parameters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Report Parameters</CardTitle>
            <CardDescription>Select the date range for the Income Statement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Quick Select</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {quickDateRanges.map((range) => (
                    <Button
                      key={range.label}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStartDate(range.start())
                        setEndDate(range.end())
                      }}
                    >
                      {range.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Income Statement Report */}
        {transactionsLoading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <RefreshCw className="mx-auto h-8 w-8 animate-spin text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Loading Income Statement data...</p>
            </CardContent>
          </Card>
        ) : incomeStatement ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">Income Statement</CardTitle>
                  <CardDescription className="mt-1">
                    {organizations?.[0]?.name || "Organisation"}
                  </CardDescription>
                  <CardDescription>
                    Period: {formatDate(debouncedStartDate)} to {formatDate(debouncedEndDate)}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-sm">
                  {formatDate(new Date().toISOString())}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Revenue Section */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-green-600">REVENUE</h3>
                  <div className="pl-4 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Sales Revenue</span>
                      <span className="font-medium">{formatCurrency(incomeStatement.revenue.sales)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Other Income</span>
                      <span className="font-medium">{formatCurrency(incomeStatement.revenue.otherIncome)}</span>
                    </div>
                    <div className="border-t pt-1 mt-2 flex justify-between items-center">
                      <span className="font-semibold">Total Revenue</span>
                      <span className="text-lg font-bold text-green-600">
                        {formatCurrency(incomeStatement.revenue.total)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cost of Goods Sold */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-red-600">COST OF GOODS SOLD</h3>
                  <div className="pl-4 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Materials</span>
                      <span className="font-medium">{formatCurrency(incomeStatement.costOfGoodsSold.materials)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Labor</span>
                      <span className="font-medium">{formatCurrency(incomeStatement.costOfGoodsSold.labor)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Overhead</span>
                      <span className="font-medium">{formatCurrency(incomeStatement.costOfGoodsSold.overhead)}</span>
                    </div>
                    <div className="border-t pt-1 mt-2 flex justify-between items-center">
                      <span className="font-semibold">Total Cost of Goods Sold</span>
                      <span className="text-lg font-bold text-red-600">
                        {formatCurrency(incomeStatement.costOfGoodsSold.total)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Gross Profit */}
                <div className="border-t-2 pt-4 flex justify-between items-center">
                  <span className="text-lg font-bold">Gross Profit</span>
                  <span className={`text-2xl font-bold ${incomeStatement.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(incomeStatement.grossProfit)}
                  </span>
                </div>

                {/* Operating Expenses */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-orange-600">OPERATING EXPENSES</h3>
                  <div className="pl-4 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Salaries & Wages</span>
                      <span className="font-medium">{formatCurrency(incomeStatement.operatingExpenses.salaries)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Rent</span>
                      <span className="font-medium">{formatCurrency(incomeStatement.operatingExpenses.rent)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Utilities</span>
                      <span className="font-medium">{formatCurrency(incomeStatement.operatingExpenses.utilities)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Marketing & Advertising</span>
                      <span className="font-medium">{formatCurrency(incomeStatement.operatingExpenses.marketing)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Depreciation</span>
                      <span className="font-medium">{formatCurrency(incomeStatement.operatingExpenses.depreciation)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Other Operating Expenses</span>
                      <span className="font-medium">{formatCurrency(incomeStatement.operatingExpenses.other)}</span>
                    </div>
                    <div className="border-t pt-1 mt-2 flex justify-between items-center">
                      <span className="font-semibold">Total Operating Expenses</span>
                      <span className="text-lg font-bold text-orange-600">
                        {formatCurrency(incomeStatement.operatingExpenses.total)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Operating Income */}
                <div className="border-t-2 pt-4 flex justify-between items-center">
                  <span className="text-lg font-bold">Operating Income</span>
                  <span className={`text-2xl font-bold ${incomeStatement.operatingIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(incomeStatement.operatingIncome)}
                  </span>
                </div>

                {/* Other Income/Expense */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">OTHER INCOME / EXPENSE</h3>
                  <div className="pl-4 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Interest Income</span>
                      <span className="font-medium text-green-600">
                        {formatCurrency(incomeStatement.otherIncomeExpense.interestIncome)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Interest Expense</span>
                      <span className="font-medium text-red-600">
                        ({formatCurrency(Math.abs(incomeStatement.otherIncomeExpense.interestExpense))})
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Other Income</span>
                      <span className="font-medium text-green-600">
                        {formatCurrency(incomeStatement.otherIncomeExpense.otherIncome)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Other Expense</span>
                      <span className="font-medium text-red-600">
                        ({formatCurrency(Math.abs(incomeStatement.otherIncomeExpense.otherExpense))})
                      </span>
                    </div>
                    <div className="border-t pt-1 mt-2 flex justify-between items-center">
                      <span className="font-semibold">Net Other Income / (Expense)</span>
                      <span className={`text-lg font-bold ${incomeStatement.otherIncomeExpense.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(incomeStatement.otherIncomeExpense.total)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Net Income */}
                <div className="border-t-4 border-primary pt-6 flex justify-between items-center">
                  <span className="text-2xl font-bold">NET INCOME</span>
                  <span className={`text-3xl font-bold ${incomeStatement.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(incomeStatement.netIncome)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
              <p className="text-muted-foreground">
                Select a date range and ensure you have transactions in that period.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}

