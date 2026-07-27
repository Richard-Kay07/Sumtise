/**
 * HMRC VAT (MTD) API v1.0 client — all 8 endpoints.
 *
 * Spec: https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/vat-api/1.0
 * Resolved OpenAPI captured at .firecrawl/hmrc/vat-oas-resolved.yaml
 *
 * Scopes: read:vat (all GETs), write:vat (submit return only).
 */

import { z } from "zod"
import { hmrcRequest, type HmrcRequestOptions } from "./client"
import { prisma } from "@/lib/prisma"

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const ObligationSchema = z.object({
  start: z.string(),
  end: z.string(),
  due: z.string(),
  // Spec types this as a free string, not an enum — don't over-constrain.
  status: z.string(),
  periodKey: z.string(),
  received: z.string().optional(),
})

export const ObligationsResponseSchema = z.object({
  obligations: z.array(ObligationSchema),
})

/**
 * VAT return payload. All 11 fields are required — the spec has no optional
 * fields on this resource.
 *
 * Two distinct numeric classes:
 *  - Boxes 1–5 (vatDue*, totalVatDue, vatReclaimed*, netVatDue): 2 decimal
 *    places, multipleOf 0.01.
 *  - Boxes 6–9 (totalValue*ExVAT, totalAcquisitionsExVAT): WHOLE POUNDS.
 *    HMRC has no multipleOf on these and describes them as "to 2 zeroed
 *    decimal places" — send integers.
 *
 * netVatDue is the only field that cannot be negative, and it has a smaller
 * maximum (99,999,999,999.99) than the others (9,999,999,999,999.99).
 */
export const VatReturnPayloadSchema = z.object({
  periodKey: z.string().min(4).max(4),
  vatDueSales: z.number().min(-9_999_999_999_999.99).max(9_999_999_999_999.99),
  vatDueAcquisitions: z.number().min(-9_999_999_999_999.99).max(9_999_999_999_999.99),
  totalVatDue: z.number().min(-9_999_999_999_999.99).max(9_999_999_999_999.99),
  vatReclaimedCurrPeriod: z.number().min(-9_999_999_999_999.99).max(9_999_999_999_999.99),
  netVatDue: z.number().min(0).max(99_999_999_999.99),
  totalValueSalesExVAT: z.number().int().min(-9_999_999_999_999).max(9_999_999_999_999),
  totalValuePurchasesExVAT: z.number().int().min(-9_999_999_999_999).max(9_999_999_999_999),
  totalValueGoodsSuppliedExVAT: z.number().int().min(-9_999_999_999_999).max(9_999_999_999_999),
  totalAcquisitionsExVAT: z.number().int().min(-9_999_999_999_999).max(9_999_999_999_999),
  finalised: z.boolean(),
})

export type VatReturnPayload = z.infer<typeof VatReturnPayloadSchema>

export const SubmitReturnResponseSchema = z.object({
  processingDate: z.string(),
  formBundleNumber: z.string().regex(/^[0-9]{12}$/),
  paymentIndicator: z.enum(["DD", "BANK"]).optional(),
  chargeRefNumber: z.string().optional(),
})

export const ViewReturnResponseSchema = VatReturnPayloadSchema.omit({ finalised: true })

export const LiabilitiesResponseSchema = z.object({
  liabilities: z.array(
    z.object({
      taxPeriod: z.object({ from: z.string(), to: z.string() }).optional(),
      type: z.string(),
      originalAmount: z.number(),
      outstandingAmount: z.number().optional(),
      due: z.string().optional(),
    }),
  ),
})

export const PaymentsResponseSchema = z.object({
  payments: z.array(
    z.object({ amount: z.number(), received: z.string().optional() }),
  ),
})

export const CustomerInfoResponseSchema = z.object({
  customerDetails: z.object({ effectiveRegistrationDate: z.string().optional() }).optional(),
  flatRateScheme: z
    .object({ frsCategory: z.string().optional(), startDate: z.string().optional() })
    .optional(),
})

// Penalties and financial-details have deep, largely-optional structures with
// several string-typed numerics. Validate loosely and let callers narrow —
// over-constraining here would reject valid HMRC responses.
export const PenaltiesResponseSchema = z.record(z.unknown())
export const FinancialDetailsResponseSchema = z.record(z.unknown())

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Period keys may contain '#', which MUST be percent-encoded in the path. */
function encodePeriodKey(periodKey: string): string {
  return encodeURIComponent(periodKey)
}

function assertValidVrn(vrn: string): void {
  if (!/^\d{9}$/.test(vrn)) {
    throw new Error(
      `Invalid VAT registration number "${vrn}". HMRC requires exactly 9 digits with no GB prefix or spaces.`,
    )
  }
}

/** Round to 2dp for boxes 1–5. Floating point makes this necessary. */
export function money2dp(value: number): number {
  return Math.round(value * 100) / 100
}

/** Boxes 6–9 must be whole pounds. HMRC rejects decimals here. */
export function wholePounds(value: number): number {
  return Math.round(value)
}

// ─── 1. Retrieve VAT obligations ─────────────────────────────────────────────

export async function retrieveObligations(
  organizationId: string,
  vrn: string,
  params: { from?: string; to?: string; status?: "O" | "F" },
  opts: HmrcRequestOptions = {},
) {
  assertValidVrn(vrn)

  const qs = new URLSearchParams()
  if (params.from) qs.set("from", params.from)
  if (params.to) qs.set("to", params.to)
  if (params.status) qs.set("status", params.status)

  // from/to are marked optional in the spec but are conditionally mandatory:
  // "Mandatory unless the status is O".
  if (!params.status && (!params.from || !params.to)) {
    throw new Error(
      "HMRC requires a from/to date range when retrieving obligations without a status filter.",
    )
  }

  const { data } = await hmrcRequest<unknown>(
    organizationId,
    `/organisations/vat/${vrn}/obligations?${qs.toString()}`,
    opts,
  )

  return ObligationsResponseSchema.parse(data)
}

/**
 * Fetch obligations and mirror them into VatPeriod rows.
 * Splitting the sync from the fetch keeps the API client pure and testable.
 */
export async function syncObligations(
  organizationId: string,
  vrn: string,
  params: { from?: string; to?: string; status?: "O" | "F" },
  opts: HmrcRequestOptions = {},
) {
  const result = await retrieveObligations(organizationId, vrn, params, opts)

  const conn = await prisma.hmrcConnection.findUnique({ where: { organizationId } })
  if (!conn) throw new Error("No HMRC connection for this organisation")

  const now = new Date()

  for (const o of result.obligations) {
    const due = new Date(o.due)
    const status =
      o.status === "F" ? "FULFILLED" : due < now ? "OVERDUE" : "OPEN"

    await prisma.vatPeriod.upsert({
      where: { organizationId_periodKey: { organizationId, periodKey: o.periodKey } },
      create: {
        organizationId,
        hmrcConnectionId: conn.id,
        vrn,
        periodKey: o.periodKey,
        periodStart: new Date(o.start),
        periodEnd: new Date(o.end),
        dueDate: due,
        status,
        lastSyncedAt: now,
      },
      update: {
        periodStart: new Date(o.start),
        periodEnd: new Date(o.end),
        dueDate: due,
        status,
        lastSyncedAt: now,
        ...(o.received ? { submittedAt: new Date(o.received) } : {}),
      },
    })
  }

  await prisma.hmrcConnection.update({
    where: { organizationId },
    data: { lastSyncAt: now, status: "ACTIVE" },
  })

  return result.obligations
}

// ─── 2. Submit VAT return ────────────────────────────────────────────────────

export async function submitReturn(
  organizationId: string,
  vrn: string,
  payload: VatReturnPayload,
  opts: HmrcRequestOptions = {},
) {
  assertValidVrn(vrn)
  const validated = VatReturnPayloadSchema.parse(payload)

  // Enforce HMRC's arithmetic rules before the call so users get a clear
  // message rather than VAT_TOTAL_VALUE / VAT_NET_VALUE back from HMRC.
  const expectedTotal = money2dp(validated.vatDueSales + validated.vatDueAcquisitions)
  if (Math.abs(expectedTotal - validated.totalVatDue) > 0.005) {
    throw new Error(
      `Box 3 (${validated.totalVatDue}) must equal Box 1 + Box 2 (${expectedTotal}).`,
    )
  }

  const expectedNet = money2dp(
    Math.abs(validated.totalVatDue - validated.vatReclaimedCurrPeriod),
  )
  if (Math.abs(expectedNet - validated.netVatDue) > 0.005) {
    throw new Error(
      `Box 5 (${validated.netVatDue}) must be the difference between Box 3 and Box 4 (${expectedNet}).`,
    )
  }

  if (!validated.finalised) {
    throw new Error("The VAT return must be declared final before submission.")
  }

  // noRetry: a retried POST that already succeeded yields DUPLICATE_SUBMISSION
  // and risks our ledger disagreeing with HMRC about whether a return was filed.
  const { data, correlationId, headers } = await hmrcRequest<unknown>(
    organizationId,
    `/organisations/vat/${vrn}/returns`,
    { ...opts, method: "POST", body: validated, noRetry: true },
  )

  const result = SubmitReturnResponseSchema.parse(data)

  await prisma.vatPeriod.updateMany({
    where: { organizationId, periodKey: validated.periodKey },
    data: {
      status: "FULFILLED",
      hmrcReceiptId: result.formBundleNumber,
      submittedAt: new Date(),
      box1OutputVat: validated.vatDueSales,
      box2: validated.vatDueAcquisitions,
      box3: validated.totalVatDue,
      box4InputVat: validated.vatReclaimedCurrPeriod,
      box5NetVat: validated.netVatDue,
      box6SalesNet: validated.totalValueSalesExVAT,
      box7PurchasesNet: validated.totalValuePurchasesExVAT,
      box8: validated.totalValueGoodsSuppliedExVAT,
      box9: validated.totalAcquisitionsExVAT,
    },
  })

  return {
    ...result,
    correlationId,
    receiptId: headers.get("Receipt-ID") ?? undefined,
    receiptTimestamp: headers.get("Receipt-Timestamp") ?? undefined,
  }
}

// ─── 3. View a submitted VAT return ──────────────────────────────────────────

export async function viewReturn(
  organizationId: string,
  vrn: string,
  periodKey: string,
  opts: HmrcRequestOptions = {},
) {
  assertValidVrn(vrn)
  const { data } = await hmrcRequest<unknown>(
    organizationId,
    `/organisations/vat/${vrn}/returns/${encodePeriodKey(periodKey)}`,
    opts,
  )
  return ViewReturnResponseSchema.parse(data)
}

// ─── 4. Retrieve VAT liabilities ─────────────────────────────────────────────

export async function retrieveLiabilities(
  organizationId: string,
  vrn: string,
  from: string,
  to: string,
  opts: HmrcRequestOptions = {},
) {
  assertValidVrn(vrn)
  const { data } = await hmrcRequest<unknown>(
    organizationId,
    `/organisations/vat/${vrn}/liabilities?from=${from}&to=${to}`,
    opts,
  )
  return LiabilitiesResponseSchema.parse(data)
}

// ─── 5. Retrieve VAT payments ────────────────────────────────────────────────

export async function retrievePayments(
  organizationId: string,
  vrn: string,
  from: string,
  to: string,
  opts: HmrcRequestOptions = {},
) {
  assertValidVrn(vrn)
  const { data } = await hmrcRequest<unknown>(
    organizationId,
    `/organisations/vat/${vrn}/payments?from=${from}&to=${to}`,
    opts,
  )
  return PaymentsResponseSchema.parse(data)
}

// ─── 6. Retrieve VAT penalties ───────────────────────────────────────────────

export async function retrievePenalties(
  organizationId: string,
  vrn: string,
  opts: HmrcRequestOptions = {},
) {
  assertValidVrn(vrn)
  const { data } = await hmrcRequest<unknown>(
    organizationId,
    `/organisations/vat/${vrn}/penalties`,
    opts,
  )
  // An account with no penalties returns 200 {} — that is success, not an error.
  return PenaltiesResponseSchema.parse(data)
}

// ─── 7. Retrieve financial details for a penalty ─────────────────────────────

export async function retrieveFinancialDetails(
  organizationId: string,
  vrn: string,
  penaltyChargeReference: string,
  opts: HmrcRequestOptions = {},
) {
  assertValidVrn(vrn)
  const { data } = await hmrcRequest<unknown>(
    organizationId,
    `/organisations/vat/${vrn}/financial-details/${encodeURIComponent(penaltyChargeReference)}`,
    opts,
  )
  return FinancialDetailsResponseSchema.parse(data)
}

// ─── 8. Retrieve VAT customer information ────────────────────────────────────

export async function retrieveCustomerInformation(
  organizationId: string,
  vrn: string,
  opts: HmrcRequestOptions = {},
) {
  assertValidVrn(vrn)
  const { data } = await hmrcRequest<unknown>(
    organizationId,
    `/organisations/vat/${vrn}/information`,
    opts,
  )
  return CustomerInfoResponseSchema.parse(data)
}
