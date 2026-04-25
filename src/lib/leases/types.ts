import { Prisma } from "@prisma/client"

// ---------------------------------------------------------------------------
// Lease payment stream
// ---------------------------------------------------------------------------

export interface LeasePayment {
  date: Date
  amount: Prisma.Decimal
}

export type PaymentFrequency = "MONTHLY" | "QUARTERLY" | "ANNUAL"

// ---------------------------------------------------------------------------
// Schedule generation
// ---------------------------------------------------------------------------

export interface LeaseParams {
  commencementDate: Date
  endDate: Date
  annualRent: Prisma.Decimal
  paymentFrequency: PaymentFrequency
  /** Day of month payments fall on (1–28) */
  paymentDay: number
  ibrPercent: Prisma.Decimal
  rentFreeMonths: number
  currency: string
}

export interface LeaseScheduleRow {
  periodNumber: number
  periodStart: Date
  periodEnd: Date
  paymentDate: Date
  openingLiability: Prisma.Decimal
  leasePayment: Prisma.Decimal
  interestCharge: Prisma.Decimal
  principalRepayment: Prisma.Decimal
  closingLiability: Prisma.Decimal
}

// ---------------------------------------------------------------------------
// ROU asset initial measurement
// ---------------------------------------------------------------------------

export interface RouAssetParams {
  pvLeasePayments: Prisma.Decimal
  initialDirectCosts: Prisma.Decimal
  leaseIncentivesReceived: Prisma.Decimal
  restorationProvision: Prisma.Decimal
}

export interface RouAssetMeasurement {
  initialCarryingAmount: Prisma.Decimal
  breakdown: {
    pvPayments: Prisma.Decimal
    directCosts: Prisma.Decimal
    incentives: Prisma.Decimal
    restoration: Prisma.Decimal
  }
}

// ---------------------------------------------------------------------------
// ROU asset depreciation
// ---------------------------------------------------------------------------

export type DepreciationMethod = "STRAIGHT_LINE" | "REDUCING_BALANCE"

export interface RouDepreciationParams {
  recognitionDate: Date
  initialCarryingAmount: Prisma.Decimal
  depreciationTermMonths: number
  residualValue: Prisma.Decimal
  method: DepreciationMethod
}

export interface RouDepreciationRow {
  periodStart: Date
  periodEnd: Date
  openingNBV: Prisma.Decimal
  depreciationCharge: Prisma.Decimal
  closingNBV: Prisma.Decimal
}

// ---------------------------------------------------------------------------
// Lease modification
// ---------------------------------------------------------------------------

export type LeaseModificationType = "EXTENSION" | "EARLY_TERMINATION" | "SCOPE_CHANGE"

export interface LeaseModification {
  type: LeaseModificationType
  effectiveDate: Date
  newEndDate?: Date
  newAnnualRent?: Prisma.Decimal
  newIbrPercent?: Prisma.Decimal
  /** Book value of lease liability on the effective date */
  currentLiabilityCarryingAmount: Prisma.Decimal
  /** Net book value of ROU asset on the effective date */
  currentRouCarryingAmount: Prisma.Decimal
  penalty?: Prisma.Decimal
}

export interface ModificationJournalEntry {
  description: string
  debitDescription: string
  creditDescription: string
  amount: Prisma.Decimal
}

export interface ModificationResult {
  newLiability: Prisma.Decimal
  remeasurementAdjustment: Prisma.Decimal
  newRouCarryingAmount: Prisma.Decimal
  journalEntries: ModificationJournalEntry[]
}

// ---------------------------------------------------------------------------
// Balance sheet classification
// ---------------------------------------------------------------------------

export interface LiabilityClassification {
  currentLiability: Prisma.Decimal
  nonCurrentLiability: Prisma.Decimal
}

// ---------------------------------------------------------------------------
// Disclosure note
// ---------------------------------------------------------------------------

export interface MaturityAnalysis {
  lessThan1Year: Prisma.Decimal
  between1And2Years: Prisma.Decimal
  between2And5Years: Prisma.Decimal
  moreThan5Years: Prisma.Decimal
}

export interface IFRS16Disclosure {
  maturityAnalysis: MaturityAnalysis
  totalUndiscounted: Prisma.Decimal
  totalPresentValue: Prisma.Decimal
  totalFinanceCharges: Prisma.Decimal
}

// ---------------------------------------------------------------------------
// Lease record shape expected by disclosure function
// ---------------------------------------------------------------------------

export interface LeaseRecord {
  id: string
  commencementDate: Date
  endDate: Date
  annualRentAmount: Prisma.Decimal
  paymentFrequency: string
  incrementalBorrowingRate: Prisma.Decimal
  scheduleEntries: Array<{
    periodStart: Date
    periodEnd: Date
    paymentDate: Date
    openingLiability: Prisma.Decimal
    leasePayment: Prisma.Decimal
    interestCharge: Prisma.Decimal
    principalRepayment: Prisma.Decimal
    closingLiability: Prisma.Decimal
    isPosted: boolean
  }>
}
