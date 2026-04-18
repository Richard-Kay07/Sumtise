"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc-client"
import { formatCurrency } from "@/lib/utils"
import { Logo } from "@/components/logo"
import { 
  Plus, 
  RefreshCw, 
  Edit, 
  Trash2,
  Search,
  FileText
} from "lucide-react"
import Link from "next/link"

export default function ChartOfAccountsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedType, setSelectedType] = useState<string>("")

  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()
  const organizationId = organizations?.[0]?.id

  const { data: accounts, isLoading } = trpc.chartOfAccounts.getAll.useQuery(
    { organizationId: organizationId || "" },
    { enabled: !!organizationId }
  )

  const filteredAccounts = accounts?.filter((account) => {
    const matchesSearch =
      account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.code.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = !selectedType || account.type === selectedType
    return matchesSearch && matchesType
  })

  const accountTypes = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center space-x-4">
            <a className="flex items-center space-x-2" href="/">
              <Logo size={32} showText={true} />
            </a>
            <h1 className="text-2xl font-bold">Chart of Accounts</h1>
          </div>
          <div className="flex items-center space-x-2">
            <Link href="/settings/accounting">
              <Button variant="outline">Back to Settings</Button>
            </Link>
            <Button onClick={() => alert("Create account functionality coming soon")}>
              <Plus className="mr-2 h-4 w-4" />
              New Account
            </Button>
          </div>
        </div>
      </div>

      <main className="container mx-auto py-6">
        <div className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="search">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search by name or code..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="type">Account Type</Label>
                  <select
                    id="type"
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  >
                    <option value="">All Types</option>
                    {accountTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Accounts List */}
          {isLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <RefreshCw className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">Loading accounts...</p>
              </CardContent>
            </Card>
          ) : filteredAccounts && filteredAccounts.length > 0 ? (
            <div className="space-y-4">
              {accountTypes.map((type) => {
                const typeAccounts = filteredAccounts.filter((acc) => acc.type === type)
                if (typeAccounts.length === 0) return null

                return (
                  <Card key={type}>
                    <CardHeader>
                      <CardTitle>{type} Accounts</CardTitle>
                      <CardDescription>{typeAccounts.length} account{typeAccounts.length !== 1 ? 's' : ''}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2">Code</th>
                              <th className="text-left p-2">Name</th>
                              <th className="text-right p-2">Opening Balance</th>
                              <th className="text-center p-2">Currency</th>
                              <th className="text-center p-2">Status</th>
                              <th className="text-right p-2">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {typeAccounts.map((account) => (
                              <tr key={account.id} className="border-b hover:bg-muted/50">
                                <td className="p-2 font-mono text-sm">{account.code}</td>
                                <td className="p-2">{account.name}</td>
                                <td className="p-2 text-right">
                                  {formatCurrency(Number(account.openingBalance || 0))}
                                </td>
                                <td className="p-2 text-center">
                                  <Badge variant="outline">{account.currency || "GBP"}</Badge>
                                </td>
                                <td className="p-2 text-center">
                                  {account.isActive ? (
                                    <Badge variant="default">Active</Badge>
                                  ) : (
                                    <Badge variant="secondary">Inactive</Badge>
                                  )}
                                </td>
                                <td className="p-2 text-right">
                                  <div className="flex justify-end space-x-2">
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => alert("Edit account functionality coming soon")}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No Accounts Found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || selectedType
                    ? "No accounts match your filters"
                    : "Get started by creating your first account"}
                </p>
                {!searchTerm && !selectedType && (
                  <Button onClick={() => alert("Create account functionality coming soon")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Account
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}

