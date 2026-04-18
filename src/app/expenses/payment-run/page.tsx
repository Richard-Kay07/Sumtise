"use client"

import { useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { trpc } from "@/lib/trpc-client"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useDebounce } from "@/lib/hooks/useDebounce"
import { 
  AlertCircle,
  Download,
  Filter,
  Search,
  Banknote,
  Calendar,
  User,
  DollarSign,
  FileText,
  Send,
  CheckSquare,
  Square
} from "lucide-react"

interface SupplierPayment {
  id: string
  supplierName: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  amount: number
  currency: string
  bankAccount: string
  selected: boolean
}

export default function PaymentRunPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState("bank-transfer")
  const [selectedSupplierPayments, setSelectedSupplierPayments] = useState<Set<string>>(new Set())
  const [showPreview, setShowPreview] = useState(false)
  
  // Debounce search to improve performance
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  // Mock data - replace with actual tRPC query
  const mockPayments: SupplierPayment[] = [
    {
      id: "1",
      supplierName: "Office Supplies Ltd",
      invoiceNumber: "INV-001",
      invoiceDate: "2024-01-15",
      dueDate: "2024-02-15",
      amount: 1250.00,
      currency: "GBP",
      bankAccount: "GB29 NWBK 6016 1331 9268 19",
      selected: false
    },
    {
      id: "2",
      supplierName: "Tech Solutions Inc",
      invoiceNumber: "INV-002",
      invoiceDate: "2024-01-20",
      dueDate: "2024-02-20",
      amount: 3500.00,
      currency: "GBP",
      bankAccount: "GB82 WEST 1234 5698 7654 32",
      selected: false
    },
    {
      id: "3",
      supplierName: "Professional Services Co",
      invoiceNumber: "INV-003",
      invoiceDate: "2024-01-25",
      dueDate: "2024-02-25",
      amount: 2800.00,
      currency: "GBP",
      bankAccount: "GB33 BUKB 2020 1555 5555 55",
      selected: false
    },
  ]

  const [payments, setPayments] = useState<SupplierPayment[]>(mockPayments)

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedSupplierPayments)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedSupplierPayments(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedSupplierPayments.size === payments.length) {
      setSelectedSupplierPayments(new Set())
    } else {
      setSelectedSupplierPayments(new Set(payments.map(p => p.id)))
    }
  }

  // Memoize filtered payments
  const filteredPayments = useMemo(() => {
    if (!debouncedSearchTerm) {
      return payments
    }
    return payments.filter(payment =>
      payment.supplierName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      payment.invoiceNumber.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    )
  }, [payments, debouncedSearchTerm])

  // Memoize selected payments calculations
  const selectedPayments = useMemo(() => {
    return payments.filter(p => selectedSupplierPayments.has(p.id))
  }, [payments, selectedSupplierPayments])

  const totalAmount = useMemo(() => {
    return selectedPayments.reduce((sum, p) => sum + p.amount, 0)
  }, [selectedPayments])

  const paymentCount = selectedPayments.length

  const handlePaymentRun = () => {
    if (selectedPayments.length === 0) {
      alert("Please select at least one invoice to pay")
      return
    }
    // Process payment run
    alert(`Processing payment run for ${paymentCount} invoice(s) totaling ${formatCurrency(totalAmount)}`)
  }

  const exportPaymentFile = () => {
    if (selectedPayments.length === 0) {
      alert("Please select at least one invoice to export")
      return
    }
    // Export payment file (CSV, BACS, etc.)
    alert("↵Exporting payment file for selected invoices...")
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <main className="container mx-auto py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Payment Run</h1>
            <p className="text-muted-foreground mt-1">
              Process batch payments to suppliers
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={exportPaymentFile}>
              <Download className="mr-2 h-4 w-4" />
              Export File
            </Button>
            <Button onClick={handlePaymentRun} disabled={selectedPayments.length === 0}>
              <Send className="mr-2 h-4 w-4" />
              Process Payment Run
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Payment Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Settings</CardTitle>
                <CardDescription>Configure payment run parameters</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="payment-date">Payment Date</Label>
                    <Input
                      id="payment-date"
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="payment-method">Payment Method</Label>
                    <select
                      id="payment-method"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
                    >
                      <option value="bank-transfer">Bank Transfer</option>
                      <option value="bacs">BACS</option>
                      <option value="fps">Faster Payments</option>
                      <option value="chaps">CHAPS</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Search and Filter */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <Label htmlFor="search">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="search"
                        placeholder="Search suppliers or invoice numbers..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Supplier Invoices */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Outstanding Invoices</CardTitle>
                  <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                    {selectedSupplierPayments.size === payments.length ? (
                      <>
                        <CheckSquare className="mr-2 h-4 w-4" />
                        Deselect All
                      </>
                    ) : (
                      <>
                        <Square className="mr-2 h-4 w-4" />
                        Select All
                      </>
                    )}
                  </Button>
                </div>
                <CardDescription>
                  Select invoices to include in this payment run
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredPayments.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">No invoices found</h3>
                    <p className="text-muted-foreground">
                      No outstanding invoices match your search criteria.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-4 w-12">
                            <Square className="h-4 w-4 text-muted-foreground" />
                          </th>
                          <th className="text-left p-4 font-medium">Supplier</th>
                          <th className="text-left p-4 font-medium">Invoice</th>
                          <th className="text-left p-4 font-medium">Due Date</th>
                          <th className="text-left p-4 font-medium">Amount</th>
                          <th className="text-left p-4 font-medium">Bank Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPayments.map((payment) => (
                          <tr 
                            key={payment.id} 
                            className="border-b hover:bg-muted/50 cursor-pointer"
                            onClick={() => toggleSelect(payment.id)}
                          >
                            <td className="p-4">
                              {selectedSupplierPayments.has(payment.id) ? (
                                <CheckSquare className="h-4 w-4 text-primary" />
                              ) : (
                                <Square className="h-4 w-4 text-muted-foreground" />
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center">
                                <User className="mr-2 h-4 w-4 text-muted-foreground" />
                                {payment.supplierName}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="font-medium">{payment.invoiceNumber}</div>
                              <div className="text-sm text-muted-foreground">
                                {formatDate(payment.invoiceDate)}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center">
                                <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                                {formatDate(payment.dueDate)}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center">
                                <DollarSign className="mr-2 h-4 w-4 text-muted-foreground" />
                                {formatCurrency(payment.amount, payment.currency)}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="text-sm text-muted-foreground">
                                {payment.bankAccount}
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
          </div>

          {/* Sidebar Summary */}
          <div className="space-y-6">
            {/* Summary Card */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Selected Invoices</span>
                  <span className="font-medium">{paymentCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Amount</span>
                  <span className="text-2xl font-bold">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
                <div className="pt-4 border-t">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Payment Date</span>
                    <span className="font-medium">{formatDate(paymentDate)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Method</span>
                    <Badge>{paymentMethod}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setSearchTerm("")}
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Clear Filters
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Preview File
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  disabled
                >
                  <Banknote className="mr-2 h-4 w-4" />
                  Payment History
                </Button>
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="bg-muted">
              <CardContent className="pt-6">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium mb-1">Payment Run Info</p>
                    <p>Selected invoices will be processed as a batch payment. Ensure all bank details are correct before proceeding.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

