"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc-client"
import { formatCurrency, formatDate } from "@/lib/utils"
// Toast notifications - using simple alert for now
import { 
  ArrowLeft, 
  Edit, 
  Trash2,
  Mail,
  Phone,
  MapPin,
  FileText,
  Tag,
  Building2,
  DollarSign,
  Calendar,
  CreditCard,
} from "lucide-react"
import Link from "next/link"

export default function CustomerDetailPage() {
  const router = useRouter()
  const params = useParams()
  const customerId = params.id as string

  // Get user's organizations
  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()

  // Get customer
  const { data: customer, isLoading, refetch } = trpc.customers.getById.useQuery(
    {
      id: customerId,
      organizationId: organizations?.[0]?.id || "",
    },
    { enabled: !!customerId && !!organizations?.[0]?.id }
  )

  // Delete mutation
  const deleteMutation = trpc.customers.delete.useMutation({
    onSuccess: () => {
      alert("Customer archived successfully")
      router.push("/customers")
    },
    onError: (error) => {
      alert(`Error: ${error.message}`)
    },
  })

  const handleDelete = () => {
    if (confirm("Are you sure you want to archive this customer?")) {
      deleteMutation.mutate({
        id: customerId,
        organizationId: organizations?.[0]?.id || "",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Customer not found</h2>
              <p className="text-muted-foreground mb-4">
                The customer you're looking for doesn't exist or has been deleted.
              </p>
              <Link href="/customers">
                <Button>Back to Customers</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const address = customer.address as any
  const billingPreferences = customer.billingPreferences as any

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <Link href="/customers" className="mr-4">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Customers
            </Button>
          </Link>
          <div className="flex flex-1 items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{customer.name}</h1>
              <p className="text-sm text-muted-foreground">
                Customer since {formatDate(customer.createdAt)}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Link href={`/customers/${customerId}/edit`}>
                <Button variant="outline">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </Link>
              <Button variant="outline" onClick={handleDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Archive
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto py-6 max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {customer.email && (
                    <div className="flex items-center">
                      <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Email</div>
                        <div className="text-sm text-muted-foreground">{customer.email}</div>
                      </div>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex items-center">
                      <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Phone</div>
                        <div className="text-sm text-muted-foreground">{customer.phone}</div>
                      </div>
                    </div>
                  )}
                </div>
                {address && (address.street || address.city || address.postcode) && (
                  <div className="flex items-start">
                    <MapPin className="mr-2 h-4 w-4 text-muted-foreground mt-1" />
                    <div>
                      <div className="text-sm font-medium">Address</div>
                      <div className="text-sm text-muted-foreground">
                        {address.street && <div>{address.street}</div>}
                        {(address.city || address.postcode) && (
                          <div>
                            {address.city}
                            {address.city && address.postcode && ", "}
                            {address.postcode}
                          </div>
                        )}
                        {address.country && <div>{address.country}</div>}
                      </div>
                    </div>
                  </div>
                )}
                {customer.taxId && (
                  <div>
                    <div className="text-sm font-medium">Tax ID</div>
                    <div className="text-sm text-muted-foreground">{customer.taxId}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Billing Preferences */}
            <Card>
              <CardHeader>
                <CardTitle>Billing Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-sm font-medium">Currency</div>
                    <div className="text-sm text-muted-foreground">{customer.currency || "GBP"}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Payment Terms</div>
                    <div className="text-sm text-muted-foreground">
                      {customer.paymentTerms || 30} days
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Credit Limit</div>
                    <div className="text-sm text-muted-foreground">
                      {formatCurrency(Number(customer.creditLimit), customer.currency || "GBP")}
                    </div>
                  </div>
                </div>
                {billingPreferences && (
                  <div className="grid gap-4 md:grid-cols-2">
                    {billingPreferences.invoiceFormat && (
                      <div>
                        <div className="text-sm font-medium">Invoice Format</div>
                        <div className="text-sm text-muted-foreground capitalize">
                          {billingPreferences.invoiceFormat}
                        </div>
                      </div>
                    )}
                    {billingPreferences.deliveryMethod && (
                      <div>
                        <div className="text-sm font-medium">Delivery Method</div>
                        <div className="text-sm text-muted-foreground capitalize">
                          {billingPreferences.deliveryMethod}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tags */}
            {customer.tags && customer.tags.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Tags</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {customer.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        <Tag className="mr-1 h-3 w-3" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {customer.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{customer.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm font-medium">Status</div>
                  <Badge variant={customer.isActive ? "default" : "secondary"} className="mt-1">
                    {customer.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm font-medium">Total Invoices</div>
                  <div className="text-2xl font-bold mt-1">
                    {customer._count?.invoices || 0}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">Created</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {formatDate(customer.createdAt)}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">Last Updated</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {formatDate(customer.updatedAt)}
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
                <Link href={`/invoices/new?customerId=${customerId}`}>
                  <Button className="w-full" variant="outline">
                    <FileText className="mr-2 h-4 w-4" />
                    Create Invoice
                  </Button>
                </Link>
                <Link href={`/customers/${customerId}/invoices`}>
                  <Button className="w-full" variant="outline">
                    <FileText className="mr-2 h-4 w-4" />
                    View Invoices
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

