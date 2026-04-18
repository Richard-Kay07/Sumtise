"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { trpc } from "@/lib/trpc-client"
import { Logo } from "@/components/logo"
import { formatCurrency, formatDate } from "@/lib/utils"
import { 
  CreditCard, 
  Upload, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  FileText,
  Link,
  Shield,
  Banknote
} from "lucide-react"

interface BankTransaction {
  id: string
  date: string
  description: string
  amount: number
  type: 'debit' | 'credit'
  balance: number
  reference?: string
  category?: string
  matched: boolean
}

interface BankAccount {
  id: string
  name: string
  accountNumber: string
  sortCode: string
  currency: string
  currentBalance: number
  lastSync: string
  status: 'connected' | 'disconnected' | 'error'
  transactions: BankTransaction[]
}

export default function BankingPage() {
  const [selectedAccount, setSelectedAccount] = useState<string>("")
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [reconciliationMode, setReconciliationMode] = useState(false)

  // Get user's organizations
  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()

  // Get bank accounts
  const { data: bankAccounts } = trpc.bankAccounts.getAll.useQuery(
    { organizationId: organizations?.[0]?.id || "" },
    { enabled: !!organizations?.[0]?.id }
  )

  // Mock data for demonstration
  const mockBankAccounts: BankAccount[] = [
    {
      id: "1",
      name: "Business Current Account",
      accountNumber: "****1234",
      sortCode: "20-00-00",
      currency: "GBP",
      currentBalance: 25430.50,
      lastSync: "2024-01-15T10:30:00Z",
      status: "connected",
      transactions: [
        {
          id: "t1",
          date: "2024-01-15",
          description: "Payment from ABC Corp",
          amount: 2500.00,
          type: "credit",
          balance: 25430.50,
          reference: "INV-2024001",
          category: "Sales",
          matched: true
        },
        {
          id: "t2",
          date: "2024-01-14",
          description: "Office Supplies Ltd",
          amount: 150.00,
          type: "debit",
          balance: 22930.50,
          reference: "EXP-001",
          category: "Office Supplies",
          matched: true
        },
        {
          id: "t3",
          date: "2024-01-13",
          description: "Bank Transfer - Unknown",
          amount: 500.00,
          type: "credit",
          balance: 23080.50,
          matched: false
        }
      ]
    },
    {
      id: "2",
      name: "Business Savings Account",
      accountNumber: "****5678",
      sortCode: "20-00-00",
      currency: "GBP",
      currentBalance: 50000.00,
      lastSync: "2024-01-14T15:45:00Z",
      status: "connected",
      transactions: []
    }
  ]

  const accounts = bankAccounts || mockBankAccounts
  const selectedAccountData = accounts.find(acc => acc.id === selectedAccount)

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    setImportProgress(0)

    // Simulate file processing
    const interval = setInterval(() => {
      setImportProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsImporting(false)
          return 100
        }
        return prev + 10
      })
    }, 200)

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  const handleOpenBankingConnect = async () => {
    // This would integrate with Open Banking APIs
    console.log("Connecting to Open Banking...")
  }

  const handleReconcile = async () => {
    setReconciliationMode(true)
    // Simulate reconciliation process
    await new Promise(resolve => setTimeout(resolve, 1500))
    setReconciliationMode(false)
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "connected":
        return "default"
      case "disconnected":
        return "secondary"
      case "error":
        return "destructive"
      default:
        return "outline"
    }
  }

  const getTransactionIcon = (type: string) => {
    return type === "credit" ? TrendingUp : TrendingDown
  }

  const getTransactionColor = (type: string) => {
    return type === "credit" ? "text-green-600" : "text-red-600"
  }

  const unmatchedTransactions = selectedAccountData?.transactions.filter(t => !t.matched) || []
  const matchedTransactions = selectedAccountData?.transactions.filter(t => t.matched) || []

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <a className="mr-6" href="/">
              <Logo size={32} showText={true} />
            </a>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="w-full flex-1 md:w-auto md:flex-none">
              <h1 className="text-2xl font-bold">Banking & Reconciliation</h1>
            </div>
            <nav className="flex items-center space-x-2">
              <Button variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync All
              </Button>
              <Button>
                <Link className="mr-2 h-4 w-4" />
                Connect Bank
              </Button>
            </nav>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Bank Accounts */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="mr-2 h-5 w-5" />
                  Bank Accounts
                </CardTitle>
                <CardDescription>
                  Manage your connected accounts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {accounts.map((account) => (
                    <div
                      key={account.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedAccount === account.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedAccount(account.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium">{account.name}</h3>
                        <Badge variant={getStatusBadgeVariant(account.status)}>
                          {account.status}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center">
                          <Banknote className="mr-2 h-4 w-4" />
                          {formatCurrency(account.currentBalance, account.currency)}
                        </div>
                        <div className="flex items-center">
                          <Calendar className="mr-2 h-4 w-4" />
                          Last sync: {formatDate(account.lastSync)}
                        </div>
                        <div className="flex items-center">
                          <FileText className="mr-2 h-4 w-4" />
                          {account.transactions.length} transactions
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Import Options */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Import Transactions</CardTitle>
                <CardDescription>
                  Upload bank statements or connect via Open Banking
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center">
                    <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium mb-2">Upload Statement</p>
                    <p className="text-xs text-muted-foreground mb-3">
                      CSV, OFX, QIF formats supported
                    </p>
                    <input
                      type="file"
                      accept=".csv,.ofx,.qif"
                      onChange={handleFileImport}
                      className="hidden"
                      id="file-upload"
                    />
                    <Button variant="outline" size="sm" onClick={() => document.getElementById('file-upload')?.click()}>
                      Choose File
                    </Button>
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Shield className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">Open Banking</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Secure, real-time bank data
                    </p>
                    <Button variant="outline" size="sm" onClick={handleOpenBankingConnect}>
                      <Link className="mr-2 h-4 w-4" />
                      Connect
                    </Button>
                  </div>

                  {isImporting && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Importing transactions...</span>
                        <span>{importProgress}%</span>
                      </div>
                      <Progress value={importProgress} className="h-2" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Transactions and Reconciliation */}
          <div className="lg:col-span-2">
            {selectedAccountData ? (
              <div className="space-y-6">
                {/* Account Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{selectedAccountData.name}</span>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">
                          {unmatchedTransactions.length} unmatched
                        </Badge>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleReconcile}
                          disabled={reconciliationMode}
                        >
                          {reconciliationMode ? (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                              Reconciling...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Reconcile
                            </>
                          )}
                        </Button>
                      </div>
                    </CardTitle>
                    <CardDescription>
                      Account: {selectedAccountData.accountNumber} | Sort Code: {selectedAccountData.sortCode}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {formatCurrency(selectedAccountData.currentBalance, selectedAccountData.currency)}
                        </div>
                        <div className="text-sm text-muted-foreground">Current Balance</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">
                          {selectedAccountData.transactions.length}
                        </div>
                        <div className="text-sm text-muted-foreground">Total Transactions</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {matchedTransactions.length}
                        </div>
                        <div className="text-sm text-muted-foreground">Matched</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Unmatched Transactions */}
                {unmatchedTransactions.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center text-orange-600">
                        <AlertTriangle className="mr-2 h-5 w-5" />
                        Unmatched Transactions ({unmatchedTransactions.length})
                      </CardTitle>
                      <CardDescription>
                        These transactions need to be matched with your accounting records
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {unmatchedTransactions.map((transaction) => {
                          const Icon = getTransactionIcon(transaction.type)
                          return (
                            <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center space-x-3">
                                <Icon className={`h-5 w-5 ${getTransactionColor(transaction.type)}`} />
                                <div>
                                  <div className="font-medium">{transaction.description}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {formatDate(transaction.date)} • {transaction.reference || 'No reference'}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-3">
                                <div className={`font-bold ${getTransactionColor(transaction.type)}`}>
                                  {transaction.type === 'credit' ? '+' : '-'}{formatCurrency(transaction.amount)}
                                </div>
                                <div className="flex space-x-1">
                                  <Button variant="outline" size="sm">
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                  <Button variant="outline" size="sm">
                                    <AlertTriangle className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* All Transactions */}
                <Card>
                  <CardHeader>
                    <CardTitle>All Transactions</CardTitle>
                    <CardDescription>
                      Complete transaction history for this account
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {selectedAccountData.transactions.map((transaction) => {
                        const Icon = getTransactionIcon(transaction.type)
                        return (
                          <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center space-x-3">
                              <Icon className={`h-5 w-5 ${getTransactionColor(transaction.type)}`} />
                              <div>
                                <div className="font-medium">{transaction.description}</div>
                                <div className="text-sm text-muted-foreground">
                                  {formatDate(transaction.date)} • {transaction.reference || 'No reference'}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3">
                              <div className={`font-bold ${getTransactionColor(transaction.type)}`}>
                                {transaction.type === 'credit' ? '+' : '-'}{formatCurrency(transaction.amount)}
                              </div>
                              <div className="flex items-center space-x-2">
                                {transaction.matched ? (
                                  <Badge variant="default" className="bg-green-100 text-green-800">
                                    <CheckCircle className="mr-1 h-3 w-3" />
                                    Matched
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive">
                                    <AlertTriangle className="mr-1 h-3 w-3" />
                                    Unmatched
                                  </Badge>
                                )}
                                {transaction.category && (
                                  <Badge variant="outline">{transaction.category}</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <CreditCard className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">Select a bank account</h3>
                  <p className="text-muted-foreground">
                    Choose an account from the sidebar to view transactions
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
