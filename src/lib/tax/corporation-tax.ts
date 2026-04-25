/**
 * UK Corporation Tax computation — FY2023 onwards (Finance Act 2023).
 *
 * Key changes from April 2023:
 *   - Small profits rate: 19% on profits ≤ £50,000
 *   - Main rate: 25% on profits > £250,000
 *   - Marginal Relief applies between £50,001 and £250,000
 *   - Thresholds divided by number of associated companies + 1
 *
 * References:
 *   https://www.gov.uk/guidance/corporation-tax-rates
 *   https://www.gov.uk/guidance/corporation-tax-marginal-relief
 */

// ---------------------------------------------------------------------------
// Rates
// ---------------------------------------------------------------------------

export type CTFinancialYear = "FY2023" | "FY2024"

interface CTRates {
  smallProfitsRate:       number   // 0.19
  mainRate:               number   // 0.25
  smallProfitsLimit:      number   // £50,000
  upperLimit:             number   // £250,000
  marginalReliefFraction: number   // 3/200 = 0.015
}

const CT_RATES: Record<CTFinancialYear, CTRates> = {
  FY2023: {
    smallProfitsRate:       0.19,
    mainRate:               0.25,
    smallProfitsLimit:      50_000,
    upperLimit:             250_000,
    marginalReliefFraction: 3 / 200,  // standard fraction
  },
  FY2024: {
    smallProfitsRate:       0.19,
    mainRate:               0.25,
    smallProfitsLimit:      50_000,
    upperLimit:             250_000,
    marginalReliefFraction: 3 / 200,
  },
}

// ---------------------------------------------------------------------------
// Main computation
// ---------------------------------------------------------------------------

export interface CorporationTaxInput {
  /** Trading profit (after capital allowances, before CT) */
  tradingProfitGBP: number
  /** Net chargeable gains (after indexation/reliefs) */
  chargeableGainsGBP?: number
  /** Investment income (non-trading) */
  investmentIncomeGBP?: number
  /** Loan relationship deficits and other reliefs to deduct */
  reliefDeductionsGBP?: number
  /** Number of associated companies (excluding this one) */
  associatedCompanies?: number
  /** Accounting period length in days (default 365) */
  periodDays?: number
  financialYear?: CTFinancialYear
}

export interface CorporationTaxResult {
  /** Total profits chargeable to CT */
  augmentedProfits: number
  /** CT before marginal relief */
  grossCT: number
  /** Marginal Relief deduction (if applicable) */
  marginalRelief: number
  /** Final CT liability */
  ctLiability: number
  /** Effective rate */
  effectiveRate: number
  rateBand: "small" | "marginal" | "main"
  /** Adjusted thresholds (after associated companies apportionment) */
  adjustedSmallLimit: number
  adjustedUpperLimit: number
}

export function computeCorporationTax(input: CorporationTaxInput): CorporationTaxResult {
  const {
    tradingProfitGBP,
    chargeableGainsGBP    = 0,
    investmentIncomeGBP   = 0,
    reliefDeductionsGBP   = 0,
    associatedCompanies   = 0,
    periodDays            = 365,
    financialYear         = "FY2024",
  } = input

  const rates = CT_RATES[financialYear]

  // Augmented profits
  const augmentedProfits = Math.max(
    0,
    tradingProfitGBP + chargeableGainsGBP + investmentIncomeGBP - reliefDeductionsGBP
  )

  // Apportion thresholds for short periods and associated companies
  const divisor = associatedCompanies + 1
  const periodFraction = periodDays / 365
  const adjustedSmallLimit  = (rates.smallProfitsLimit  / divisor) * periodFraction
  const adjustedUpperLimit  = (rates.upperLimit          / divisor) * periodFraction

  if (augmentedProfits <= 0) {
    return {
      augmentedProfits: 0,
      grossCT: 0,
      marginalRelief: 0,
      ctLiability: 0,
      effectiveRate: 0,
      rateBand: "small",
      adjustedSmallLimit,
      adjustedUpperLimit,
    }
  }

  let grossCT: number
  let marginalRelief = 0
  let rateBand: "small" | "marginal" | "main"

  if (augmentedProfits <= adjustedSmallLimit) {
    grossCT  = augmentedProfits * rates.smallProfitsRate
    rateBand = "small"
  } else if (augmentedProfits <= adjustedUpperLimit) {
    // Marginal Relief formula:
    //   CT = profits × main_rate − MR_fraction × (upper_limit − profits) × (profits / augmented_profits)
    grossCT = augmentedProfits * rates.mainRate
    marginalRelief = rates.marginalReliefFraction * (adjustedUpperLimit - augmentedProfits)
    rateBand = "marginal"
  } else {
    grossCT  = augmentedProfits * rates.mainRate
    rateBand = "main"
  }

  const ctLiability   = Math.max(0, grossCT - marginalRelief)
  const effectiveRate = augmentedProfits > 0 ? ctLiability / augmentedProfits : 0

  return {
    augmentedProfits,
    grossCT,
    marginalRelief,
    ctLiability,
    effectiveRate,
    rateBand,
    adjustedSmallLimit,
    adjustedUpperLimit,
  }
}

// ---------------------------------------------------------------------------
// Capital Allowances (Annual Investment Allowance)
// ---------------------------------------------------------------------------

export interface CapitalAllowanceInput {
  /** Qualifying plant & machinery spend */
  qualifyingSpendGBP: number
  /** AIA limit for the period (2024/25: £1,000,000) */
  aiaLimitGBP?: number
  /** Existing main pool balance before this period */
  mainPoolBalanceGBP?: number
  /** Writing down allowance rate for main pool */
  mainPoolWDARate?: number
  /** Existing special rate pool (long life assets, integral features) */
  specialRatePoolGBP?: number
  specialRateWDARate?: number
}

export interface CapitalAllowanceResult {
  aiaClaimedGBP: number
  mainPoolWDAGBP: number
  specialRateWDAGBP: number
  totalAllowancesGBP: number
  mainPoolClosingBalance: number
  specialRateClosingBalance: number
}

export function computeCapitalAllowances(input: CapitalAllowanceInput): CapitalAllowanceResult {
  const {
    qualifyingSpendGBP,
    aiaLimitGBP          = 1_000_000,
    mainPoolBalanceGBP   = 0,
    mainPoolWDARate      = 0.18,
    specialRatePoolGBP   = 0,
    specialRateWDARate   = 0.06,
  } = input

  // AIA: 100% on qualifying spend up to the limit
  const aiaClaimedGBP = Math.min(qualifyingSpendGBP, aiaLimitGBP)
  const excessOverAIA = qualifyingSpendGBP - aiaClaimedGBP

  // Excess goes into main pool
  const mainPoolOpening = mainPoolBalanceGBP + excessOverAIA
  const mainPoolWDAGBP  = mainPoolOpening * mainPoolWDARate
  const mainPoolClosingBalance = mainPoolOpening - mainPoolWDAGBP

  // Special rate pool WDA
  const specialRateWDAGBP       = specialRatePoolGBP * specialRateWDARate
  const specialRateClosingBalance = specialRatePoolGBP - specialRateWDAGBP

  return {
    aiaClaimedGBP,
    mainPoolWDAGBP,
    specialRateWDAGBP,
    totalAllowancesGBP: aiaClaimedGBP + mainPoolWDAGBP + specialRateWDAGBP,
    mainPoolClosingBalance,
    specialRateClosingBalance,
  }
}

// ---------------------------------------------------------------------------
// R&D Enhanced Deduction (SME scheme — pre April 2024)
// ---------------------------------------------------------------------------

export interface RandDInput {
  qualifyingRandDSpendGBP: number
  /** Company is loss-making — can surrender R&D loss for payable credit */
  isLossMaking?: boolean
  scheme?: "sme" | "rdec"
}

export interface RandDResult {
  enhancedDeductionGBP: number
  taxCreditGBP: number
  /** Equivalent reduction in CT liability */
  ctSavingGBP: number
}

export function computeRandDRelief(input: RandDInput): RandDResult {
  const { qualifyingRandDSpendGBP, isLossMaking = false, scheme = "sme" } = input

  if (scheme === "rdec") {
    // R&D Expenditure Credit: 20% of qualifying spend from April 2023
    const rdecCredit = qualifyingRandDSpendGBP * 0.20
    return {
      enhancedDeductionGBP: 0,
      taxCreditGBP: rdecCredit,
      ctSavingGBP: rdecCredit,
    }
  }

  // SME scheme: 86% enhancement (reduced from 130% from April 2023)
  const enhancementRate  = 0.86
  const enhancedDeductionGBP = qualifyingRandDSpendGBP * enhancementRate
  const ctSavingGBP          = enhancedDeductionGBP * CT_RATES.FY2024.mainRate

  // Payable credit for loss-making SMEs: 10% of surrendered loss (post April 2023)
  const payableCreditRate = 0.10
  const taxCreditGBP = isLossMaking
    ? qualifyingRandDSpendGBP * (1 + enhancementRate) * payableCreditRate
    : 0

  return {
    enhancedDeductionGBP,
    taxCreditGBP,
    ctSavingGBP,
  }
}
