"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { trpc } from "@/lib/trpc-client"
import { Logo } from "@/components/logo"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  CreditCard,
  Upload,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Banknote,
  Plus,
  RefreshCw,
  Clock,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

const CURRENCIES = ["GBP", "USD", "EUR", "CAD", "AUD", "ZAR"]

export default function BankingPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [selectedAccountId, setSelectedAccountId] = useState<string>("")
  const [addAccountOpen, setAddAccountOpen] = useState(false)
  const [newAccount, setNewAccount] = useState({
    name: "",
    accountNumber: "",
    sortCode: "",
    iban: "",
    currency: "GBP",
    openingBalance: "0",
  })

  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = organizations?.[0]?.id ?? ""

  const { data: bankAccounts, refetch: refetchAccounts } = trpc.bankAccounts.getAll.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  )

  // Transactions for selected account
  const { data: txData, isLoading: txLoading } = trpc.bankAccounts.getTransactions.useQuery(
    {
      organizationId: orgId,
      bankAccountId: selectedAccountId,
      page: 1,
      limit: 50,
      sortBy: "date",
      sortOrder: "desc",
    },
    { enabled: !!selectedAccountId && !!orgId }
  )

  // Unreconciled count for selected account
  const { data: unreconciledData } = trpc.bankAccounts.getUnreconciled.useQuery(
    { organizationId: orgId, bankAccountId: selectedAccountId, page: 1, limit: 1 },
    { enabled: !!selectedAccountId && !!orgId }
  )

  const createAccount = trpc.bankAccounts.create.useMutation({
    onSuccess: () => {
      refetchAccounts()
      setAddAccountOpen(false)
      setNewAccount({ name: "", accountNumber: "", sortCode: "", iban: "", currency: "GBP", openingBalance: "0" })
      toast({ title: "Bank account added" })
    },
    onError: (err) => toast({ title: "Failed to add account", description: err.message, variant: "destructive" }),
  })

  const handleCreateAccount = () => {
    if (!newAccount.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" })
      return
    }
    createAccount.mutate({
      organizationId: orgId,
      name: newAccount.name,
      accountNumber: newAccount.accountNumber || undefined,
      sortCode: newAccount.sortCode || undefined,
      iban: newAccount.iban || undefined,
      currency: newAccount.currency,
      openingBalance: parseFloat(newAccount.openingBalance) || 0,
    })
  }

  const selectedAccount = bankAccounts?.find(a => a.id === selectedAccountId)
  const transactions = txData?.transactions ?? []
  const unreconciledCount = unreconciledData?.pagination?.total ?? 0

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <a className="mr-6" href="/"><Logo size={32} showText={true} /></a>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="w-full flex-1 md:w-auto md:flex-none">
              <h1 className="text-2xl font-bold">Banking &amp; Reconciliation</h1>
            </div>
            <nav className="flex items-center space-x-2">
              <Button variant="outline" onClick={() => router.push("/banking/import")}>
                <Upload className="mr-2 h-4 w-4" />
                Import Statement
              </Button>
              <Button onClick={() => setAddAccountOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Account
              </Button>
            </nav>
          </div>
        </div>
      </div>

      <main className="container mx-auto py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Sidebar — accounts + import options */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" /> Bank Accounts
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setAddAccountOpen(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>Select an account to view transactions</CardDescription>
              </CardHeader>
              <CardContent>
                {!bankAccounts?.length ? (
                  <div className="text-center py-8">
                    <Banknote className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground mb-3">No bank accounts yet</p>
                    <Button size="sm" onClick={() => setAddAccountOpen(true)}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add Account
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bankAccounts.map((account) => (
                      <div
                        key={account.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedAccountId === account.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                        }`}
                        onClick={() => setSelectedAccountId(account.id)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-medium text-sm">{account.name}</h3>
                          <Badge variant="outline" className="text-xs">{account.currency}</Badge>
                        </div>
                        <div className="text-lg font-bold">
                          {formatCurrency(Number(account.currentBalance), account.currency)}
                        </div>
                        {account.accountNumber && (
                          <div className="text-xs text-muted-foreground mt-1">••••{account.accountNumber.slice(-4)}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Import / Open Banking */}
            <Card>
              <CardHeader>
                <CardTitle>Import Transactions</CardTitle>
                <CardDescription>Upload a bank statement file</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => router.push(selectedAccountId ? `/banking/import?accountId=${selectedAccountId}` : "/banking/import")}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Import CSV / OFX
                </Button>

                {/* Open Banking — architecture retained, UI honest about status */}
                <div className="border rounded-lg p-3 bg-muted/30">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Open Banking</span>
                    <Badge variant="outline" className="text-xs">Coming soon</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Plaid / TrueLayer integration is planned for a future release. Use CSV/OFX import in the meantime.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main — transactions */}
          <div className="lg:col-span-2">
            {!selectedAccount ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <CreditCard className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">Select a bank account</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    Choose an account from the sidebar to view its transactions.
                  </p>
                  {!bankAccounts?.length && (
                    <Button className="mt-4" onClick={() => setAddAccountOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" /> Add your first account
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Account summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{selectedAccount.name}</span>
                      <div className="flex items-center gap-2">
                        {unreconciledCount > 0 && (
                          <Badge variant="outline" className="text-orange-600 border-orange-300">
                            {unreconciledCount} unreconciled
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/banking/reconciliation?accountId=${selectedAccountId}`)}
                        >
                          <CheckCircle className="mr-1 h-4 w-4" />
                          Reconcile
                        </Button>
                      </div>
                    </CardTitle>
                    {selectedAccount.accountNumber && (
                      <CardDescription>
                        Account ••••{selectedAccount.accountNumber.slice(-4)}
                        {selectedAccount.sortCode && ` · Sort code ${selectedAccount.sortCode}`}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {formatCurrency(Number(selectedAccount.currentBalance), selectedAccount.currency)}
                        </div>
                        <div className="text-sm text-muted-foreground">Current Balance</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{txData?.pagination?.total ?? 0}</div>
                        <div className="text-sm text-muted-foreground">Total Transactions</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${unreconciledCount > 0 ? "text-orange-600" : "text-green-600"}`}>
                          {unreconciledCount}
                        </div>
                        <div className="text-sm text-muted-foreground">Unreconciled</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Transactions list */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Transactions</span>
                      <Button size="sm" variant="outline"
                        onClick={() => router.push(`/banking/import?accountId=${selectedAccountId}`)}>
                        <Upload className="mr-1 h-3.5 w-3.5" /> Import
                      </Button>
                    </CardTitle>
                    <CardDescription>Most recent 50 transactions for this account</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {txLoading ? (
                      <div className="py-12 text-center">
                        <RefreshCw className="mx-auto h-8 w-8 animate-spin text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground">Loading transactions…</p>
                      </div>
                    ) : transactions.length === 0 ? (
                      <div className="py-12 text-center">
                        <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                        <h3 className="font-semibold mb-1">No transactions yet</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Import a bank statement to see transactions here.
                        </p>
                        <Button onClick={() => router.push(`/banking/import?accountId=${selectedAccountId}`)}>
                          <Upload className="mr-2 h-4 w-4" /> Import Statement
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {transactions.map((tx) => {
                          const amount = Number(tx.amount)
                          const isCredit = amount >= 0
                          const Icon = isCredit ? TrendingUp : TrendingDown
                          const isReconciled = !!tx.reconciledAt
                          return (
                            <div key={tx.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                              <div className="flex items-center gap-3">
                                <Icon className={`h-4 w-4 ${isCredit ? "text-green-600" : "text-red-600"}`} />
                                <div>
                                  <div className="text-sm font-medium">{tx.description}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {formatDate(tx.date)}
                                    {tx.reference && ` · ${tx.reference}`}
                                    {tx.payee && ` · ${tx.payee}`}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className={`font-bold text-sm ${isCredit ? "text-green-600" : "text-red-600"}`}>
                                  {isCredit ? "+" : ""}{formatCurrency(Math.abs(amount), selectedAccount.currency)}
                                </div>
                                {isReconciled ? (
                                  <Badge variant="outline" className="text-green-600 border-green-200 text-xs">
                                    <CheckCircle className="mr-1 h-3 w-3" /> Reconciled
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-orange-600 border-orange-200 text-xs">
                                    <AlertTriangle className="mr-1 h-3 w-3" /> Pending
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add Account Dialog */}
      <Dialog open={addAccountOpen} onOpenChange={setAddAccountOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Bank Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Account name <span className="text-red-500">*</span></Label>
              <Input className="mt-1" placeholder="e.g. Business Current Account"
                value={newAccount.name} onChange={e => setNewAccount(a => ({ ...a, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Account number</Label>
                <Input className="mt-1" placeholder="12345678"
                  value={newAccount.accountNumber} onChange={e => setNewAccount(a => ({ ...a, accountNumber: e.target.value }))} />
              </div>
              <div>
                <Label>Sort code</Label>
                <Input className="mt-1" placeholder="20-00-00"
                  value={newAccount.sortCode} onChange={e => setNewAccount(a => ({ ...a, sortCode: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>IBAN (optional)</Label>
              <Input className="mt-1" placeholder="GB29 NWBK 6016 1331 9268 19"
                value={newAccount.iban} onChange={e => setNewAccount(a => ({ ...a, iban: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Currency</Label>
                <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newAccount.currency} onChange={e => setNewAccount(a => ({ ...a, currency: e.target.value }))}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <Label>Opening balance</Label>
                <Input className="mt-1" type="number" step="0.01" placeholder="0.00"
                  value={newAccount.openingBalance} onChange={e => setNewAccount(a => ({ ...a, openingBalance: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddAccountOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateAccount} disabled={createAccount.isPending}>
              {createAccount.isPending ? "Adding…" : "Add Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
