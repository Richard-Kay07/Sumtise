"use client"

import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc-client"
import { formatCurrency, formatDate } from "@/lib/utils"
import { ArrowLeft, Eye, CheckCircle, AlertCircle } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"

export default function TransactionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const transactionId = params.id as string

  // Get user's organizations
  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()

  // Get transaction
  const { data: transactionData, isLoading } = trpc.transactions.getById.useQuery(
    {
      id: transactionId,
      organizationId: organizations?.[0]?.id || "",
    },
    { enabled: !!transactionId && !!organizations?.[0]?.id }
  )

  const transaction = transactionData?.transaction
  const relatedTransactions = transactionData?.relatedTransactions || []

  // Check if this is a journal entry (has related transactions)
  const isJournalEntry = relatedTransactions.length > 0
  const allTransactions = transaction ? [transaction, ...relatedTransactions] : []

  // Calculate totals for journal entry
  const journalTotals = useMemo(() => {
    if (!isJournalEntry) return null
    
    const totalDebits = allTransactions.reduce((sum, tx) => sum + Number(tx.debit), 0)
    const totalCredits = allTransactions.reduce((sum, tx) => sum + Number(tx.credit), 0)
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01
    
    return { totalDebits, totalCredits, isBalanced }
  }, [isJournalEntry, allTransactions])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!transaction) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Transaction not found</h2>
              <p className="text-muted-foreground mb-4">
                The transaction you're looking for doesn't exist or has been deleted.
              </p>
              <Link href="/transactions">
                <Button>Back to Transactions</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
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
            <div>
              <h1 className="text-2xl font-bold">Transaction Details</h1>
              <p className="text-sm text-muted-foreground">
                {isJournalEntry ? "Journal Entry" : "Transaction"} • {formatDate(transaction.date)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto py-6 max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Transaction Information */}
            <Card>
              <CardHeader>
                <CardTitle>Transaction Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-sm font-medium">Date</div>
                    <div className="text-sm text-muted-foreground">{formatDate(transaction.date)}</div>
                  </div>
                  {transaction.reference && (
                    <div>
                      <div className="text-sm font-medium">Reference</div>
                      <div className="text-sm text-muted-foreground">{transaction.reference}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-medium">Currency</div>
                    <div className="text-sm text-muted-foreground">{transaction.currency}</div>
                  </div>
                  {transaction.exchangeRate !== 1 && (
                    <div>
                      <div className="text-sm font-medium">Exchange Rate</div>
                      <div className="text-sm text-muted-foreground">{transaction.exchangeRate}</div>
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium">Description</div>
                  <div className="text-sm text-muted-foreground">{transaction.description}</div>
                </div>
              </CardContent>
            </Card>

            {/* Postings */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {isJournalEntry ? "Journal Entry Postings" : "Posting"}
                  </CardTitle>
                  {isJournalEntry && journalTotals && (
                    <Badge variant={journalTotals.isBalanced ? "default" : "destructive"}>
                      {journalTotals.isBalanced ? (
                        <>
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Balanced
                        </>
                      ) : (
                        <>
                          <AlertCircle className="mr-1 h-3 w-3" />
                          Unbalanced
                        </>
                      )}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="h-10 px-4 text-left align-middle font-medium text-sm">Account</th>
                        <th className="h-10 px-4 text-left align-middle font-medium text-sm">Description</th>
                        <th className="h-10 px-4 text-right align-middle font-medium text-sm">Debit</th>
                        <th className="h-10 px-4 text-right align-middle font-medium text-sm">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allTransactions.map((tx) => (
                        <tr key={tx.id} className="border-b hover:bg-muted/50">
                          <td className="p-4">
                            <div className="font-medium">{tx.account.code}</div>
                            <div className="text-sm text-muted-foreground">{tx.account.name}</div>
                          </td>
                          <td className="p-4">
                            <div className="text-sm">{tx.description}</div>
                          </td>
                          <td className="p-4 text-right">
                            {Number(tx.debit) > 0 && (
                              <div className="text-sm font-medium text-red-600">
                                {formatCurrency(Number(tx.debit), tx.currency)}
                              </div>
                            )}
                            {Number(tx.debit) === 0 && (
                              <div className="text-sm text-muted-foreground">—</div>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            {Number(tx.credit) > 0 && (
                              <div className="text-sm font-medium text-green-600">
                                {formatCurrency(Number(tx.credit), tx.currency)}
                              </div>
                            )}
                            {Number(tx.credit) === 0 && (
                              <div className="text-sm text-muted-foreground">—</div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {isJournalEntry && journalTotals && (
                      <tfoot>
                        <tr className="border-t font-medium bg-muted/50">
                          <td colSpan={2} className="p-4 text-right">Totals:</td>
                          <td className="p-4 text-right text-red-600">
                            {formatCurrency(journalTotals.totalDebits, transaction.currency)}
                          </td>
                          <td className="p-4 text-right text-green-600">
                            {formatCurrency(journalTotals.totalCredits, transaction.currency)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Info */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm font-medium">Transaction ID</div>
                  <div className="text-sm text-muted-foreground font-mono">{transaction.id}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Account</div>
                  <div className="text-sm text-muted-foreground">
                    {transaction.account.code} - {transaction.account.name}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">Account Type</div>
                  <Badge variant="outline" className="mt-1">
                    {transaction.account.type}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm font-medium">Amount</div>
                  <div className="text-lg font-bold mt-1">
                    {Number(transaction.debit) > 0 ? (
                      <span className="text-red-600">
                        DR {formatCurrency(Number(transaction.debit), transaction.currency)}
                      </span>
                    ) : (
                      <span className="text-green-600">
                        CR {formatCurrency(Number(transaction.credit), transaction.currency)}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">Created</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {formatDate(transaction.createdAt)}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">Last Updated</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {formatDate(transaction.updatedAt)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

