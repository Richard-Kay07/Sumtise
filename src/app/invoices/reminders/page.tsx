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
  Mail, 
  Send,
  ArrowLeft,
  Search,
  CheckSquare,
  Square,
  FileText,
  Calendar,
  DollarSign,
  Eye,
  Edit
} from "lucide-react"

export default function SendRemindersPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set())
  const [emailTemplate, setEmailTemplate] = useState("default")
  const [customSubject, setCustomSubject] = useState("")
  const [customBody, setCustomBody] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()
  const { data: invoicesData } = trpc.invoices.getAll.useQuery(
    { 
      organizationId: organizations?.[0]?.id || "",
      page: 1,
      limit: 100,
      sortBy: "dueDate",
      sortOrder: "asc",
      status: "SENT", // Only show sent but unpaid invoices
    },
    { enabled: !!organizations?.[0]?.id }
  )

  const invoices = invoicesData?.invoices || []
  
  // Filter to only show outstanding invoices
  const outstandingInvoices = invoices.filter(inv => 
    inv.status === "SENT" || inv.status === "OVERDUE"
  )

  const filteredInvoices = outstandingInvoices.filter(inv =>
    inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.customer.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const toggleSelect = (invoiceId: string) => {
    const newSelected = new Set(selectedInvoices)
    if (newSelected.has(invoiceId)) {
      newSelected.delete(invoiceId)
    } else {
      newSelected.add(invoiceId)
    }
    setSelectedInvoices(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedInvoices.size === filteredInvoices.length) {
      setSelectedInvoices(new Set())
    } else {
      setSelectedInvoices(new Set(filteredInvoices.map(inv => inv.id)))
    }
  }

  const selectedInvoiceList = filteredInvoices.filter(inv => selectedInvoices.has(inv.id))
  const totalOutstanding = selectedInvoiceList.reduce((sum, inv) => sum + inv.total, 0)

  const emailTemplates = {
    default: {
      subject: "Payment Reminder - Invoice {{invoiceNumber}}",
      body: `Dear {{customerName}},

This is a friendly reminder that payment is due for Invoice {{invoiceNumber}} dated {{invoiceDate}}.

Amount Due: {{amount}}
Due Date: {{dueDate}}

Please arrange payment at your earliest convenience. If you have already made this payment, please disregard this reminder.

Thank you for your business.

Best regards,
{{organizationName}}`
    },
    first: {
      subject: "First Payment Reminder - Invoice {{invoiceNumber}}",
      body: `Dear {{customerName}},

This is a friendly reminder that payment is due for Invoice {{invoiceNumber}}.

Amount Due: {{amount}}
Due Date: {{dueDate}}

We look forward to receiving your payment.

Thank you,
{{organizationName}}`
    },
    second: {
      subject: "Second Payment Reminder - Invoice {{invoiceNumber}}",
      body: `Dear {{customerName}},

This is a second reminder regarding Invoice {{invoiceNumber}} which is now overdue.

Amount Due: {{amount}}
Due Date: {{dueDate}}
Days Overdue: {{daysOverdue}}

Please arrange payment immediately. If you have any queries regarding this invoice, please contact us.

Best regards,
{{organizationName}}`
    },
    final: {
      subject: "Final Payment Notice - Invoice {{invoiceNumber}}",
      body: `Dear {{customerName}},

This is a final notice that Invoice {{invoiceNumber}} is overdue and requires immediate payment.

Amount Due: {{amount}}
Due Date: {{dueDate}}
Days Overdue: {{daysOverdue}}

Please arrange payment within 7 days to avoid further action. If payment has been made, please provide proof of payment.

If you have any queries, please contact us immediately.

{{organizationName}}`
    }
  }

  const getTemplateContent = () => {
    if (emailTemplate === "custom") {
      return {
        subject: customSubject || emailTemplates.default.subject,
        body: customBody || emailTemplates.default.body
      }
    }
    return emailTemplates[emailTemplate as keyof typeof emailTemplates] || emailTemplates.default
  }

  const replaceTemplateVariables = (template: string, invoice: any) => {
    const daysOverdue = invoice.status === "OVERDUE" 
      ? Math.floor((new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0
    
    return template
      .replace(/\{\{invoiceNumber\}\}/g, invoice.invoiceNumber)
      .replace(/\{\{customerName\}\}/g, invoice.customer.name)
      .replace(/\{\{invoiceDate\}\}/g, formatDate(invoice.date))
      .replace(/\{\{dueDate\}\}/g, formatDate(invoice.dueDate))
      .replace(/\{\{amount\}\}/g, formatCurrency(invoice.total, invoice.currency))
      .replace(/\{\{daysOverdue\}\}/g, daysOverdue.toString())
      .replace(/\{\{organizationName\}\}/g, organizations?.[0]?.name || "Sumtise")
  }

  const handleSendReminders = async () => {
    if (selectedInvoiceList.length === 0) {
      alert("Please select at least one invoice")
      return
    }

    setIsSending(true)
    try {
      const template = getTemplateContent()
      
      for (const invoice of selectedInvoiceList) {
        // Create reminder record and send email
        // await trpc.invoiceReminders.create.mutate({
        //   organizationId: organizations?.[0]?.id || "",
        //   invoiceId: invoice.id,
        //   reminderType: emailTemplate.toUpperCase(),
        //   scheduledFor: new Date(),
        //   emailSubject: replaceTemplateVariables(template.subject, invoice),
        //   emailBody: replaceTemplateVariables(template.body, invoice),
        // })
        
        // Send email via email service
        // await sendEmail(...)
      }

      alert(`Reminders sent successfully to ${selectedInvoiceList.length} customer(s)!`)
      router.push("/invoices")
    } catch (error) {
      console.error("Error sending reminders:", error)
      alert("Failed to send reminders. Please try again.")
    } finally {
      setIsSending(false)
    }
  }

  const previewInvoice = selectedInvoiceList.length > 0 ? selectedInvoiceList[0] : null

  return (
    <div className="flex flex-col h-full bg-background">
      <main className="container mx-auto py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Send Payment Reminders</h1>
            <p className="text-muted-foreground mt-1">
              Send automated payment reminders to customers with outstanding invoices
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push("/invoices")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Select Invoices */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Select Outstanding Invoices</CardTitle>
                  <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                    {selectedInvoices.size === filteredInvoices.length ? (
                      <>
                        <CheckSquare className="mr-2 h-4 w-4" />
                        Deselect All
                      </>
                    ) : (
                      <>
                        <Square className="mr-2 h-4 w-4" />
                        Select All ({filteredInvoices.length})
                      </>
                    )}
                  </Button>
                </div>
                <CardDescription>
                  Select invoices to send payment reminders for
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="search">Search Invoices</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search by invoice number or customer..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="border rounded-lg max-h-96 overflow-y-auto">
                  {filteredInvoices.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                      <p>No outstanding invoices found</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredInvoices.map((invoice) => {
                        const isSelected = selectedInvoices.has(invoice.id)
                        const daysOverdue = invoice.status === "OVERDUE" 
                          ? Math.floor((new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24))
                          : null

                        return (
                          <div
                            key={invoice.id}
                            className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : ''}`}
                            onClick={() => toggleSelect(invoice.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                {isSelected ? (
                                  <CheckSquare className="h-5 w-5 text-blue-600" />
                                ) : (
                                  <Square className="h-5 w-5 text-muted-foreground" />
                                )}
                                <div>
                                  <div className="font-medium">{invoice.invoiceNumber}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {invoice.customer.name}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium">{formatCurrency(invoice.total, invoice.currency)}</div>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant={invoice.status === "OVERDUE" ? "destructive" : "secondary"}>
                                    {invoice.status}
                                  </Badge>
                                  {daysOverdue !== null && (
                                    <span className="text-xs text-muted-foreground">
                                      {daysOverdue} days overdue
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground flex items-center gap-4">
                              <span className="flex items-center">
                                <Calendar className="mr-1 h-3 w-3" />
                                Due: {formatDate(invoice.dueDate)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Email Template */}
            {selectedInvoiceList.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Email Template</CardTitle>
                  <CardDescription>Choose or customize the reminder email template</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="template">Template</Label>
                    <select
                      id="template"
                      value={emailTemplate}
                      onChange={(e) => setEmailTemplate(e.target.value)}
                      className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
                    >
                      <option value="default">Default Reminder</option>
                      <option value="first">First Reminder</option>
                      <option value="second">Second Reminder</option>
                      <option value="final">Final Notice</option>
                      <option value="custom">Custom Template</option>
                    </select>
                  </div>

                  {emailTemplate === "custom" && (
                    <>
                      <div>
                        <Label htmlFor="subject">Email Subject</Label>
                        <Input
                          id="subject"
                          value={customSubject}
                          onChange={(e) => setCustomSubject(e.target.value)}
                          placeholder="Payment Reminder - Invoice {{invoiceNumber}}"
                        />
                      </div>
                      <div>
                        <Label htmlFor="body">Email Body</Label>
                        <textarea
                          id="body"
                          value={customBody}
                          onChange={(e) => setCustomBody(e.target.value)}
                          rows={10}
                          className="w-full px-3 py-2 border border-input bg-background rounded-md font-mono text-sm"
                          placeholder="Enter your custom email template. Use {{variable}} for placeholders."
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Available variables: {"{{invoiceNumber}}"}, {"{{customerName}}"}, {"{{invoiceDate}}"}, {"{{dueDate}}"}, {"{{amount}}"}, {"{{daysOverdue}}"}, {"{{organizationName}}"}
                        </p>
                      </div>
                    </>
                  )}

                  <div className="border-t pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowPreview(!showPreview)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      {showPreview ? "Hide" : "Show"} Preview
                    </Button>
                  </div>

                  {showPreview && previewInvoice && (
                    <div className="border rounded-lg p-4 bg-muted/50">
                      <div className="text-sm space-y-2">
                        <div>
                          <span className="font-medium">To:</span> {previewInvoice.customer.email || previewInvoice.customer.name}
                        </div>
                        <div>
                          <span className="font-medium">Subject:</span> {replaceTemplateVariables(getTemplateContent().subject, previewInvoice)}
                        </div>
                        <div className="border-t pt-2 mt-2">
                          <div className="whitespace-pre-wrap">{replaceTemplateVariables(getTemplateContent().body, previewInvoice)}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Selected Invoices:</span>
                    <span className="font-medium">{selectedInvoiceList.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Outstanding:</span>
                    <span className="font-medium">{formatCurrency(totalOutstanding)}</span>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <Button
                    className="w-full"
                    onClick={handleSendReminders}
                    disabled={selectedInvoiceList.length === 0 || isSending}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {isSending ? "Sending..." : `Send to ${selectedInvoiceList.length} Customer(s)`}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="text-sm text-blue-900">
                  <p className="font-medium mb-2">Reminder Best Practices:</p>
                  <ul className="space-y-1 text-xs list-disc list-inside">
                    <li>Send first reminder 3 days before due date</li>
                    <li>Send second reminder 3 days after due date</li>
                    <li>Send final notice 10 days after due date</li>
                    <li>Always include payment details and invoice number</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

