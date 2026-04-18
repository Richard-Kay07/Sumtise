import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const webhookSchema = z.object({
  event: z.enum([
    "invoice.created",
    "invoice.paid", 
    "invoice.overdue",
    "customer.created",
    "transaction.created",
    "payment.received"
  ]),
  timestamp: z.string(),
  data: z.record(z.any()),
  organizationId: z.string()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event, timestamp, data, organizationId } = webhookSchema.parse(body)

    // Verify webhook signature (implement based on your webhook provider)
    const signature = request.headers.get("x-webhook-signature")
    if (!signature) {
      return NextResponse.json(
        { error: "Missing webhook signature" },
        { status: 401 }
      )
    }

    // Process webhook event
    switch (event) {
      case "invoice.created":
        await handleInvoiceCreated(data, organizationId)
        break
      case "invoice.paid":
        await handleInvoicePaid(data, organizationId)
        break
      case "invoice.overdue":
        await handleInvoiceOverdue(data, organizationId)
        break
      case "customer.created":
        await handleCustomerCreated(data, organizationId)
        break
      case "transaction.created":
        await handleTransactionCreated(data, organizationId)
        break
      case "payment.received":
        await handlePaymentReceived(data, organizationId)
        break
      default:
        console.log(`Unhandled webhook event: ${event}`)
    }

    // Log webhook event
    await prisma.webhookLog.create({
      data: {
        event,
        timestamp: new Date(timestamp),
        data: JSON.stringify(data),
        organizationId,
        processed: true
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Webhook processing error:", error)
    
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    )
  }
}

async function handleInvoiceCreated(data: any, organizationId: string) {
  // Send notification email
  console.log("Invoice created:", data.invoiceId)
  
  // Update customer statistics
  if (data.customerId) {
    await prisma.customer.update({
      where: { id: data.customerId },
      data: {
        // Update customer stats if needed
      }
    })
  }
}

async function handleInvoicePaid(data: any, organizationId: string) {
  // Create payment transaction
  console.log("Invoice paid:", data.invoiceId, data.amount)
  
  // Update invoice status
  await prisma.invoice.update({
    where: { id: data.invoiceId },
    data: { status: "PAID" }
  })
}

async function handleInvoiceOverdue(data: any, organizationId: string) {
  // Send overdue notification
  console.log("Invoice overdue:", data.invoiceId)
  
  // Update invoice status
  await prisma.invoice.update({
    where: { id: data.invoiceId },
    data: { status: "OVERDUE" }
  })
}

async function handleCustomerCreated(data: any, organizationId: string) {
  // Send welcome email
  console.log("Customer created:", data.customerId)
}

async function handleTransactionCreated(data: any, organizationId: string) {
  // Update account balances
  console.log("Transaction created:", data.transactionId)
}

async function handlePaymentReceived(data: any, organizationId: string) {
  // Process payment and update balances
  console.log("Payment received:", data.amount, data.currency)
}
