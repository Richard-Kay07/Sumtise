import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import {
  processQuery,
  generateInsights,
  extractReceiptData,
  categorizeExpense,
  detectAnomalies,
} from "@/lib/ai/ai-service"

export const aiRouter = createTRPCRouter({
  // ── Natural language query ──────────────────────────────────────────────────

  processQuery: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({
      organizationId: z.string(),
      query: z.string().min(1).max(1000),
    }))
    .mutation(async ({ ctx, input }) => {
      return processQuery(input.query, ctx.organizationId)
    }),

  // ── Insights from real financial context ────────────────────────────────────

  generateInsights: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({
      organizationId: z.string(),
      period: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return generateInsights(ctx.organizationId, input.period)
    }),

  // ── Expense categorization against real COA ─────────────────────────────────

  categorizeExpense: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BILLS_CREATE))
    .input(z.object({
      organizationId: z.string(),
      description: z.string().min(1).max(500),
      amount: z.number().min(0),
      merchantName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const expenseAccounts = await prisma.chartOfAccount.findMany({
        where: {
          organizationId: ctx.organizationId,
          type: "EXPENSE",
          isActive: true,
        },
        select: { id: true, name: true, code: true },
        orderBy: { code: "asc" },
      })

      return categorizeExpense(
        input.description,
        input.amount,
        input.merchantName,
        expenseAccounts,
      )
    }),

  // ── Receipt OCR ─────────────────────────────────────────────────────────────

  scanReceipt: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BILLS_CREATE))
    .input(z.object({
      organizationId: z.string(),
      // base64-encoded image content
      imageBase64: z.string().min(10),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]).default("image/jpeg"),
    }))
    .mutation(async ({ ctx, input }) => {
      const imageBuffer = Buffer.from(input.imageBase64, "base64")
      const result = await extractReceiptData(imageBuffer, input.mimeType)

      // Augment with COA suggestion for the first item if we have account info
      const expenseAccounts = await prisma.chartOfAccount.findMany({
        where: { organizationId: ctx.organizationId, type: "EXPENSE", isActive: true },
        select: { id: true, name: true, code: true },
        orderBy: { code: "asc" },
      })

      let suggestedAccount: { id: string; name: string; code: string } | null = null
      if (expenseAccounts.length > 0 && result.vendorName) {
        const categorized = await categorizeExpense(
          result.vendorName,
          result.total ?? 0,
          result.vendorName,
          expenseAccounts,
        )
        const found = expenseAccounts.find(a => a.id === categorized.suggestedAccountId)
        if (found) suggestedAccount = found
      }

      return { ...result, suggestedAccount }
    }),

  // ── Create bill from scanned receipt ────────────────────────────────────────

  createBillFromScan: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BILLS_CREATE))
    .input(z.object({
      organizationId: z.string(),
      vendorId: z.string().min(1),
      invoiceReference: z.string().optional(),
      date: z.string(),       // ISO date string
      dueDate: z.string(),
      currency: z.string().default("GBP"),
      notes: z.string().optional(),
      items: z.array(z.object({
        description: z.string().min(1),
        quantity: z.number().min(0.0001),
        unitPrice: z.number().min(0),
        taxRate: z.number().min(0).max(100).default(0),
        accountId: z.string().min(1),
      })).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify vendor
      const vendor = await prisma.vendor.findUnique({
        where: { id: input.vendorId, organizationId: ctx.organizationId, deletedAt: null },
      })
      if (!vendor) throw new TRPCError({ code: "NOT_FOUND", message: "Vendor not found" })

      // Generate bill number
      const count = await prisma.bill.count({ where: { organizationId: ctx.organizationId } })
      const billNumber = input.invoiceReference
        ? `SCAN-${input.invoiceReference}`
        : `BILL-${String(count + 1).padStart(5, "0")}`

      // Ensure bill number is unique
      const existing = await prisma.bill.findFirst({
        where: { organizationId: ctx.organizationId, billNumber, deletedAt: null },
      })
      const finalBillNumber = existing ? `${billNumber}-${Date.now()}` : billNumber

      // Calculate totals
      let subtotal = 0, taxAmount = 0
      for (const item of input.items) {
        const lineSub = item.quantity * item.unitPrice
        subtotal += lineSub
        taxAmount += lineSub * (item.taxRate / 100)
      }
      const total = subtotal + taxAmount

      const bill = await prisma.bill.create({
        data: {
          organizationId: ctx.organizationId,
          vendorId: input.vendorId,
          billNumber: finalBillNumber,
          date: new Date(input.date),
          dueDate: new Date(input.dueDate),
          status: "RECEIVED",
          subtotal,
          taxAmount,
          total,
          currency: input.currency,
          notes: input.notes,
          tags: [],
          items: {
            create: input.items.map(item => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.quantity * item.unitPrice * (1 + item.taxRate / 100),
              taxRate: item.taxRate,
              accountId: item.accountId,
            })),
          },
        },
      })

      return { billId: bill.id, billNumber: finalBillNumber, total }
    }),

  // ── Anomaly detection ────────────────────────────────────────────────────────

  detectAnomalies: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({
      organizationId: z.string(),
      dateFrom: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const dateFrom = input.dateFrom
        ? new Date(input.dateFrom)
        : new Date(Date.now() - 30 * 86400000)

      const txns = await prisma.transaction.findMany({
        where: { organizationId: ctx.organizationId, date: { gte: dateFrom } },
        select: { id: true, description: true, debit: true, credit: true, date: true },
        orderBy: { date: "desc" },
        take: 500,
      })

      const normalized = txns.map(t => ({
        id: t.id,
        description: t.description,
        debit: Number(t.debit),
        credit: Number(t.credit),
        date: t.date.toISOString().split("T")[0],
      }))

      return detectAnomalies(normalized)
    }),
})
