"use client"

import { useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
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
  ArrowLeft, 
  Search, 
  Filter,
  FileText,
  Calendar,
  DollarSign,
  Eye,
  Download,
} from "lucide-react"

export default function CustomerInvoicesPage() {
  const params = useParams()
  const router = useRouter()
  const customerId = params.id as string
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [page, setPage] = useState(1)
  const limit = 20

  // Debounce search term
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  // Get user's organizations
  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()

  // Get customer
  const { data: customer } = trpc.customers.getById.useQuery(
    {
      id: customerId,
      organizationId: organizations?.[0]?.id || "",
    },
    { enabled: !!customerId && !!organizations?.[0]?.id }
  )

  // Get customer invoices
  const { data: invoicesData, isLoading } = trpc.customers.getInvoices.useQuery(
    {
      customerId,
      organizationId: organizations?.[0]?.id || "",
      page,
      limit,
      sortBy: "createdAt",
      sortOrder: "desc",
    },
    { enabled: !!customerId && !!organizations?.[0]?.id }
  )

  const invoices = invoicesData?.invoices || []
  const pagination = invoicesData?.pagination

  // Filter invoices client-side
  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const matchesSearch = !debouncedSearchTerm ||
        invoice.invoiceNumber.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        invoice.description?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())

      const matchesStatus = statusFilter === "all" || invoice.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [invoices, debouncedSearchTerm, statusFilter])

  // Summary stats
  const summaryStats = useMemo(() => {
    const totalValue = invoices.reduce((sum, invoice) => sum + Number(invoice.total), 0)
    const paidCount = invoices.filter((invoice) => invoice.status === "PAID").length
    const overdueCount = invoices.filter((invoice) => invoice.status === "OVERDUE").length
    const outstandingValue = invoices
      .filter((invoice) => invoice.status !== "PAID" && invoice.status !== "CANCELLED")
      .reduce((sum, invoice) => sum + Number(invoice.total), 0)

    return { totalValue, paidCount, overdueCount, outstandingValue }
  }, [invoices])

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "PAID":
        return "default"
      case "SENT":
        return "secondary"
      case "OVERDUE":
        return "destructive"
      case "DRAFT":
        return "outline"
      case "CANCELLED":
        return "secondary"
      default:
        return "outline"
    }
  }

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
          <Link href={`/customers/${customerId}`} className="mr-4">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Customer
            </Button>
          </Link>
          <div className="flex flex-1 items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">
                Invoices - {customer?.name || "Customer"}
              </h1>
              <p className="text-sm text-muted-foreground">
                All invoices for this customer
              </p>
            </div>
            <Link href={`/invoices/new?customerId=${customerId}`}>
              <Button>
                <FileText className="mr-2 h-4 w-4" />
                New Invoice
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto py-6">
        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summaryStats.totalValue, customer?.currency || "GBP")}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summaryStats.outstandingValue, customer?.currency || "GBP")}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Paid</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.paidCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{summaryStats.overdueCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by invoice number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="SENT">Sent</SelectItem>
                    <SelectItem value="PAID">Paid</SelectItem>
                    <SelectItem value="OVERDUE">Overdue</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoices Table */}
        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
            <CardDescription>
              {pagination?.total || 0} invoice{pagination?.total !== 1 ? "s" : ""} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredInvoices.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No invoices found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || statusFilter !== "all"
                    ? "Try adjusting your filters"
                    : "This customer doesn't have any invoices yet"}
                </p>
                {!searchTerm && statusFilter === "all" && (
                  <Link href={`/invoices/new?customerId=${customerId}`}>
                    <Button>
                      <FileText className="mr-2 h-4 w-4" />
                      Create First Invoice
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
                        <th className="h-12 px-4 text-left align-middle font-medium">Invoice #</th>
                        <th className="h-12 px-4 text-left align-middle font-medium">Date</th>
                        <th className="h-12 px-4 text-left align-middle font-medium">Due Date</th>
                        <th className="h-12 px-4 text-left align-middle font-medium">Amount</th>
                        <th className="h-12 px-4 text-left align-middle font-medium">Status</th>
                        <th className="h-12 px-4 text-right align-middle font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map((invoice) => (
                        <tr key={invoice.id} className="border-b hover:bg-muted/50">
                          <td className="p-4">
                            <div className="font-medium">{invoice.invoiceNumber}</div>
                            {invoice.description && (
                              <div className="text-sm text-muted-foreground">
                                {invoice.description}
                              </div>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="text-sm">{formatDate(invoice.date)}</div>
                          </td>
                          <td className="p-4">
                            <div className="text-sm">{formatDate(invoice.dueDate)}</div>
                          </td>
                          <td className="p-4">
                            <div className="font-medium">
                              {formatCurrency(Number(invoice.total), invoice.currency)}
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge variant={getStatusBadgeVariant(invoice.status)}>
                              {invoice.status}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-end space-x-2">
                              <Link href={`/invoices/${invoice.id}`}>
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button variant="ghost" size="sm">
                                <Download className="h-4 w-4" />
                              </Button>
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
                      Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, pagination.total)} of {pagination.total} invoices
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




