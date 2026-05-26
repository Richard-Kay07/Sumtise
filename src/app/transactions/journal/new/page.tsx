"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/page-header"
import { trpc } from "@/lib/trpc-client"
import { useOrganization } from "@/contexts/organization-context"
import { Plus, Trash2, RefreshCw, Send } from "lucide-react"

interface Line {
  accountId: string
  description: string
  debit: string
  credit: string
}

const emptyLine = (): Line => ({ accountId: "", description: "", debit: "", credit: "" })

export default function NewJournalPage() {
  const router = useRouter()
  const { orgId } = useOrganization()

  const [reference, setReference] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()])
  const [saving, setSaving] = useState(false)

  const { data: accounts } = trpc.chartOfAccounts.getAll.useQuery(
    { organizationId: orgId || "" },
    { enabled: !!orgId }
  )

  const createMutation = trpc.manualJournals.create.useMutation()
  const submitMutation = trpc.manualJournals.submit.useMutation()

  const totalDebits = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0)
  const totalCredits = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0)
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01
  const hasData = lines.some((l) => l.accountId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))

  const updateLine = (i: number, field: keyof Line, value: string) => {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  }

  const addLine = () => setLines((prev) => [...prev, emptyLine()])

  const removeLine = (i: number) => {
    if (lines.length <= 2) return
    setLines((prev) => prev.filter((_, idx) => idx !== i))
  }

  const buildPayload = () => ({
    organizationId: orgId!,
    reference,
    description,
    date,
    notes: notes || undefined,
    lines: lines
      .filter((l) => l.accountId)
      .map((l, i) => ({
        accountId: l.accountId,
        description: l.description || undefined,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
        sortOrder: i,
      })),
  })

  const handleSaveDraft = async () => {
    if (!orgId) return
    setSaving(true)
    try {
      await createMutation.mutateAsync(buildPayload())
      router.push("/transactions/journal")
    } catch (e: any) {
      alert(`Error: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!orgId) return
    setSaving(true)
    try {
      const journal = await createMutation.mutateAsync(buildPayload())
      await submitMutation.mutateAsync({ id: journal.id, organizationId: orgId! })
      router.push("/transactions/journal")
    } catch (e: any) {
      alert(`Error: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        crumbs={[
          { label: "Accounting", href: "/accounting" },
          { label: "Ledger & Banking", href: "/accounting/ledger-banking" },
          { label: "Journals", href: "/transactions/journal" },
        ]}
        title="New Journal Entry"
      />

      <main className="container mx-auto py-6 space-y-6 max-w-4xl">
        {/* Header fields */}
        <Card>
          <CardHeader>
            <CardTitle>Journal Details</CardTitle>
            <CardDescription>Complete the journal header then add debit/credit lines below</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="reference">Reference *</Label>
              <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="JNL-001" />
            </div>
            <div>
              <Label htmlFor="date">Date *</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="description">Description *</Label>
              <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of the journal" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional supporting notes" className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
          </CardContent>
        </Card>

        {/* Lines */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Journal Lines</CardTitle>
              <Button variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-4 w-4 mr-1" /> Add Line
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium w-[35%]">Account</th>
                    <th className="text-left py-2 font-medium">Description</th>
                    <th className="text-right py-2 font-medium w-24">Debit</th>
                    <th className="text-right py-2 font-medium w-24">Credit</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-1.5 pr-2">
                        <select
                          value={line.accountId}
                          onChange={(e) => updateLine(i, "accountId", e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                        >
                          <option value="">— Select account —</option>
                          {accounts?.map((acc: any) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.code} — {acc.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1.5 pr-2">
                        <Input
                          value={line.description}
                          onChange={(e) => updateLine(i, "description", e.target.value)}
                          placeholder="Line description"
                          className="h-8 text-sm"
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.debit}
                          onChange={(e) => updateLine(i, "debit", e.target.value)}
                          className="h-8 text-sm text-right"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.credit}
                          onChange={(e) => updateLine(i, "credit", e.target.value)}
                          className="h-8 text-sm text-right"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="py-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-500"
                          onClick={() => removeLine(i)}
                          disabled={lines.length <= 2}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  <tr className="font-medium text-sm">
                    <td colSpan={2} className="pt-3 text-right text-muted-foreground">Totals</td>
                    <td className={`pt-3 text-right ${!isBalanced && hasData ? "text-red-500" : ""}`}>
                      {totalDebits.toFixed(2)}
                    </td>
                    <td className={`pt-3 text-right ${!isBalanced && hasData ? "text-red-500" : ""}`}>
                      {totalCredits.toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {!isBalanced && hasData && (
              <p className="mt-2 text-sm text-red-500">
                Debits and credits must balance. Difference: {Math.abs(totalDebits - totalCredits).toFixed(2)}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleSaveDraft} disabled={saving || !reference || !description}>
            {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Draft
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !reference || !description || !isBalanced || !hasData}
          >
            {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Submit for Approval
          </Button>
        </div>
      </main>
    </div>
  )
}
