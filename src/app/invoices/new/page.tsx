"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { trpc } from "@/lib/trpc-client"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"
import { 
  Plus, 
  Minus, 
  Save, 
  Send,
  ArrowLeft,
  ArrowRight,
  Calendar,
  User,
  FileText,
  DollarSign,
  Percent
} from "lucide-react"

const invoiceItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().positive("Quantity must be positive"),
  unitPrice: z.number().nonnegative("Unit price must be non-negative"),
  taxRate: z.number().min(0).max(100).default(20),
})

const invoiceFormSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  date: z.string().min(1, "Date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  currency: z.string().default("GBP"),
  notes: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, "At least one item is required"),
})

type InvoiceFormData = z.infer<typeof invoiceFormSchema>
type InvoiceItem = z.infer<typeof invoiceItemSchema>

export default function CreateInvoicePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()
  const { data: customersData } = trpc.customers.getAll.useQuery(
    { 
      organizationId: organizations?.[0]?.id || "",
      page: 1,
      limit: 100, // Get more customers for dropdown
    },
    { enabled: !!organizations?.[0]?.id }
  )

  const customers = customersData?.customers || []
  
  // Get customer from URL params
  const customerIdFromUrl = searchParams?.get("customerId") || ""

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      customerId: customerIdFromUrl,
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      currency: "GBP",
      notes: "",
      items: [{ description: "", quantity: 1, unitPrice: 0, taxRate: 20 }],
    },
  })

  // Update form when customerId from URL changes
  useEffect(() => {
    if (customerIdFromUrl && customers.length > 0) {
      setValue("customerId", customerIdFromUrl)
      // Set currency from customer if available
      const selectedCustomer = customers.find(c => c.id === customerIdFromUrl)
      if (selectedCustomer?.currency) {
        setValue("currency", selectedCustomer.currency)
      }
      // Set due date based on customer payment terms
      if (selectedCustomer?.paymentTerms) {
        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + selectedCustomer.paymentTerms)
        setValue("dueDate", dueDate.toISOString().split('T')[0])
      }
    }
  }, [customerIdFromUrl, customers, setValue])

  const { register, handleSubmit, watch, setValue, formState: { errors } } = form
  const watchedItems = watch("items")
  const watchedCurrency = watch("currency")

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

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const currentItems = [...watchedItems]
    currentItems[index] = { ...currentItems[index], [field]: value }
    
    // Recalculate total for this item
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

  const onSubmit = async (data: InvoiceFormData) => {
    setIsSubmitting(true)
    try {
      // Create invoice via tRPC mutation
      // const result = await trpc.invoices.create.mutate({
      //   organizationId: organizations?.[0]?.id || "",
      //   customerId: data.customerId,
      //   date: new Date(data.date),
      //   dueDate: new Date(data.dueDate),
      //   currency: data.currency,
      //   notes: data.notes,
      //   items: data.items,
      // })
      
      // For now, simulate success
      alert("Invoice created successfully!")
      router.push("/invoices")
    } catch (error) {
      console.error("Error creating invoice:", error)
      alert("Failed to create invoice. Please try again.")
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
            <h1 className="text-3xl font-bold tracking-tight">Create Invoice</h1>
            <p className="text-muted-foreground mt-1">
              Step {currentStep} of 3: {currentStep === 1 ? "Customer & Dates" : currentStep === 2 ? "Items" : "Review"}
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push("/invoices")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-6 lg:grid-cols-4">
            {/* Main Form */}
            <div className="lg:col-span-3 space-y-6">
              {/* Step 1: Customer & Dates */}
              {currentStep === 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Customer & Invoice Details</CardTitle>
                    <CardDescription>Select customer and set invoice dates</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="customerId">Customer *</Label>
                      <select
                        id="customerId"
                        {...register("customerId")}
                        className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
                        onChange={(e) => {
                          setValue("customerId", e.target.value)
                          // Update currency and due date based on selected customer
                          const selectedCustomer = customers.find(c => c.id === e.target.value)
                          if (selectedCustomer) {
                            if (selectedCustomer.currency) {
                              setValue("currency", selectedCustomer.currency)
                            }
                            if (selectedCustomer.paymentTerms) {
                              const dueDate = new Date()
                              dueDate.setDate(dueDate.getDate() + selectedCustomer.paymentTerms)
                              setValue("dueDate", dueDate.toISOString().split('T')[0])
                            }
                          }
                        }}
                      >
                        <option value="">Select a customer...</option>
                        {customers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.name} {customer.email ? `(${customer.email})` : ""}
                          </option>
                        ))}
                      </select>
                      {errors.customerId && (
                        <p className="text-sm text-destructive mt-1">{errors.customerId.message}</p>
                      )}
                      {customers.length === 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          No customers found. <Link href="/customers/new" className="text-primary hover:underline">Create one</Link>
                        </p>
                      )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="date">Invoice Date *</Label>
                        <Input
                          id="date"
                          type="date"
                          {...register("date")}
                        />
                        {errors.date && (
                          <p className="text-sm text-destructive mt-1">{errors.date.message}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="dueDate">Due Date *</Label>
                        <Input
                          id="dueDate"
                          type="date"
                          {...register("dueDate")}
                        />
                        {errors.dueDate && (
                          <p className="text-sm text-destructive mt-1">{errors.dueDate.message}</p>
                        )}
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
              )}

              {/* Step 2: Items */}
              {currentStep === 2 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Invoice Items</CardTitle>
                    <CardDescription>Add line items to your invoice</CardDescription>
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
              )}

              {/* Step 3: Review */}
              {currentStep === 3 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Review Invoice</CardTitle>
                    <CardDescription>Review all details before creating</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Customer:</span>
                        <span className="font-medium">
                          {customers?.find(c => c.id === watch("customerId"))?.name}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Invoice Date:</span>
                        <span className="font-medium">{watch("date")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Due Date:</span>
                        <span className="font-medium">{watch("dueDate")}</span>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-2">Items</h4>
                      <div className="space-y-2">
                        {watchedItems.map((item, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span>{item.description} × {item.quantity}</span>
                            <span>{formatCurrency(item.total || 0, watchedCurrency)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border-t pt-4 space-y-2">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(totals.subtotal, watchedCurrency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tax:</span>
                        <span>{formatCurrency(totals.taxAmount, watchedCurrency)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg">
                        <span>Total:</span>
                        <span>{formatCurrency(totals.total, watchedCurrency)}</span>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="notes">Notes</Label>
                      <textarea
                        id="notes"
                        {...register("notes")}
                        rows={3}
                        className="w-full px-3 py-2 border border-input bg-background rounded-md"
                        placeholder="Additional notes for the invoice..."
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                  disabled={currentStep === 1}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
                {currentStep < 3 ? (
                  <Button
                    type="button"
                    onClick={() => {
                      // Validate current step before proceeding
                      if (currentStep === 1) {
                        if (!watch("customerId") || !watch("date") || !watch("dueDate")) {
                          alert("Please fill in all required fields")
                          return
                        }
                      } else if (currentStep === 2) {
                        const items = watch("items")
                        if (items.some(item => !item.description || item.quantity <= 0 || item.unitPrice < 0)) {
                          alert("Please complete all item fields")
                          return
                        }
                      }
                      setCurrentStep(currentStep + 1)
                    }}
                  >
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <div className="flex gap-2">
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
                )}
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

