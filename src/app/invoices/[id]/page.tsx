"use client"

import { Suspense } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Edit } from "lucide-react"
import { trpc } from "@/lib/trpc-client"
import { formatCurrency, formatDate } from "@/lib/utils"

function InvoiceDetailContent() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { data: orgsData } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgsData?.[0]?.id ?? ""

  const { data, isLoading } = trpc.invoices.getAll.useQuery(
    { organizationId: orgId, page: 1, limit: 200 },
    { enabled: !!orgId }
  )

  const invoice = data?.invoices?.find((inv: any) => inv.id === id)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Invoice not found.</p>
      </div>
    )
  }

  const statusColor =
    invoice.status === "PAID" ? "bg-green-100 text-green-800" :
    invoice.status === "SENT" ? "bg-blue-100 text-blue-800" :
    invoice.status === "OVERDUE" ? "bg-red-100 text-red-800" :
    invoice.status === "CANCELLED" ? "bg-gray-100 text-gray-600" :
    "bg-yellow-100 text-yellow-800"

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => router.push("/invoices")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <h1 className="text-2xl font-bold">{invoice.invoiceNumber}</h1>
            <Badge className={statusColor}>{invoice.status}</Badge>
          </div>
          <Button variant="outline" onClick={() => router.push(`/invoices/${id}/edit`)}>
            <Edit className="h-4 w-4 mr-1" /> Edit
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Invoice Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice Date:</span>
                <span>{formatDate(invoice.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date:</span>
                <span>{formatDate(invoice.dueDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Currency:</span>
                <span>{invoice.currency}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <p className="font-medium">{invoice.customer?.name ?? "—"}</p>
              <p className="text-muted-foreground">{invoice.customer?.email ?? ""}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2">Description</th>
                  <th className="text-right py-2">Qty</th>
                  <th className="text-right py-2">Unit Price</th>
                  <th className="text-right py-2">Tax</th>
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items?.map((item: any) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-2">{item.description}</td>
                    <td className="text-right py-2">{item.quantity}</td>
                    <td className="text-right py-2">{formatCurrency(Number(item.unitPrice), invoice.currency)}</td>
                    <td className="text-right py-2">{item.taxRate}%</td>
                    <td className="text-right py-2">{formatCurrency(Number(item.total), invoice.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 space-y-1 text-sm text-right">
              <div>Subtotal: {formatCurrency(Number(invoice.subtotal), invoice.currency)}</div>
              <div>Tax: {formatCurrency(Number(invoice.taxAmount), invoice.currency)}</div>
              <div className="font-bold text-base">Total: {formatCurrency(Number(invoice.total), invoice.currency)}</div>
            </div>
          </CardContent>
        </Card>

        {invoice.notes && (
          <Card>
            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
            <CardContent><p className="text-sm">{invoice.notes}</p></CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default function InvoiceDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    }>
      <InvoiceDetailContent />
    </Suspense>
  )
}
