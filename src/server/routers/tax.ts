import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import {
  aggregateVATReturn,
  calculateVATAmount,
  netFromGross,
  getVATQuarter,
  type VATTransactionLine,
  type VATRateCode,
} from "@/lib/tax/vat"
import {
  computeCorporationTax,
  computeCapitalAllowances,
  computeRandDRelief,
} from "@/lib/tax/corporation-tax"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getCashFlowForPeriod(organizationId: string, start: Date, end: Date) {
  return prisma.transaction.findMany({
    where: {
      organizationId,
      date: { gte: start, lte: end },
    },
    select: {
      id:          true,
      amount:      true,
      type:        true,
      description: true,
      accountId:   true,
    },
  })
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const taxRouter = createTRPCRouter({
  // ── VAT ──────────────────────────────────────────────────────────────────

  getVATReturn: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({
      organizationId: z.string(),
      periodStart:    z.date(),
      periodEnd:      z.date(),
      scheme:         z.enum(["standard", "cash", "flat_rate"]).default("standard"),
      flatRatePercent: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Pull transactions in range and use their tax amounts
      const transactions = await prisma.transaction.findMany({
        where: {
          organizationId: ctx.organizationId,
          date:           { gte: input.periodStart, lte: input.periodEnd },
        },
        select: {
          id:       true,
          amount:   true,
          type:     true,
          taxRate:  true,
          account:  { select: { accountType: true, normalBalance: true } },
        },
      })

      const lines: VATTransactionLine[] = transactions
        .filter((t) => t.taxRate != null && t.taxRate.greaterThan(0))
        .map((t): VATTransactionLine => {
          const taxRate  = t.taxRate!.toNumber()
          const rateCode: VATRateCode =
            Math.abs(taxRate - 0.20) < 0.001 ? "STANDARD" :
            Math.abs(taxRate - 0.05) < 0.001 ? "REDUCED"  : "ZERO"

          const netPence = Math.round(t.amount.toNumber() * 100)
          const vatPence = calculateVATAmount(netPence, rateCode)
          const isOutput = t.account?.accountType === "INCOME" || t.type === "CREDIT"

          return { netPence, vatPence, rateCode, isOutput }
        })

      const vatReturn = aggregateVATReturn({
        transactions: lines,
        scheme:       input.scheme,
        flatRatePercent: input.flatRatePercent,
      })

      // Convert pence back to £
      const toPounds = (p: number) => new Prisma.Decimal(p).div(100)

      return {
        periodStart:   input.periodStart,
        periodEnd:     input.periodEnd,
        scheme:        input.scheme,
        box1OutputVAT: toPounds(vatReturn.box1OutputVAT),
        box2:          toPounds(vatReturn.box2AcquisitionVAT),
        box3TotalDue:  toPounds(vatReturn.box3TotalVATDue),
        box4InputVAT:  toPounds(vatReturn.box4InputVAT),
        box5NetVAT:    toPounds(vatReturn.box5NetVAT),
        box6SalesNet:  toPounds(vatReturn.box6TotalSalesNet),
        box7PurchasesNet: toPounds(vatReturn.box7TotalPurchasesNet),
        isRepayment:   vatReturn.box5NetVAT < 0,
        transactionsAnalysed: transactions.length,
      }
    }),

  getVATQuarterDates: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({
      organizationId: z.string(),
      referenceDate:  z.date().optional(),
    }))
    .query(async ({ ctx: _, input }) => {
      const ref = input.referenceDate ?? new Date()
      return getVATQuarter(ref)
    }),

  listVATSubmissions: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      return prisma.taxSubmission.findMany({
        where:   { organizationId: ctx.organizationId, submissionType: "VAT_RETURN" },
        orderBy: { periodStart: "desc" },
      })
    }),

  createVATSubmission: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(z.object({
      organizationId: z.string(),
      periodStart:    z.date(),
      periodEnd:      z.date(),
      reference:      z.string().optional(),
      totalAmount:    z.string(),
      data:           z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return prisma.taxSubmission.create({
        data: {
          organizationId:  ctx.organizationId,
          submissionType:  "VAT_RETURN",
          periodStart:     input.periodStart,
          periodEnd:       input.periodEnd,
          submissionDate:  new Date(),
          status:          "SUBMITTED",
          reference:       input.reference,
          totalAmount:     new Prisma.Decimal(input.totalAmount),
          data:            input.data,
          submittedAt:     new Date(),
          submittedBy:     ctx.userId ?? undefined,
        },
      })
    }),

  // ── Corporation Tax ───────────────────────────────────────────────────────

  getCorporationTaxEstimate: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({
      organizationId:       z.string(),
      periodStart:          z.date(),
      periodEnd:            z.date(),
      associatedCompanies:  z.number().min(0).default(0),
      qualifyingRandDSpend: z.string().optional(),
      randDScheme:          z.enum(["sme", "rdec"]).optional(),
      qualifyingCapex:      z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Derive P&L figures from transactions
      const transactions = await prisma.transaction.findMany({
        where: {
          organizationId: ctx.organizationId,
          date:           { gte: input.periodStart, lte: input.periodEnd },
        },
        include: { account: { select: { accountType: true } } },
      })

      const ZERO = new Prisma.Decimal(0)
      let revenue = ZERO, expenses = ZERO

      for (const t of transactions) {
        if (!t.account) continue
        if (t.account.accountType === "INCOME") {
          revenue = revenue.plus(t.amount.abs())
        } else if (t.account.accountType === "EXPENSE") {
          expenses = expenses.plus(t.amount.abs())
        }
      }

      const tradingProfit = revenue.minus(expenses).toNumber()

      // Capital allowances (if capex provided)
      let capitalAllowances = 0
      if (input.qualifyingCapex) {
        const ca = computeCapitalAllowances({ qualifyingSpendGBP: parseFloat(input.qualifyingCapex) })
        capitalAllowances = ca.totalAllowancesGBP
      }

      // Period length in days
      const periodDays = Math.round(
        (input.periodEnd.getTime() - input.periodStart.getTime()) / 86_400_000
      )

      const ct = computeCorporationTax({
        tradingProfitGBP:    Math.max(0, tradingProfit - capitalAllowances),
        associatedCompanies: input.associatedCompanies,
        periodDays,
      })

      // R&D relief
      let rdRelief = null
      if (input.qualifyingRandDSpend) {
        rdRelief = computeRandDRelief({
          qualifyingRandDSpendGBP: parseFloat(input.qualifyingRandDSpend),
          scheme:                  input.randDScheme ?? "sme",
          isLossMaking:            tradingProfit < 0,
        })
      }

      return {
        periodStart:        input.periodStart,
        periodEnd:          input.periodEnd,
        revenue:            revenue.toNumber(),
        expenses:           expenses.toNumber(),
        tradingProfitGross: tradingProfit,
        capitalAllowances,
        tradingProfitChargeable: ct.augmentedProfits,
        rateBand:           ct.rateBand,
        grossCT:            ct.grossCT,
        marginalRelief:     ct.marginalRelief,
        ctLiability:        ct.ctLiability,
        effectiveRate:      ct.effectiveRate,
        rdRelief,
      }
    }),

  listCorporationTaxSubmissions: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      return prisma.taxSubmission.findMany({
        where:   { organizationId: ctx.organizationId, submissionType: "CORPORATION_TAX" },
        orderBy: { periodStart: "desc" },
      })
    }),

  createCorporationTaxSubmission: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(z.object({
      organizationId: z.string(),
      periodStart:    z.date(),
      periodEnd:      z.date(),
      reference:      z.string().optional(),
      totalAmount:    z.string(),
      data:           z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return prisma.taxSubmission.create({
        data: {
          organizationId:  ctx.organizationId,
          submissionType:  "CORPORATION_TAX",
          periodStart:     input.periodStart,
          periodEnd:       input.periodEnd,
          submissionDate:  new Date(),
          status:          "SUBMITTED",
          reference:       input.reference,
          totalAmount:     new Prisma.Decimal(input.totalAmount),
          data:            input.data,
          submittedAt:     new Date(),
          submittedBy:     ctx.userId ?? undefined,
        },
      })
    }),

  // ── RTI (PAYE) ────────────────────────────────────────────────────────────

  listRTISubmissions: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PAYROLL_VIEW))
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      return prisma.taxSubmission.findMany({
        where:   { organizationId: ctx.organizationId, submissionType: { in: ["RTI_PAYE", "RTI_NI"] } },
        orderBy: { periodStart: "desc" },
      })
    }),

  createRTISubmission: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PAYROLL_APPROVE))
    .input(z.object({
      organizationId: z.string(),
      submissionType: z.enum(["RTI_PAYE", "RTI_NI"]),
      periodStart:    z.date(),
      periodEnd:      z.date(),
      reference:      z.string().optional(),
      totalAmount:    z.string(),
      employeeCount:  z.number().optional(),
      data:           z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return prisma.taxSubmission.create({
        data: {
          organizationId:  ctx.organizationId,
          submissionType:  input.submissionType,
          periodStart:     input.periodStart,
          periodEnd:       input.periodEnd,
          submissionDate:  new Date(),
          status:          "SUBMITTED",
          reference:       input.reference,
          totalAmount:     new Prisma.Decimal(input.totalAmount),
          employeeCount:   input.employeeCount,
          data:            input.data,
          submittedAt:     new Date(),
          submittedBy:     ctx.userId ?? undefined,
        },
      })
    }),

  // ── All submissions list ──────────────────────────────────────────────────

  listAllSubmissions: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({
      organizationId: z.string(),
      type:           z.enum(["VAT_RETURN", "CORPORATION_TAX", "RTI_PAYE", "RTI_NI", "OTHER"]).optional(),
      status:         z.enum(["DRAFT", "SUBMITTED", "ACCEPTED", "REJECTED", "AMENDED"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      return prisma.taxSubmission.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(input.type   ? { submissionType: input.type }   : {}),
          ...(input.status ? { status: input.status }         : {}),
        },
        orderBy: [{ periodStart: "desc" }, { submissionDate: "desc" }],
      })
    }),
})
