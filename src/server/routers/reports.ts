/**
 * Reports Router
 * 
 * Provides endpoints for financial reports:
 * - Trial Balance
 * - Cash Flow Statement
 * - Aged Receivables
 * - Aged Payables
 */

import { z } from "zod"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "../trpc"
import { Permission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { Decimal } from "decimal.js"

const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(1000).default(100),
})

export const reportsRouter = createTRPCRouter({
  /**
   * Get Trial Balance
   * Returns account balances grouped by account type as of a specific date
   */
  getTrialBalance: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(
      z.object({
        organizationId: z.string(),
        asOfDate: z.union([z.date(), z.string()]),
        currency: z.string().optional(),
        includeInactive: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const { asOfDate, currency, includeInactive } = input
      const reportDate = typeof asOfDate === "string" ? new Date(asOfDate) : asOfDate

      // Get all accounts
      const accounts = await prisma.chartOfAccount.findMany({
        where: {
          organizationId: ctx.organizationId,
          isActive: includeInactive ? undefined : true,
          currency: currency || undefined,
        },
        orderBy: [{ type: "asc" }, { code: "asc" }],
      })

      // Get all transactions up to the report date
      const transactions = await prisma.transaction.findMany({
        where: {
          organizationId: ctx.organizationId,
          date: { lte: reportDate },
          account: currency ? { currency } : undefined,
        },
        include: {
          account: true,
        },
      })

      // Calculate balances for each account
      const accountBalances = accounts.map((account) => {
        const accountTransactions = transactions.filter(
          (t) => t.accountId === account.id
        )

        let debitTotal = new Decimal(0)
        let creditTotal = new Decimal(0)

        accountTransactions.forEach((tx) => {
          debitTotal = debitTotal.plus(new Decimal(tx.debit.toString()))
          creditTotal = creditTotal.plus(new Decimal(tx.credit.toString()))
        })

        // Add opening balance
        const openingBalance = new Decimal(account.openingBalance?.toString() || 0)
        
        // For asset accounts: balance = opening + debits - credits
        // For liability/equity/revenue accounts: balance = opening + credits - debits
        const isDebitNormal = account.type === "ASSET" || account.type === "EXPENSE"
        
        if (isDebitNormal) {
          debitTotal = debitTotal.plus(openingBalance)
        } else {
          creditTotal = creditTotal.plus(openingBalance)
        }

        const balance = isDebitNormal
          ? debitTotal.minus(creditTotal)
          : creditTotal.minus(debitTotal)

        return {
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          accountType: account.type,
          debit: debitTotal.toNumber(),
          credit: creditTotal.toNumber(),
          balance: balance.toNumber(),
          currency: account.currency,
        }
      })

      // Group by account type and calculate totals
      const groupedByType: Record<string, typeof accountBalances> = {}
      accountBalances.forEach((item) => {
        if (!groupedByType[item.accountType]) {
          groupedByType[item.accountType] = []
        }
        groupedByType[item.accountType].push(item)
      })

      // Calculate totals
      const totalDebits = accountBalances.reduce(
        (sum, item) => sum.plus(new Decimal(item.debit)),
        new Decimal(0)
      )
      const totalCredits = accountBalances.reduce(
        (sum, item) => sum.plus(new Decimal(item.credit)),
        new Decimal(0)
      )

      return {
        asOfDate: reportDate,
        accounts: accountBalances,
        groupedByType,
        totals: {
          totalDebits: totalDebits.toNumber(),
          totalCredits: totalCredits.toNumber(),
          difference: totalDebits.minus(totalCredits).toNumber(),
          isBalanced: totalDebits.minus(totalCredits).abs().lessThan(0.01),
        },
      }
    }),

  /**
   * Get Cash Flow Statement (Indirect Method)
   * Calculates operating, investing, and financing cash flows for a period
   */
  getCashFlow: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(
      z.object({
        organizationId: z.string(),
        startDate: z.union([z.date(), z.string()]),
        endDate: z.union([z.date(), z.string()]),
        currency: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { startDate, endDate, currency } = input
      const periodStart = typeof startDate === "string" ? new Date(startDate) : startDate
      const periodEnd = typeof endDate === "string" ? new Date(endDate) : endDate

      // Get cash accounts
      const cashAccounts = await prisma.chartOfAccount.findMany({
        where: {
          organizationId: ctx.organizationId,
          type: "ASSET",
          code: { startsWith: "1" }, // Typically cash accounts start with 1
          currency: currency || undefined,
        },
      })

      // Get bank accounts
      const bankAccounts = await prisma.bankAccount.findMany({
        where: {
          organizationId: ctx.organizationId,
          isActive: true,
          currency: currency || undefined,
        },
      })

      // Get all transactions in the period
      const transactions = await prisma.transaction.findMany({
        where: {
          organizationId: ctx.organizationId,
          date: { gte: periodStart, lte: periodEnd },
          account: currency ? { currency } : undefined,
        },
        include: {
          account: true,
        },
      })

      // Calculate operating activities (revenue and expense accounts)
      const revenueAccounts = await prisma.chartOfAccount.findMany({
        where: {
          organizationId: ctx.organizationId,
          type: "REVENUE",
          currency: currency || undefined,
        },
      })

      const expenseAccounts = await prisma.chartOfAccount.findMany({
        where: {
          organizationId: ctx.organizationId,
          type: "EXPENSE",
          currency: currency || undefined,
        },
      })

      const operatingRevenue = transactions
        .filter((t) => revenueAccounts.some((acc) => acc.id === t.accountId))
        .reduce(
          (sum, t) => sum.plus(new Decimal(t.credit.toString())),
          new Decimal(0)
        )

      const operatingExpenses = transactions
        .filter((t) => expenseAccounts.some((acc) => acc.id === t.accountId))
        .reduce(
          (sum, t) => sum.plus(new Decimal(t.debit.toString())),
          new Decimal(0)
        )

      // Get non-cash adjustments (depreciation, amortization)
      const depreciationAccounts = await prisma.chartOfAccount.findMany({
        where: {
          organizationId: ctx.organizationId,
          name: { contains: "Depreciation" },
          currency: currency || undefined,
        },
      })

      const nonCashAdjustments = transactions
        .filter((t) => depreciationAccounts.some((acc) => acc.id === t.accountId))
        .reduce(
          (sum, t) => sum.plus(new Decimal(t.debit.toString())),
          new Decimal(0)
        )

      // Calculate investing activities (asset purchases/sales)
      const investingAccounts = await prisma.chartOfAccount.findMany({
        where: {
          organizationId: ctx.organizationId,
          type: "ASSET",
          code: { not: { startsWith: "1" } }, // Non-cash assets
          currency: currency || undefined,
        },
      })

      const investingCashFlow = transactions
        .filter((t) => investingAccounts.some((acc) => acc.id === t.accountId))
        .reduce(
          (sum, t) => sum.plus(new Decimal(t.debit.toString())).minus(new Decimal(t.credit.toString())),
          new Decimal(0)
        )

      // Calculate financing activities (loans, equity)
      const financingAccounts = await prisma.chartOfAccount.findMany({
        where: {
          organizationId: ctx.organizationId,
          type: { in: ["LIABILITY", "EQUITY"] },
          currency: currency || undefined,
        },
      })

      const financingCashFlow = transactions
        .filter((t) => financingAccounts.some((acc) => acc.id === t.accountId))
        .reduce(
          (sum, t) => sum.plus(new Decimal(t.credit.toString())).minus(new Decimal(t.debit.toString())),
          new Decimal(0)
        )

      // Calculate net cash flow
      const netOperatingCashFlow = operatingRevenue
        .minus(operatingExpenses)
        .plus(nonCashAdjustments)

      const netCashFlow = netOperatingCashFlow
        .plus(investingCashFlow)
        .plus(financingCashFlow)

      // Calculate beginning and ending cash
      const beginningCash = bankAccounts.reduce(
        (sum, acc) => sum.plus(new Decimal(acc.openingBalance?.toString() || 0)),
        new Decimal(0)
      )

      const endingCash = beginningCash.plus(netCashFlow)

      return {
        period: {
          startDate: periodStart,
          endDate: periodEnd,
        },
        operating: {
          revenue: operatingRevenue.toNumber(),
          expenses: operatingExpenses.toNumber(),
          nonCashAdjustments: nonCashAdjustments.toNumber(),
          netCashFlow: netOperatingCashFlow.toNumber(),
        },
        investing: {
          netCashFlow: investingCashFlow.neg().toNumber(), // Negative for purchases
        },
        financing: {
          netCashFlow: financingCashFlow.toNumber(),
        },
        summary: {
          beginningCash: beginningCash.toNumber(),
          netCashFlow: netCashFlow.toNumber(),
          endingCash: endingCash.toNumber(),
        },
      }
    }),

  /**
   * Get Aged Receivables
   * Returns outstanding invoices grouped by aging buckets
   */
  getAgedReceivables: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(
      z.object({
        organizationId: z.string(),
        asOfDate: z.union([z.date(), z.string()]).optional(),
        customerId: z.string().optional(),
        currency: z.string().optional(),
        ...paginationSchema.shape,
      })
    )
    .query(async ({ ctx, input }) => {
      const { asOfDate, customerId, currency, page, limit } = input
      const reportDate = asOfDate
        ? typeof asOfDate === "string"
          ? new Date(asOfDate)
          : asOfDate
        : new Date()

      // Get outstanding invoices
      const where: any = {
        organizationId: ctx.organizationId,
        status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] },
        currency: currency || undefined,
      }

      if (customerId) {
        where.customerId = customerId
      }

      const invoices = await prisma.invoice.findMany({
        where,
        include: {
          customer: true,
        },
        orderBy: { dueDate: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      })

      // Calculate balances and aging for each invoice
      const agedItems = await Promise.all(
        invoices.map(async (invoice) => {
          // Calculate outstanding balance
          // Invoice payments are stored in invoice metadata
          const metadata = (invoice.metadata as any) || {}
          const metadataPayments = metadata.payments || []
          const totalPaid = metadataPayments.reduce(
            (sum: Decimal, p: any) => sum.plus(new Decimal(p.amount || 0)),
            new Decimal(0)
          )

          // Also check for credit notes applied
          const creditNotes = await prisma.creditNote.findMany({
            where: {
              organizationId: ctx.organizationId,
              invoiceId: invoice.id,
              status: { in: ["APPLIED", "SENT"] },
            },
          })

          const creditNotesApplied = creditNotes.reduce((sum, cn) => {
            const cnMetadata = cn.metadata as any || {}
            const cnApplications = cnMetadata.applications || []
            const cnAppliedToThisInvoice = cnApplications
              .filter((app: any) => app.invoiceId === invoice.id)
              .reduce((s: number, app: any) => s.plus(new Decimal(app.amount || 0)), new Decimal(0))
            return sum.plus(cnAppliedToThisInvoice)
          }, new Decimal(0))

          const balance = new Decimal(invoice.total.toString()).minus(totalPaid).minus(creditNotesApplied)

          // Calculate days overdue
          const daysOverdue = Math.floor(
            (reportDate.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)
          )

          // Categorize into aging buckets
          let bucket0_30 = new Decimal(0)
          let bucket31_60 = new Decimal(0)
          let bucket61_90 = new Decimal(0)
          let bucket90Plus = new Decimal(0)

          if (daysOverdue <= 0) {
            bucket0_30 = balance
          } else if (daysOverdue <= 30) {
            bucket0_30 = balance
          } else if (daysOverdue <= 60) {
            bucket31_60 = balance
          } else if (daysOverdue <= 90) {
            bucket61_90 = balance
          } else {
            bucket90Plus = balance
          }

          return {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            customerId: invoice.customerId,
            customerName: invoice.customer.name,
            date: invoice.date,
            dueDate: invoice.dueDate,
            total: invoice.total.toNumber(),
            balance: balance.toNumber(),
            daysOverdue,
            currency: invoice.currency,
            aging: {
              current: daysOverdue <= 0 ? balance.toNumber() : 0,
              days0_30: bucket0_30.toNumber(),
              days31_60: bucket31_60.toNumber(),
              days61_90: bucket61_90.toNumber(),
              days90Plus: bucket90Plus.toNumber(),
            },
          }
        })
      )

      // Calculate totals
      const totals = agedItems.reduce(
        (acc, item) => ({
          current: acc.current + item.aging.current,
          days0_30: acc.days0_30 + item.aging.days0_30,
          days31_60: acc.days31_60 + item.aging.days31_60,
          days61_90: acc.days61_90 + item.aging.days61_90,
          days90Plus: acc.days90Plus + item.aging.days90Plus,
          total: acc.total + item.balance,
        }),
        {
          current: 0,
          days0_30: 0,
          days31_60: 0,
          days61_90: 0,
          days90Plus: 0,
          total: 0,
        }
      )

      // Get total count for pagination
      const total = await prisma.invoice.count({ where })

      return {
        asOfDate: reportDate,
        items: agedItems,
        totals,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    }),

  /**
   * Get Aged Payables
   * Returns outstanding bills grouped by aging buckets
   */
  getAgedPayables: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(
      z.object({
        organizationId: z.string(),
        asOfDate: z.union([z.date(), z.string()]).optional(),
        vendorId: z.string().optional(),
        currency: z.string().optional(),
        ...paginationSchema.shape,
      })
    )
    .query(async ({ ctx, input }) => {
      const { asOfDate, vendorId, currency, page, limit } = input
      const reportDate = asOfDate
        ? typeof asOfDate === "string"
          ? new Date(asOfDate)
          : asOfDate
        : new Date()

      // Get outstanding bills
      const where: any = {
        organizationId: ctx.organizationId,
        deletedAt: null,
        status: { in: ["APPROVED", "PART_PAID", "OVERDUE"] },
        currency: currency || undefined,
      }

      if (vendorId) {
        where.vendorId = vendorId
      }

      const bills = await prisma.bill.findMany({
        where,
        include: {
          vendor: true,
        },
        orderBy: { dueDate: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      })

      // Calculate balances and aging for each bill
      const agedItems = await Promise.all(
        bills.map(async (bill) => {
          // Calculate outstanding balance
          // Payments can be linked via billId or via metadata
          const payments = await prisma.payment.findMany({
            where: {
              organizationId: ctx.organizationId,
              billId: bill.id,
              status: "COMPLETED",
            },
          })

          // Also check metadata for payments
          const metadata = (bill.metadata as any) || {}
          const metadataPayments = metadata.payments || []
          const metadataPaid = metadataPayments.reduce(
            (sum: number, p: any) => sum + (p.amount || 0),
            0
          )

          const totalPaid = payments.reduce(
            (sum, p) => sum.plus(new Decimal(p.amount.toString())),
            new Decimal(metadataPaid)
          )

          const balance = new Decimal(bill.total.toString()).minus(totalPaid)

          // Calculate days overdue
          const daysOverdue = Math.floor(
            (reportDate.getTime() - bill.dueDate.getTime()) / (1000 * 60 * 60 * 24)
          )

          // Categorize into aging buckets
          let bucket0_30 = new Decimal(0)
          let bucket31_60 = new Decimal(0)
          let bucket61_90 = new Decimal(0)
          let bucket90Plus = new Decimal(0)

          if (daysOverdue <= 0) {
            bucket0_30 = balance
          } else if (daysOverdue <= 30) {
            bucket0_30 = balance
          } else if (daysOverdue <= 60) {
            bucket31_60 = balance
          } else if (daysOverdue <= 90) {
            bucket61_90 = balance
          } else {
            bucket90Plus = balance
          }

          return {
            billId: bill.id,
            billNumber: bill.billNumber,
            vendorId: bill.vendorId,
            vendorName: bill.vendor.name,
            date: bill.date,
            dueDate: bill.dueDate,
            total: bill.total.toNumber(),
            balance: balance.toNumber(),
            daysOverdue,
            currency: bill.currency,
            aging: {
              current: daysOverdue <= 0 ? balance.toNumber() : 0,
              days0_30: bucket0_30.toNumber(),
              days31_60: bucket31_60.toNumber(),
              days61_90: bucket61_90.toNumber(),
              days90Plus: bucket90Plus.toNumber(),
            },
          }
        })
      )

      // Calculate totals
      const totals = agedItems.reduce(
        (acc, item) => ({
          current: acc.current + item.aging.current,
          days0_30: acc.days0_30 + item.aging.days0_30,
          days31_60: acc.days31_60 + item.aging.days31_60,
          days61_90: acc.days61_90 + item.aging.days61_90,
          days90Plus: acc.days90Plus + item.aging.days90Plus,
          total: acc.total + item.balance,
        }),
        {
          current: 0,
          days0_30: 0,
          days31_60: 0,
          days61_90: 0,
          days90Plus: 0,
          total: 0,
        }
      )

      // Get total count for pagination
      const total = await prisma.bill.count({ where })

      return {
        asOfDate: reportDate,
        items: agedItems,
        totals,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    }),
})

