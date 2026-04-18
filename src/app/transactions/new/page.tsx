"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { trpc } from "@/lib/trpc-client"
import { formatCurrency } from "@/lib/utils"
import { ArrowLeft, Plus, Minus, Save, AlertCircle, CheckCircle } from "lucide-react"
import Link from "next/link"

interface JournalLine {
  accountId: string
  debit: number
  credit: number
  description: string
  tracking?: any
}

export default function NewJournalPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: "",
    reference: "",
    currency: "GBP",
    exchangeRate: 1,
  })
  const [lines, setLines] = useState<JournalLine[]>([
    { accountId: "", debit: 0, credit: 0, description: "" },
    { accountId: "", debit: 0, credit: 0, description: "" },
  ])

  // Get user's organizations
  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()

  // Get chart of accounts
  const { data: accountsData } = trpc.chartOfAccounts.getAll.useQuery(
    { organizationId: organizations?.[0]?.id || "" },
    { enabled: !!organizations?.[0]?.id }
  )

  const accounts = accountsData?.accounts || []

  // Create mutation
  const createMutation = trpc.transactions.createDoubleEntry.useMutation({
    onSuccess: () => {
      alert("Journal entry created successfully")
      router.push("/transactions")
    },
    onError: (error) => {
      alert(`Error: ${error.message}`)
    },
  })

  // Calculate totals
  const totals = useMemo(() => {
    const totalDebits = lines.reduce((sum, line) => sum + (line.debit || 0), 0)
    const totalCredits = lines.reduce((sum, line) => sum + (line.credit || 0), 0)
    const difference = Math.abs(totalDebits - totalCredits)
    const isBalanced = difference < 0.01

    return { totalDebits, totalCredits, difference, isBalanced }
  }, [lines])

  const handleAddLine = () => {
    setLines([...lines, { accountId: "", debit: 0, credit: 0, description: "" }])
  }

  const handleRemoveLine = (index: number) => {
    if (lines.length > 2) {
      setLines(lines.filter((_, i) => i !== index))
    }
  }

  const handleLineChange = (index: number, field: keyof JournalLine, value: any) => {
    const newLines = [...lines]
    newLines[index] = { ...newLines[index], [field]: value }
    
    // If debit is set, clear credit and vice versa
    if (field === "debit" && value > 0) {
      newLines[index].credit = 0
    } else if (field === "credit" && value > 0) {
      newLines[index].debit = 0
    }
    
    setLines(newLines)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!totals.isBalanced) {
      alert(`Journal entry is not balanced. Difference: ${formatCurrency(totals.difference, formData.currency)}`)
      return
    }

    if (lines.some(line => !line.accountId)) {
      alert("Please select an account for all lines")
      return
    }

    if (lines.some(line => line.debit === 0 && line.credit === 0)) {
      alert("Each line must have either a debit or credit amount")
      return
    }

    if (!formData.description.trim()) {
      alert("Please enter a description")
      return
    }

    createMutation.mutate({
      organizationId: organizations?.[0]?.id || "",
      date: formData.date,
      description: formData.description,
      reference: formData.reference || undefined,
      currency: formData.currency,
      exchangeRate: formData.exchangeRate,
      entries: lines.map(line => ({
        accountId: line.accountId,
        debit: line.debit || 0,
        credit: line.credit || 0,
        description: line.description || undefined,
        tracking: line.tracking,
      })),
    })
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <Link href="/transactions" className="mr-4">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Transactions
            </Button>
          </Link>
          <div className="flex flex-1 items-center justify-between">
            <h1 className="text-2xl font-bold">New Journal Entry</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto py-6 max-w-6xl">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Header Information */}
            <Card>
              <CardHeader>
                <CardTitle>Journal Entry Details</CardTitle>
                <CardDescription>Basic information for this journal entry</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label htmlFor="date">Date *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="reference">Reference</Label>
                    <Input
                      id="reference"
                      value={formData.reference}
                      onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                      placeholder="JE-001"
                    />
                  </div>
                  <div>
                    <Label htmlFor="currency">Currency</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(value) => setFormData({ ...formData, currency: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">Description *</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Journal entry description"
                    required
                  />
                </div>
              </CardContent>
            </Card>

            {/* Journal Lines */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Journal Lines</CardTitle>
                    <CardDescription>At least 2 lines required. Debits must equal credits.</CardDescription>
                  </div>
                  <Button type="button" onClick={handleAddLine} variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Line
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {lines.map((line, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Line {index + 1}</h4>
                      {lines.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveLine(index)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-5">
                      <div className="md:col-span-2">
                        <Label>Account *</Label>
                        <Select
                          value={line.accountId}
                          onValueChange={(value) => handleLineChange(index, "accountId", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.code} - {account.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Debit</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.debit || ""}
                          onChange={(e) => handleLineChange(index, "debit", parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label>Credit</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.credit || ""}
                          onChange={(e) => handleLineChange(index, "credit", parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label>Line Description</Label>
                        <Input
                          value={line.description}
                          onChange={(e) => handleLineChange(index, "description", e.target.value)}
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Balance Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Balance Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Debits:</span>
                  <span className="text-sm font-bold text-red-600">
                    {formatCurrency(totals.totalDebits, formData.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Credits:</span>
                  <span className="text-sm font-bold text-green-600">
                    {formatCurrency(totals.totalCredits, formData.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="text-sm font-medium">Difference:</span>
                  <div className="flex items-center space-x-2">
                    {totals.isBalanced ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-bold text-green-600">Balanced</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-bold text-red-600">
                          {formatCurrency(totals.difference, formData.currency)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {!totals.isBalanced && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800">
                      Journal entry must be balanced. Total debits must equal total credits.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end space-x-2">
              <Link href="/transactions">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={createMutation.isLoading || !totals.isBalanced}>
                <Save className="mr-2 h-4 w-4" />
                {createMutation.isLoading ? "Creating..." : "Create Journal Entry"}
              </Button>
            </div>
          </div>
        </form>
      </main>
    </div>
  )
}




