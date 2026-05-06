"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
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
  Link2,
  X,
  RefreshCw,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function ReconciliationPage() {
  const { toast } = useToast()
  const searchParams = useSearchParams()

  const [selectedAccountId, setSelectedAccountId] = useState<string>("")
  const [statementDate, setStatementDate] = useState<string>("")
  const [statementBalance, setStatementBalance] = useState<string>("")
  const [reconciliationDialogOpen, setReconciliationDialogOpen] = useState(false)

  // Proper React state for match selections:
  // selectedIds = Set of bankTxIds the user has checked
  // ledgerMatches = Map<bankTxId, ledgerTxId> for bank→GL matches
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set())
  const [ledgerMatches, setLedgerMatches] = useState<Map<string, string>>(new Map())

  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = organizations?.[0]?.id ?? ""

  // Pre-select account from query param (set by /banking page)
  useEffect(() => {
    const id = searchParams.get("accountId")
    if (id) setSelectedAccountId(id)
  }, [searchParams])

  const { data: bankAccounts } = trpc.bankAccounts.getAll.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  )

  const { data: unreconciledData, refetch: refetchUnreconciled } = trpc.bankAccounts.getUnreconciled.useQuery(
    { organizationId: orgId, bankAccountId: selectedAccountId, page: 1, limit: 100 },
    { enabled: !!selectedAccountId && !!orgId }
  )

  const { data: suggestions, refetch: refetchSuggestions } = trpc.bankAccounts.suggestMatches.useQuery(
    { organizationId: orgId, bankAccountId: selectedAccountId, amountTolerance: 0.01, dateToleranceDays: 7 },
    { enabled: !!selectedAccountId && !!orgId }
  )

  const { data: report } = trpc.bankAccounts.getReconciliationReport.useQuery(
    { organizationId: orgId, bankAccountId: selectedAccountId },
    { enabled: !!selectedAccountId && !!orgId }
  )

  const reconcileMutation = trpc.bankAccounts.reconcile.useMutation({
    onSuccess: () => {
      toast({ title: "Reconciliation completed" })
      setReconciliationDialogOpen(false)
      setSelectedIds(new Set())
      setLedgerMatches(new Map())
      refetchUnreconciled()
      refetchSuggestions()
    },
    onError: (err) => toast({ title: "Reconciliation failed", description: err.message, variant: "destructive" }),
  })

  const handleToggleSelect = (txId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(txId)) {
        next.delete(txId)
        setLedgerMatches(m => { const n = new Map(m); n.delete(txId); return n })
      } else {
        next.add(txId)
      }
      return next
    })
  }

  const handleAcceptSuggestion = (bankTxId: string, ledgerTxId: string) => {
    setSelectedIds(prev => new Set([...prev, bankTxId]))
    setLedgerMatches(prev => new Map([...prev, [bankTxId, ledgerTxId]]))
  }

  const handleReconcile = () => {
    if (!selectedAccountId || !statementDate || !statementBalance) {
      toast({ title: "Missing information", description: "Provide statement date and balance.", variant: "destructive" })
      return
    }
    const unreconciledTransactions = unreconciledData?.transactions ?? []
    const matches = unreconciledTransactions
      .filter(tx => selectedIds.has(tx.id))
      .map(tx => ({
        bankTransactionId: tx.id,
        transactionId: ledgerMatches.get(tx.id) ?? undefined,
        amount: Number(tx.amount),
        matchType: ledgerMatches.has(tx.id) ? "MANUAL" : "MANUAL",
      })) as any[]

    if (matches.length === 0) {
      toast({ title: "No transactions selected", description: "Select at least one transaction to reconcile.", variant: "destructive" })
      return
    }

    reconcileMutation.mutate({
      organizationId: orgId,
      bankAccountId: selectedAccountId,
      statementDate: new Date(statementDate),
      statementBalance: Number(statementBalance),
      matches,
    })
  }

  const selectedAccount = bankAccounts?.find(a => a.id === selectedAccountId)
  const unreconciledTransactions = unreconciledData?.transactions ?? []
  const suggestionsMap = new Map(suggestions?.map(s => [s.bankTransaction.id, s]) ?? [])

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Bank Reconciliation</h1>
            <p className="text-muted-foreground mt-1">Match bank transactions with your accounting records</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => { refetchUnreconciled(); refetchSuggestions() }}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Button
              onClick={() => setReconciliationDialogOpen(true)}
              disabled={!selectedAccountId || unreconciledTransactions.length === 0}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Reconcile ({selectedIds.size} selected)
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Account selector */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Bank Account</CardTitle>
                <CardDescription>Select account to reconcile</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {bankAccounts?.map(account => (
                    <div
                      key={account.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedAccountId === account.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      }`}
                      onClick={() => { setSelectedAccountId(account.id); setSelectedIds(new Set()); setLedgerMatches(new Map()) }}
                    >
                      <div className="font-medium">{account.name}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {formatCurrency(Number(account.currentBalance), account.currency)}
                      </div>
                    </div>
                  ))}
                  {!bankAccounts?.length && (
                    <p className="text-sm text-muted-foreground text-center py-4">No bank accounts found.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {report && (
              <Card>
                <CardHeader>
                  <CardTitle>Reconciliation Report</CardTitle>
                  <CardDescription>Bank vs GL Balance</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bank Balance:</span>
                    <span className="font-medium">{formatCurrency(report.bankBalance, selectedAccount?.currency ?? "GBP")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">GL Balance:</span>
                    <span className="font-medium">{formatCurrency(report.glBalance, selectedAccount?.currency ?? "GBP")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unreconciled:</span>
                    <span className="font-medium">{formatCurrency(report.unreconciledAmount, selectedAccount?.currency ?? "GBP")}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between">
                    <span className="font-medium">Difference:</span>
                    <span className={`font-bold ${report.isBalanced ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(report.difference, selectedAccount?.currency ?? "GBP")}
                    </span>
                  </div>
                  {report.isBalanced && (
                    <Badge className="w-full justify-center bg-green-100 text-green-800">
                      <CheckCircle className="mr-1 h-3 w-3" /> Balanced
                    </Badge>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Unreconciled transactions */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Unreconciled Transactions</span>
                  <div className="flex gap-2">
                    <Badge variant="outline">{unreconciledTransactions.length} items</Badge>
                    {selectedIds.size > 0 && (
                      <Badge className="bg-blue-100 text-blue-800">{selectedIds.size} selected</Badge>
                    )}
                  </div>
                </CardTitle>
                <CardDescription>
                  Click a row to select it for reconciliation. Accept suggestions to link to a GL entry.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedAccountId ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    Select a bank account to begin reconciliation.
                  </div>
                ) : unreconciledTransactions.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
                    <h3 className="text-lg font-semibold">All reconciled</h3>
                    <p className="text-muted-foreground">All transactions have been matched.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {unreconciledTransactions.map(tx => {
                      const amount = Number(tx.amount)
                      const isCredit = amount >= 0
                      const isSelected = selectedIds.has(tx.id)
                      const suggestion = suggestionsMap.get(tx.id)
                      const bestMatch = suggestion?.bestMatch
                      const matchedLedgerId = ledgerMatches.get(tx.id)

                      return (
                        <div
                          key={tx.id}
                          className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                            isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/30"
                          }`}
                          onClick={() => handleToggleSelect(tx.id)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              {isCredit
                                ? <TrendingUp className="h-4 w-4 text-green-600 shrink-0" />
                                : <TrendingDown className="h-4 w-4 text-red-600 shrink-0" />}
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{tx.description}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {formatDate(tx.date)}
                                  {tx.reference && ` · ${tx.reference}`}
                                  {tx.payee && ` · ${tx.payee}`}
                                </div>

                                {/* Suggested match */}
                                {bestMatch && !isSelected && (
                                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                                    <div className="flex items-center justify-between gap-2">
                                      <div>
                                        <span className="font-medium text-blue-900">
                                          Suggested ({bestMatch.score.toFixed(0)}% confidence):
                                        </span>
                                        <div className="text-blue-700 mt-0.5">
                                          {bestMatch.transaction.description} · {formatDate(bestMatch.transaction.date)}
                                        </div>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="shrink-0"
                                        onClick={e => {
                                          e.stopPropagation()
                                          handleAcceptSuggestion(tx.id, bestMatch.transaction.id)
                                        }}
                                      >
                                        <Link2 className="h-3 w-3 mr-1" /> Accept
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {/* Matched to GL */}
                                {isSelected && matchedLedgerId && (
                                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                                    <div className="flex items-center justify-between">
                                      <span className="text-green-800 font-medium">
                                        Matched to GL · {matchedLedgerId.slice(0, 8)}…
                                      </span>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 px-1"
                                        onClick={e => {
                                          e.stopPropagation()
                                          setLedgerMatches(m => { const n = new Map(m); n.delete(tx.id); return n })
                                        }}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {/* Selected without GL match */}
                                {isSelected && !matchedLedgerId && (
                                  <div className="mt-2 p-2 bg-primary/5 border border-primary/20 rounded text-xs text-muted-foreground">
                                    Selected for reconciliation (no GL match — will post as manual)
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className={`ml-4 font-bold text-sm shrink-0 ${isCredit ? "text-green-600" : "text-red-600"}`}>
                              {isCredit ? "+" : ""}{formatCurrency(Math.abs(amount), selectedAccount?.currency ?? "GBP")}
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

      {/* Reconciliation confirm dialog */}
      <Dialog open={reconciliationDialogOpen} onOpenChange={setReconciliationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reconcile Bank Account</DialogTitle>
            <DialogDescription>Enter statement details to complete reconciliation</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Statement Date</Label>
              <Input className="mt-1" type="date"
                value={statementDate} onChange={e => setStatementDate(e.target.value)} />
            </div>
            <div>
              <Label>Statement Balance</Label>
              <Input className="mt-1" type="number" step="0.01" placeholder="0.00"
                value={statementBalance} onChange={e => setStatementBalance(e.target.value)} />
            </div>
            <p className="text-sm text-muted-foreground">
              {selectedIds.size} transaction{selectedIds.size !== 1 ? "s" : ""} will be reconciled.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReconciliationDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleReconcile} disabled={reconcileMutation.isPending}>
              {reconcileMutation.isPending ? "Reconciling…" : "Reconcile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
