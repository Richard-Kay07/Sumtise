"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { trpc } from "@/lib/trpc-client"
import { formatCurrency, formatDate } from "@/lib/utils"
import { 
  CheckCircle, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Calendar,
  FileText,
  Link2,
  X,
  Search,
  RefreshCw,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function ReconciliationPage() {
  const { toast } = useToast()
  const [selectedAccountId, setSelectedAccountId] = useState<string>("")
  const [selectedBankTx, setSelectedBankTx] = useState<string | null>(null)
  const [statementDate, setStatementDate] = useState<string>("")
  const [statementBalance, setStatementBalance] = useState<string>("")
  const [reconciliationDialogOpen, setReconciliationDialogOpen] = useState(false)
  const [matchDialogOpen, setMatchDialogOpen] = useState(false)

  // Get user's organizations
  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = organizations?.[0]?.id || ""

  // Get bank accounts
  const { data: bankAccounts } = trpc.bankAccounts.getAll.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  )

  // Get unreconciled transactions
  const { data: unreconciledData, refetch: refetchUnreconciled } = trpc.bankAccounts.getUnreconciled.useQuery(
    {
      organizationId: orgId,
      bankAccountId: selectedAccountId,
      page: 1,
      limit: 100,
    },
    { enabled: !!selectedAccountId && !!orgId }
  )

  // Get suggested matches
  const { data: suggestions, refetch: refetchSuggestions } = trpc.bankAccounts.suggestMatches.useQuery(
    {
      organizationId: orgId,
      bankAccountId: selectedAccountId,
      amountTolerance: 0.01,
      dateToleranceDays: 7,
    },
    { enabled: !!selectedAccountId && !!orgId }
  )

  // Get reconciliation report
  const { data: report } = trpc.bankAccounts.getReconciliationReport.useQuery(
    {
      organizationId: orgId,
      bankAccountId: selectedAccountId,
    },
    { enabled: !!selectedAccountId && !!orgId }
  )

  // Reconcile mutation
  const reconcileMutation = trpc.bankAccounts.reconcile.useMutation({
    onSuccess: () => {
      toast({
        title: "Reconciliation completed",
        description: "Bank transactions have been reconciled successfully.",
      })
      setReconciliationDialogOpen(false)
      refetchUnreconciled()
      refetchSuggestions()
    },
    onError: (error) => {
      toast({
        title: "Reconciliation failed",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleReconcile = () => {
    if (!selectedAccountId || !statementDate || !statementBalance) {
      toast({
        title: "Missing information",
        description: "Please provide statement date and balance.",
        variant: "destructive",
      })
      return
    }

    // Build matches from selected transactions
    const matches = unreconciledData?.transactions
      .filter((tx) => (tx as any).selected)
      .map((tx) => ({
        bankTransactionId: tx.id,
        transactionId: (tx as any).matchedTransactionId || undefined,
        amount: Number(tx.amount),
        matchType: (tx as any).matchType || "MANUAL",
        notes: (tx as any).matchNotes || undefined,
      })) || []

    reconcileMutation.mutate({
      organizationId: orgId,
      bankAccountId: selectedAccountId,
      statementDate: new Date(statementDate),
      statementBalance: Number(statementBalance),
      matches,
    })
  }

  const handleMatch = (bankTxId: string, ledgerTxId?: string) => {
    // Mark transaction as matched
    const tx = unreconciledData?.transactions.find((t) => t.id === bankTxId)
    if (tx) {
      (tx as any).selected = true
      (tx as any).matchedTransactionId = ledgerTxId
      (tx as any).matchType = ledgerTxId ? "MANUAL" : "MANUAL"
    }
    setMatchDialogOpen(false)
    setSelectedBankTx(null)
  }

  const selectedAccount = bankAccounts?.find((acc) => acc.id === selectedAccountId)
  const unreconciledTransactions = unreconciledData?.transactions || []
  const suggestionsMap = new Map(
    suggestions?.map((s) => [s.bankTransaction.id, s]) || []
  )

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Bank Reconciliation</h1>
            <p className="text-muted-foreground mt-1">
              Match bank transactions with your accounting records
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                refetchUnreconciled()
                refetchSuggestions()
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button
              onClick={() => setReconciliationDialogOpen(true)}
              disabled={!selectedAccountId || unreconciledTransactions.length === 0}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Reconcile
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Bank Account Selection */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Bank Account</CardTitle>
                <CardDescription>Select account to reconcile</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {bankAccounts?.map((account) => (
                    <div
                      key={account.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedAccountId === account.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedAccountId(account.id)}
                    >
                      <div className="font-medium">{account.name}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {formatCurrency(Number(account.currentBalance), account.currency)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Reconciliation Report */}
            {report && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Reconciliation Report</CardTitle>
                  <CardDescription>Bank vs GL Balance</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Bank Balance:</span>
                      <span className="font-medium">
                        {formatCurrency(report.bankBalance, selectedAccount?.currency || "GBP")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">GL Balance:</span>
                      <span className="font-medium">
                        {formatCurrency(report.glBalance, selectedAccount?.currency || "GBP")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Unreconciled:</span>
                      <span className="font-medium">
                        {formatCurrency(report.unreconciledAmount, selectedAccount?.currency || "GBP")}
                      </span>
                    </div>
                    <div className="border-t pt-2 flex justify-between">
                      <span className="text-sm font-medium">Difference:</span>
                      <span
                        className={`font-bold ${
                          report.isBalanced ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {formatCurrency(report.difference, selectedAccount?.currency || "GBP")}
                      </span>
                    </div>
                    {report.isBalanced && (
                      <Badge className="w-full justify-center bg-green-100 text-green-800">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Balanced
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Unreconciled Transactions */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Unreconciled Transactions</span>
                  <Badge variant="outline">
                    {unreconciledTransactions.length} items
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Match these transactions with your ledger entries
                </CardDescription>
              </CardHeader>
              <CardContent>
                {unreconciledTransactions.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
                    <h3 className="text-lg font-semibold">All reconciled</h3>
                    <p className="text-muted-foreground">
                      All transactions have been matched
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {unreconciledTransactions.map((tx) => {
                      const suggestion = suggestionsMap.get(tx.id)
                      const bestMatch = suggestion?.bestMatch
                      const isDebit = Number(tx.amount) < 0
                      const amount = Math.abs(Number(tx.amount))

                      return (
                        <div
                          key={tx.id}
                          className={`p-4 border rounded-lg ${
                            (tx as any).selected ? "border-primary bg-primary/5" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                {isDebit ? (
                                  <TrendingDown className="h-4 w-4 text-red-600" />
                                ) : (
                                  <TrendingUp className="h-4 w-4 text-green-600" />
                                )}
                                <div>
                                  <div className="font-medium">{tx.description}</div>
                                  <div className="text-sm text-muted-foreground mt-1">
                                    {formatDate(tx.date)} • {tx.reference || "No reference"}
                                    {tx.payee && ` • ${tx.payee}`}
                                  </div>
                                </div>
                              </div>

                              {/* Suggested Match */}
                              {bestMatch && !(tx as any).selected && (
                                <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <span className="font-medium text-blue-900">
                                        Suggested match ({bestMatch.score.toFixed(0)}% confidence):
                                      </span>
                                      <div className="text-blue-700 mt-1">
                                        {bestMatch.transaction.description} •{" "}
                                        {formatDate(bestMatch.transaction.date)}
                                      </div>
                                      <div className="text-xs text-blue-600 mt-1">
                                        {bestMatch.reasons.join(", ")}
                                      </div>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        handleMatch(tx.id, bestMatch.transaction.id)
                                      }}
                                    >
                                      <Link2 className="h-3 w-3 mr-1" />
                                      Match
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {/* Selected Match */}
                              {(tx as any).selected && (
                                <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-sm">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <span className="font-medium text-green-900">
                                        Matched
                                        {(tx as any).matchedTransactionId &&
                                          ` • Transaction ${(tx as any).matchedTransactionId.slice(0, 8)}`}
                                      </span>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        (tx as any).selected = false
                                        delete (tx as any).matchedTransactionId
                                      }}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="ml-4 text-right">
                              <div
                                className={`font-bold ${
                                  isDebit ? "text-red-600" : "text-green-600"
                                }`}
                              >
                                {isDebit ? "-" : "+"}
                                {formatCurrency(amount, selectedAccount?.currency || "GBP")}
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="mt-2"
                                onClick={() => {
                                  setSelectedBankTx(tx.id)
                                  setMatchDialogOpen(true)
                                }}
                              >
                                <Search className="h-3 w-3 mr-1" />
                                Match
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Reconciliation Dialog */}
      <Dialog open={reconciliationDialogOpen} onOpenChange={setReconciliationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reconcile Bank Account</DialogTitle>
            <DialogDescription>
              Enter statement details to complete reconciliation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Statement Date</Label>
              <Input
                type="date"
                value={statementDate}
                onChange={(e) => setStatementDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Statement Balance</Label>
              <Input
                type="number"
                step="0.01"
                value={statementBalance}
                onChange={(e) => setStatementBalance(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {unreconciledTransactions.filter((tx) => (tx as any).selected).length} transactions
              selected for reconciliation
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReconciliationDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReconcile} disabled={reconcileMutation.isLoading}>
              {reconcileMutation.isLoading ? "Reconciling..." : "Reconcile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}




