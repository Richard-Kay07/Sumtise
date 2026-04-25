/**
 * IFRS 16 / FRS 102 Section 20 lease calculation functions.
 *
 * Pure functions — no DB calls. All monetary values use Prisma.Decimal for
 * precision. Day count convention: actual/365.
 */

import { Prisma } from "@prisma/client"
import type {
  LeasePayment,
  LeaseParams,
  LeaseScheduleRow,
  RouAssetParams,
  RouAssetMeasurement,
  RouDepreciationParams,
  RouDepreciationRow,
  LeaseModification,
  ModificationResult,
  LiabilityClassification,
  IFRS16Disclosure,
  LeaseRecord,
} from "./types"

const D = (n: number | string) => new Prisma.Decimal(n)
const ZERO = D(0)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

function clampDay(year: number, month: number, day: number): Date {
  // Last valid day of the month (handles Feb 28/29, 30-day months)
  const last = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(day, last))
}

// ---------------------------------------------------------------------------
// 1. Present value of a stream of future payments
// ---------------------------------------------------------------------------

export function calculatePresentValue(
  payments: LeasePayment[],
  ibrPercent: Prisma.Decimal,
  commencementDate: Date
): Prisma.Decimal {
  const rate = ibrPercent.div(100).toNumber()
  let pv = ZERO

  for (const pmt of payments) {
    const t = daysBetween(commencementDate, pmt.date) / 365
    if (t < 0) continue
    const factor = D(Math.pow(1 + rate, -t))
    pv = pv.plus(pmt.amount.mul(factor))
  }

  return pv
}

// ---------------------------------------------------------------------------
// 2. Full amortisation schedule
// ---------------------------------------------------------------------------

export function generateLeaseSchedule(params: LeaseParams): LeaseScheduleRow[] {
  const {
    commencementDate,
    endDate,
    annualRent,
    paymentFrequency,
    paymentDay,
    ibrPercent,
    rentFreeMonths,
  } = params

  const periodsPerYear =
    paymentFrequency === "MONTHLY" ? 12 : paymentFrequency === "QUARTERLY" ? 4 : 1
  const monthsPerPeriod = 12 / periodsPerYear
  const periodicPayment = annualRent.div(periodsPerYear)

  const annualRate = ibrPercent.div(100).toNumber()

  // Build schedule from commencement to end, one period at a time
  const schedule: LeaseScheduleRow[] = []

  // First: calculate opening liability = PV of all payments from commencement
  const allPayments: LeasePayment[] = []
  let cursor = new Date(commencementDate)
  let period = 0
  while (cursor < endDate) {
    const periodEnd = addMonths(cursor, monthsPerPeriod)
    const effectiveEnd = periodEnd > endDate ? endDate : periodEnd
    const pmtDate = clampDay(
      cursor.getFullYear(),
      cursor.getMonth(),
      paymentDay
    )
    const isRentFree = period < rentFreeMonths
    allPayments.push({ date: pmtDate, amount: isRentFree ? ZERO : periodicPayment })
    cursor = effectiveEnd
    period++
  }

  let liability = calculatePresentValue(allPayments, ibrPercent, commencementDate)

  cursor = new Date(commencementDate)
  period = 0

  while (cursor < endDate) {
    const periodStart = new Date(cursor)
    const rawEnd = addMonths(cursor, monthsPerPeriod)
    const periodEnd = rawEnd > endDate ? new Date(endDate) : rawEnd
    const pmtDate = clampDay(
      periodStart.getFullYear(),
      periodStart.getMonth(),
      paymentDay
    )

    const daysInPeriod = daysBetween(periodStart, periodEnd)
    const interestCharge = liability.mul(D(annualRate * daysInPeriod / 365))
    const isRentFree = period < rentFreeMonths
    const isLastPeriod = addMonths(cursor, monthsPerPeriod) >= endDate

    let payment: Prisma.Decimal
    if (isRentFree) {
      payment = ZERO
    } else if (isLastPeriod) {
      // Clear any remaining liability exactly
      const remaining = liability.plus(interestCharge)
      payment = remaining.greaterThan(0) ? remaining : periodicPayment
    } else {
      payment = periodicPayment
    }

    const principal = payment.minus(interestCharge)
    const closing = liability.plus(interestCharge).minus(payment)
    const clampedClosing = closing.lessThan(0) ? ZERO : closing

    schedule.push({
      periodNumber:        period + 1,
      periodStart,
      periodEnd,
      paymentDate:         pmtDate,
      openingLiability:    liability,
      leasePayment:        payment,
      interestCharge,
      principalRepayment:  principal,
      closingLiability:    clampedClosing,
    })

    liability = clampedClosing
    cursor = periodEnd
    period++

    if (liability.lessThanOrEqualTo("0.005")) break
  }

  return schedule
}

// ---------------------------------------------------------------------------
// 3. Initial ROU asset measurement
// ---------------------------------------------------------------------------

export function calculateInitialRouAsset(params: RouAssetParams): RouAssetMeasurement {
  const { pvLeasePayments, initialDirectCosts, leaseIncentivesReceived, restorationProvision } = params

  const initialCarryingAmount = pvLeasePayments
    .plus(initialDirectCosts)
    .plus(restorationProvision)
    .minus(leaseIncentivesReceived)

  return {
    initialCarryingAmount,
    breakdown: {
      pvPayments:   pvLeasePayments,
      directCosts:  initialDirectCosts,
      incentives:   leaseIncentivesReceived,
      restoration:  restorationProvision,
    },
  }
}

// ---------------------------------------------------------------------------
// 4. ROU asset depreciation schedule (monthly)
// ---------------------------------------------------------------------------

export function generateRouDepreciationSchedule(
  params: RouDepreciationParams
): RouDepreciationRow[] {
  const {
    recognitionDate,
    initialCarryingAmount,
    depreciationTermMonths,
    residualValue,
    method,
  } = params

  const schedule: RouDepreciationRow[] = []
  const depreciable = initialCarryingAmount.minus(residualValue)

  if (method === "STRAIGHT_LINE") {
    const monthlyCharge = depreciable.div(depreciationTermMonths)
    let nbv = initialCarryingAmount

    for (let i = 0; i < depreciationTermMonths; i++) {
      const periodStart = addMonths(recognitionDate, i)
      const periodEnd   = addMonths(recognitionDate, i + 1)

      // Pro-rata first period by days remaining in first month
      let charge: Prisma.Decimal
      if (i === depreciationTermMonths - 1) {
        // Last period: remainder to avoid rounding residual
        charge = nbv.minus(residualValue)
      } else {
        charge = monthlyCharge
      }
      const clampedCharge = charge.lessThan(0) ? ZERO : charge

      schedule.push({
        periodStart,
        periodEnd,
        openingNBV:         nbv,
        depreciationCharge: clampedCharge,
        closingNBV:         nbv.minus(clampedCharge),
      })

      nbv = nbv.minus(clampedCharge)
      if (nbv.lessThanOrEqualTo(residualValue.plus("0.005"))) break
    }
  } else {
    // Reducing balance — caller provides an annual rate via residualValue (not ideal;
    // for now derive rate that gets to residual in term using geometric formula)
    const annualRate =
      initialCarryingAmount.greaterThan(0)
        ? 1 - Math.pow(residualValue.div(initialCarryingAmount).toNumber(), 12 / depreciationTermMonths)
        : 0
    const monthlyRate = D(1 - Math.pow(1 - annualRate, 1 / 12))

    let nbv = initialCarryingAmount
    for (let i = 0; i < depreciationTermMonths; i++) {
      const periodStart = addMonths(recognitionDate, i)
      const periodEnd   = addMonths(recognitionDate, i + 1)
      const charge      = nbv.mul(monthlyRate)

      schedule.push({
        periodStart,
        periodEnd,
        openingNBV:         nbv,
        depreciationCharge: charge,
        closingNBV:         nbv.minus(charge),
      })

      nbv = nbv.minus(charge)
    }
  }

  return schedule
}

// ---------------------------------------------------------------------------
// 5. Lease modification
// ---------------------------------------------------------------------------

export function calculateLeaseModification(
  original: LeaseParams,
  modification: LeaseModification
): ModificationResult {
  const {
    effectiveDate,
    newEndDate,
    newAnnualRent,
    newIbrPercent,
    currentLiabilityCarryingAmount,
    currentRouCarryingAmount,
    penalty,
  } = modification

  if (modification.type === "EARLY_TERMINATION") {
    // Derecognise: gain/loss = ROU NBV - Liability + any penalty
    const rouDerecognised = currentRouCarryingAmount
    const liabilityDerecognised = currentLiabilityCarryingAmount
    const gainLoss = liabilityDerecognised.minus(rouDerecognised).minus(penalty ?? ZERO)

    return {
      newLiability:             ZERO,
      remeasurementAdjustment:  currentLiabilityCarryingAmount.negated(),
      newRouCarryingAmount:     ZERO,
      journalEntries: [
        {
          description:      "Lease termination — derecognise liability",
          debitDescription: "Lease Liability",
          creditDescription: "ROU Asset / Gain on Termination",
          amount: liabilityDerecognised,
        },
        ...(gainLoss.greaterThan(0)
          ? [{ description: "Gain on termination", debitDescription: "Lease Liability", creditDescription: "P&L Gain", amount: gainLoss }]
          : gainLoss.lessThan(0)
          ? [{ description: "Loss on termination", debitDescription: "P&L Loss", creditDescription: "Lease Liability", amount: gainLoss.abs() }]
          : []),
      ],
    }
  }

  // EXTENSION or SCOPE_CHANGE — remeasure
  const newParams: LeaseParams = {
    ...original,
    commencementDate: effectiveDate,
    endDate:          newEndDate ?? original.endDate,
    annualRent:       newAnnualRent ?? original.annualRent,
    ibrPercent:       newIbrPercent ?? original.ibrPercent,
  }

  const newSchedule = generateLeaseSchedule(newParams)
  const newLiability = newSchedule.length > 0 ? newSchedule[0].openingLiability : ZERO
  const remeasurementAdjustment = newLiability.minus(currentLiabilityCarryingAmount)
  const newRouCarryingAmount = currentRouCarryingAmount.plus(remeasurementAdjustment)

  const journalEntries = []
  if (remeasurementAdjustment.greaterThan(0)) {
    journalEntries.push({
      description:      "Lease modification — remeasurement increase",
      debitDescription: "ROU Asset",
      creditDescription: "Lease Liability",
      amount: remeasurementAdjustment,
    })
  } else if (remeasurementAdjustment.lessThan(0)) {
    journalEntries.push({
      description:      "Lease modification — remeasurement decrease",
      debitDescription: "Lease Liability",
      creditDescription: "ROU Asset",
      amount: remeasurementAdjustment.abs(),
    })
  }

  return { newLiability, remeasurementAdjustment, newRouCarryingAmount, journalEntries }
}

// ---------------------------------------------------------------------------
// 6. Current vs non-current classification
// ---------------------------------------------------------------------------

export function classifyCurrentVsNonCurrent(
  schedule: LeaseScheduleRow[],
  periodEndDate: Date
): LiabilityClassification {
  const cutoff = new Date(periodEndDate)
  cutoff.setFullYear(cutoff.getFullYear() + 1)

  let current    = ZERO
  let nonCurrent = ZERO

  for (const row of schedule) {
    if (row.isPosted ?? false) continue
    const principal = row.principalRepayment.lessThan(0) ? ZERO : row.principalRepayment
    if (row.paymentDate <= cutoff) {
      current = current.plus(principal)
    } else {
      nonCurrent = nonCurrent.plus(principal)
    }
  }

  return { currentLiability: current, nonCurrentLiability: nonCurrent }
}

// Overload accepting plain rows without isPosted
export function classifyCurrentVsNonCurrentFromRows(
  rows: Array<Pick<LeaseScheduleRow, "paymentDate" | "principalRepayment">>,
  periodEndDate: Date
): LiabilityClassification {
  return classifyCurrentVsNonCurrent(rows as LeaseScheduleRow[], periodEndDate)
}

// ---------------------------------------------------------------------------
// 7. IFRS 16 disclosure note
// ---------------------------------------------------------------------------

export function calculateDisclosureNote(
  lease: LeaseRecord,
  asAtDate: Date
): IFRS16Disclosure {
  const y1End = addMonths(asAtDate, 12)
  const y2End = addMonths(asAtDate, 24)
  const y5End = addMonths(asAtDate, 60)

  const buckets = {
    lessThan1Year:      ZERO,
    between1And2Years:  ZERO,
    between2And5Years:  ZERO,
    moreThan5Years:     ZERO,
  }

  let totalUndiscounted = ZERO
  let totalPV           = ZERO
  let totalInterest     = ZERO

  for (const row of lease.scheduleEntries) {
    if (row.paymentDate <= asAtDate) continue
    const pmt = row.leasePayment

    if (row.paymentDate <= y1End) {
      buckets.lessThan1Year = buckets.lessThan1Year.plus(pmt)
    } else if (row.paymentDate <= y2End) {
      buckets.between1And2Years = buckets.between1And2Years.plus(pmt)
    } else if (row.paymentDate <= y5End) {
      buckets.between2And5Years = buckets.between2And5Years.plus(pmt)
    } else {
      buckets.moreThan5Years = buckets.moreThan5Years.plus(pmt)
    }

    totalUndiscounted = totalUndiscounted.plus(pmt)
    totalInterest     = totalInterest.plus(row.interestCharge)
  }

  // PV = last closing liability in schedule (= current carrying amount of liability)
  const lastRow = [...lease.scheduleEntries]
    .filter((r) => r.paymentDate > asAtDate)
    .sort((a, b) => a.paymentDate.getTime() - b.paymentDate.getTime())
  totalPV = lastRow.length > 0 ? lastRow[0].openingLiability : ZERO

  return {
    maturityAnalysis: buckets,
    totalUndiscounted,
    totalPresentValue: totalPV,
    totalFinanceCharges: totalInterest,
  }
}
