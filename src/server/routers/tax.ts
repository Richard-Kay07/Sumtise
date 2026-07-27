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
// Every field is client-supplied and reaches an HTTP header, so validate
// strictly rather than coercing: HMRC requires a UUID device ID, a UTC±hh:mm
// timezone, and positive whole numbers for screen and window dimensions.
const BrowserFingerprintSchema = z.object({
  jsUserAgent: z.string().min(1).max(512),
  deviceId:    z.string().uuid(),
  timezone:    z.string().regex(/^UTC[+-]\d{2}:\d{2}$/, "Timezone must be UTC±hh:mm"),
  screens: z.array(z.object({
    width:         z.number().int().positive(),
    height:        z.number().int().positive(),
    scalingFactor: z.number().positive(),
    colourDepth:   z.number().int().positive(),
  })).min(1),
  windowSize: z.object({
    width:  z.number().int().positive(),
    height: z.number().int().positive(),
  }),
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

  // The public IP our own infrastructure presents to the end user. HMRC
  // cross-validates this against Gov-Vendor-Forwarded and Gov-Client-Public-IP.
  const vendorPublicIp = process.env.HMRC_VENDOR_PUBLIC_IP?.trim()

  // Bail out rather than substitute anything. HMRC explicitly forbids
  // placeholder values ("null", "undefined", "unknown", "", "0.0.0.0"), so an
  // incomplete set must abort the call, not be padded out.
  if (!network.clientPublicIp || !vendorPublicIp || !ctx.userId) return undefined

  return {
    browser: fingerprint,
    server: { ...network, vendorPublicIp, userId: ctx.userId },
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
  // Never surface raw upstream text: HMRC OAuth/token error bodies are
  // internal detail and this message is serialised straight to the browser.
  console.error("[HMRC] unhandled error", err)
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Could not complete the request with HMRC. Try again shortly.",
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
      // Cash accounting and the Flat Rate Scheme are NOT supported by this
      // derivation. Cash accounting requires matching to payment dates, which
      // this query does not do — it would silently compute an invoice-basis
      // return and declare VAT the business does not yet owe. FRS requires a
      // gross Box 6 and capital-goods tracking that the ledger does not carry.
      // Refusing is the only safe behaviour: the alternative is a wrong number
      // on a filed return.
      if (input.scheme !== "standard") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            input.scheme === "cash"
              ? "Cash accounting is not yet supported. Figures would be calculated on the invoice basis and would overstate VAT due on unpaid invoices."
              : "The Flat Rate Scheme is not yet supported. Box 6 and capital-goods reclaims require data the ledger does not yet capture.",
        })
      }

      // Normalise the period to whole UTC days. The browser sends local-time
      // midnights, so under BST a 30 June posting fell outside `lte` and
      // silently moved into the next quarter.
      const periodStart = new Date(Date.UTC(
        input.periodStart.getFullYear(), input.periodStart.getMonth(), input.periodStart.getDate(),
        0, 0, 0, 0,
      ))
      const periodEndExclusive = new Date(Date.UTC(
        input.periodEnd.getFullYear(), input.periodEnd.getMonth(), input.periodEnd.getDate() + 1,
        0, 0, 0, 0,
      ))

      // Pull ledger postings in range, joined to their account so we can read
      // the VAT treatment and work out whether each line is an output or input.
      const transactions = await prisma.transaction.findMany({
        where: {
          organizationId: ctx.organizationId,
          // Half-open interval: `lte` on a midnight boundary excluded any
          // same-day posting with a non-zero time component.
          date:           { gte: periodStart, lt: periodEndExclusive },
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
      //
      // OUT_OF_SCOPE maps to null, not "OUTSIDE": VAT Notice 700/12 requires
      // out-of-scope items (wages, PAYE, drawings, dividends) to be EXCLUDED
      // from boxes 6 and 7. Mapping it to a truthy rate code passed the filter
      // and put the entire wage bill into Box 7.
      const RATE_BY_TREATMENT: Record<string, VATRateCode | null> = {
        STANDARD_RATE:  "STANDARD",
        REDUCED_RATE:   "REDUCED",
        ZERO_RATE:      "ZERO",
        EXEMPT:         "EXEMPT",
        OUT_OF_SCOPE:   null,
        NOT_APPLICABLE: null,
      }

      const lines: VATTransactionLine[] = transactions
        .map((t): VATTransactionLine | null => {
          const rateCode = RATE_BY_TREATMENT[t.account.vatTreatment]
          if (!rateCode) return null

          // Revenue is an output (credit balance). Expenses AND asset purchases
          // are inputs: input VAT on capital items is fully reclaimable, and
          // excluding ASSET accounts understated Box 4 and Box 7 by the whole
          // value of every capitalised purchase.
          const isOutput = t.account.type === "REVENUE"
          const isInput  = t.account.type === "EXPENSE" || t.account.type === "ASSET"
          if (!isOutput && !isInput) return null

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
        linesWithVatTreatment: lines.length,
        // vatTreatment defaults to NOT_APPLICABLE, so an unmapped chart of
        // accounts produces an all-zero return that looks finished. Surface it
        // rather than letting someone file a nil return by accident.
        warning:
          transactions.length > 0 && lines.length === 0
            ? `None of the ${transactions.length} transactions in this period are on accounts with a VAT treatment set. ` +
              `Set the VAT treatment on your chart of accounts before filing — this return would be nil.`
            : null,
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
      // Key the guard on the receipt ALONE. Requiring status === "FULFILLED"
      // too made it defeatable: syncObligations re-derives status from HMRC on
      // every sync, and HMRC's obligation flips to "F" only after a lag, so a
      // sync in that window reset the row to OPEN while the receipt remained —
      // re-arming the double-submit path.
      if (existing?.hmrcReceiptId) {
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
