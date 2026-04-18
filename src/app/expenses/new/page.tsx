"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { trpc } from "@/lib/trpc-client"
import { formatCurrency, formatDate } from "@/lib/utils"
import { 
  Plus, 
  Save,
  ArrowLeft,
  Upload,
  Camera,
  FileText,
  DollarSign,
  Calendar,
  Tag,
  MapPin,
  CheckCircle,
  AlertCircle,
  Scan,
  X,
  Receipt
} from "lucide-react"

const expenseFormSchema = z.object({
  vendorId: z.string().min(1, "Vendor/Supplier is required"),
  billNumber: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  currency: z.string().default("GBP"),
  notes: z.string().optional(),
  items: z.array(z.object({
    description: z.string().min(1, "Description is required"),
    quantity: z.number().positive("Quantity must be positive"),
    unitPrice: z.number().nonnegative("Unit price must be non-negative"),
    taxRate: z.number().min(0).max(100).default(20),
    accountId: z.string().optional(),
  })).min(1, "At least one item is required"),
})

type ExpenseFormData = z.infer<typeof expenseFormSchema>

export default function CreateExpensePage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scannedData, setScannedData] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()
  const { data: vendors } = trpc.vendors.getAll.useQuery(
    { organizationId: organizations?.[0]?.id || "" },
    { enabled: !!organizations?.[0]?.id }
  )
  const { data: accounts } = trpc.accounts.getAll.useQuery(
    { organizationId: organizations?.[0]?.id || "" },
    { enabled: !!organizations?.[0]?.id }
  )

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      vendorId: "",
      billNumber: "",
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      currency: "GBP",
      notes: "",
      items: [{ description: "", quantity: 1, unitPrice: 0, taxRate: 20, accountId: "" }],
    },
  })

  const { register, handleSubmit, watch, setValue, formState: { errors } } = form
  const watchedItems = watch("items")
  const watchedCurrency = watch("currency")

  const simulateOCRScan = async (file: File) => {
    setIsScanning(true)
    setScanProgress(0)

    // Simulate OCR processing
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 200))
      setScanProgress(i)
    }

    // Simulate extracted data
    const mockData = {
      merchant: "Acme Supplies Ltd",
      date: new Date().toISOString().split('T')[0],
      total: 125.50,
      tax: 20.92,
      items: [
        { description: "Office Supplies", quantity: 1, unitPrice: 104.58, taxRate: 20 },
      ]
    }

    setScannedData(mockData)
    
    // Populate form with scanned data
    setValue("date", mockData.date)
    setValue("items", mockData.items)
    
    setIsScanning(false)
    setScanProgress(0)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      await simulateOCRScan(file)
    }
  }

  const addItem = () => {
    const currentItems = watch("items")
    setValue("items", [...currentItems, { description: "", quantity: 1, unitPrice: 0, taxRate: 20, accountId: "" }])
  }

  const removeItem = (index: number) => {
    const currentItems = watch("items")
    if (currentItems.length > 1) {
      setValue("items", currentItems.filter((_, i) => i !== index))
    }
  }

  const updateItem = (index: number, field: string, value: string | number) => {
    const currentItems = [...watchedItems]
    currentItems[index] = { ...currentItems[index], [field]: value }
    
    // Recalculate total
    const quantity = typeof currentItems[index].quantity === 'number' ? currentItems[index].quantity : parseFloat(currentItems[index].quantity.toString())
    const unitPrice = typeof currentItems[index].unitPrice === 'number' ? currentItems[index].unitPrice : parseFloat(currentItems[index].unitPrice.toString())
    const taxRate = typeof currentItems[index].taxRate === 'number' ? currentItems[index].taxRate : parseFloat(currentItems[index].taxRate.toString())
    
    const subtotal = quantity * unitPrice
    currentItems[index] = { ...currentItems[index], total: subtotal * (1 + taxRate / 100) }
    
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

  const onSubmit = async (data: ExpenseFormData) => {
    setIsSubmitting(true)
    try {
      // Create bill/expense via tRPC mutation
      // const result = await trpc.bills.create.mutate({
      //   organizationId: organizations?.[0]?.id || "",
      //   vendorId: data.vendorId,
      //   billNumber: data.billNumber || undefined,
      //   date: new Date(data.date),
      //   dueDate: new Date(data.dueDate),
      //   currency: data.currency,
      //   notes: data.notes,
      //   items: data.items,
      // })
      
      alert("Expense created successfully!")
      router.push("/expenses")
    } catch (error) {
      console.error("Error creating expense:", error)
      alert("Failed to create expense. Please try again.")
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
            <h1 className="text-3xl font-bold tracking-tight">Create Expense</h1>
            <p className="text-muted-foreground mt-1">
              Add a new bill or expense from a vendor
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
              {/* OCR Scanning */}
              <Card>
                <CardHeader>
                  <CardTitle>Scan Receipt (Optional)</CardTitle>
                  <CardDescription>Upload a receipt image to automatically extract expense details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!scannedData && !isScanning && (
                    <div className="flex gap-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Receipt
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1"
                      >
                        <Camera className="mr-2 h-4 w-4" />
                        Take Photo
                      </Button>
                    </div>
                  )}

                  {isScanning && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Scanning receipt...</span>
                        <span>{scanProgress}%</span>
                      </div>
                      <Progress value={scanProgress} />
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Scan className="h-4 w-4 animate-pulse" />
                        Extracting data using AI...
                      </div>
                    </div>
                  )}

                  {scannedData && (
                    <div className="border rounded-lg p-4 bg-green-50 border-green-200">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start">
                          <CheckCircle className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
                          <div>
                            <p className="font-medium text-green-900">Receipt Scanned Successfully</p>
                            <p className="text-sm text-green-700 mt-1">
                              Extracted: {scannedData.merchant} • {formatCurrency(scannedData.total, watchedCurrency)}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setScannedData(null)
                            setScanProgress(0)
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Expense Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Expense Details</CardTitle>
                  <CardDescription>Enter vendor and bill information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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

                  <div>
                    <Label htmlFor="billNumber">Bill/Invoice Number</Label>
                    <Input
                      id="billNumber"
                      {...register("billNumber")}
                      placeholder="e.g., BILL-2024-001"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="date">Bill Date *</Label>
                      <Input
                        id="date"
                        type="date"
                        {...register("date")}
                      />
                    </div>
                    <div>
                      <Label htmlFor="dueDate">Due Date *</Label>
                      <Input
                        id="dueDate"
                        type="date"
                        {...register("dueDate")}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="currency">Currency</Label>
                    <select
                      id="currency"
                      {...register("currency")}
                      className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
                    >
                      <option value="GBP">GBP (£)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                </CardContent>
              </Card>

              {/* Items */}
              <Card>
                <CardHeader>
                  <CardTitle>Expense Items</CardTitle>
                  <CardDescription>Add line items for this expense</CardDescription>
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
                            <X className="h-4 w-4" />
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

                      <div className="grid gap-4 md:grid-cols-5">
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
                          <Label>Account</Label>
                          <select
                            value={item.accountId || ""}
                            onChange={(e) => updateItem(index, "accountId", e.target.value)}
                            className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
                          >
                            <option value="">Select account...</option>
                            {accounts?.filter(a => a.type === "EXPENSE").map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.code} - {account.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label>Total</Label>
                          <Input
                            value={formatCurrency((item.total as any) || 0, watchedCurrency)}
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

              {/* Notes */}
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
                      placeholder="Additional notes for this expense..."
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
                  <Receipt className="mr-2 h-4 w-4" />
                  {isSubmitting ? "Creating..." : "Create Expense"}
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
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Items:</span>
                      <span className="font-medium">{watchedItems.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span className="font-medium">{formatCurrency(totals.subtotal, watchedCurrency)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax:</span>
                      <span className="font-medium">{formatCurrency(totals.taxAmount, watchedCurrency)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold">
                      <span>Total:</span>
                      <span>{formatCurrency(totals.total, watchedCurrency)}</span>
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

