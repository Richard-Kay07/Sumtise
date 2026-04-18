import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const exportSchema = z.object({
  type: z.enum(["invoices", "customers", "transactions", "reports"]),
  format: z.enum(["csv", "excel", "pdf"]),
  organizationId: z.string(),
  filters: z.record(z.any()).optional(),
  dateRange: z.object({
    start: z.string(),
    end: z.string()
  }).optional()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, format, organizationId, filters, dateRange } = exportSchema.parse(body)

    let data: any[] = []
    let filename = ""

    switch (type) {
      case "invoices":
        data = await exportInvoices(organizationId, filters, dateRange)
        filename = `invoices_${new Date().toISOString().split('T')[0]}.${format}`
        break
      case "customers":
        data = await exportCustomers(organizationId, filters)
        filename = `customers_${new Date().toISOString().split('T')[0]}.${format}`
        break
      case "transactions":
        data = await exportTransactions(organizationId, filters, dateRange)
        filename = `transactions_${new Date().toISOString().split('T')[0]}.${format}`
        break
      case "reports":
        data = await exportReports(organizationId, filters, dateRange)
        filename = `reports_${new Date().toISOString().split('T')[0]}.${format}`
        break
    }

    if (format === "csv") {
      const csv = convertToCSV(data)
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${filename}"`
        }
      })
    } else if (format === "excel") {
      // For Excel export, you would use a library like xlsx
      const excelBuffer = await convertToExcel(data)
      return new NextResponse(excelBuffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`
        }
      })
    } else if (format === "pdf") {
      // For PDF export, you would use a library like puppeteer or jsPDF
      const pdfBuffer = await convertToPDF(data, type)
      return new NextResponse(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`
        }
      })
    }

    return NextResponse.json({ error: "Unsupported format" }, { status: 400 })
  } catch (error) {
    console.error("Export error:", error)
    return NextResponse.json(
      { error: "Export failed" },
      { status: 500 }
    )
  }
}

async function exportInvoices(organizationId: string, filters?: any, dateRange?: any) {
  const where: any = { organizationId }
  
  if (filters?.status) {
    where.status = filters.status
  }
  
  if (dateRange) {
    where.date = {
      gte: new Date(dateRange.start),
      lte: new Date(dateRange.end)
    }
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      customer: true,
      items: true
    },
    orderBy: { createdAt: "desc" }
  })

  return invoices.map(invoice => ({
    "Invoice Number": invoice.invoiceNumber,
    "Date": invoice.date.toISOString().split('T')[0],
    "Due Date": invoice.dueDate.toISOString().split('T')[0],
    "Customer": invoice.customer.name,
    "Status": invoice.status,
    "Subtotal": invoice.subtotal,
    "Tax Amount": invoice.taxAmount,
    "Total": invoice.total,
    "Currency": invoice.currency,
    "Notes": invoice.notes || ""
  }))
}

async function exportCustomers(organizationId: string, filters?: any) {
  const where: any = { organizationId }
  
  if (filters?.isActive !== undefined) {
    where.isActive = filters.isActive
  }

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { createdAt: "desc" }
  })

  return customers.map(customer => ({
    "Name": customer.name,
    "Email": customer.email || "",
    "Phone": customer.phone || "",
    "Credit Limit": customer.creditLimit,
    "Tax ID": customer.taxId || "",
    "Active": customer.isActive ? "Yes" : "No",
    "Created": customer.createdAt.toISOString().split('T')[0]
  }))
}

async function exportTransactions(organizationId: string, filters?: any, dateRange?: any) {
  const where: any = { organizationId }
  
  if (filters?.accountId) {
    where.accountId = filters.accountId
  }
  
  if (dateRange) {
    where.date = {
      gte: new Date(dateRange.start),
      lte: new Date(dateRange.end)
    }
  }

  const transactions = await prisma.transaction.findMany({
    where,
    include: {
      account: true
    },
    orderBy: { date: "desc" }
  })

  return transactions.map(transaction => ({
    "Date": transaction.date.toISOString().split('T')[0],
    "Description": transaction.description,
    "Reference": transaction.reference || "",
    "Account": `${transaction.account.code} - ${transaction.account.name}`,
    "Debit": transaction.debit,
    "Credit": transaction.credit,
    "Currency": transaction.currency,
    "Exchange Rate": transaction.exchangeRate
  }))
}

async function exportReports(organizationId: string, filters?: any, dateRange?: any) {
  // This would generate various financial reports
  // For now, return a basic profit & loss structure
  return [
    {
      "Report Type": "Profit & Loss",
      "Period": dateRange ? `${dateRange.start} to ${dateRange.end}` : "Current Period",
      "Revenue": 0, // Would calculate from transactions
      "Expenses": 0, // Would calculate from transactions
      "Net Profit": 0 // Would calculate difference
    }
  ]
}

function convertToCSV(data: any[]): string {
  if (data.length === 0) return ""
  
  const headers = Object.keys(data[0])
  const csvRows = [headers.join(",")]
  
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header]
      return typeof value === "string" ? `"${value.replace(/"/g, '""')}"` : value
    })
    csvRows.push(values.join(","))
  }
  
  return csvRows.join("\n")
}

async function convertToExcel(data: any[]): Promise<Buffer> {
  // This would use the xlsx library to create Excel files
  // For now, return CSV as buffer
  const csv = convertToCSV(data)
  return Buffer.from(csv, "utf-8")
}

async function convertToPDF(data: any[], type: string): Promise<Buffer> {
  // This would use puppeteer or jsPDF to create PDF files
  // For now, return CSV as buffer
  const csv = convertToCSV(data)
  return Buffer.from(csv, "utf-8")
}
