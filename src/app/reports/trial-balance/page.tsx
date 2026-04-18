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
  FileText,
  RefreshCw,
  Printer,
  CheckCircle2,
  XCircle
} from "lucide-react"
import { useDebounce } from "@/lib/hooks/useDebounce"

export default function TrialBalancePage() {
  const [asOfDate, setAsOfDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [currency, setCurrency] = useState<string>("")
  const [includeInactive, setIncludeInactive] = useState(false)

  // Debounce date changes
  const debouncedAsOfDate = useDebounce(asOfDate, 500)

  // Get user's organizations
  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()

  // Fetch trial balance data
  const { data: trialBalanceData, isLoading } = trpc.reports.getTrialBalance.useQuery(
    {
      organizationId: organizations?.[0]?.id || "",
      asOfDate: debouncedAsOfDate,
      currency: currency || undefined,
      includeInactive,
    },
    { 
      enabled: !!organizations?.[0]?.id && !!debouncedAsOfDate,
      refetchOnWindowFocus: false
    }
  )

  // Export handlers
  const handleExportCSV = () => {
    if (!trialBalanceData) return

    const csvRows = [
      ["Account Code", "Account Name", "Account Type", "Debit", "Credit", "Balance", "Currency"],
      ...trialBalanceData.accounts.map(acc => [
        acc.accountCode,
        acc.accountName,
        acc.accountType,
        acc.debit.toFixed(2),
        acc.credit.toFixed(2),
        acc.balance.toFixed(2),
        acc.currency || "GBP"
      ]),
      ["", "", "TOTAL", trialBalanceData.totals.totalDebits.toFixed(2), trialBalanceData.totals.totalCredits.toFixed(2), "", ""]
    ]

    const csvContent = csvRows.map(row => row.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `trial-balance-${debouncedAsOfDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportPDF = () => {
    // PDF export would require a library like jsPDF or a server-side solution
    window.print()
  }

  // Group accounts by type for display
  const groupedAccounts = useMemo(() => {
    if (!trialBalanceData) return {}
    
    const grouped: Record<string, typeof trialBalanceData.accounts> = {}
    trialBalanceData.accounts.forEach(acc => {
      if (!grouped[acc.accountType]) {
        grouped[acc.accountType] = []
      }
      grouped[acc.accountType].push(acc)
    })
    
    return grouped
  }, [trialBalanceData])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center space-x-4">
            <a className="flex items-center space-x-2" href="/">
              <Logo size={32} showText={true} />
            </a>
            <h1 className="text-2xl font-bold">Trial Balance</h1>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={handleExportPDF}>
              <Printer className="mr-2 h-4 w-4" />
              Print/PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto py-6">
        <div className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Report Parameters</CardTitle>
              <CardDescription>Configure your trial balance report</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="as-of-date">As of Date</Label>
                  <Input
                    id="as-of-date"
                    type="date"
                    value={asOfDate}
                    onChange={(e) => setAsOfDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="currency">Currency (Optional)</Label>
                  <Input
                    id="currency"
                    type="text"
                    placeholder="GBP, USD, EUR..."
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={includeInactive}
                      onChange={(e) => setIncludeInactive(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Include Inactive Accounts</span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trial Balance Report */}
          {isLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <RefreshCw className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">Loading trial balance...</p>
              </CardContent>
            </Card>
          ) : trialBalanceData ? (
            <>
              {/* Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Trial Balance Summary</CardTitle>
                  <CardDescription>
                    As of {formatDate(trialBalanceData.asOfDate)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <div className="text-sm text-muted-foreground">Total Debits</div>
                      <div className="text-2xl font-bold">
                        {formatCurrency(trialBalanceData.totals.totalDebits)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Total Credits</div>
                      <div className="text-2xl font-bold">
                        {formatCurrency(trialBalanceData.totals.totalCredits)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Balance Status</div>
                      <div className="flex items-center space-x-2">
                        {trialBalanceData.totals.isBalanced ? (
                          <>
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            <span className="text-lg font-semibold text-green-600">Balanced</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-5 w-5 text-red-600" />
                            <span className="text-lg font-semibold text-red-600">
                              Difference: {formatCurrency(Math.abs(trialBalanceData.totals.difference))}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Accounts by Type */}
              {Object.entries(groupedAccounts).map(([accountType, accounts]) => (
                <Card key={accountType}>
                  <CardHeader>
                    <CardTitle>{accountType} Accounts</CardTitle>
                    <CardDescription>
                      {accounts.length} account{accounts.length !== 1 ? 's' : ''}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Code</th>
                            <th className="text-left p-2">Account Name</th>
                            <th className="text-right p-2">Debit</th>
                            <th className="text-right p-2">Credit</th>
                            <th className="text-right p-2">Balance</th>
                            <th className="text-center p-2">Currency</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accounts.map((account) => (
                            <tr key={account.accountId} className="border-b hover:bg-muted/50">
                              <td className="p-2 font-mono text-sm">{account.accountCode}</td>
                              <td className="p-2">{account.accountName}</td>
                              <td className="p-2 text-right">
                                {account.debit > 0 ? formatCurrency(account.debit) : "-"}
                              </td>
                              <td className="p-2 text-right">
                                {account.credit > 0 ? formatCurrency(account.credit) : "-"}
                              </td>
                              <td className={`p-2 text-right font-medium ${
                                account.balance < 0 ? "text-red-600" : "text-green-600"
                              }`}>
                                {formatCurrency(Math.abs(account.balance))}
                                {account.balance < 0 ? " (CR)" : " (DR)"}
                              </td>
                              <td className="p-2 text-center">
                                <Badge variant="outline">{account.currency || "GBP"}</Badge>
                              </td>
                            </tr>
                          ))}
                          <tr className="border-t-2 font-bold">
                            <td colSpan={2} className="p-2">Total ({accountType})</td>
                            <td className="p-2 text-right">
                              {formatCurrency(
                                accounts.reduce((sum, acc) => sum + acc.debit, 0)
                              )}
                            </td>
                            <td className="p-2 text-right">
                              {formatCurrency(
                                accounts.reduce((sum, acc) => sum + acc.credit, 0)
                              )}
                            </td>
                            <td colSpan={2}></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No Data Available</h3>
                <p className="text-muted-foreground">
                  Select a date and organization to view the trial balance
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}




