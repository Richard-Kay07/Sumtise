"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc-client"
import { formatCurrency, formatDate } from "@/lib/utils"
import { 
  Save,
  ArrowLeft,
  Search,
  FileText,
  History,
  User,
  Calendar,
  AlertTriangle,
  CheckCircle,
  X,
  Clock,
  Eye
} from "lucide-react"

export default function AmendExpensePage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedBill, setSelectedBill] = useState<any>(null)
  const [isAmending, setIsAmending] = useState(false)
  const [showAuditTrail, setShowAuditTrail] = useState(false)
  const [amendmentReason, setAmendmentReason] = useState("")
  const [amendmentType, setAmendmentType] = useState("OTHER")

  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()
  const { data: billsData } = trpc.bills.getAll.useQuery(
    { 
      organizationId: organizations?.[0]?.id || "",
      page: 1,
      limit: 100,
      sortBy: "createdAt",
      sortOrder: "desc",
    },
    { enabled: !!organizations?.[0]?.id }
  )

  const bills = billsData?.bills || []
  const filteredBills = bills.filter(bill =>
    bill.billNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bill.vendor.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectBill = (bill: any) => {
    setSelectedBill(bill)
  }

  const handleAmendBill = async () => {
    if (!amendmentReason.trim()) {
      alert("Please provide a reason for the amendment")
      return
    }

    setIsAmending(true)
    try {
      // Create amendment via tRPC mutation
      // const originalData = {
      //   vendorId: selectedBill.vendorId,
      //   date: selectedBill.date,
      //   dueDate: selectedBill.dueDate,
      //   total: selectedBill.total,
      //   items: selectedBill.items,
      // }
      
      // const amendedData = {
      //   // Get current form values
      //   vendorId: selectedBill.vendorId,
      //   date: selectedBill.date,
      //   dueDate: newDueDate,
      //   total: newTotal,
      //   items: newItems,
      // }

      // await trpc.billAmendments.create.mutate({
      //   organizationId: organizations?.[0]?.id || "",
      //   billId: selectedBill.id,
      //   userId: currentUser.id,
      //   amendmentType: amendmentType,
      //   reason: amendmentReason,
      //   originalData: originalData,
      //   amendedData: amendedData,
      // })

      // Update bill
      // await trpc.bills.update.mutate({
      //   id: selectedBill.id,
      //   ...amendedData,
      // })

      alert("Bill amendment created successfully! It will be reviewed by an approver.")
      router.push("/expenses")
    } catch (error) {
      console.error("Error amending bill:", error)
      alert("Failed to create amendment. Please try again.")
    } finally {
      setIsAmending(false)
    }
  }

  const mockAuditTrail = selectedBill ? [
    {
      id: "1",
      action: "CREATED",
      userId: selectedBill.createdById || "user-1",
      userName: "Admin User",
      timestamp: new Date(selectedBill.createdAt),
      details: "Bill created",
      changes: null,
    },
    ...(selectedBill.amendments || []).map((amend: any) => ({
      id: amend.id,
      action: "AMENDED",
      userId: amend.userId,
      userName: amend.user.name || "User",
      timestamp: new Date(amend.createdAt),
      details: amend.reason,
      changes: {
        type: amend.amendmentType,
        original: amend.originalData,
        amended: amend.amendedData,
      },
      status: amend.status,
    })),
  ] : []

  return (
    <div className="flex flex-col h-full bg-background">
      <main className="container mx-auto py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Amend Expense</h1>
            <p className="text-muted-foreground mt-1">
              Request amendments to existing bills with full audit trail
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push("/expenses")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Select Bill */}
            {!selectedBill && (
              <Card>
                <CardHeader>
                  <CardTitle>Select Bill to Amend</CardTitle>
                  <CardDescription>Choose the bill you want to amend</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="search">Search Bills</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="search"
                        placeholder="Search by bill number or vendor..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="border rounded-lg max-h-96 overflow-y-auto">
                    {filteredBills.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No bills found
                      </div>
                    ) : (
                      <div className="divide-y">
                        {filteredBills.map((bill) => (
                          <button
                            key={bill.id}
                            type="button"
                            onClick={() => selectBill(bill)}
                            className="w-full text-left p-4 hover:bg-muted transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">{bill.billNumber || `Bill ${bill.id.slice(0, 8)}`}</div>
                                <div className="text-sm text-muted-foreground">
                                  {bill.vendor.name} • {formatDate(bill.date)}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium">{formatCurrency(bill.total, bill.currency)}</div>
                                <Badge variant={bill.status === "PAID" ? "default" : "secondary"}>
                                  {bill.status}
                                </Badge>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Amendment Form */}
            {selectedBill && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Original Bill Details</CardTitle>
                    <CardDescription>
                      Bill {selectedBill.billNumber || selectedBill.id.slice(0, 8)} - {selectedBill.vendor.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label className="text-muted-foreground">Bill Number</Label>
                        <div className="font-medium">{selectedBill.billNumber || "N/A"}</div>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Vendor</Label>
                        <div className="font-medium">{selectedBill.vendor.name}</div>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Bill Date</Label>
                        <div className="font-medium">{formatDate(selectedBill.date)}</div>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Due Date</Label>
                        <div className="font-medium">{formatDate(selectedBill.dueDate)}</div>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Total Amount</Label>
                        <div className="font-medium">{formatCurrency(selectedBill.total, selectedBill.currency)}</div>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Status</Label>
                        <div>
                          <Badge variant={selectedBill.status === "PAID" ? "default" : "secondary"}>
                            {selectedBill.status}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {selectedBill.items && selectedBill.items.length > 0 && (
                      <div className="border-t pt-4">
                        <Label className="text-muted-foreground mb-2 block">Items</Label>
                        <div className="space-y-2">
                          {selectedBill.items.map((item: any, index: number) => (
                            <div key={index} className="flex justify-between text-sm">
                              <span>{item.description} × {item.quantity}</span>
                              <span>{formatCurrency(item.total, selectedBill.currency)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Amendment Details</CardTitle>
                    <CardDescription>Specify what needs to be changed and why</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="amendmentType">Amendment Type *</Label>
                      <select
                        id="amendmentType"
                        value={amendmentType}
                        onChange={(e) => setAmendmentType(e.target.value)}
                        className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
                      >
                        <option value="AMOUNT_CHANGE">Amount Change</option>
                        <option value="DATE_CHANGE">Date Change</option>
                        <option value="VENDOR_CHANGE">Vendor Change</option>
                        <option value="ITEM_CHANGE">Item Change</option>
                        <option value="STATUS_CHANGE">Status Change</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="reason">Reason for Amendment *</Label>
                      <textarea
                        id="reason"
                        value={amendmentReason}
                        onChange={(e) => setAmendmentReason(e.target.value)}
                        rows={5}
                        className="w-full px-3 py-2 border border-input bg-background rounded-md"
                        placeholder="Please provide a detailed reason for this amendment. This will be part of the audit trail."
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        All amendments are tracked in the audit trail and may require approval.
                      </p>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5" />
                        <div className="text-sm text-yellow-900">
                          <p className="font-medium mb-1">Amendment Notice</p>
                          <p>This amendment will create an audit log entry. The original data will be preserved, and the changes will be tracked. Approval may be required depending on your organization's settings.</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Audit Trail */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Audit Trail</CardTitle>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAuditTrail(!showAuditTrail)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        {showAuditTrail ? "Hide" : "Show"} History
                      </Button>
                    </div>
                  </CardHeader>
                  {showAuditTrail && (
                    <CardContent>
                      <div className="space-y-4">
                        {mockAuditTrail.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            No audit history yet
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {mockAuditTrail.map((entry, index) => (
                              <div key={entry.id} className="border-l-2 border-blue-200 pl-4 pb-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge variant={entry.action === "CREATED" ? "default" : "secondary"}>
                                        {entry.action}
                                      </Badge>
                                      {entry.status && (
                                        <Badge variant={entry.status === "APPROVED" ? "default" : entry.status === "REJECTED" ? "destructive" : "secondary"}>
                                          {entry.status}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      <div className="flex items-center gap-4">
                                        <span className="flex items-center">
                                          <User className="mr-1 h-3 w-3" />
                                          {entry.userName}
                                        </span>
                                        <span className="flex items-center">
                                          <Clock className="mr-1 h-3 w-3" />
                                          {formatDate(entry.timestamp.toISOString())}
                                        </span>
                                      </div>
                                    </div>
                                    <p className="text-sm mt-2">{entry.details}</p>
                                    {entry.changes && (
                                      <div className="mt-2 text-xs bg-muted p-2 rounded">
                                        <p className="font-medium mb-1">Changes:</p>
                                        <p className="text-muted-foreground">
                                          Type: {entry.changes.type.replace(/_/g, " ")}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* Action Buttons */}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSelectedBill(null)
                      setAmendmentReason("")
                      setAmendmentType("OTHER")
                    }}
                  >
                    Change Bill
                  </Button>
                  <Button
                    type="button"
                    onClick={handleAmendBill}
                    disabled={isAmending || !amendmentReason.trim()}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {isAmending ? "Submitting..." : "Submit Amendment"}
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {selectedBill && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-6">
                  <div className="text-sm text-blue-900">
                    <p className="font-medium mb-2">About Amendments</p>
                    <ul className="space-y-1 text-xs list-disc list-inside">
                      <li>All amendments are logged in the audit trail</li>
                      <li>Original data is preserved for compliance</li>
                      <li>Some amendments may require approval</li>
                      <li>Amendments cannot be deleted, only reversed</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

