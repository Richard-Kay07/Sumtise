"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { trpc } from "@/lib/trpc-client"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Logo } from "@/components/logo"
import { 
  Download, 
  Printer,
  RefreshCw,
  FileText,
  TrendingUp,
  TrendingDown
} from "lucide-react"
import { useDebounce } from "@/lib/hooks/useDebounce"

export default function CashFlowPage() {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 1)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [currency, setCurrency] = useState<string>("")

  const debouncedStartDate = useDebounce(startDate, 500)
  const debouncedEndDate = useDebounce(endDate, 500)

  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()

  const { data: cashFlowData, isLoading } = trpc.reports.getCashFlow.useQuery(
    {
      organizationId: organizations?.[0]?.id || "",
      startDate: debouncedStartDate,
      endDate: debouncedEndDate,
      currency: currency || undefined,
    },
    { 
      enabled: !!organizations?.[0]?.id && !!debouncedStartDate && !!debouncedEndDate,
      refetchOnWindowFocus: false
    }
  )

  const handleExportCSV = () => {
    if (!cashFlowData) return

    const csvRows = [
      ["Cash Flow Statement", "", "", ""],
      ["Period", formatDate(cashFlowData.period.startDate), "to", formatDate(cashFlowData.period.endDate)],
      ["", "", "", ""],
      ["Operating Activities", "", "", ""],
      ["Revenue", "", "", formatCurrency(cashFlowData.operating.revenue)],
      ["Expenses", "", "", formatCurrency(cashFlowData.operating.expenses)],
      ["Non-Cash Adjustments", "", "", formatCurrency(cashFlowData.operating.nonCashAdjustments)],
      ["Net Operating Cash Flow", "", "", formatCurrency(cashFlowData.operating.netCashFlow)],
      ["", "", "", ""],
      ["Investing Activities", "", "", ""],
      ["Net Investing Cash Flow", "", "", formatCurrency(cashFlowData.investing.netCashFlow)],
      ["", "", "", ""],
      ["Financing Activities", "", "", ""],
      ["Net Financing Cash Flow", "", "", formatCurrency(cashFlowData.financing.netCashFlow)],
      ["", "", "", ""],
      ["Summary", "", "", ""],
      ["Beginning Cash", "", "", formatCurrency(cashFlowData.summary.beginningCash)],
      ["Net Cash Flow", "", "", formatCurrency(cashFlowData.summary.netCashFlow)],
      ["Ending Cash", "", "", formatCurrency(cashFlowData.summary.endingCash)],
    ]

    const csvContent = csvRows.map(row => row.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `cash-flow-${debouncedStartDate}-to-${debouncedEndDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center space-x-4">
            <a className="flex items-center space-x-2" href="/">
              <Logo size={32} showText={true} />
            </a>
            <h1 className="text-2xl font-bold">Cash Flow Statement</h1>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Print/PDF
            </Button>
          </div>
        </div>
      </div>

      <main className="container mx-auto py-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Report Parameters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
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
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <RefreshCw className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">Loading cash flow statement...</p>
              </CardContent>
            </Card>
          ) : cashFlowData ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Cash Flow Statement</CardTitle>
                  <CardDescription>
                    {formatDate(cashFlowData.period.startDate)} to {formatDate(cashFlowData.period.endDate)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Operating Activities */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Operating Activities</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Revenue</span>
                          <span className="font-medium">{formatCurrency(cashFlowData.operating.revenue)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Expenses</span>
                          <span className="font-medium text-red-600">({formatCurrency(cashFlowData.operating.expenses)})</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Non-Cash Adjustments</span>
                          <span className="font-medium">{formatCurrency(cashFlowData.operating.nonCashAdjustments)}</span>
                        </div>
                        <div className="border-t pt-2 flex justify-between font-bold">
                          <span>Net Operating Cash Flow</span>
                          <span className={cashFlowData.operating.netCashFlow >= 0 ? "text-green-600" : "text-red-600"}>
                            {formatCurrency(cashFlowData.operating.netCashFlow)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Investing Activities */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Investing Activities</h3>
                      <div className="flex justify-between font-bold">
                        <span>Net Investing Cash Flow</span>
                        <span className={cashFlowData.investing.netCashFlow >= 0 ? "text-green-600" : "text-red-600"}>
                          {formatCurrency(cashFlowData.investing.netCashFlow)}
                        </span>
                      </div>
                    </div>

                    {/* Financing Activities */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Financing Activities</h3>
                      <div className="flex justify-between font-bold">
                        <span>Net Financing Cash Flow</span>
                        <span className={cashFlowData.financing.netCashFlow >= 0 ? "text-green-600" : "text-red-600"}>
                          {formatCurrency(cashFlowData.financing.netCashFlow)}
                        </span>
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="border-t pt-4">
                      <h3 className="text-lg font-semibold mb-4">Summary</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Beginning Cash</span>
                          <span className="font-medium">{formatCurrency(cashFlowData.summary.beginningCash)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Net Cash Flow</span>
                          <span className={`font-medium ${cashFlowData.summary.netCashFlow >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {cashFlowData.summary.netCashFlow >= 0 ? <TrendingUp className="inline h-4 w-4 mr-1" /> : <TrendingDown className="inline h-4 w-4 mr-1" />}
                            {formatCurrency(cashFlowData.summary.netCashFlow)}
                          </span>
                        </div>
                        <div className="border-t pt-2 flex justify-between font-bold text-lg">
                          <span>Ending Cash</span>
                          <span className="text-blue-600">{formatCurrency(cashFlowData.summary.endingCash)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No Data Available</h3>
                <p className="text-muted-foreground">
                  Select a date range to view the cash flow statement
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}




