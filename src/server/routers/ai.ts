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
  getModelSnapshot,
} from "@/lib/ai/ai-service"
import { resolveAccountCode } from "@/lib/ai/accountant-agent"
import { LedgerAgent } from "@/lib/agents/ledger-agent"
import { TaxAgent } from "@/lib/agents/tax-agent"
import { FpnaAgent } from "@/lib/agents/fpna-agent"
import { submitAgentActionForApproval, requiresApprovalForAmount } from "@/lib/agents/approval-gateway"
import { postDoubleEntry, reversePosting } from "@/lib/posting"
import { getBoss } from "@/lib/queue/boss"
import { JOBS } from "@/lib/queue/jobs"

// Reusable optional model override schema
const modelOverrideSchema = z.object({
  fast:      z.string().optional(),
  smart:     z.string().optional(),
  vision:    z.string().optional(),
  reasoning: z.string().optional(),
}).optional()

export const aiRouter = createTRPCRouter({
  // ── Model discovery ─────────────────────────────────────────────────────────

  getModels: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({ organizationId: z.string() }))
    .query(async () => {
      return getModelSnapshot()
    }),

  // ── Natural language query ──────────────────────────────────────────────────

  processQuery: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({
      organizationId: z.string(),
      query: z.string().min(1).max(1000),
      modelOverrides: modelOverrideSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      return processQuery(input.query, ctx.organizationId, {
        fast:  input.modelOverrides?.fast,
        smart: input.modelOverrides?.smart,
      })
    }),

  // ── Insights from real financial context ────────────────────────────────────

  generateInsights: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({
      organizationId: z.string(),
      period: z.string().optional(),
      modelOverrides: modelOverrideSchema,
    }))
    .query(async ({ ctx, input }) => {
      return generateInsights(ctx.organizationId, input.period, input.modelOverrides?.smart)
    }),

  // ── Expense categorization against real COA ─────────────────────────────────

  categorizeExpense: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BILLS_CREATE))
    .input(z.object({
      organizationId: z.string(),
      description: z.string().min(1).max(500),
      amount: z.number().min(0),
      merchantName: z.string().optional(),
      modelOverrides: modelOverrideSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const expenseAccounts = await prisma.chartOfAccount.findMany({
        where: { organizationId: ctx.organizationId, type: "EXPENSE", isActive: true },
        select: { id: true, name: true, code: true },
        orderBy: { code: "asc" },
      })

      return categorizeExpense(
        input.description,
        input.amount,
        input.merchantName,
        expenseAccounts,
        input.modelOverrides?.fast,
      )
    }),

  // ── Receipt OCR ─────────────────────────────────────────────────────────────

  scanReceipt: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BILLS_CREATE))
    .input(z.object({
      organizationId: z.string(),
      imageBase64: z.string().min(10),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]).default("image/jpeg"),
      modelOverrides: modelOverrideSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const imageBuffer = Buffer.from(input.imageBase64, "base64")
      const result = await extractReceiptData(imageBuffer, input.mimeType, {
        fast:   input.modelOverrides?.fast,
        vision: input.modelOverrides?.vision,
      })

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
          input.modelOverrides?.fast,
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

  // ── Agentic accountant chat ──────────────────────────────────────────────────

  accountantChat: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({
      organizationId: z.string(),
      conversation: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })),
      modelOverrides: modelOverrideSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const agent = new LedgerAgent()
      return agent.runChat(input.conversation, {
        organizationId: ctx.organizationId,
        triggeredBy: ctx.userId,
      })
    }),

  // ── Post a proposed journal entry ───────────────────────────────────────────

  postProposedEntry: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BILLS_CREATE))
    .input(z.object({
      organizationId: z.string(),
      reference: z.string(),
      description: z.string(),
      date: z.string(),
      lines: z.array(z.object({
        accountCode: z.string(),
        accountName: z.string(),
        description: z.string(),
        debit: z.number(),
        credit: z.number(),
      })),
      type: z.enum(["journal", "accrual", "prepayment", "deferred_revenue", "reversal", "correction"]),
      reversalDate: z.string().optional(),
      notes: z.string(),
      agentActionId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Resolve account codes to IDs
      const resolvedLines = await Promise.all(
        input.lines.map(async (line) => {
          const accountId = await resolveAccountCode(line.accountCode, ctx.organizationId)
          if (!accountId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Account code "${line.accountCode}" (${line.accountName}) not found in chart of accounts`,
            })
          }
          return { accountId, debit: line.debit, credit: line.credit, description: line.description }
        })
      )

      // If this came from an agent, check if the total amount exceeds the approval threshold.
      if (input.agentActionId) {
        const totalAmount = input.lines.reduce((s, l) => s + l.debit, 0)
        const needsApproval = await requiresApprovalForAmount(ctx.organizationId, totalAmount)
        if (needsApproval) {
          const approvalId = await submitAgentActionForApproval({
            organizationId: ctx.organizationId,
            entityType: "AGENT_JOURNAL",
            agentActionId: input.agentActionId,
            submittedBy: ctx.userId,
            notes: `Agent-proposed entry: ${input.description} (£${totalAmount.toFixed(2)})`,
          })
          return { requiresApproval: true, approvalRequestId: approvalId, reference: input.reference }
        }
      }

      const result = await postDoubleEntry({
        date: new Date(input.date),
        lines: resolvedLines,
        docRef: input.reference,
        orgId: ctx.organizationId,
        userId: ctx.userId,
        description: input.description,
        metadata: { type: input.type, notes: input.notes, reversalDate: input.reversalDate },
      })

      return { ...result, reference: input.reference, requiresApproval: false }
    }),

  // ── Tax Agent ────────────────────────────────────────────────────────────────

  runTaxAgent: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({
      organizationId: z.string(),
      periodKey: z.string().optional(),
      async: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const message = input.periodKey
        ? `Compile the VAT return for period ${input.periodKey}. Check for missing VAT treatments, calculate all 9 boxes, and flag any anomalies.`
        : 'Find all open VAT periods. For the most recent open period, compile the VAT return with all 9 boxes and flag any issues.'

      if (input.async) {
        const boss = await getBoss()
        const jobId = await boss.send(JOBS.TAX_COMPILE_VAT, {
          organizationId: ctx.organizationId,
          triggeredBy: ctx.userId,
          periodKey: input.periodKey ?? 'latest',
        })
        return { queued: true, jobId }
      }

      const agent = new TaxAgent()
      const result = await agent.run(message, { organizationId: ctx.organizationId, triggeredBy: ctx.userId })
      return result
    }),

  // ── FP&A Agent ───────────────────────────────────────────────────────────────

  runFpnaForecast: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({
      organizationId: z.string(),
      async: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.async) {
        const boss = await getBoss()
        const jobId = await boss.send(JOBS.FPNA_FORECAST, {
          organizationId: ctx.organizationId,
          triggeredBy: ctx.userId,
        })
        return { queued: true, jobId }
      }

      const agent = new FpnaAgent()
      const result = await agent.run(
        'Generate a 6-month cash flow forecast. Analyse historical trends, review budget vs actuals, and identify the top 5 variances.',
        { organizationId: ctx.organizationId, triggeredBy: ctx.userId }
      )
      return result
    }),

  runVarianceAnalysis: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({
      organizationId: z.string(),
      async: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.async) {
        const boss = await getBoss()
        const jobId = await boss.send(JOBS.FPNA_VARIANCE, {
          organizationId: ctx.organizationId,
          triggeredBy: ctx.userId,
        })
        return { queued: true, jobId }
      }

      const agent = new FpnaAgent()
      const result = await agent.run(
        'Run a full budget vs actuals variance analysis for the current period. Identify accounts where actuals exceed budget by more than 15%. Explain each variance.',
        { organizationId: ctx.organizationId, triggeredBy: ctx.userId }
      )
      return result
    }),

  // ── Approve an agent action (executes the pending action) ───────────────────

  approveAgentAction: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BILLS_CREATE))
    .input(z.object({
      organizationId: z.string(),
      approvalRequestId: z.string(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const request = await prisma.approvalRequest.findUnique({
        where: { id: input.approvalRequestId, organizationId: ctx.organizationId },
        include: { agentAction: true },
      })

      if (!request) throw new TRPCError({ code: "NOT_FOUND" })
      if (request.status !== "PENDING") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Approval request is not pending" })
      }
      if (!request.agentActionId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No agent action linked to this approval" })
      }

      await prisma.$transaction([
        prisma.approvalRequest.update({
          where: { id: request.id },
          data: { status: "APPROVED", completedAt: new Date(), completedBy: ctx.userId },
        }),
        prisma.approvalAction.create({
          data: { approvalRequestId: request.id, actionType: "APPROVED", actorId: ctx.userId, notes: input.notes },
        }),
        prisma.agentAction.update({
          where: { id: request.agentActionId },
          data: { status: "APPROVED" },
        }),
      ])

      return { approved: true }
    }),

  // ── Reverse a journal entry by reference ─────────────────────────────────────

  reverseJournalEntry: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BILLS_CREATE))
    .input(z.object({
      organizationId: z.string(),
      reference: z.string(),
      reversalDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const txns = await prisma.transaction.findMany({
        where: {
          organizationId: ctx.organizationId,
          reference: { contains: input.reference, mode: "insensitive" },
        },
        select: { id: true },
      })

      if (txns.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: `No transactions found with reference "${input.reference}"` })
      }

      const result = await reversePosting(
        txns.map(t => t.id),
        {
          orgId: ctx.organizationId,
          userId: ctx.userId,
          date: input.reversalDate ? new Date(input.reversalDate) : new Date(),
          description: `Reversal of ${input.reference}`,
        }
      )

      return result
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
