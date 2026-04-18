/**
 * Posting Engine Usage Examples
 * 
 * This file demonstrates how to use the posting engine
 * for double-entry bookkeeping throughout the Sumtise application.
 */

import { postDoubleEntry, reversePosting, validateDoubleEntry } from "@/lib/posting"
import { orgScopedProcedure } from "@/lib/trpc"
import { prisma } from "@/lib/prisma"

// ============================================================================
// Example 1: Post invoice payment (Cash received, Revenue)
// ============================================================================

export const postInvoicePaymentExample = async (
  ctx: { session: any; organizationId: string },
  invoiceId: string,
  amount: number,
  paymentDate: Date
) => {
  // Get invoice details
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { customer: true },
  })

  if (!invoice) {
    throw new Error("Invoice not found")
  }

  // Get accounts
  const cashAccount = await prisma.chartOfAccount.findFirst({
    where: {
      organizationId: ctx.organizationId,
      code: "1000", // Cash account code
      isActive: true,
    },
  })

  const revenueAccount = await prisma.chartOfAccount.findFirst({
    where: {
      organizationId: ctx.organizationId,
      type: "REVENUE",
      isActive: true,
    },
  })

  if (!cashAccount || !revenueAccount) {
    throw new Error("Required accounts not found")
  }

  // Post double-entry
  const result = await postDoubleEntry({
    date: paymentDate,
    lines: [
      {
        accountId: cashAccount.id,
        debit: amount,
        credit: 0,
        description: `Payment received for invoice ${invoice.invoiceNumber}`,
        reference: invoice.invoiceNumber,
      },
      {
        accountId: revenueAccount.id,
        debit: 0,
        credit: amount,
        description: `Revenue from invoice ${invoice.invoiceNumber}`,
        reference: invoice.invoiceNumber,
      },
    ],
    docRef: invoice.invoiceNumber,
    currency: invoice.currency,
    rate: 1.0,
    orgId: ctx.organizationId,
    userId: ctx.session.user.id,
    description: `Invoice payment: ${invoice.invoiceNumber}`,
    metadata: {
      invoiceId,
      customerId: invoice.customerId,
    },
  })

  return result
}

// ============================================================================
// Example 2: Post expense payment (Expense, Accounts Payable)
// ============================================================================

export const postExpensePaymentExample = async (
  ctx: { session: any; organizationId: string },
  billId: string,
  amount: number,
  paymentDate: Date
) => {
  // Get bill details
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: { vendor: true, items: true },
  })

  if (!bill) {
    throw new Error("Bill not found")
  }

  // Get accounts
  const expenseAccount = bill.items[0]?.accountId
    ? await prisma.chartOfAccount.findUnique({
        where: { id: bill.items[0].accountId },
      })
    : await prisma.chartOfAccount.findFirst({
        where: {
          organizationId: ctx.organizationId,
          type: "EXPENSE",
          isActive: true,
        },
      })

  const apAccount = await prisma.chartOfAccount.findFirst({
    where: {
      organizationId: ctx.organizationId,
      code: "2000", // Accounts Payable account code
      isActive: true,
    },
  })

  if (!expenseAccount || !apAccount) {
    throw new Error("Required accounts not found")
  }

  // Post double-entry
  const result = await postDoubleEntry({
    date: paymentDate,
    lines: [
      {
        accountId: expenseAccount.id,
        debit: amount,
        credit: 0,
        description: `Expense payment for bill ${bill.billNumber}`,
        reference: bill.billNumber,
      },
      {
        accountId: apAccount.id,
        debit: 0,
        credit: amount,
        description: `Accounts payable for bill ${bill.billNumber}`,
        reference: bill.billNumber,
      },
    ],
    docRef: bill.billNumber,
    currency: bill.currency,
    rate: 1.0,
    orgId: ctx.organizationId,
    userId: ctx.session.user.id,
    description: `Bill payment: ${bill.billNumber}`,
    metadata: {
      billId,
      vendorId: bill.vendorId,
    },
  })

  return result
}

// ============================================================================
// Example 3: Post bank transfer (Bank A to Bank B)
// ============================================================================

export const postBankTransferExample = async (
  ctx: { session: any; organizationId: string },
  fromBankAccountId: string,
  toBankAccountId: string,
  amount: number,
  transferDate: Date
) => {
  // Post double-entry
  const result = await postDoubleEntry({
    date: transferDate,
    lines: [
      {
        accountId: toBankAccountId,
        debit: amount,
        credit: 0,
        description: "Bank transfer received",
      },
      {
        accountId: fromBankAccountId,
        debit: 0,
        credit: amount,
        description: "Bank transfer sent",
      },
    ],
    docRef: `TRF-${Date.now()}`,
    currency: "GBP",
    rate: 1.0,
    orgId: ctx.organizationId,
    userId: ctx.session.user.id,
    description: "Bank transfer",
    metadata: {
      fromBankAccountId,
      toBankAccountId,
    },
  })

  return result
}

// ============================================================================
// Example 4: Post multi-line journal entry
// ============================================================================

export const postMultiLineJournalExample = async (
  ctx: { session: any; organizationId: string },
  journalDate: Date
) => {
  // Example: Accrual entry with multiple accounts
  const result = await postDoubleEntry({
    date: journalDate,
    lines: [
      {
        accountId: "acc1", // Expense account
        debit: 500,
        credit: 0,
        description: "Accrued expense - Rent",
      },
      {
        accountId: "acc2", // Expense account
        debit: 300,
        credit: 0,
        description: "Accrued expense - Utilities",
      },
      {
        accountId: "acc3", // Liability account (Accrued Expenses)
        debit: 0,
        credit: 800, // Total of above
        description: "Accrued expenses payable",
      },
    ],
    docRef: `JNL-${Date.now()}`,
    currency: "GBP",
    rate: 1.0,
    orgId: ctx.organizationId,
    userId: ctx.session.user.id,
    description: "Monthly accrual entry",
  })

  return result
}

// ============================================================================
// Example 5: Validate before posting
// ============================================================================

export const validateBeforePostingExample = async (
  ctx: { session: any; organizationId: string },
  lines: any[]
) => {
  // Validate first
  const validation = await validateDoubleEntry({
    date: new Date(),
    lines,
    orgId: ctx.organizationId,
    userId: ctx.session.user.id,
  })

  if (!validation.valid) {
    // Return validation errors to user
    return {
      success: false,
      errors: validation.errors,
      totalDebit: validation.totalDebit,
      totalCredit: validation.totalCredit,
      difference: validation.difference,
    }
  }

  // If valid, proceed with posting
  const result = await postDoubleEntry({
    date: new Date(),
    lines,
    orgId: ctx.organizationId,
    userId: ctx.session.user.id,
  })

  return {
    success: true,
    result,
  }
}

// ============================================================================
// Example 6: Reverse a posting
// ============================================================================

export const reversePostingExample = async (
  ctx: { session: any; organizationId: string },
  transactionIds: string[]
) => {
  // Reverse the posting
  const result = await reversePosting(transactionIds, {
    orgId: ctx.organizationId,
    userId: ctx.session.user.id,
    date: new Date(),
    description: "Reversal of incorrect entry",
  })

  return result
}

// ============================================================================
// Example 7: Post in tRPC router
// ============================================================================

export const postDoubleEntryRouter = {
  post: orgScopedProcedure
    .input(/* postDoubleEntrySchema */)
    .mutation(async ({ ctx, input }) => {
      // Post double-entry transaction
      const result = await postDoubleEntry({
        date: input.date,
        lines: input.lines,
        docRef: input.docRef,
        currency: input.currency,
        rate: input.rate,
        orgId: ctx.organizationId,
        userId: ctx.session.user.id,
        description: input.description,
        metadata: input.metadata,
      })

      return result
    }),

  validate: orgScopedProcedure
    .input(/* postDoubleEntrySchema */)
    .mutation(async ({ ctx, input }) => {
      // Validate without posting
      const validation = await validateDoubleEntry({
        date: input.date,
        lines: input.lines,
        orgId: ctx.organizationId,
        userId: ctx.session.user.id,
      })

      return validation
    }),

  reverse: orgScopedProcedure
    .input(/* z.object({ transactionIds: z.array(z.string()) }) */)
    .mutation(async ({ ctx, input }) => {
      // Reverse posting
      const result = await reversePosting(input.transactionIds, {
        orgId: ctx.organizationId,
        userId: ctx.session.user.id,
      })

      return result
    }),
}

// ============================================================================
// Example 8: Post with error handling
// ============================================================================

export const postWithErrorHandlingExample = async (
  ctx: { session: any; organizationId: string },
  lines: any[]
) => {
  try {
    const result = await postDoubleEntry({
      date: new Date(),
      lines,
      orgId: ctx.organizationId,
      userId: ctx.session.user.id,
    })

    return {
      success: true,
      data: result,
    }
  } catch (error: any) {
    // Handle validation errors
    if (error.code === "BAD_REQUEST") {
      return {
        success: false,
        error: "Validation failed",
        message: error.message,
      }
    }

    // Handle other errors
    return {
      success: false,
      error: "Posting failed",
      message: error.message,
    }
  }
}

