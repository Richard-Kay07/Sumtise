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
  Eye,
  ArrowLeft,
  Building2,
  CheckCircle,
  AlertCircle,
} from "lucide-react"

export default function JournalEntriesPage() {
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

  // Get journal entries
  const { data: journalsData, isLoading } = trpc.transactions.getJournalEntries.useQuery(
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

  const journals = journalsData?.journals || []
  const pagination = journalsData?.pagination

  // Filter journals by search term
  const filteredJournals = useMemo(() => {
    if (!debouncedSearchTerm) return journals
    
    return journals.filter((journal) =>
      journal.description.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      journal.reference?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    )
  }, [journals, debouncedSearchTerm])

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
          <Link href="/transactions" className="mr-4">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Transactions
            </Button>
          </Link>
          <div className="flex flex-1 items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Journal Entries</h1>
              <p className="text-sm text-muted-foreground">
                Manual journal entries and adjustments
              </p>
            </div>
            <Link href="/transactions/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Journal Entry
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto py-6">
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
                    placeholder="Search by description or reference..."
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

        {/* Journal Entries */}
        <div className="space-y-4">
          {filteredJournals.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">No journal entries found</h3>
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
              </CardContent>
            </Card>
          ) : (
            filteredJournals.map((journal) => {
              const isBalanced = Math.abs(journal.totalDebits - journal.totalCredits) < 0.01
              
              return (
                <Card key={journal.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center space-x-2">
                          <span>{journal.description}</span>
                          {isBalanced ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-600" />
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {formatDate(journal.date)} {journal.reference && `• ${journal.reference}`}
                        </CardDescription>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={isBalanced ? "default" : "destructive"}>
                          {isBalanced ? "Balanced" : "Unbalanced"}
                        </Badge>
                        {journal.transactions.length > 0 && (
                          <Link href={`/transactions/${journal.transactions[0].id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="rounded-md border">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="h-10 px-4 text-left align-middle font-medium text-sm">Account</th>
                              <th className="h-10 px-4 text-left align-middle font-medium text-sm">Description</th>
                              <th className="h-10 px-4 text-right align-middle font-medium text-sm">Debit</th>
                              <th className="h-10 px-4 text-right align-middle font-medium text-sm">Credit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {journal.transactions.map((tx) => (
                              <tr key={tx.id} className="border-b">
                                <td className="p-3">
                                  <div className="text-sm font-medium">{tx.account.code}</div>
                                  <div className="text-xs text-muted-foreground">{tx.account.name}</div>
                                </td>
                                <td className="p-3">
                                  <div className="text-sm">{tx.description}</div>
                                </td>
                                <td className="p-3 text-right">
                                  {Number(tx.debit) > 0 && (
                                    <div className="text-sm font-medium text-red-600">
                                      {formatCurrency(Number(tx.debit), tx.currency)}
                                    </div>
                                  )}
                                  {Number(tx.debit) === 0 && (
                                    <div className="text-sm text-muted-foreground">—</div>
                                  )}
                                </td>
                                <td className="p-3 text-right">
                                  {Number(tx.credit) > 0 && (
                                    <div className="text-sm font-medium text-green-600">
                                      {formatCurrency(Number(tx.credit), tx.currency)}
                                    </div>
                                  )}
                                  {Number(tx.credit) === 0 && (
                                    <div className="text-sm text-muted-foreground">—</div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t font-medium">
                              <td colSpan={2} className="p-3 text-right">Totals:</td>
                              <td className="p-3 text-right text-red-600">
                                {formatCurrency(journal.totalDebits, journal.transactions[0]?.currency || "GBP")}
                              </td>
                              <td className="p-3 text-right text-green-600">
                                {formatCurrency(journal.totalCredits, journal.transactions[0]?.currency || "GBP")}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-muted-foreground">
              Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, pagination.total)} of {pagination.total} journal entries
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
      </main>
    </div>
  )
}




