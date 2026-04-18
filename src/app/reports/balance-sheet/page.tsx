"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
// Select component - using a simple dropdown for now
import { trpc } from "@/lib/trpc-client"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Logo } from "@/components/logo"
import { 
  Download, 
  Calendar, 
  FileText,
  RefreshCw,
  Printer,
  TrendingUp,
  TrendingDown
} from "lucide-react"
import { useDebounce } from "@/lib/hooks/useDebounce"

interface BalanceSheetData {
  assets: {
    current: {
      cash: number
      accountsReceivable: number
      inventory: number
      prepaidExpenses: number
      otherCurrent: number
      total: number
    }
    fixed: {
      property: number
      equipment: number
      vehicles: number
      accumulatedDepreciation: number
      netFixed: number
      otherFixed: number
      total: number
    }
    other: {
      investments: number
      intangibles: number
      other: number
      total: number
    }
    total: number
  }
  liabilities: {
    current: {
      accountsPayable: number
      shortTermLoans: number
      accruedExpenses: number
      currentPortionDebt: number
      taxesPayable: number
      otherCurrent: number
      total: number
    }
    longTerm: {
      longTermLoans: number
      mortgages: number
      deferredTax: number
      otherLongTerm: number
      total: number
    }
    total: number
  }
  equity: {
    shareCapital: number
    retainedEarnings: number
    currentYearEarnings: number
    otherEquity: number
    total: number
  }
}

export default function BalanceSheetPage() {
  const [asOfDate, setAsOfDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [reportBasis, setReportBasis] = useState<"accrual" | "cash">("accrual")
  const [includeSubAccounts, setIncludeSubAccounts] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  // Debounce date changes
  const debouncedAsOfDate = useDebounce(asOfDate, 500)

  // Get user's organizations
  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()

  // Fetch chart of accounts
  const { data: accountsData } = trpc.chartOfAccounts.getAll.useQuery(
    {
      organizationId: organizations?.[0]?.id || "",
    },
    { 
      enabled: !!organizations?.[0]?.id,
      refetchOnWindowFocus: false
    }
  )

  // Fetch all transactions up to the as-of date
  const { data: transactionsData, isLoading: transactionsLoading } = trpc.transactions.getAll.useQuery(
    {
      organizationId: organizations?.[0]?.id || "",
      page: 1,
      limit: 10000,
      sortBy: "date",
      sortOrder: "asc",
      endDate: debouncedAsOfDate ? new Date(debouncedAsOfDate) : undefined,
    },
    { 
      enabled: !!organizations?.[0]?.id && !!debouncedAsOfDate,
      refetchOnWindowFocus: false
    }
  )

  // Fetch invoices for accounts receivable calculation
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

  // Fetch bills for accounts payable calculation (using expenses/vendors if bills endpoint doesn't exist)
  // Note: This will need to be implemented based on your actual bills/vendors router
  const billsData = null // Placeholder - replace with actual bills query when available

  // Fetch bank accounts for cash calculation
  const { data: bankAccountsData } = trpc.bankAccounts.getAll.useQuery(
    {
      organizationId: organizations?.[0]?.id || "",
    },
    { 
      enabled: !!organizations?.[0]?.id,
      refetchOnWindowFocus: false
    }
  )

  // Calculate Balance Sheet data
  const balanceSheet = useMemo(() => {
    if (!transactionsData?.transactions || !accountsData || !bankAccountsData) {
      return null
    }

    const transactions = transactionsData.transactions
    const accounts = accountsData
    const bankAccounts = Array.isArray(bankAccountsData) ? bankAccountsData : bankAccountsData.bankAccounts || []
    const asOf = new Date(debouncedAsOfDate)

    // Filter transactions up to as-of date
    const filteredTransactions = transactions.filter(t => {
      const tDate = new Date(t.date)
      return tDate <= asOf
    })

    // Calculate account balances (sum of credits - sum of debits for each account)
    const accountBalances: Record<string, number> = {}
    
    filteredTransactions.forEach(t => {
      if (!t.accountId) return
      
      if (!accountBalances[t.accountId]) {
        accountBalances[t.accountId] = 0
      }

      // For asset accounts, debits increase, credits decrease
      // For liability/equity accounts, credits increase, debits decrease
      const account = accounts.find(a => a.id === t.accountId)
      const isAsset = account?.type === "ASSET"
      
      if (isAsset) {
        accountBalances[t.accountId] += Number(t.debit) - Number(t.credit)
      } else {
        accountBalances[t.accountId] += Number(t.credit) - Number(t.debit)
      }
    })

    // Calculate Cash (from bank accounts)
    const cash = bankAccounts.reduce((sum, account) => {
      return sum + Number(account.currentBalance || 0)
    }, 0)

    // Calculate Accounts Receivable (unpaid invoices)
    const accountsReceivable = invoicesData?.invoices
      ? invoicesData.invoices
          .filter(inv => {
            const invDate = new Date(inv.date)
            return invDate <= asOf && (inv.status === "SENT" || inv.status === "PARTIALLY_PAID")
          })
          .reduce((sum, inv) => {
            const paid = inv.payments?.reduce((p, payment) => p + Number(payment.amount || 0), 0) || 0
            return sum + Number(inv.total) - paid
          }, 0)
      : 0

    // Calculate Inventory (from inventory accounts)
    const inventory = accounts
      .filter(a => a.type === "ASSET" && (a.name?.toLowerCase().includes("inventory") || a.name?.toLowerCase().includes("stock")))
      .reduce((sum, account) => {
        return sum + (accountBalances[account.id] || 0)
      }, 0)

    // Calculate Prepaid Expenses
    const prepaidExpenses = accounts
      .filter(a => a.type === "ASSET" && a.name?.toLowerCase().includes("prepaid"))
      .reduce((sum, account) => {
        return sum + (accountBalances[account.id] || 0)
      }, 0)

    // Calculate Other Current Assets
    const otherCurrentAssets = accounts
      .filter(a => a.type === "ASSET" && 
                   !a.name?.toLowerCase().includes("cash") &&
                   !a.name?.toLowerCase().includes("receivable") &&
                   !a.name?.toLowerCase().includes("inventory") &&
                   !a.name?.toLowerCase().includes("prepaid"))
      .reduce((sum, account) => {
        return sum + (accountBalances[account.id] || 0)
      }, 0)

    // Calculate Fixed Assets
    const property = accounts
      .filter(a => a.type === "ASSET" && a.name?.toLowerCase().includes("property"))
      .reduce((sum, account) => {
        return sum + (accountBalances[account.id] || 0)
      }, 0)

    const equipment = accounts
      .filter(a => a.type === "ASSET" && a.name?.toLowerCase().includes("equipment"))
      .reduce((sum, account) => {
        return sum + (accountBalances[account.id] || 0)
      }, 0)

    const vehicles = accounts
      .filter(a => a.type === "ASSET" && a.name?.toLowerCase().includes("vehicle"))
      .reduce((sum, account) => {
        return sum + (accountBalances[account.id] || 0)
      }, 0)

    const accumulatedDepreciation = accounts
      .filter(a => a.type === "LIABILITY" && a.name?.toLowerCase().includes("depreciation"))
      .reduce((sum, account) => {
        return sum + Math.abs(accountBalances[account.id] || 0)
      }, 0)

    const netFixedAssets = property + equipment + vehicles - accumulatedDepreciation

    const otherFixedAssets = accounts
      .filter(a => a.type === "ASSET" && 
                   !a.name?.toLowerCase().includes("property") &&
                   !a.name?.toLowerCase().includes("equipment") &&
                   !a.name?.toLowerCase().includes("vehicle"))
      .reduce((sum, account) => {
        return sum + (accountBalances[account.id] || 0)
      }, 0)

    // Calculate Other Assets
    const investments = accounts
      .filter(a => a.type === "ASSET" && a.name?.toLowerCase().includes("investment"))
      .reduce((sum, account) => {
        return sum + (accountBalances[account.id] || 0)
      }, 0)

    const intangibles = accounts
      .filter(a => a.type === "ASSET" && a.name?.toLowerCase().includes("intangible"))
      .reduce((sum, account) => {
        return sum + (accountBalances[account.id] || 0)
      }, 0)

    const otherAssets = accounts
      .filter(a => a.type === "ASSET" &&
                   !a.name?.toLowerCase().includes("investment") &&
                   !a.name?.toLowerCase().includes("intangible"))
      .reduce((sum, account) => {
        return sum + (accountBalances[account.id] || 0)
      }, 0)

    // Calculate Current Liabilities
    // Accounts Payable (from liability accounts and transactions)
    const accountsPayable = accounts
      .filter(a => a.type === "LIABILITY" && 
                   (a.name?.toLowerCase().includes("payable") || a.name?.toLowerCase().includes("accounts payable")))
      .reduce((sum, account) => {
        return sum + Math.abs(accountBalances[account.id] || 0)
      }, 0)

    const shortTermLoans = accounts
      .filter(a => a.type === "LIABILITY" && a.name?.toLowerCase().includes("loan") && a.name?.toLowerCase().includes("short"))
      .reduce((sum, account) => {
        return sum + Math.abs(accountBalances[account.id] || 0)
      }, 0)

    const accruedExpenses = accounts
      .filter(a => a.type === "LIABILITY" && a.name?.toLowerCase().includes("accrued"))
      .reduce((sum, account) => {
        return sum + Math.abs(accountBalances[account.id] || 0)
      }, 0)

    const currentPortionDebt = accounts
      .filter(a => a.type === "LIABILITY" && a.name?.toLowerCase().includes("current") && a.name?.toLowerCase().includes("debt"))
      .reduce((sum, account) => {
        return sum + Math.abs(accountBalances[account.id] || 0)
      }, 0)

    const taxesPayable = accounts
      .filter(a => a.type === "LIABILITY" && a.name?.toLowerCase().includes("tax"))
      .reduce((sum, account) => {
        return sum + Math.abs(accountBalances[account.id] || 0)
      }, 0)

    const otherCurrentLiabilities = accounts
      .filter(a => a.type === "LIABILITY" && 
                   !a.name?.toLowerCase().includes("payable") &&
                   !a.name?.toLowerCase().includes("loan") &&
                   !a.name?.toLowerCase().includes("accrued") &&
                   !a.name?.toLowerCase().includes("tax"))
      .reduce((sum, account) => {
        return sum + Math.abs(accountBalances[account.id] || 0)
      }, 0)

    // Calculate Long-term Liabilities
    const longTermLoans = accounts
      .filter(a => a.type === "LIABILITY" && a.name?.toLowerCase().includes("loan") && !a.name?.toLowerCase().includes("short"))
      .reduce((sum, account) => {
        return sum + Math.abs(accountBalances[account.id] || 0)
      }, 0)

    const mortgages = accounts
      .filter(a => a.type === "LIABILITY" && a.name?.toLowerCase().includes("mortgage"))
      .reduce((sum, account) => {
        return sum + Math.abs(accountBalances[account.id] || 0)
      }, 0)

    const deferredTax = accounts
      .filter(a => a.type === "LIABILITY" && a.name?.toLowerCase().includes("deferred"))
      .reduce((sum, account) => {
        return sum + Math.abs(accountBalances[account.id] || 0)
      }, 0)

    const otherLongTermLiabilities = accounts
      .filter(a => a.type === "LIABILITY" && 
                   !a.name?.toLowerCase().includes("loan") &&
                   !a.name?.toLowerCase().includes("mortgage") &&
                   !a.name?.toLowerCase().includes("deferred"))
      .reduce((sum, account) => {
        return sum + Math.abs(accountBalances[account.id] || 0)
      }, 0)

    // Calculate Equity
    const shareCapital = accounts
      .filter(a => a.type === "EQUITY" && a.name?.toLowerCase().includes("capital"))
      .reduce((sum, account) => {
        return sum + Math.abs(accountBalances[account.id] || 0)
      }, 0)

    const retainedEarnings = accounts
      .filter(a => a.type === "EQUITY" && a.name?.toLowerCase().includes("retained"))
      .reduce((sum, account) => {
        return sum + Math.abs(accountBalances[account.id] || 0)
      }, 0)

    // Calculate current year earnings (from income statement)
    const currentYearStart = new Date(asOf.getFullYear(), 0, 1)
    const currentYearTransactions = filteredTransactions.filter(t => {
      const tDate = new Date(t.date)
      return tDate >= currentYearStart && tDate <= asOf
    })

    const revenue = currentYearTransactions
      .filter(t => {
        const account = accounts.find(a => a.id === t.accountId)
        return account?.type === "REVENUE"
      })
      .reduce((sum, t) => sum + Number(t.credit) - Number(t.debit), 0)

    const expenses = currentYearTransactions
      .filter(t => {
        const account = accounts.find(a => a.id === t.accountId)
        return account?.type === "EXPENSE"
      })
      .reduce((sum, t) => sum + Number(t.debit) - Number(t.credit), 0)

    const currentYearEarnings = revenue - expenses

    const otherEquity = accounts
      .filter(a => a.type === "EQUITY" && 
                   !a.name?.toLowerCase().includes("capital") &&
                   !a.name?.toLowerCase().includes("retained"))
      .reduce((sum, account) => {
        return sum + Math.abs(accountBalances[account.id] || 0)
      }, 0)

    const data: BalanceSheetData = {
      assets: {
        current: {
          cash,
          accountsReceivable,
          inventory,
          prepaidExpenses,
          otherCurrent: otherCurrentAssets,
          total: cash + accountsReceivable + inventory + prepaidExpenses + otherCurrentAssets
        },
        fixed: {
          property,
          equipment,
          vehicles,
          accumulatedDepreciation,
          netFixed: netFixedAssets,
          otherFixed: otherFixedAssets,
          total: netFixedAssets + otherFixedAssets
        },
        other: {
          investments,
          intangibles,
          other: otherAssets,
          total: investments + intangibles + otherAssets
        },
        total: (cash + accountsReceivable + inventory + prepaidExpenses + otherCurrentAssets) + 
               (netFixedAssets + otherFixedAssets) + 
               (investments + intangibles + otherAssets)
      },
      liabilities: {
        current: {
          accountsPayable,
          shortTermLoans,
          accruedExpenses,
          currentPortionDebt,
          taxesPayable,
          otherCurrent: otherCurrentLiabilities,
          total: accountsPayable + shortTermLoans + accruedExpenses + currentPortionDebt + taxesPayable + otherCurrentLiabilities
        },
        longTerm: {
          longTermLoans,
          mortgages,
          deferredTax,
          otherLongTerm: otherLongTermLiabilities,
          total: longTermLoans + mortgages + deferredTax + otherLongTermLiabilities
        },
        total: (accountsPayable + shortTermLoans + accruedExpenses + currentPortionDebt + taxesPayable + otherCurrentLiabilities) +
               (longTermLoans + mortgages + deferredTax + otherLongTermLiabilities)
      },
      equity: {
        shareCapital,
        retainedEarnings,
        currentYearEarnings,
        otherEquity,
        total: shareCapital + retainedEarnings + currentYearEarnings + otherEquity
      }
    }

    return data
  }, [transactionsData, accountsData, invoicesData, bankAccountsData, debouncedAsOfDate])

  const handleRefresh = () => {
    setIsLoading(true)
    setTimeout(() => setIsLoading(false), 1000)
  }

  const handleExport = () => {
    alert("Export functionality will be implemented")
  }

  const handlePrint = () => {
    window.print()
  }

  const quickDates = [
    { label: "Today", date: () => new Date().toISOString().split('T')[0] },
    { label: "End of Last Month", date: () => {
      const date = new Date()
      date.setDate(0)
      return date.toISOString().split('T')[0]
    }},
    { label: "End of Last Quarter", date: () => {
      const date = new Date()
      const quarter = Math.floor(date.getMonth() / 3)
      date.setMonth(quarter * 3 - 1)
      date.setDate(0)
      return date.toISOString().split('T')[0]
    }},
    { label: "End of Last Year", date: () => {
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
              <h1 className="text-2xl font-bold">Balance Sheet</h1>
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
        {/* Selection Parameters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Report Parameters</CardTitle>
            <CardDescription>Select parameters for the Balance Sheet report</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label htmlFor="as-of-date">As Of Date</Label>
                <Input
                  id="as-of-date"
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="report-basis">Report Basis</Label>
                <select
                  id="report-basis"
                  value={reportBasis}
                  onChange={(e) => setReportBasis(e.target.value as "accrual" | "cash")}
                  className="mt-1 flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
                >
                  <option value="accrual">Accrual</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <Label>Quick Select</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {quickDates.map((quickDate) => (
                    <Button
                      key={quickDate.label}
                      variant="outline"
                      size="sm"
                      onClick={() => setAsOfDate(quickDate.date())}
                    >
                      {quickDate.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Balance Sheet Report */}
        {transactionsLoading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <RefreshCw className="mx-auto h-8 w-8 animate-spin text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Loading Balance Sheet data...</p>
            </CardContent>
          </Card>
        ) : balanceSheet ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Assets */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl text-green-600">ASSETS</CardTitle>
                  <Badge variant="outline" className="text-sm">
                    {formatDate(debouncedAsOfDate)}
                  </Badge>
                </div>
                <CardDescription className="mt-1">
                  {organizations?.[0]?.name || "Organisation"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Current Assets */}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm uppercase">Current Assets</h3>
                    <div className="pl-4 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Cash and Cash Equivalents</span>
                        <span className="font-medium">{formatCurrency(balanceSheet.assets.current.cash)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Accounts Receivable</span>
                        <span className="font-medium">{formatCurrency(balanceSheet.assets.current.accountsReceivable)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Inventory</span>
                        <span className="font-medium">{formatCurrency(balanceSheet.assets.current.inventory)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Prepaid Expenses</span>
                        <span className="font-medium">{formatCurrency(balanceSheet.assets.current.prepaidExpenses)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Other Current Assets</span>
                        <span className="font-medium">{formatCurrency(balanceSheet.assets.current.otherCurrent)}</span>
                      </div>
                      <div className="border-t pt-1 mt-2 flex justify-between font-semibold">
                        <span>Total Current Assets</span>
                        <span className="text-green-600">{formatCurrency(balanceSheet.assets.current.total)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Fixed Assets */}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm uppercase">Fixed Assets</h3>
                    <div className="pl-4 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Property</span>
                        <span className="font-medium">{formatCurrency(balanceSheet.assets.fixed.property)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Equipment</span>
                        <span className="font-medium">{formatCurrency(balanceSheet.assets.fixed.equipment)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Vehicles</span>
                        <span className="font-medium">{formatCurrency(balanceSheet.assets.fixed.vehicles)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Less: Accumulated Depreciation</span>
                        <span className="font-medium">({formatCurrency(balanceSheet.assets.fixed.accumulatedDepreciation)})</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Net Fixed Assets</span>
                        <span className="font-medium">{formatCurrency(balanceSheet.assets.fixed.netFixed)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Other Fixed Assets</span>
                        <span className="font-medium">{formatCurrency(balanceSheet.assets.fixed.otherFixed)}</span>
                      </div>
                      <div className="border-t pt-1 mt-2 flex justify-between font-semibold">
                        <span>Total Fixed Assets</span>
                        <span className="text-green-600">{formatCurrency(balanceSheet.assets.fixed.total)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Other Assets */}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm uppercase">Other Assets</h3>
                    <div className="pl-4 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Investments</span>
                        <span className="font-medium">{formatCurrency(balanceSheet.assets.other.investments)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Intangible Assets</span>
                        <span className="font-medium">{formatCurrency(balanceSheet.assets.other.intangibles)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Other Assets</span>
                        <span className="font-medium">{formatCurrency(balanceSheet.assets.other.other)}</span>
                      </div>
                      <div className="border-t pt-1 mt-2 flex justify-between font-semibold">
                        <span>Total Other Assets</span>
                        <span className="text-green-600">{formatCurrency(balanceSheet.assets.other.total)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Total Assets */}
                  <div className="border-t-2 pt-4 flex justify-between items-center">
                    <span className="text-xl font-bold">TOTAL ASSETS</span>
                    <span className="text-2xl font-bold text-green-600">{formatCurrency(balanceSheet.assets.total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Liabilities & Equity */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl text-red-600">LIABILITIES & EQUITY</CardTitle>
                  <Badge variant="outline" className="text-sm">
                    {formatDate(debouncedAsOfDate)}
                  </Badge>
                </div>
                <CardDescription className="mt-1">
                  {organizations?.[0]?.name || "Organisation"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Current Liabilities */}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm uppercase">Current Liabilities</h3>
                    <div className="pl-4 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Accounts Payable</span>
                        <span className="font-medium">{formatCurrency(balanceSheet.liabilities.current.accountsPayable)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Short-term Loans</span>
                        <span className="font-medium">{formatCurrency(balanceSheet.liabilities.current.shortTermLoans)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Accrued Expenses</span>
                        <span className="font-medium">{formatCurrency(balanceSheet.liabilities.current.accruedExpenses)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Current Portion of Long-term Debt</span>
                        <span className="font-medium">{formatCurrency(balanceSheet.liabilities.current.currentPortionDebt)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Taxes Payable</span>
                        <span className="font-medium">{formatCurrency(balanceSheet.liabilities.current.taxesPayable)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Other Current Liabilities</span>
                        <span className="font-medium">{formatCurrency(balanceSheet.liabilities.current.otherCurrent)}</span>
                      </div>
                      <div className="border-t pt-1 mt-2 flex justify-between font-semibold">
                        <span>Total Current Liabilities</span>
                        <span className="text-red-600">{formatCurrency(balanceSheet.liabilities.current.total)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Long-term Liabilities */}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm uppercase">Long-term Liabilities</h3>
                    <div className="pl-4 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Long-term Loans</span>
                        <span className="font-medium">{formatCurrency(balanceSheet.liabilities.longTerm.longTermLoans)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Mortgages</span>
                        <span className="font-medium">{formatCurrency(balanceSheet.liabilities.longTerm.mortgages)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Deferred Tax</span>
                        <span className="font-medium">{formatCurrency(balanceSheet.liabilities.longTerm.deferredTax)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Other Long-term Liabilities</span>
                        <span className="font-medium">{formatCurrency(balanceSheet.liabilities.longTerm.otherLongTerm)}</span>
                      </div>
                      <div className="border-t pt-1 mt-2 flex justify-between font-semibold">
                        <span>Total Long-term Liabilities</span>
                        <span className="text-red-600">{formatCurrency(balanceSheet.liabilities.longTerm.total)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Total Liabilities */}
                  <div className="border-t pt-2 flex justify-between font-semibold">
                    <span>TOTAL LIABILITIES</span>
                    <span className="text-red-600">{formatCurrency(balanceSheet.liabilities.total)}</span>
                  </div>

                  {/* Equity */}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm uppercase">Equity</h3>
                    <div className="pl-4 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Share Capital</span>
                        <span className="font-medium">{formatCurrency(balanceSheet.equity.shareCapital)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Retained Earnings</span>
                        <span className="font-medium">{formatCurrency(balanceSheet.equity.retainedEarnings)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Current Year Earnings</span>
                        <span className={`font-medium ${balanceSheet.equity.currentYearEarnings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(balanceSheet.equity.currentYearEarnings)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Other Equity</span>
                        <span className="font-medium">{formatCurrency(balanceSheet.equity.otherEquity)}</span>
                      </div>
                      <div className="border-t pt-1 mt-2 flex justify-between font-semibold">
                        <span>Total Equity</span>
                        <span className="text-blue-600">{formatCurrency(balanceSheet.equity.total)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Total Liabilities & Equity */}
                  <div className="border-t-2 pt-4 flex justify-between items-center">
                    <span className="text-xl font-bold">TOTAL LIABILITIES & EQUITY</span>
                    <span className="text-2xl font-bold text-blue-600">{formatCurrency(balanceSheet.liabilities.total + balanceSheet.equity.total)}</span>
                  </div>

                  {/* Balance Check */}
                  <div className={`mt-4 p-3 rounded-xl ${Math.abs(balanceSheet.assets.total - (balanceSheet.liabilities.total + balanceSheet.equity.total)) < 0.01 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-medium">Balance Check:</span>
                      <span className={`font-bold ${Math.abs(balanceSheet.assets.total - (balanceSheet.liabilities.total + balanceSheet.equity.total)) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                        {Math.abs(balanceSheet.assets.total - (balanceSheet.liabilities.total + balanceSheet.equity.total)) < 0.01 
                          ? '✓ Balanced' 
                          : `Difference: ${formatCurrency(Math.abs(balanceSheet.assets.total - (balanceSheet.liabilities.total + balanceSheet.equity.total)))}`}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
              <p className="text-muted-foreground">
                Select a date and ensure you have transactions in that period.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}

