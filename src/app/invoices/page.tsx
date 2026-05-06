"use client"

import { useState, useMemo, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { trpc } from "@/lib/trpc-client"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useDebounce } from "@/lib/hooks/useDebounce"
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Edit, 
  Trash2,
  FileText,
  Calendar,
  DollarSign,
  User
} from "lucide-react"
import { Logo } from "@/components/logo"

export default function InvoicesPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  
  // Debounce search term to reduce API calls
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  const utils = trpc.useUtils()

  // Get user's organizations
  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()

  // Get invoices for the first organization
  const { data: invoicesData, isLoading } = trpc.invoices.getAll.useQuery(
    { 
      organizationId: organizations?.[0]?.id || "",
      page: 1,
      limit: 50,
      sortBy: "createdAt",
      sortOrder: "desc",
      ...(statusFilter !== "all" && { status: statusFilter as any })
    },
    { enabled: !!organizations?.[0]?.id }
  )

  const invoices = invoicesData?.invoices || []

  // Memoize status badge variant function
  const getStatusBadgeVariant = useCallback((status: string) => {
    switch (status) {
      case "PAID":
        return "default"
      case "SENT":
        return "secondary"
      case "OVERDUE":
        return "destructive"
      case "DRAFT":
        return "outline"
      default:
        return "outline"
    }
  }, [])

  const handleDownload = useCallback(async (invoiceId: string) => {
    if (!organizations?.[0]?.id) return
    setDownloadingId(invoiceId)
    try {
      const result = await utils.invoices.exportPDF.fetch({
        organizationId: organizations[0].id,
        id: invoiceId,
      })
      window.open(result.pdfUrl, "_blank")
    } catch (err) {
      console.error("PDF export failed", err)
    } finally {
      setDownloadingId(null)
    }
  }, [organizations, utils])

  // Memoize filtered invoices to avoid recalculating on every render
  const filteredInvoices = useMemo(() => {
    if (!debouncedSearchTerm && statusFilter === "all") {
      return invoices
    }
    
    return invoices.filter(invoice => {
      const matchesSearch = !debouncedSearchTerm || 
        invoice.invoiceNumber.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        invoice.customer.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      
      const matchesStatus = statusFilter === "all" || invoice.status === statusFilter
      
      return matchesSearch && matchesStatus
    })
  }, [invoices, debouncedSearchTerm, statusFilter])

  // Memoize summary calculations
  const summaryStats = useMemo(() => {
    const totalValue = invoices.reduce((sum, invoice) => sum + Number(invoice.total), 0)
    const paidCount = invoices.filter(invoice => invoice.status === "PAID").length
    const overdueCount = invoices.filter(invoice => invoice.status === "OVERDUE").length
    
    return { totalValue, paidCount, overdueCount }
  }, [invoices])

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
            <a className="mr-6" href="/">
              <Logo size={32} showText={true} />
            </a>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="w-full flex-1 md:w-auto md:flex-none">
              <h1 className="text-2xl font-bold">Invoices</h1>
            </div>
            <nav className="flex items-center space-x-2">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Invoice
              </Button>
            </nav>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto py-6">
        {/* Filters and Search */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filter Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search by invoice number or customer..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="md:w-48">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="DRAFT">Draft</option>
                  <option value="SENT">Sent</option>
                  <option value="PAID">Paid</option>
                  <option value="OVERDUE">Overdue</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoices Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Invoices ({filteredInvoices.length})</span>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
                <Button variant="outline" size="sm">
                  <Filter className="mr-2 h-4 w-4" />
                  Filter
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredInvoices.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No invoices found</h3>
                <p className="text-muted-foreground">
                  {searchTerm || statusFilter !== "all" 
                    ? "Try adjusting your search or filter criteria."
                    : "Get started by creating your first invoice."
                  }
                </p>
                <Button className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Invoice
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4 font-medium">Invoice</th>
                      <th className="text-left p-4 font-medium">Customer</th>
                      <th className="text-left p-4 font-medium">Date</th>
                      <th className="text-left p-4 font-medium">Due Date</th>
                      <th className="text-left p-4 font-medium">Amount</th>
                      <th className="text-left p-4 font-medium">Status</th>
                      <th className="text-left p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b hover:bg-muted/50">
                        <td className="p-4">
                          <div>
                            <div className="font-medium">{invoice.invoiceNumber}</div>
                            <div className="text-sm text-muted-foreground">
                              {invoice.currency}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center">
                            <User className="mr-2 h-4 w-4 text-muted-foreground" />
                            {invoice.customer.name}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center">
                            <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                            {formatDate(invoice.date)}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center">
                            <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                            {formatDate(invoice.dueDate)}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center">
                            <DollarSign className="mr-2 h-4 w-4 text-muted-foreground" />
                            {formatCurrency(Number(invoice.total), invoice.currency)}
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant={getStatusBadgeVariant(invoice.status)}>
                            {invoice.status}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/invoices/${invoice.id}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/invoices/${invoice.id}/edit`)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={downloadingId === invoice.id}
                              onClick={() => handleDownload(invoice.id)}
                            >
                              <Download className={`h-4 w-4 ${downloadingId === invoice.id ? "animate-pulse" : ""}`} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4 mt-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{invoices.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summaryStats.totalValue)}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Paid Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summaryStats.paidCount}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Overdue Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {summaryStats.overdueCount}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
