/**
 * VAT period aggregation and return box calculations.
 *
 * Covers standard VAT accounting (invoice basis) and cash accounting.
 * Flat Rate Scheme (FRS) is also supported.
 *
 * Reference: HMRC VAT Notice 700 and 733 (Flat Rate Scheme).
 */

// ---------------------------------------------------------------------------
// Rate constants
// ---------------------------------------------------------------------------

export const VAT_RATES = {
  STANDARD: 0.20,
  REDUCED:  0.05,
  ZERO:     0.00,
} as const

export type VATRateCode = "STANDARD" | "REDUCED" | "ZERO" | "EXEMPT" | "OUTSIDE"

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface VATTransactionLine {
  /** Net amount (excluding VAT) in pence */
  netPence: number
  /** VAT amount in pence (may differ from netPence * rate for rounding) */
  vatPence: number
  rateCode: VATRateCode
  /** true = sales/output, false = purchases/input */
  isOutput: boolean
  /** For Flat Rate Scheme — whether this is a capital expenditure item */
  isCapitalAsset?: boolean
}

export interface VATReturnInput {
  transactions: VATTransactionLine[]
  scheme?: "standard" | "cash" | "flat_rate"
  /** Required when scheme = "flat_rate" */
  flatRatePercent?: number
  /** Total VAT-inclusive turnover for FRS — if not provided, derived from transactions */
  frsGrossTurnoverPence?: number
}

// ---------------------------------------------------------------------------
// VAT return output (UK VAT100 boxes)
// ---------------------------------------------------------------------------

export interface VATReturn {
  /** Box 1: VAT due on sales and other outputs */
  box1OutputVAT: number
  /** Box 2: VAT due on acquisitions from EC countries (legacy; 0 post-Brexit) */
  box2AcquisitionVAT: number
  /** Box 3: Total VAT due (Box 1 + Box 2) */
  box3TotalVATDue: number
  /** Box 4: VAT reclaimed on purchases and inputs */
  box4InputVAT: number
  /** Box 5: Net VAT to pay (positive) or reclaim (negative) */
  box5NetVAT: number
  /** Box 6: Total value of sales, excluding VAT */
  box6TotalSalesNet: number
  /** Box 7: Total value of purchases, excluding VAT */
  box7TotalPurchasesNet: number
  /** Box 8: Total value of EC supplies (0 post-Brexit) */
  box8ECSales: number
  /** Box 9: Total value of EC acquisitions (0 post-Brexit) */
  box9ECAcquisitions: number
  /** Breakdown by rate code */
  breakdown: VATBreakdown
}

export interface VATBreakdown {
  output: Record<VATRateCode, { netPence: number; vatPence: number }>
  input:  Record<VATRateCode, { netPence: number; vatPence: number }>
}

// ---------------------------------------------------------------------------
// Core aggregation
// ---------------------------------------------------------------------------

function emptyRateMap(): Record<VATRateCode, { netPence: number; vatPence: number }> {
  const codes: VATRateCode[] = ["STANDARD", "REDUCED", "ZERO", "EXEMPT", "OUTSIDE"]
  return Object.fromEntries(codes.map((c) => [c, { netPence: 0, vatPence: 0 }])) as Record<
    VATRateCode,
    { netPence: number; vatPence: number }
  >
}

export function aggregateVATReturn(input: VATReturnInput): VATReturn {
  const { transactions, scheme = "standard", flatRatePercent, frsGrossTurnoverPence } = input

  if (scheme === "flat_rate") {
    return computeFlatRateReturn(transactions, flatRatePercent ?? 0, frsGrossTurnoverPence)
  }

  const output = emptyRateMap()
  const inp    = emptyRateMap()

  for (const tx of transactions) {
    const target = tx.isOutput ? output : inp
    target[tx.rateCode].netPence += tx.netPence
    target[tx.rateCode].vatPence += tx.vatPence
  }

  const box1 = Object.values(output).reduce((s, v) => s + v.vatPence, 0)
  const box4 = Object.values(inp).reduce((s, v) => s + v.vatPence, 0)
  const box6 = Object.values(output).reduce((s, v) => s + v.netPence, 0)
  const box7 = Object.values(inp).reduce((s, v) => s + v.netPence, 0)

  return {
    box1OutputVAT:       box1,
    box2AcquisitionVAT:  0,
    box3TotalVATDue:     box1,
    box4InputVAT:        box4,
    box5NetVAT:          box1 - box4,
    box6TotalSalesNet:   box6,
    box7TotalPurchasesNet: box7,
    box8ECSales:         0,
    box9ECAcquisitions:  0,
    breakdown:           { output, input: inp },
  }
}

// ---------------------------------------------------------------------------
// Flat Rate Scheme
// ---------------------------------------------------------------------------

function computeFlatRateReturn(
  transactions: VATTransactionLine[],
  flatRatePercent: number,
  frsGrossTurnoverPence?: number
): VATReturn {
  // Box 6: gross turnover (VAT-inclusive) used for FRS calculation
  const outputSales = transactions.filter((t) => t.isOutput)
  const grossTurnover =
    frsGrossTurnoverPence ??
    outputSales.reduce((s, t) => s + t.netPence + t.vatPence, 0)

  // FRS VAT due = gross turnover × flat rate
  const frsVATDue = Math.round(grossTurnover * (flatRatePercent / 100))

  // Capital goods input tax — always fully reclaimed (assets > £2,000 incl. VAT)
  const capitalInputVAT = transactions
    .filter((t) => !t.isOutput && t.isCapitalAsset)
    .reduce((s, t) => s + t.vatPence, 0)

  // Net sales figure for Box 6 — use net (ex VAT) value as normal
  const box6 = outputSales.reduce((s, t) => s + t.netPence, 0)
  const box7 = transactions
    .filter((t) => !t.isOutput)
    .reduce((s, t) => s + t.netPence, 0)

  const output = emptyRateMap()
  const inp    = emptyRateMap()
  for (const tx of transactions) {
    const target = tx.isOutput ? output : inp
    target[tx.rateCode].netPence += tx.netPence
    target[tx.rateCode].vatPence += tx.vatPence
  }

  return {
    box1OutputVAT:       frsVATDue,
    box2AcquisitionVAT:  0,
    box3TotalVATDue:     frsVATDue,
    box4InputVAT:        capitalInputVAT,
    box5NetVAT:          frsVATDue - capitalInputVAT,
    box6TotalSalesNet:   box6,
    box7TotalPurchasesNet: box7,
    box8ECSales:         0,
    box9ECAcquisitions:  0,
    breakdown:           { output, input: inp },
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Calculate VAT amount from a net value and rate code. */
export function calculateVATAmount(netPence: number, rateCode: VATRateCode): number {
  if (rateCode === "EXEMPT" || rateCode === "OUTSIDE") return 0
  return Math.round(netPence * VAT_RATES[rateCode])
}

/** Extract net from a VAT-inclusive (gross) amount. */
export function netFromGross(grossPence: number, rateCode: VATRateCode): number {
  if (rateCode === "EXEMPT" || rateCode === "OUTSIDE") return grossPence
  return Math.round(grossPence / (1 + VAT_RATES[rateCode]))
}

/** Format pence as currency string for display. */
export function penceToPounds(pence: number): number {
  return pence / 100
}

/** Check whether a VAT return period is due to be filed (quarterly calendar periods). */
export function isVATReturnDue(periodEndDate: Date, filingDeadlineDays = 37): boolean {
  const now  = new Date()
  const deadline = new Date(periodEndDate)
  deadline.setDate(deadline.getDate() + filingDeadlineDays)
  return now >= deadline
}

/**
 * Determine VAT quarter boundaries from any date.
 *
 * Dates are built in UTC. Local-time construction shifted quarter ends by an
 * hour under BST, which pushed 30 June transactions into the following quarter.
 */
export function getVATQuarter(date: Date): { start: Date; end: Date } {
  // Calendar quarters ending March, June, September, December.
  const ends = [3, 6, 9, 12]
  const month = date.getUTCMonth() + 1 // 1-based
  const endMonth = ends.find((m) => m >= month) ?? 12
  const year = date.getUTCFullYear()

  // Day 0 of month N gives the last day of month N-1, and Date months are
  // 0-based — so `endMonth` (not endMonth-1) is the last day OF endMonth.
  // The previous form returned the month BEFORE the quarter end, which for a
  // March date produced a period ending before the date itself.
  const end = new Date(Date.UTC(year, endMonth, 0, 23, 59, 59, 999))
  const start = new Date(Date.UTC(year, endMonth - 3, 1, 0, 0, 0, 0))

  return { start, end }
}
