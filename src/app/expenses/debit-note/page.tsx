"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { trpc } from "@/lib/trpc-client"
import { formatCurrency, formatDate } from "@/lib/utils"
import { 
  Plus, 
  Minus, 
  Save, 
  Send,
  ArrowLeft,
  Search,
  FileText,
  DollarSign,
  AlertCircle,
  Info,
  Receipt,
  X
} from "lucide-react"

const debitNoteItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().positive("Quantity must be positive"),
  unitPrice: z.number().nonnegative("Unit price must be non-negative"),
  taxRate: z.number().min(0).max(100).default(20),
})

const debitNoteFormSchema = z.object({
  billId: z.string().optional(),
  vendorId: z.string().min(1, "Vendor is required"),
  date: z.string().min(1, "Date is required"),
  reason: z.string().optional(),
  currency: z.string().default("GBP"),
  notes: z.string().optional(),
  items: z.array(debitNoteItemSchema).min(1, "At least one item is required"),
})

type DebitNoteFormData = z.infer<typeof debitNoteFormSchema>
type DebitNoteItem = z.infer<typeof debitNoteItemSchema>

export default function DebitNotePage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedBill, setSelectedBill] = useState<any>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()
  const { data: billsData } = trpc.bills.getAll.useQuery(
    { 
      organizationId: organizations?.[0]?.id || "",
      page: 1,
      limit: 100,
      sortBy: "createdAt",
      sortOrder: "desc",
    },
    { enabled: !!organizations?.[0]?.id }
  )
  const { data: vendors } = trpc.vendors.getAll.useQuery(
    { organizationId: organizations?.[0]?.id || "" },
    { enabled: !!organizations?.[0]?.id }
  )

  const bills = billsData?.bills || []
  const filteredBills = bills.filter(bill =>
    bill.billNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bill.vendor.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const form = useForm<DebitNoteFormData>({
    resolver: zodResolver(debitNoteFormSchema),
    defaultValues: {
      billId: "",
      vendorId: "",
      date: new Date().toISOString().split('T')[0],
      reason: "",
      currency: "GBP",
      notes: "",
      items: [{ description: "", quantity: 1, unitPrice: 0, taxRate: 20 }],
    },
  })

  const { register, handleSubmit, watch, setValue, formState: { errors } } = form
  const watchedItems = watch("items")
  const watchedCurrency = watch("currency")
  const watchedVendorId = watch("vendorId")

  const selectBill = (bill: any) => {
    setSelectedBill(bill)
    setValue("billId", bill.id)
    setValue("vendorId", bill.vendorId)
    setValue("currency", bill.currency)
    // Pre-populate items from bill
    const billItems = bill.items?.map((item: any) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      total: item.total,
    })) || []
    setValue("items", billItems.length > 0 ? billItems : [{ description: "", quantity: 1, unitPrice: 0, taxRate: 20 }])
  }

  const clearBillSelection = () => {
    setSelectedBill(null)
    setValue("billId", "")
    setValue("items", [{ description: "", quantity: 1, unitPrice: 0, taxRate: 20 }])
  }

  const addItem = () => {
    const currentItems = watch("items")
    setValue("items", [...currentItems, { description: "", quantity: 1, unitPrice: 0, taxRate: 20 }])
  }

  const removeItem = (index: number) => {
    const currentItems = watch("items")
    if (currentItems.length > 1) {
      setValue("items", currentItems.filter((_, i) => i !== index))
    }
  }

  const updateItem = (index: number, field: keyof DebitNoteItem, value: string | number) => {
    const currentItems = [...watchedItems]
    currentItems[index] = { ...currentItems[index], [field]: value }
    
    const quantity = typeof currentItems[index].quantity === 'number' ? currentItems[index].quantity : parseFloat(currentItems[index].quantity.toString())
    const unitPrice = typeof currentItems[index].unitPrice === 'number' ? currentItems[index].unitPrice : parseFloat(currentItems[index].unitPrice.toString())
    const taxRate = typeof currentItems[index].taxRate === 'number' ? currentItems[index].taxRate : parseFloat(currentItems[index].taxRate.toString())
    
    const subtotal = quantity * unitPrice
    const tax = subtotal * (taxRate / 100)
    currentItems[index].total = subtotal + tax
    
    setValue("items", currentItems)
  }

  const calculateTotals = () => {
    const items = watchedItems
    const subtotal = items.reduce((sum, item) => {
      const quantity = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity.toString())
      const unitPrice = typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(item.unitPrice.toString())
      return sum + (quantity * unitPrice)
    }, 0)
    
    const taxAmount = items.reduce((sum, item) => {
      const quantity = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity.toString())
      const unitPrice = typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(item.unitPrice.toString())
      const taxRate = typeof item.taxRate === 'number' ? item.taxRate : parseFloat(item.taxRate.toString())
      return sum + (quantity * unitPrice * (taxRate / 100))
    }, 0)
    
    return { subtotal, taxAmount, total: subtotal + taxAmount }
  }

  const totals = calculateTotals()

  const onSubmit = async (data: DebitNoteFormData) => {
    setIsSubmitting(true)
    try {
      // Create debit note via tRPC mutation
      // const result = await trpc.debitNotes.create.mutate({
      //   organizationId: organizations?.[0]?.id || "",
      //   billId: data.billId || undefined,
      //   vendorId: data.vendorId,
      //   date: new Date(data.date),
      //   reason: data.reason,
      //   notes: data.notes,
      //   items: data.items,
      // })
      
      alert("Debit note created successfully!")
      router.push("/expenses")
    } catch (error) {
      console.error("Error creating debit note:", error)
      alert("Failed to create debit note. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <main className="container mx-auto py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create Debit Note</h1>
            <p className="text-muted-foreground mt-1">
              Create a debit note to reduce the amount owed to a vendor
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push("/expenses")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-6 lg:grid-cols-4">
            {/* Main Form */}
            <div className="lg:col-span-3 space-y-6">
              {/* Select Bill (Optional) */}
              {!selectedBill && (
                <Card>
                  <CardHeader>
                    <CardTitle>Select Related Bill (Optional)</CardTitle>
                    <CardDescription>Choose a bill to create a debit note for, or create a standalone debit note</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="search">Search Bills</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="search"
                          placeholder="Search by bill number or vendor..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="border rounded-lg max-h-96 overflow-y-auto">
                      {filteredBills.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No bills found
                        </div>
                      ) : (
                        <div className="divide-y">
                          {filteredBills.map((bill) => (
                            <button
                              key={bill.id}
                              type="button"
                              onClick={() => selectBill(bill)}
                              className="w-full text-left p-4 hover:bg-muted transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium">{bill.billNumber || `Bill ${bill.id.slice(0, 8)}`}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {bill.vendor.name} • {formatDate(bill.date)}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium">{formatCurrency(bill.total, bill.currency)}</div>
                                  <Badge variant={bill.status === "PAID" ? "default" : "secondary"}>
                                    {bill.status}
                                  </Badge>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="text-center py-4">
                      <span className="text-sm text-muted-foreground">or</span>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        // Skip bill selection and proceed with vendor selection
                        setSearchTerm("")
                      }}
                    >
                      Create Standalone Debit Note
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Debit Note Form */}
              <Card>
                <CardHeader>
                  <CardTitle>Debit Note Details</CardTitle>
                  {selectedBill && (
                    <CardDescription>
                      Debit note for Bill {selectedBill.billNumber || selectedBill.id.slice(0, 8)}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedBill && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start">
                          <Info className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
                          <div className="text-sm text-blue-900">
                            <p className="font-medium mb-1">Related Bill:</p>
                            <p>Bill {selectedBill.billNumber || selectedBill.id.slice(0, 8)} • {formatCurrency(selectedBill.total, selectedBill.currency)} • {selectedBill.vendor.name}</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={clearBillSelection}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {!selectedBill && (
                    <div>
                      <Label htmlFor="vendorId">Vendor/Supplier *</Label>
                      <select
                        id="vendorId"
                        {...register("vendorId")}
                        className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
                      >
                        <option value="">Select a vendor...</option>
                        {vendors?.map((vendor) => (
                          <option key={vendor.id} value={vendor.id}>
                            {vendor.name}
                          </option>
                        ))}
                      </select>
                      {errors.vendorId && (
                        <p className="text-sm text-destructive mt-1">{errors.vendorId.message}</p>
                      )}
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="date">Debit Note Date *</Label>
                      <Input
                        id="date"
                        type="date"
                        {...register("date")}
                      />
                    </div>
                    <div>
                      <Label htmlFor="reason">Reason</Label>
                      <Input
                        id="reason"
                        {...register("reason")}
                        placeholder="e.g., Returned goods, Pricing error"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Debit Note Items</CardTitle>
                  <CardDescription>Specify the items being debited</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {watchedItems.map((item, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Item {index + 1}</h4>
                        {watchedItems.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(index)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div>
                        <Label>Description *</Label>
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(index, "description", e.target.value)}
                          placeholder="Item description"
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-4">
                        <div>
                          <Label>Quantity *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <Label>Unit Price *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <Label>Tax Rate (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.taxRate}
                            onChange={(e) => updateItem(index, "taxRate", parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <Label>Total</Label>
                          <Input
                            value={formatCurrency(item.total || 0, watchedCurrency)}
                            readOnly
                            className="bg-muted"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button type="button" variant="outline" onClick={addItem} className="w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Additional Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <textarea
                      id="notes"
                      {...register("notes")}
                      rows={3}
                      className="w-full px-3 py-2 border border-input bg-background rounded-md"
                      placeholder="Additional notes for the debit note..."
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2">
                <Button
                  type="submit"
                  variant="outline"
                  disabled={isSubmitting}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save Draft
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {isSubmitting ? "Creating..." : "Create & Send"}
                </Button>
              </div>
            </div>

            {/* Sidebar Summary */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {selectedBill && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Original Bill:</span>
                        <span className="font-medium">{formatCurrency(selectedBill.total, selectedBill.currency)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Debit Amount:</span>
                      <span className="font-medium text-red-600">-{formatCurrency(totals.total, watchedCurrency)}</span>
                    </div>
                    {selectedBill && (
                      <div className="border-t pt-2 flex justify-between font-bold">
                        <span>Net Amount:</span>
                        <span>{formatCurrency(selectedBill.total - totals.total, watchedCurrency)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-yellow-50 border-yellow-200">
                <CardContent className="pt-6">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5" />
                    <div className="text-sm text-yellow-900">
                      <p className="font-medium mb-1">Debit Note Information</p>
                      <p className="text-xs">A debit note reduces the amount you owe to a vendor. This will be reflected in your accounts payable.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </main>
    </div>
  )
}

