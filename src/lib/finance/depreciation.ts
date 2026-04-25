/**
 * Asset depreciation calculation utilities.
 *
 * Supports:
 *   - Straight-line (SL)
 *   - Declining balance / reducing balance (DB)
 *   - Double-declining balance (DDB)
 *   - Units of production (UOP)
 *   - Sum-of-years-digits (SYD)
 *   - IFRS 16 right-of-use asset (finance lease depreciation)
 *
 * All monetary values are in the same currency unit as the caller provides
 * (no conversion is performed here).
 */

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface DepreciationPeriod {
  period: number         // 1-based
  openingBookValue: number
  depreciationCharge: number
  accumulatedDepreciation: number
  closingBookValue: number
}

// ---------------------------------------------------------------------------
// Straight-line
// ---------------------------------------------------------------------------

export interface StraightLineInput {
  cost: number
  residualValue?: number
  usefulLifeYears: number
  /** Number of periods to generate (default = usefulLifeYears * periodsPerYear) */
  periods?: number
  periodsPerYear?: number
}

export function straightLine(input: StraightLineInput): DepreciationPeriod[] {
  const {
    cost,
    residualValue    = 0,
    usefulLifeYears,
    periodsPerYear   = 1,
    periods          = usefulLifeYears * periodsPerYear,
  } = input

  const annualCharge  = (cost - residualValue) / usefulLifeYears
  const periodCharge  = annualCharge / periodsPerYear
  const schedule: DepreciationPeriod[] = []
  let accum = 0

  for (let i = 1; i <= periods; i++) {
    const opening = cost - accum
    const charge  = Math.min(periodCharge, opening - residualValue)
    const clampedCharge = Math.max(0, charge)
    accum += clampedCharge

    schedule.push({
      period:                 i,
      openingBookValue:       opening,
      depreciationCharge:     clampedCharge,
      accumulatedDepreciation: accum,
      closingBookValue:       cost - accum,
    })
  }

  return schedule
}

// ---------------------------------------------------------------------------
// Declining / reducing balance
// ---------------------------------------------------------------------------

export interface DecliningBalanceInput {
  cost: number
  residualValue?: number
  /** Annual depreciation rate, e.g. 0.25 for 25% */
  rate: number
  periods?: number
  periodsPerYear?: number
  /** Use double the straight-line rate (DDB method) */
  double?: boolean
}

export function decliningBalance(input: DecliningBalanceInput): DepreciationPeriod[] {
  const {
    cost,
    residualValue  = 0,
    rate,
    periodsPerYear = 1,
    periods        = 20,  // caller should set sensible limit
    double         = false,
  } = input

  const annualRate  = double ? rate * 2 : rate
  const periodRate  = 1 - Math.pow(1 - annualRate, 1 / periodsPerYear)
  const schedule: DepreciationPeriod[] = []
  let bookValue = cost
  let accum     = 0

  for (let i = 1; i <= periods; i++) {
    const charge = Math.max(0, Math.min(bookValue * periodRate, bookValue - residualValue))
    accum    += charge
    bookValue -= charge

    schedule.push({
      period:                  i,
      openingBookValue:        bookValue + charge,
      depreciationCharge:      charge,
      accumulatedDepreciation: accum,
      closingBookValue:        bookValue,
    })

    if (bookValue <= residualValue + 0.001) break
  }

  return schedule
}

// ---------------------------------------------------------------------------
// Sum-of-years-digits
// ---------------------------------------------------------------------------

export interface SYDInput {
  cost: number
  residualValue?: number
  usefulLifeYears: number
}

export function sumOfYearsDigits(input: SYDInput): DepreciationPeriod[] {
  const { cost, residualValue = 0, usefulLifeYears } = input

  const n           = usefulLifeYears
  const syd         = (n * (n + 1)) / 2
  const depreciable = cost - residualValue
  const schedule: DepreciationPeriod[] = []
  let accum = 0

  for (let i = 1; i <= n; i++) {
    const factor = (n - i + 1) / syd
    const charge = depreciable * factor
    accum += charge

    schedule.push({
      period:                  i,
      openingBookValue:        cost - accum + charge,
      depreciationCharge:      charge,
      accumulatedDepreciation: accum,
      closingBookValue:        cost - accum,
    })
  }

  return schedule
}

// ---------------------------------------------------------------------------
// Units of production
// ---------------------------------------------------------------------------

export interface UnitsOfProductionInput {
  cost: number
  residualValue?: number
  totalEstimatedUnits: number
  unitsPerPeriod: number[]
}

export function unitsOfProduction(input: UnitsOfProductionInput): DepreciationPeriod[] {
  const { cost, residualValue = 0, totalEstimatedUnits, unitsPerPeriod } = input

  const depreciable   = cost - residualValue
  const ratePerUnit   = depreciable / totalEstimatedUnits
  const schedule: DepreciationPeriod[] = []
  let accum = 0

  for (let i = 0; i < unitsPerPeriod.length; i++) {
    const opening = cost - accum
    const charge  = Math.min(unitsPerPeriod[i] * ratePerUnit, opening - residualValue)
    accum += charge

    schedule.push({
      period:                  i + 1,
      openingBookValue:        opening,
      depreciationCharge:      charge,
      accumulatedDepreciation: accum,
      closingBookValue:        cost - accum,
    })
  }

  return schedule
}

// ---------------------------------------------------------------------------
// IFRS 16 — Right-of-Use asset depreciation
// ---------------------------------------------------------------------------

export interface IFRS16DepreciationInput {
  /** Initial ROU asset value (present value of lease payments + initial direct costs) */
  rouAssetValue: number
  /** Lease term in periods */
  leaseTermPeriods: number
  /** Residual value guaranteed by lessee (often 0) */
  residualGuarantee?: number
  periodsPerYear?: number
}

export function ifrs16RouDepreciation(input: IFRS16DepreciationInput): DepreciationPeriod[] {
  // ROU asset is depreciated straight-line over the shorter of lease term and useful life.
  // Caller is responsible for determining that shorter period.
  return straightLine({
    cost:            input.rouAssetValue,
    residualValue:   input.residualGuarantee ?? 0,
    usefulLifeYears: input.leaseTermPeriods / (input.periodsPerYear ?? 1),
    periods:         input.leaseTermPeriods,
    periodsPerYear:  input.periodsPerYear ?? 1,
  })
}

// ---------------------------------------------------------------------------
// Lease amortisation schedule (IFRS 16 liability)
// ---------------------------------------------------------------------------

export interface LeaseAmortisationInput {
  /** Present value of lease liability (opening balance) */
  openingLiability: number
  /** Periodic lease payment */
  periodicPayment: number
  /** Implicit / incremental borrowing rate per period */
  periodicInterestRate: number
  periods: number
}

export interface LeaseAmortisationPeriod {
  period: number
  openingLiability: number
  interestCharge: number
  payment: number
  principalRepayment: number
  closingLiability: number
}

export function leaseAmortisationSchedule(
  input: LeaseAmortisationInput
): LeaseAmortisationPeriod[] {
  const { openingLiability, periodicPayment, periodicInterestRate, periods } = input

  const schedule: LeaseAmortisationPeriod[] = []
  let balance = openingLiability

  for (let i = 1; i <= periods; i++) {
    const interestCharge      = balance * periodicInterestRate
    const principalRepayment  = periodicPayment - interestCharge
    const closing             = Math.max(0, balance - principalRepayment)

    schedule.push({
      period:             i,
      openingLiability:   balance,
      interestCharge,
      payment:            periodicPayment,
      principalRepayment,
      closingLiability:   closing,
    })

    balance = closing
    if (balance < 0.001) break
  }

  return schedule
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Net book value at any given period without generating a full schedule. */
export function bookValueAt(
  method: "straight-line" | "declining-balance",
  cost: number,
  residualValue: number,
  period: number,
  options: { usefulLifeYears?: number; rate?: number }
): number {
  if (method === "straight-line") {
    const annual   = (cost - residualValue) / (options.usefulLifeYears ?? 1)
    return Math.max(residualValue, cost - annual * period)
  }
  return Math.max(residualValue, cost * Math.pow(1 - (options.rate ?? 0), period))
}
