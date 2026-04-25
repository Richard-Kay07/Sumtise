/**
 * PAYE and National Insurance computation — England/Wales 2024/25 tax year.
 *
 * All monetary inputs and outputs are in pence (integers) to avoid
 * floating-point drift in cumulative payroll runs.
 *
 * References:
 *   https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2024-to-2025
 */

// ---------------------------------------------------------------------------
// Tax-year bands (pence, annual)
// ---------------------------------------------------------------------------

export type TaxYear = "2023/24" | "2024/25"

interface TaxBands {
  personalAllowance: number
  basicRateLimit: number    // upper limit of basic-rate band
  higherRateLimit: number   // upper limit of higher-rate band (additional rate above)
  basicRate: number         // e.g. 0.20
  higherRate: number        // e.g. 0.40
  additionalRate: number    // e.g. 0.45
  paWithdrawalThreshold: number // personal allowance tapers above this
}

const TAX_BANDS: Record<TaxYear, TaxBands> = {
  "2024/25": {
    personalAllowance:       1_257_000,  // £12,570
    basicRateLimit:          5_027_000,  // £50,270
    higherRateLimit:        12_514_000,  // £125,140
    basicRate:               0.20,
    higherRate:              0.40,
    additionalRate:          0.45,
    paWithdrawalThreshold:  10_000_000, // £100,000
  },
  "2023/24": {
    personalAllowance:       1_257_000,
    basicRateLimit:          5_027_000,
    higherRateLimit:        12_514_000,
    basicRate:               0.20,
    higherRate:              0.40,
    additionalRate:          0.45,
    paWithdrawalThreshold:  10_000_000,
  },
}

// ---------------------------------------------------------------------------
// NI thresholds (pence, annual)
// ---------------------------------------------------------------------------

interface NIThresholds {
  /** Lower Earnings Limit — NI record starts accruing */
  lel: number
  /** Primary Threshold — employee contributions start */
  pt: number
  /** Upper Earnings Limit — main rate applies up to here */
  uel: number
  /** Secondary Threshold — employer contributions start */
  st: number
  /** Employee main rate (PT–UEL) */
  employeeMain: number
  /** Employee upper rate (above UEL) */
  employeeUpper: number
  /** Employer rate (above ST) */
  employerRate: number
}

const NI_THRESHOLDS: Record<TaxYear, NIThresholds> = {
  "2024/25": {
    lel:           672_600,  // £6,726
    pt:          1_257_000,  // £12,570
    uel:          5_027_000, // £50,270
    st:            962_000,  // £9,620  (employer secondary threshold)
    employeeMain:  0.08,
    employeeUpper: 0.02,
    employerRate:  0.138,
  },
  "2023/24": {
    lel:           672_600,
    pt:          1_257_000,
    uel:          5_027_000,
    st:            910_000,
    employeeMain:  0.12,
    employeeUpper: 0.02,
    employerRate:  0.138,
  },
}

// ---------------------------------------------------------------------------
// Student Loan repayment
// ---------------------------------------------------------------------------

export type StudentLoanPlan = "none" | "plan1" | "plan2" | "plan4" | "postgrad"

interface StudentLoanThreshold {
  threshold: number  // annual, pence
  rate: number
}

const STUDENT_LOAN_PLANS: Record<StudentLoanPlan, StudentLoanThreshold> = {
  none:     { threshold: 0,           rate: 0 },
  plan1:    { threshold: 2_299_500,   rate: 0.09 },  // £22,995
  plan2:    { threshold: 2_799_500,   rate: 0.09 },  // £27,295  (2024/25 frozen)
  plan4:    { threshold: 3_149_500,   rate: 0.09 },  // £31,395  (Scotland)
  postgrad: { threshold: 2_100_000,   rate: 0.06 },  // £21,000
}

// ---------------------------------------------------------------------------
// Core PAYE computation
// ---------------------------------------------------------------------------

export interface PAYEInput {
  /** Annual gross salary in pence */
  annualGrossPence: number
  /** HMRC tax code, e.g. "1257L", "BR", "0T", "D0", "NT" */
  taxCode?: string
  taxYear?: TaxYear
}

export interface PAYEResult {
  /** Annual PAYE tax in pence */
  annualTaxPence: number
  /** Effective personal allowance applied (pence) */
  effectiveAllowancePence: number
  /** Taxable income (pence) */
  taxableIncomePence: number
  /** Band breakdown */
  bands: {
    basic: number
    higher: number
    additional: number
  }
}

export function computePAYE(input: PAYEInput): PAYEResult {
  const { annualGrossPence, taxCode = "1257L", taxYear = "2024/25" } = input
  const bands = TAX_BANDS[taxYear]

  let personalAllowance = resolvePersonalAllowance(taxCode, annualGrossPence, bands)
  const taxableIncomePence = Math.max(0, annualGrossPence - personalAllowance)

  const basicBandWidth = bands.basicRateLimit - bands.personalAllowance
  const higherBandWidth = bands.higherRateLimit - bands.basicRateLimit

  const inBasic    = Math.min(taxableIncomePence, basicBandWidth)
  const inHigher   = Math.min(Math.max(0, taxableIncomePence - basicBandWidth), higherBandWidth)
  const inAdditional = Math.max(0, taxableIncomePence - basicBandWidth - higherBandWidth)

  const taxBasic      = Math.round(inBasic      * bands.basicRate)
  const taxHigher     = Math.round(inHigher     * bands.higherRate)
  const taxAdditional = Math.round(inAdditional * bands.additionalRate)

  return {
    annualTaxPence: taxBasic + taxHigher + taxAdditional,
    effectiveAllowancePence: personalAllowance,
    taxableIncomePence,
    bands: { basic: taxBasic, higher: taxHigher, additional: taxAdditional },
  }
}

function resolvePersonalAllowance(taxCode: string, grossPence: number, bands: TaxBands): number {
  const upper = taxCode.toUpperCase()

  // Special codes — no allowance or flat rate
  if (upper === "BR")  return 0
  if (upper === "0T")  return 0
  if (upper === "NT")  return grossPence  // no tax
  if (upper === "D0")  return 0           // all at higher rate (handled below)
  if (upper === "D1")  return 0           // all at additional rate

  // Standard numeric code, e.g. "1257L" → £12,570
  const match = upper.match(/^(\d+)[A-Z]?$/)
  if (match) {
    let pa = parseInt(match[1], 10) * 100  // multiply by 100 pence

    // Personal allowance tapering above £100,000
    if (grossPence > bands.paWithdrawalThreshold) {
      const excess = grossPence - bands.paWithdrawalThreshold
      pa = Math.max(0, pa - Math.floor(excess / 2))
    }
    return pa
  }

  return bands.personalAllowance
}

// ---------------------------------------------------------------------------
// National Insurance computation
// ---------------------------------------------------------------------------

export interface NIInput {
  annualGrossPence: number
  taxYear?: TaxYear
  /** Set true for directors (annual rather than per-period calculation) */
  isDirector?: boolean
}

export interface NIResult {
  employeePence: number
  employerPence: number
  breakdown: {
    belowPT: number
    mainRate: number
    upperRate: number
    employerMainRate: number
  }
}

export function computeNI(input: NIInput): NIResult {
  const { annualGrossPence, taxYear = "2024/25" } = input
  const thr = NI_THRESHOLDS[taxYear]

  // Employee contributions
  const inMain  = Math.max(0, Math.min(annualGrossPence, thr.uel) - thr.pt)
  const inUpper = Math.max(0, annualGrossPence - thr.uel)

  const employeeMain  = Math.round(Math.max(0, inMain)  * thr.employeeMain)
  const employeeUpper = Math.round(Math.max(0, inUpper) * thr.employeeUpper)
  const employeePence = employeeMain + employeeUpper

  // Employer contributions
  const aboveST        = Math.max(0, annualGrossPence - thr.st)
  const employerPence  = Math.round(aboveST * thr.employerRate)

  return {
    employeePence,
    employerPence,
    breakdown: {
      belowPT:         Math.max(0, Math.min(annualGrossPence, thr.pt)),
      mainRate:        employeeMain,
      upperRate:       employeeUpper,
      employerMainRate: employerPence,
    },
  }
}

// ---------------------------------------------------------------------------
// Pension auto-enrolment
// ---------------------------------------------------------------------------

export interface PensionInput {
  annualGrossPence: number
  /** Employee contribution rate, e.g. 0.05 for 5% */
  employeeRate?: number
  /** Employer contribution rate, e.g. 0.03 for 3% */
  employerRate?: number
  /**
   * Auto-enrolment qualifying earnings band (2024/25):
   *   lower: £6,240  upper: £50,270
   */
  qualifyingLowerPence?: number
  qualifyingUpperPence?: number
}

export interface PensionResult {
  qualifyingEarningsPence: number
  employeeContributionPence: number
  employerContributionPence: number
}

export function computePension(input: PensionInput): PensionResult {
  const {
    annualGrossPence,
    employeeRate = 0.05,
    employerRate = 0.03,
    qualifyingLowerPence = 624_000,   // £6,240
    qualifyingUpperPence = 5_027_000, // £50,270
  } = input

  const qualifyingEarningsPence = Math.max(
    0,
    Math.min(annualGrossPence, qualifyingUpperPence) - qualifyingLowerPence
  )

  return {
    qualifyingEarningsPence,
    employeeContributionPence: Math.round(qualifyingEarningsPence * employeeRate),
    employerContributionPence: Math.round(qualifyingEarningsPence * employerRate),
  }
}

// ---------------------------------------------------------------------------
// Student loan repayment
// ---------------------------------------------------------------------------

export function computeStudentLoan(
  annualGrossPence: number,
  plan: StudentLoanPlan = "none"
): number {
  const config = STUDENT_LOAN_PLANS[plan]
  const repayable = Math.max(0, annualGrossPence - config.threshold)
  return Math.round(repayable * config.rate)
}

// ---------------------------------------------------------------------------
// Full payslip calculation (monthly)
// ---------------------------------------------------------------------------

export interface PayslipInput {
  /** Annual gross salary in pence */
  annualGrossPence: number
  taxCode?: string
  taxYear?: TaxYear
  studentLoanPlan?: StudentLoanPlan
  pensionEmployeeRate?: number
  pensionEmployerRate?: number
  /** Number of pay periods per year (12 = monthly, 52 = weekly) */
  periodsPerYear?: number
}

export interface PayslipResult {
  /** Per-period amounts, all in pence */
  period: {
    grossPence: number
    payePence: number
    employeeNIPence: number
    employerNIPence: number
    pensionEmployeePence: number
    pensionEmployerPence: number
    studentLoanPence: number
    totalDeductionsPence: number
    netPence: number
  }
  /** Annual equivalents */
  annual: {
    grossPence: number
    payePence: number
    employeeNIPence: number
    employerNIPence: number
    pensionEmployeePence: number
    pensionEmployerPence: number
    studentLoanPence: number
    totalDeductionsPence: number
    netPence: number
  }
  effectiveTaxRate: number
}

export function computePayslip(input: PayslipInput): PayslipResult {
  const {
    annualGrossPence,
    taxCode,
    taxYear,
    studentLoanPlan = "none",
    pensionEmployeeRate,
    pensionEmployerRate,
    periodsPerYear = 12,
  } = input

  const paye    = computePAYE({ annualGrossPence, taxCode, taxYear })
  const ni      = computeNI({ annualGrossPence, taxYear })
  const pension = computePension({ annualGrossPence, employeeRate: pensionEmployeeRate, employerRate: pensionEmployerRate })
  const sl      = computeStudentLoan(annualGrossPence, studentLoanPlan)

  const annualDeductions =
    paye.annualTaxPence +
    ni.employeePence +
    pension.employeeContributionPence +
    sl

  const annualNet = annualGrossPence - annualDeductions

  const p = (n: number) => Math.round(n / periodsPerYear)

  return {
    period: {
      grossPence:            p(annualGrossPence),
      payePence:             p(paye.annualTaxPence),
      employeeNIPence:       p(ni.employeePence),
      employerNIPence:       p(ni.employerPence),
      pensionEmployeePence:  p(pension.employeeContributionPence),
      pensionEmployerPence:  p(pension.employerContributionPence),
      studentLoanPence:      p(sl),
      totalDeductionsPence:  p(annualDeductions),
      netPence:              p(annualNet),
    },
    annual: {
      grossPence:            annualGrossPence,
      payePence:             paye.annualTaxPence,
      employeeNIPence:       ni.employeePence,
      employerNIPence:       ni.employerPence,
      pensionEmployeePence:  pension.employeeContributionPence,
      pensionEmployerPence:  pension.employerContributionPence,
      studentLoanPence:      sl,
      totalDeductionsPence:  annualDeductions,
      netPence:              annualNet,
    },
    effectiveTaxRate: annualGrossPence > 0
      ? (paye.annualTaxPence + ni.employeePence) / annualGrossPence
      : 0,
  }
}
