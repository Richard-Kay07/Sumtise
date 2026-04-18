"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { trpc } from "@/lib/trpc-client"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useDebounce } from "@/lib/hooks/useDebounce"
import Link from "next/link"
import { 
  Plus, 
  Search, 
  Filter,
  FileText,
  Calendar,
  DollarSign,
  Eye,
  ArrowUp,
  ArrowDown,
  Building2,
} from "lucide-react"

export default function TransactionsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [accountFilter, setAccountFilter] = useState<string>("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [page, setPage] = useState(1)
  const limit = 20

  // Debounce search term
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  // Get user's organizations
  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()

  // Get chart of accounts for filter
  const { data: accountsData } = trpc.chartOfAccounts.getAll.useQuery(
    { organizationId: organizations?.[0]?.id || "" },
    { enabled: !!organizations?.[0]?.id }
  )

  // Get transactions
  const { data: transactionsData, isLoading } = trpc.transactions.getAll.useQuery(
    {
      organizationId: organizations?.[0]?.id || "",
      page,
      limit,
      sortBy: "date",
      sortOrder: "desc",
      accountId: accountFilter !== "all" ? accountFilter : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    },
    { enabled: !!organizations?.[0]?.id }
  )

  const transactions = transactionsData?.transactions || []
  const pagination = transactionsData?.pagination

  // Summary stats
  const summaryStats = useMemo(() => {
    const totalDebits = transactions.reduce((sum, tx) => sum + Number(tx.debit), 0)
    const totalCredits = transactions.reduce((sum, tx) => sum + Number(tx.credit), 0)
    const transactionCount = transactions.length
    
    return { totalDebits, totalCredits, transactionCount }
  }, [transactions])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <Link className="mr-6" href="/">
              <Building2 className="h-6 w-6" />
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="w-full flex-1 md:w-auto md:flex-none">
              <h1 className="text-2xl font-bold">Transactions</h1>
            </div>
            <nav className="flex items-center space-x-2">
              <Link href="/transactions/journal">
                <Button variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  Journal Entries
                </Button>
              </Link>
              <Link href="/transactions/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Journal Entry
                </Button>
              </Link>
            </nav>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto py-6">
        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Debits</CardTitle>
              <ArrowDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(summaryStats.totalDebits, "GBP")}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Credits</CardTitle>
              <ArrowUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(summaryStats.totalCredits, "GBP")}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transactions</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.transactionCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label>Account</Label>
                <Select value={accountFilter} onValueChange={setAccountFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    {accountsData?.accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>
              All ledger transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No transactions found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || accountFilter !== "all" || startDate || endDate
                    ? "Try adjusting your filters"
                    : "Get started by creating your first journal entry"}
                </p>
                {!searchTerm && accountFilter === "all" && !startDate && !endDate && (
                  <Link href="/transactions/new">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Journal Entry
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="h-12 px-4 text-left align-middle font-medium">Date</th>
                        <th className="h-12 px-4 text-left align-middle font-medium">Account</th>
                        <th className="h-12 px-4 text-left align-middle font-medium">Description</th>
                        <th className="h-12 px-4 text-left align-middle font-medium">Reference</th>
                        <th className="h-12 px-4 text-right align-middle font-medium">Debit</th>
                        <th className="h-12 px-4 text-right align-middle font-medium">Credit</th>
                        <th className="h-12 px-4 text-right align-middle font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((transaction) => (
                        <tr key={transaction.id} className="border-b hover:bg-muted/50">
                          <td className="p-4">
                            <div className="text-sm">{formatDate(transaction.date)}</div>
                          </td>
                          <td className="p-4">
                            <div className="font-medium">{transaction.account.code}</div>
                            <div className="text-sm text-muted-foreground">{transaction.account.name}</div>
                          </td>
                          <td className="p-4">
                            <div className="text-sm">{transaction.description}</div>
                          </td>
                          <td className="p-4">
                            <div className="text-sm text-muted-foreground">
                              {transaction.reference || "—"}
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            {Number(transaction.debit) > 0 && (
                              <div className="text-sm font-medium text-red-600">
                                {formatCurrency(Number(transaction.debit), transaction.currency)}
                              </div>
                            )}
                            {Number(transaction.debit) === 0 && (
                              <div className="text-sm text-muted-foreground">—</div>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            {Number(transaction.credit) > 0 && (
                              <div className="text-sm font-medium text-green-600">
                                {formatCurrency(Number(transaction.credit), transaction.currency)}
                              </div>
                            )}
                            {Number(transaction.credit) === 0 && (
                              <div className="text-sm text-muted-foreground">—</div>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-end space-x-2">
                              <Link href={`/transactions/${transaction.id}`}>
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {pagination && pagination.pages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, pagination.total)} of {pagination.total} transactions
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page - 1)}
                        disabled={page === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page + 1)}
                        disabled={page >= pagination.pages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}




