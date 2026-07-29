/**
 * VAT return derivation from source documents.
 *
 * WHY DOCUMENTS AND NOT THE LEDGER
 * --------------------------------
 * The obvious approach — read VAT from the ledger's VAT control account — does
 * not work in this application today, for two verified reasons:
 *
 *  1. Sales invoices are never posted to the general ledger. The only
 *     `postDoubleEntry` in the invoice flow is the payment receipt
 *     (DR Bank / CR AR). No revenue line, no output VAT line. A ledger-derived
 *     Box 1 and Box 6 are therefore structurally ZERO for every invoice the
 *     app creates.
 *  2. Purchase bills post VAT-INCLUSIVE amounts. `BillItem.total` is
 *     `quantity * unitPrice * (1 + taxRate/100)` and `bills.approve()` debits
 *     that gross figure to the expense account with no separate VAT line. A
 *     ledger-derived Box 7 would therefore include VAT, which VAT Notice
 *     700/12 §3.8 forbids, and Box 4 would be zero.
 *
 * The previous implementation imputed VAT as `net × rate` from each account's
 * VAT treatment. That is worse than it looks: applied to bill postings it
 * multiplies an already-gross figure by 20%, so Box 4 was wrong by a factor of
 * 1.2 even in principle, before any consideration of mixed-rate invoices,
 * supplier rounding, or partial exemption.
 *
 * The sub-ledger documents DO carry the VAT actually charged
 * (`Invoice.taxAmount`, `Bill.taxAmount`, and the same on credit/debit notes),
 * and under VAT Notice 700/12 §3.2/§3.5 the VAT invoice is the source of
 * record. So documents are both correct today and the legally right basis.
 *
 * Once the posting paths are fixed to write proper VAT lines, the ledger
 * becomes a cross-check rather than the primary source. See
 * docs/hmrc-integration.md.
 */

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

/** Boxes 1–5 are 2dp; boxes 6–9 are whole pounds. */
export interface VatBoxes {
  box1OutputVat: number
  box2Acquisitions: number
  box3TotalVatDue: number
  box4InputVat: number
  /** Signed: negative means a repayment is due to the business. */
  box5NetVatSigned: number
  box6SalesExVat: number
  box7PurchasesExVat: number
  box8GoodsSuppliedExVat: number
  box9AcquisitionsExVat: number
}

export interface VatDerivation {
  basis: "documents"
  boxes: VatBoxes
  /** Boxes that cannot be derived from the current schema. */
  unsupported: Array<"box2" | "box8" | "box9">
  counts: {
    invoices: number
    creditNotes: number
    bills: number
    debitNotes: number
  }
  /** Conditions that must be cleared before the return may be filed. */
  blockers: string[]
  warnings: string[]
  period: { start: Date; endExclusive: Date }
}

/**
 * Statuses that represent an ISSUED VAT invoice.
 * On the invoice basis, output VAT is due when the invoice is issued, so DRAFT
 * (not yet issued) and CANCELLED (withdrawn) are excluded.
 */
const COUNTED_INVOICE_STATUSES = ["SENT", "PAID", "OVERDUE"] as const

/**
 * Statuses that represent a RECEIVED purchase invoice.
 * Input VAT is reclaimable once a valid VAT invoice is held, so anything from
 * RECEIVED onward counts; DRAFT and CANCELLED do not.
 */
const COUNTED_BILL_STATUSES = ["RECEIVED", "APPROVED", "PART_PAID", "PAID", "OVERDUE"] as const

/** Credit/debit notes reduce the corresponding boxes once issued. */
const COUNTED_NOTE_STATUSES = ["SENT", "APPLIED"] as const

const dec = (v: Prisma.Decimal | null | undefined): number =>
  v ? Number(v.toString()) : 0

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Round to whole pounds once, on the total — never per line, which would drift
 * by up to £0.50 per document. Sign-symmetric so a credit-note-heavy period
 * does not round asymmetrically.
 */
const wholePounds = (n: number) => Math.sign(n) * Math.round(Math.abs(n))

/**
 * Normalise a period to a half-open UTC interval.
 * Local-time midnights shifted quarter boundaries under BST, moving 30 June
 * postings into the following quarter.
 */
function utcInterval(periodStart: Date, periodEnd: Date) {
  // getUTC* deliberately. VatPeriod.periodStart/periodEnd are @db.Date and
  // arrive as exact UTC midnight; reading LOCAL components on a negative-offset
  // server (e.g. UTC-5) resolved 2025-03-31T00:00Z to local 30 March, shifting
  // the whole interval a day earlier and filing every boundary-dated document
  // in the wrong quarter.
  const start = new Date(Date.UTC(
    periodStart.getUTCFullYear(), periodStart.getUTCMonth(), periodStart.getUTCDate(), 0, 0, 0, 0,
  ))
  const endExclusive = new Date(Date.UTC(
    periodEnd.getUTCFullYear(), periodEnd.getUTCMonth(), periodEnd.getUTCDate() + 1, 0, 0, 0, 0,
  ))
  return { start, endExclusive }
}

/**
 * Derive the nine VAT boxes for a period from source documents.
 *
 * Standard (invoice-basis) VAT accounting ONLY. Callers must reject any other
 * scheme before filing — see `assertStandardScheme`. Cash accounting requires
 * matching to payment dates; the Flat Rate Scheme requires a VAT-inclusive
 * Box 6 and reclaims no input VAT. Computing either on this basis produces a
 * wrong figure in every box.
 */
export async function deriveVatReturnFromDocuments(
  organizationId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<VatDerivation> {
  const { start, endExclusive } = utcInterval(periodStart, periodEnd)
  const dateRange = { gte: start, lt: endExclusive }

  const [invoices, creditNotes, bills, debitNotes] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        organizationId,
        date: dateRange,
        status: { in: COUNTED_INVOICE_STATUSES as unknown as string[] as any },
      },
      select: { id: true, subtotal: true, taxAmount: true, currency: true, invoiceNumber: true },
    }),
    prisma.creditNote.findMany({
      where: {
        organizationId,
        date: dateRange,
        status: { in: COUNTED_NOTE_STATUSES as unknown as string[] as any },
      },
      select: { id: true, subtotal: true, taxAmount: true, currency: true },
    }),
    prisma.bill.findMany({
      where: {
        organizationId,
        date: dateRange,
        deletedAt: null,
        status: { in: COUNTED_BILL_STATUSES as unknown as string[] as any },
      },
      select: { id: true, subtotal: true, taxAmount: true, currency: true, billNumber: true },
    }),
    prisma.debitNote.findMany({
      where: {
        organizationId,
        date: dateRange,
        status: { in: COUNTED_NOTE_STATUSES as unknown as string[] as any },
      },
      select: { id: true, subtotal: true, taxAmount: true, currency: true },
    }),
  ])

  const blockers: string[] = []
  const warnings: string[] = []

  // Foreign-currency documents would enter the boxes at face value, because
  // exchangeRate is not applied anywhere in the aggregation. Refuse rather
  // than file a figure in the wrong currency.
  const notGbp = (d: { currency?: string | null }) =>
    (d.currency ?? "").trim().toUpperCase() !== "GBP"
  const foreign = [
    ...invoices.filter(notGbp),
    ...bills.filter(notGbp),
    ...creditNotes.filter(notGbp),
    ...debitNotes.filter(notGbp),
  ]
  if (foreign.length > 0) {
    blockers.push(
      `FOREIGN_CURRENCY_DOCUMENTS: ${foreign.length} document(s) in this period are not in GBP. ` +
        `Currency conversion is not applied to VAT figures, so these would be filed at face value.`,
    )
  }

  // ── Box 1: output VAT, net of credit notes issued ───────────────────────────
  // VAT Notice 700/12 §3.2: "deduct any VAT on credit notes issued by you".
  const outputVat =
    invoices.reduce((s, d) => s + dec(d.taxAmount), 0) -
    creditNotes.reduce((s, d) => s + dec(d.taxAmount), 0)

  // ── Box 4: input VAT, net of debit notes ────────────────────────────────────
  // §3.5: "deduct VAT on any credit notes issued to you".
  const inputVat =
    bills.reduce((s, d) => s + dec(d.taxAmount), 0) -
    debitNotes.reduce((s, d) => s + dec(d.taxAmount), 0)

  // ── Boxes 6 / 7: net values, excluding VAT ──────────────────────────────────
  // §3.7 / §3.8: exclude VAT itself; include zero-rated and exempt supplies.
  const salesNet =
    invoices.reduce((s, d) => s + dec(d.subtotal), 0) -
    creditNotes.reduce((s, d) => s + dec(d.subtotal), 0)

  const purchasesNet =
    bills.reduce((s, d) => s + dec(d.subtotal), 0) -
    debitNotes.reduce((s, d) => s + dec(d.subtotal), 0)

  // ── Boxes 2 / 8 / 9: not derivable ──────────────────────────────────────────
  // These are Northern Ireland Protocol figures. The schema carries no
  // country-of-supply, no goods-versus-services flag and no NI indicator, so
  // they cannot be computed. Reported as zero AND declared unsupported, so a
  // caller can distinguish "derived as nil" from "not calculable".
  const box2 = 0
  const box8 = 0
  const box9 = 0

  const box1 = round2(outputVat)
  const box4 = round2(inputVat)
  const box3 = round2(box1 + box2)
  const box5Signed = round2(box3 - box4)

  // ── Plausibility checks, mirroring HMRC's own risking ───────────────────────
  if (Math.abs(box1) > 0 && wholePounds(salesNet) === 0) {
    warnings.push(
      "Box 1 shows output VAT but Box 6 is nil. HMRC queries returns where VAT is " +
        "declared with no corresponding sales value.",
    )
  }
  if (Math.abs(box4) > 0 && wholePounds(purchasesNet) === 0) {
    warnings.push(
      "Box 4 shows reclaimed VAT but Box 7 is nil. HMRC queries returns where VAT is " +
        "reclaimed with no corresponding purchase value.",
    )
  }
  if (box1 < 0 || salesNet < 0) {
    warnings.push(
      "Box 1 or Box 6 is negative — credit notes exceed invoices for this period. " +
        "That is valid but unusual; check no credit note has been keyed to the wrong period.",
    )
  }
  const impliedRate = Math.abs(salesNet) > 0 ? Math.abs(box1) / Math.abs(salesNet) : 0
  if (Math.abs(salesNet) > 0 && (impliedRate < 0 || impliedRate > 0.21)) {
    warnings.push(
      `The implied VAT rate on sales is ${(impliedRate * 100).toFixed(1)}%, outside the ` +
        `expected 0–21% range. Check the VAT amounts on this period's invoices.`,
    )
  }
  if (invoices.length === 0 && bills.length === 0) {
    warnings.push(
      "No issued invoices or received bills fall in this period, so this would be a nil return.",
    )
  }

  return {
    basis: "documents",
    boxes: {
      box1OutputVat: box1,
      box2Acquisitions: box2,
      box3TotalVatDue: box3,
      box4InputVat: box4,
      box5NetVatSigned: box5Signed,
      box6SalesExVat: wholePounds(salesNet),
      box7PurchasesExVat: wholePounds(purchasesNet),
      box8GoodsSuppliedExVat: box8,
      box9AcquisitionsExVat: box9,
    },
    unsupported: ["box2", "box8", "box9"],
    counts: {
      invoices: invoices.length,
      creditNotes: creditNotes.length,
      bills: bills.length,
      debitNotes: debitNotes.length,
    },
    blockers,
    warnings,
    period: { start, endExclusive },
  }
}

/**
 * Build the exact payload HMRC expects.
 * Boxes 6–9 are integers; Box 5 is the absolute value (HMRC's schema sets
 * `minimum: 0` on netVatDue and carries the direction separately).
 */
export function toHmrcPayload(d: VatDerivation, periodKey: string, finalised: boolean) {
  const b = d.boxes
  return {
    periodKey,
    vatDueSales: b.box1OutputVat,
    vatDueAcquisitions: b.box2Acquisitions,
    totalVatDue: b.box3TotalVatDue,
    vatReclaimedCurrPeriod: b.box4InputVat,
    netVatDue: Math.abs(b.box5NetVatSigned),
    totalValueSalesExVAT: b.box6SalesExVat,
    totalValuePurchasesExVAT: b.box7PurchasesExVat,
    totalValueGoodsSuppliedExVAT: b.box8GoodsSuppliedExVat,
    totalAcquisitionsExVAT: b.box9AcquisitionsExVat,
    finalised,
  }
}

/**
 * Guard for the filing path.
 *
 * `VatPeriod.scheme` defaults to STANDARD and is not yet populated from HMRC's
 * customer information, so a non-standard scheme may simply be unknown rather
 * than absent. Either way the derivation above is invoice-basis and must not be
 * filed for a cash-accounting or Flat Rate business: under FRS, Box 1 is a
 * percentage of VAT-INCLUSIVE turnover, Box 4 is nil, and Box 6 is gross — so
 * every box would be wrong, not merely imprecise.
 */
export function assertStandardScheme(scheme: string | null | undefined): string[] {
  if (!scheme || scheme === "STANDARD") return []
  return [
    `UNSUPPORTED_VAT_SCHEME: this business is recorded as using the ${scheme} scheme. ` +
      `Only standard (invoice-basis) VAT accounting is supported. Filing on the wrong ` +
      `basis would misstate every box.`,
  ]
}
