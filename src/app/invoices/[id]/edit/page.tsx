"use client"

import { Suspense, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Save } from "lucide-react"
import { useForm } from "react-hook-form"
import { trpc } from "@/lib/trpc-client"
import { useToast } from "@/hooks/use-toast"

function EditInvoiceContent() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()

  const { data: orgsData } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgsData?.[0]?.id ?? ""

  const { data, isLoading } = trpc.invoices.getAll.useQuery(
    { organizationId: orgId, page: 1, limit: 200 },
    { enabled: !!orgId }
  )
  const invoice = data?.invoices?.find((inv: any) => inv.id === id)

  const { register, handleSubmit, reset } = useForm({
    defaultValues: { notes: "", dueDate: "" },
  })

  useEffect(() => {
    if (invoice) {
      reset({
        notes: invoice.notes ?? "",
        dueDate: new Date(invoice.dueDate).toISOString().split("T")[0],
      })
    }
  }, [invoice, reset])

  const updateMutation = trpc.invoices.update.useMutation({
    onSuccess: () => {
      toast({ title: "Invoice updated" })
      router.push(`/invoices/${id}`)
    },
    onError: (err) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  })

  const onSubmit = (formData: any) => {
    if (!orgId) return
    updateMutation.mutate({
      id,
      organizationId: orgId,
      data: {
        notes: formData.notes,
        dueDate: new Date(formData.dueDate),
      },
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.push(`/invoices/${id}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h1 className="text-2xl font-bold">Edit Invoice</h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Card>
            <CardHeader><CardTitle>Invoice Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="dueDate">Due Date</Label>
                <Input id="dueDate" type="date" {...register("dueDate")} />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  {...register("notes")}
                  rows={4}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
                />
              </div>
              <Button type="submit" disabled={updateMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {updateMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  )
}

export default function EditInvoicePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    }>
      <EditInvoiceContent />
    </Suspense>
  )
}
