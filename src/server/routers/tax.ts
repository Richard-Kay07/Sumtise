import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { getAuthorizationUrl } from "@/lib/hmrc/oauth"
import { createOAuthState } from "@/lib/hmrc/state"
import { syncObligations, submitReturn } from "@/lib/hmrc/vat"
import { HmrcApiError } from "@/lib/hmrc/errors"
import {
  extractClientNetwork,
  type FraudPreventionInput,
} from "@/lib/hmrc/fraud-prevention"
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

/**
 * Browser half of the HMRC fraud prevention data. Collected client-side by
 * src/lib/hmrc/fingerprint-client.ts and posted with any request that will
 * result in an HMRC call. For the WEB_APP_VIA_SERVER connection method these
 * values describe the END USER'S DEVICE and cannot be derived on the server.
 */
const BrowserFingerprintSchema = z.object({
  jsUserAgent: z.string(),
  deviceId:    z.string(),
  timezone:    z.string(),
  screens: z.array(z.object({
    width:         z.number(),
    height:        z.number(),
    scalingFactor: z.number(),
    colourDepth:   z.number(),
  })),
  windowSize: z.object({ width: z.number(), height: z.number() }),
})

type BrowserFingerprintInput = z.infer<typeof BrowserFingerprintSchema>

/** Load the HMRC connection, failing clearly if it is unusable. */
async function requireVrn(organizationId: string) {
  const conn = await prisma.hmrcConnection.findUnique({ where: { organizationId } })

  if (!conn) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Not connected to HMRC. Connect your HMRC account in Tax Settings.",
    })
  }
  if (!conn.vatRegistrationNumber) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Your VAT registration number has not been set. Add it in Tax Settings before filing.",
    })
  }
  return { ...conn, vatRegistrationNumber: conn.vatRegistrationNumber }
}

/**
 * Assemble the fraud prevention payload from the browser fingerprint plus
 * server-derived network data.
 *
 * Returns undefined when the browser half is absent — the client then throws
 * before contacting production, rather than sending placeholder values, which
 * HMRC explicitly forbids.
 */
function buildFraudPrevention(
  ctx: { userId: string | null; headers?: Headers },
  fingerprint?: BrowserFingerprintInput,
): FraudPreventionInput | undefined {
  if (!fingerprint || !ctx.headers) return undefined

  const network = extractClientNetwork(ctx.headers)
  if (!network.clientPublicIp) return undefined

  return {
    browser: fingerprint,
    server: {
      ...network,
      // The public IP our own infrastructure presents to the end user.
      vendorPublicIp: process.env.HMRC_VENDOR_PUBLIC_IP ?? "",
      userId: ctx.userId ?? "unknown",
    },
  }
}

/** Surface HMRC's user-facing message rather than a raw stack trace. */
function toTrpcError(err: unknown): TRPCError {
  if (err instanceof HmrcApiError) {
    const code =
      err.kind === "AUTH"      ? "UNAUTHORIZED" :
      err.kind === "NOT_FOUND" ? "NOT_FOUND" :
      err.kind === "RATE_LIMIT"? "TOO_MANY_REQUESTS" :
      err.kind === "SERVER"    ? "INTERNAL_SERVER_ERROR" :
      "BAD_REQUEST"
    return new TRPCError({ code, message: err.userMessage, cause: err })
  }
  if (err instanceof TRPCError) return err
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: err instanceof Error ? err.message : "Unexpected error contacting HMRC.",
    cause: err,
  })
}

async function getCashFlowForPeriod(organizationId: string, start: Date, end: Date) {
  return prisma.transaction.findMany({
    where: {
      organizationId,
      date: { gte: start, lte: end },
    },
    select: {
      id:          true,
      debit:       true,
      credit:      true,
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
      // Pull ledger postings in range, joined to their account so we can read
      // the VAT treatment and work out whether each line is an output or input.
      const transactions = await prisma.transaction.findMany({
        where: {
          organizationId: ctx.organizationId,
          date:           { gte: input.periodStart, lte: input.periodEnd },
        },
        select: {
          id:      true,
          debit:   true,
          credit:  true,
          account: { select: { type: true, vatTreatment: true } },
        },
      })

      // ChartOfAccount.vatTreatment is the source of truth for the rate — there
      // is no per-transaction tax rate in the ledger.
      const RATE_BY_TREATMENT: Record<string, VATRateCode | null> = {
        STANDARD_RATE:  "STANDARD",
        REDUCED_RATE:   "REDUCED",
        ZERO_RATE:      "ZERO",
        EXEMPT:         "EXEMPT",
        OUT_OF_SCOPE:   "OUTSIDE",
        NOT_APPLICABLE: null,
      }

      const lines: VATTransactionLine[] = transactions
        .map((t): VATTransactionLine | null => {
          const rateCode = RATE_BY_TREATMENT[t.account.vatTreatment]
          if (!rateCode) return null

          // Only trading accounts carry VAT. Revenue is an output (credit
          // balance); expenses are inputs (debit balance).
          const isOutput = t.account.type === "REVENUE"
          if (!isOutput && t.account.type !== "EXPENSE") return null

          const debit  = t.debit.toNumber()
          const credit = t.credit.toNumber()

          // Signed net in the account's natural direction, so that contras and
          // credit notes reduce the box rather than inflating it.
          const net = isOutput ? credit - debit : debit - credit
          if (net === 0) return null

          const netPence = Math.round(net * 100)
          const vatPence = calculateVATAmount(netPence, rateCode)

          return { netPence, vatPence, rateCode, isOutput }
        })
        .filter((l): l is VATTransactionLine => l !== null)

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
          data:            (input.data ?? undefined) as Prisma.InputJsonValue | undefined,
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
        include: { account: { select: { type: true } } },
      })

      const ZERO = new Prisma.Decimal(0)
      let revenue = ZERO, expenses = ZERO

      // Revenue accounts carry a credit balance, expense accounts a debit
      // balance. Netting the two directions (rather than summing absolutes)
      // means refunds, credit notes and reversals reduce the figure correctly.
      for (const t of transactions) {
        if (!t.account) continue
        if (t.account.type === "REVENUE") {
          revenue = revenue.plus(t.credit).minus(t.debit)
        } else if (t.account.type === "EXPENSE") {
          expenses = expenses.plus(t.debit).minus(t.credit)
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
          data:            (input.data ?? undefined) as Prisma.InputJsonValue | undefined,
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
          data:            (input.data ?? undefined) as Prisma.InputJsonValue | undefined,
          submittedAt:     new Date(),
          submittedBy:     ctx.userId ?? undefined,
        },
      })
    }),

  // ── Draft saves ───────────────────────────────────────────────────────────

  saveVATDraft: orgScopedProcedure
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
          organizationId: ctx.organizationId,
          submissionType: "VAT_RETURN",
          periodStart:    input.periodStart,
          periodEnd:      input.periodEnd,
          submissionDate: new Date(),
          status:         "DRAFT",
          reference:      input.reference,
          totalAmount:    new Prisma.Decimal(input.totalAmount),
          data:           (input.data ?? undefined) as Prisma.InputJsonValue | undefined,
          submittedBy:    ctx.userId ?? undefined,
        },
      })
    }),

  saveCTDraft: orgScopedProcedure
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
          organizationId: ctx.organizationId,
          submissionType: "CORPORATION_TAX",
          periodStart:    input.periodStart,
          periodEnd:      input.periodEnd,
          submissionDate: new Date(),
          status:         "DRAFT",
          reference:      input.reference,
          totalAmount:    new Prisma.Decimal(input.totalAmount),
          data:           (input.data ?? undefined) as Prisma.InputJsonValue | undefined,
          submittedBy:    ctx.userId ?? undefined,
        },
      })
    }),

  // ── Submit an existing draft ───────────────────────────────────────────────

  submitDraft: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(z.object({
      organizationId: z.string(),
      submissionId:   z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.taxSubmission.findFirst({
        where: { id: input.submissionId, organizationId: ctx.organizationId },
      })
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found" })
      if (existing.status !== "DRAFT") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only DRAFT submissions can be submitted" })
      }
      return prisma.taxSubmission.update({
        where: { id: input.submissionId },
        data: {
          status:      "SUBMITTED",
          submittedAt: new Date(),
          submittedBy: ctx.userId ?? undefined,
        },
      })
    }),

  // ── HMRC MTD Connect ────────────────────────────────────────────────────────

  connectHmrc: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(z.object({ organizationId: z.string() }))
    .mutation(async ({ ctx }) => {
      if (!ctx.userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in to connect HMRC." })
      }
      // Signed, time-limited state bound to this user AND this organisation.
      const state = createOAuthState(ctx.organizationId, ctx.userId)
      return { authorizationUrl: getAuthorizationUrl(state) }
    }),

  getHmrcConnection: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const conn = await prisma.hmrcConnection.findUnique({
        where: { organizationId: ctx.organizationId },
        select: { id: true, status: true, vatRegistrationNumber: true, businessName: true, expiresAt: true, lastSyncAt: true, connectedAt: true },
      })
      return conn
    }),

  // ── HMRC VAT Obligations ────────────────────────────────────────────────────

  getVatObligations: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({
      organizationId: z.string(),
      fromDate: z.string(),
      toDate:   z.string(),
      status:   z.enum(["O", "F"]).optional(),
      fingerprint: BrowserFingerprintSchema.optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conn = await requireVrn(ctx.organizationId)

      try {
        const obligations = await syncObligations(
          ctx.organizationId,
          conn.vatRegistrationNumber,
          { from: input.fromDate, to: input.toDate, status: input.status },
          { fraudPrevention: buildFraudPrevention(ctx, input.fingerprint) },
        )
        const periods = await prisma.vatPeriod.findMany({
          where:   { organizationId: ctx.organizationId },
          orderBy: { dueDate: "desc" },
        })
        return { obligations, periods }
      } catch (err) {
        throw toTrpcError(err)
      }
    }),

  // ── Submit MTD VAT Return ───────────────────────────────────────────────────

  submitMtdVatReturn: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(z.object({
      organizationId: z.string(),
      periodKey: z.string().min(4).max(4),
      vatDueSales: z.number(),
      vatDueAcquisitions: z.number(),
      totalVatDue: z.number(),
      vatReclaimedCurrPeriod: z.number(),
      netVatDue: z.number().min(0),
      // Boxes 6–9 must be whole pounds — HMRC rejects decimals here.
      totalValueSalesExVAT: z.number().int(),
      totalValuePurchasesExVAT: z.number().int(),
      totalValueGoodsSuppliedExVAT: z.number().int(),
      totalAcquisitionsExVAT: z.number().int(),
      finalised: z.boolean(),
      fingerprint: BrowserFingerprintSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const conn = await requireVrn(ctx.organizationId)

      const { organizationId: _org, fingerprint, ...payload } = input

      // Guard against double-filing before we ever reach HMRC. HMRC would
      // return DUPLICATE_SUBMISSION anyway, but a local check gives a clearer
      // message and avoids burning a request against the rate limit.
      const existing = await prisma.vatPeriod.findUnique({
        where: {
          organizationId_periodKey: {
            organizationId: ctx.organizationId,
            periodKey: input.periodKey,
          },
        },
      })
      if (existing?.status === "FULFILLED" && existing.hmrcReceiptId) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            `A VAT return for this period was already submitted to HMRC (receipt ${existing.hmrcReceiptId}). ` +
            `Returns cannot be filed twice — corrections go through HMRC's separate amendment process.`,
        })
      }

      let result: Awaited<ReturnType<typeof submitReturn>>
      try {
        result = await submitReturn(
          ctx.organizationId,
          conn.vatRegistrationNumber,
          payload,
          { fraudPrevention: buildFraudPrevention(ctx, fingerprint) },
        )
      } catch (err) {
        throw toTrpcError(err)
      }

      const vatPeriod = await prisma.vatPeriod.findFirst({
        where: { organizationId: ctx.organizationId, periodKey: input.periodKey },
      })

      await prisma.taxSubmission.create({
        data: {
          organizationId: ctx.organizationId,
          submissionType: "VAT_RETURN",
          status:         "ACCEPTED",
          reference:      result.formBundleNumber,
          periodStart:    vatPeriod?.periodStart ?? new Date(),
          periodEnd:      vatPeriod?.periodEnd ?? new Date(),
          submissionDate: new Date(),
          submittedAt:    new Date(),
          submittedBy:    ctx.userId ?? undefined,
          totalAmount:    new Prisma.Decimal(payload.netVatDue),
          data:           payload as unknown as Prisma.InputJsonValue,
          // Persist HMRC's receipt — this is the legal proof of filing.
          response:       result as unknown as Prisma.InputJsonValue,
        },
      })

      return result
    }),

  // ── Set the VAT registration number ─────────────────────────────────────────
  // Without this the OAuth connect succeeds but every subsequent HMRC call
  // fails, because the VRN is not part of the token response.

  setVatRegistrationNumber: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(z.object({
      organizationId: z.string(),
      // 9 digits, no GB prefix, no spaces.
      vrn: z.string().regex(/^\d{9}$/, "VAT registration number must be exactly 9 digits"),
    }))
    .mutation(async ({ ctx, input }) => {
      const conn = await prisma.hmrcConnection.findUnique({
        where: { organizationId: ctx.organizationId },
      })
      if (!conn) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Connect to HMRC before setting the VAT registration number.",
        })
      }
      return prisma.hmrcConnection.update({
        where: { organizationId: ctx.organizationId },
        data:  { vatRegistrationNumber: input.vrn },
        select: { vatRegistrationNumber: true, status: true, connectedAt: true },
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
