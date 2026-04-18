"use client"

import { useState } from "react"
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
  Printer,
  RefreshCw,
  FileText,
  AlertTriangle
} from "lucide-react"
import { useDebounce } from "@/lib/hooks/useDebounce"

export default function AgedReceivablesPage() {
  const [asOfDate, setAsOfDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [currency, setCurrency] = useState<string>("")
  const [page, setPage] = useState(1)
  const limit = 50

  const debouncedAsOfDate = useDebounce(asOfDate, 500)

  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()

  const { data: agedData, isLoading } = trpc.reports.getAgedReceivables.useQuery(
    {
      organizationId: organizations?.[0]?.id || "",
      asOfDate: debouncedAsOfDate,
      currency: currency || undefined,
      page,
      limit,
    },
    { 
      enabled: !!organizations?.[0]?.id && !!debouncedAsOfDate,
      refetchOnWindowFocus: false
    }
  )

  const handleExportCSV = () => {
    if (!agedData) return

    const csvRows = [
      ["Invoice #", "Customer", "Date", "Due Date", "Total", "Balance", "Current", "0-30 Days", "31-60 Days", "61-90 Days", "90+ Days", "Days Overdue"],
      ...agedData.items.map(item => [
        item.invoiceNumber,
        item.customerName,
        formatDate(item.date),
        formatDate(item.dueDate),
        formatCurrency(item.total),
        formatCurrency(item.balance),
        formatCurrency(item.aging.current),
        formatCurrency(item.aging.days0_30),
        formatCurrency(item.aging.days31_60),
        formatCurrency(item.aging.days61_90),
        formatCurrency(item.aging.days90Plus),
        item.daysOverdue.toString()
      ]),
      ["", "", "", "", "TOTAL", formatCurrency(agedData.totals.total), formatCurrency(agedData.totals.current), formatCurrency(agedData.totals.days0_30), formatCurrency(agedData.totals.days31_60), formatCurrency(agedData.totals.days61_90), formatCurrency(agedData.totals.days90Plus), ""]
    ]

    const csvContent = csvRows.map(row => row.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `aged-receivables-${debouncedAsOfDate}.csv`
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
            <h1 className="text-2xl font-bold">Aged Receivables</h1>
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
              <div className="grid gap-4 md:grid-cols-2">
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
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <RefreshCw className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">Loading aged receivables...</p>
              </CardContent>
            </Card>
          ) : agedData ? (
            <>
              {/* Summary Totals */}
              <Card>
                <CardHeader>
                  <CardTitle>Summary Totals</CardTitle>
                  <CardDescription>
                    As of {formatDate(agedData.asOfDate)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-6">
                    <div>
                      <div className="text-sm text-muted-foreground">Current</div>
                      <div className="text-xl font-bold">{formatCurrency(agedData.totals.current)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">0-30 Days</div>
                      <div className="text-xl font-bold">{formatCurrency(agedData.totals.days0_30)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">31-60 Days</div>
                      <div className="text-xl font-bold text-orange-600">{formatCurrency(agedData.totals.days31_60)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">61-90 Days</div>
                      <div className="text-xl font-bold text-red-600">{formatCurrency(agedData.totals.days61_90)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">90+ Days</div>
                      <div className="text-xl font-bold text-red-700">{formatCurrency(agedData.totals.days90Plus)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Total Outstanding</div>
                      <div className="text-xl font-bold">{formatCurrency(agedData.totals.total)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Detailed Report */}
              <Card>
                <CardHeader>
                  <CardTitle>Detailed Report</CardTitle>
                  <CardDescription>
                    {agedData.pagination.total} invoice{agedData.pagination.total !== 1 ? 's' : ''} outstanding
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Invoice #</th>
                          <th className="text-left p-2">Customer</th>
                          <th className="text-left p-2">Date</th>
                          <th className="text-left p-2">Due Date</th>
                          <th className="text-right p-2">Total</th>
                          <th className="text-right p-2">Balance</th>
                          <th className="text-right p-2">Current</th>
                          <th className="text-right p-2">0-30</th>
                          <th className="text-right p-2">31-60</th>
                          <th className="text-right p-2">61-90</th>
                          <th className="text-right p-2">90+</th>
                          <th className="text-center p-2">Days Overdue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agedData.items.map((item) => (
                          <tr key={item.invoiceId} className="border-b hover:bg-muted/50">
                            <td className="p-2 font-mono text-sm">{item.invoiceNumber}</td>
                            <td className="p-2">{item.customerName}</td>
                            <td className="p-2">{formatDate(item.date)}</td>
                            <td className="p-2">{formatDate(item.dueDate)}</td>
                            <td className="p-2 text-right">{formatCurrency(item.total)}</td>
                            <td className="p-2 text-right font-medium">{formatCurrency(item.balance)}</td>
                            <td className="p-2 text-right">{formatCurrency(item.aging.current)}</td>
                            <td className="p-2 text-right">{formatCurrency(item.aging.days0_30)}</td>
                            <td className="p-2 text-right text-orange-600">{formatCurrency(item.aging.days31_60)}</td>
                            <td className="p-2 text-right text-red-600">{formatCurrency(item.aging.days61_90)}</td>
                            <td className="p-2 text-right text-red-700">{formatCurrency(item.aging.days90Plus)}</td>
                            <td className="p-2 text-center">
                              {item.daysOverdue > 0 ? (
                                <Badge variant="destructive">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  {item.daysOverdue}
                                </Badge>
                              ) : (
                                <Badge variant="outline">Current</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t-2 font-bold">
                          <td colSpan={5} className="p-2">Total</td>
                          <td className="p-2 text-right">{formatCurrency(agedData.totals.total)}</td>
                          <td className="p-2 text-right">{formatCurrency(agedData.totals.current)}</td>
                          <td className="p-2 text-right">{formatCurrency(agedData.totals.days0_30)}</td>
                          <td className="p-2 text-right">{formatCurrency(agedData.totals.days31_60)}</td>
                          <td className="p-2 text-right">{formatCurrency(agedData.totals.days61_90)}</td>
                          <td className="p-2 text-right">{formatCurrency(agedData.totals.days90Plus)}</td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {agedData.pagination.pages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-muted-foreground">
                        Page {agedData.pagination.page} of {agedData.pagination.pages}
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => Math.min(agedData.pagination.pages, p + 1))}
                          disabled={page >= agedData.pagination.pages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No Data Available</h3>
                <p className="text-muted-foreground">
                  Select a date to view aged receivables
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}




