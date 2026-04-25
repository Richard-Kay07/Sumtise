/**
 * Financial ratio calculations.
 *
 * All functions are pure — they take numbers and return numbers (or null when
 * a ratio is undefined, e.g. division by zero).
 *
 * Organised into four categories:
 *   1. Liquidity
 *   2. Profitability
 *   3. Efficiency / Activity
 *   4. Leverage / Solvency
 */

// ---------------------------------------------------------------------------
// Shared guard
// ---------------------------------------------------------------------------

function safe(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return numerator / denominator
}

// ---------------------------------------------------------------------------
// 1. Liquidity ratios
// ---------------------------------------------------------------------------

export interface LiquidityInputs {
  currentAssets:     number
  currentLiabilities: number
  /** Cash and cash equivalents */
  cash:              number
  /** Short-term marketable securities */
  shortTermInvestments?: number
  /** Trade receivables (net) */
  receivables:       number
  /** Inventories */
  inventory:         number
  /** Prepayments and other current assets */
  otherCurrentAssets?: number
}

export interface LiquidityRatios {
  /** Current assets / current liabilities */
  currentRatio: number | null
  /** (Current assets − inventory) / current liabilities */
  quickRatio: number | null
  /** Cash + short-term investments / current liabilities */
  cashRatio: number | null
  /** Operating cash flow / current liabilities (requires OCF input) */
  operatingCashFlowRatio: number | null
}

export function computeLiquidityRatios(
  inputs: LiquidityInputs & { operatingCashFlow?: number }
): LiquidityRatios {
  const { currentAssets, currentLiabilities, cash, shortTermInvestments = 0, inventory, operatingCashFlow } = inputs

  return {
    currentRatio:           safe(currentAssets, currentLiabilities),
    quickRatio:             safe(currentAssets - inventory, currentLiabilities),
    cashRatio:              safe(cash + shortTermInvestments, currentLiabilities),
    operatingCashFlowRatio: operatingCashFlow !== undefined
      ? safe(operatingCashFlow, currentLiabilities)
      : null,
  }
}

// ---------------------------------------------------------------------------
// 2. Profitability ratios
// ---------------------------------------------------------------------------

export interface ProfitabilityInputs {
  revenue:            number
  costOfGoodsSold:    number
  operatingProfit:    number  // EBIT
  netProfit:          number
  ebitda:             number
  totalAssets:        number
  totalEquity:        number
  capitalEmployed:    number  // total assets − current liabilities
  interestExpense?:   number
  taxExpense?:        number
}

export interface ProfitabilityRatios {
  grossMargin:          number | null  // (revenue − COGS) / revenue
  operatingMargin:      number | null  // EBIT / revenue
  netProfitMargin:      number | null  // net profit / revenue
  ebitdaMargin:         number | null  // EBITDA / revenue
  returnOnAssets:       number | null  // net profit / total assets
  returnOnEquity:       number | null  // net profit / total equity
  returnOnCapitalEmployed: number | null  // EBIT / capital employed
  assetTurnover:        number | null  // revenue / total assets
}

export function computeProfitabilityRatios(inputs: ProfitabilityInputs): ProfitabilityRatios {
  const { revenue, costOfGoodsSold, operatingProfit, netProfit, ebitda, totalAssets, totalEquity, capitalEmployed } = inputs

  const grossProfit = revenue - costOfGoodsSold

  return {
    grossMargin:             safe(grossProfit,      revenue),
    operatingMargin:         safe(operatingProfit,  revenue),
    netProfitMargin:         safe(netProfit,        revenue),
    ebitdaMargin:            safe(ebitda,           revenue),
    returnOnAssets:          safe(netProfit,        totalAssets),
    returnOnEquity:          safe(netProfit,        totalEquity),
    returnOnCapitalEmployed: safe(operatingProfit,  capitalEmployed),
    assetTurnover:           safe(revenue,          totalAssets),
  }
}

// ---------------------------------------------------------------------------
// 3. Efficiency / Activity ratios
// ---------------------------------------------------------------------------

export interface EfficiencyInputs {
  revenue:                number
  costOfGoodsSold:        number
  openingInventory:       number
  closingInventory:       number
  openingReceivables:     number
  closingReceivables:     number
  openingPayables:        number
  closingPayables:        number
  /** Credit purchases; if unknown, COGS is used as proxy */
  creditPurchases?:       number
  totalAssets:            number
  fixedAssets:            number
}

export interface EfficiencyRatios {
  /** Revenue / average total assets */
  assetTurnover:          number | null
  /** Revenue / average fixed assets */
  fixedAssetTurnover:     number | null
  /** Average inventory / (COGS / 365) — days */
  inventoryDays:          number | null
  /** (COGS / average inventory) — times */
  inventoryTurnover:      number | null
  /** Average receivables / (revenue / 365) — days */
  receivableDays:         number | null
  /** (Revenue / average receivables) — times */
  receivablesTurnover:    number | null
  /** Average payables / (purchases / 365) — days */
  payableDays:            number | null
  /** (Purchases / average payables) — times */
  payablesTurnover:       number | null
  /** Receivable days + inventory days − payable days */
  cashConversionCycle:    number | null
}

export function computeEfficiencyRatios(inputs: EfficiencyInputs): EfficiencyRatios {
  const {
    revenue, costOfGoodsSold, totalAssets, fixedAssets,
    openingInventory, closingInventory,
    openingReceivables, closingReceivables,
    openingPayables, closingPayables,
    creditPurchases,
  } = inputs

  const avgInventory    = (openingInventory   + closingInventory)   / 2
  const avgReceivables  = (openingReceivables + closingReceivables) / 2
  const avgPayables     = (openingPayables    + closingPayables)    / 2
  const purchases       = creditPurchases ?? costOfGoodsSold

  const inventoryTurnover   = safe(costOfGoodsSold, avgInventory)
  const receivablesTurnover = safe(revenue,          avgReceivables)
  const payablesTurnover    = safe(purchases,        avgPayables)

  const inventoryDays  = inventoryTurnover   ? 365 / inventoryTurnover   : null
  const receivableDays = receivablesTurnover ? 365 / receivablesTurnover : null
  const payableDays    = payablesTurnover    ? 365 / payablesTurnover    : null

  const cashConversionCycle =
    receivableDays !== null && inventoryDays !== null && payableDays !== null
      ? receivableDays + inventoryDays - payableDays
      : null

  return {
    assetTurnover:          safe(revenue, totalAssets),
    fixedAssetTurnover:     safe(revenue, fixedAssets),
    inventoryDays,
    inventoryTurnover,
    receivableDays,
    receivablesTurnover,
    payableDays,
    payablesTurnover,
    cashConversionCycle,
  }
}

// ---------------------------------------------------------------------------
// 4. Leverage / Solvency ratios
// ---------------------------------------------------------------------------

export interface LeverageInputs {
  totalDebt:          number   // interest-bearing debt (short + long term)
  totalEquity:        number
  totalAssets:        number
  totalLiabilities:   number
  ebit:               number   // operating profit
  interestExpense:    number
  ebitda:             number
  operatingCashFlow?: number
  netDebt?:           number   // total debt − cash (pass in explicitly for accuracy)
}

export interface LeverageRatios {
  /** Total debt / total equity */
  debtToEquity:         number | null
  /** Total debt / total assets */
  debtRatio:            number | null
  /** Total equity / total assets */
  equityRatio:          number | null
  /** EBIT / interest expense */
  interestCoverageRatio: number | null
  /** EBITDA / interest expense */
  ebitdaCoverageRatio:  number | null
  /** Total debt / EBITDA */
  debtToEbitda:         number | null
  /** Net debt / EBITDA */
  netDebtToEbitda:      number | null
  /** Operating cash flow / total debt */
  cashFlowToDebt:       number | null
}

export function computeLeverageRatios(inputs: LeverageInputs): LeverageRatios {
  const {
    totalDebt, totalEquity, totalAssets, ebit, interestExpense,
    ebitda, operatingCashFlow, netDebt,
  } = inputs

  return {
    debtToEquity:          safe(totalDebt,           totalEquity),
    debtRatio:             safe(totalDebt,           totalAssets),
    equityRatio:           safe(totalEquity,         totalAssets),
    interestCoverageRatio: safe(ebit,                interestExpense),
    ebitdaCoverageRatio:   safe(ebitda,              interestExpense),
    debtToEbitda:          safe(totalDebt,           ebitda),
    netDebtToEbitda:       netDebt !== undefined ? safe(netDebt, ebitda) : null,
    cashFlowToDebt:        operatingCashFlow !== undefined
      ? safe(operatingCashFlow, totalDebt)
      : null,
  }
}

// ---------------------------------------------------------------------------
// 5. Valuation ratios (requires share data)
// ---------------------------------------------------------------------------

export interface ValuationInputs {
  marketCapitalisation: number
  netProfit:            number
  bookValueOfEquity:    number
  ebitda:               number
  revenue:              number
  dividendPerShare?:    number
  earningsPerShare?:    number
  sharePrice?:          number
  sharesOutstanding?:   number
}

export interface ValuationRatios {
  /** Market cap / net profit */
  priceToEarnings:     number | null
  /** Market cap / book value */
  priceToBook:         number | null
  /** Market cap / revenue */
  priceToSales:        number | null
  /** Market cap / EBITDA */
  evToEbitda:          number | null  // simplified: no debt/cash adjustment
  /** Dividend / earnings per share */
  payoutRatio:         number | null
  /** Dividend per share / share price */
  dividendYield:       number | null
}

export function computeValuationRatios(inputs: ValuationInputs): ValuationRatios {
  const {
    marketCapitalisation, netProfit, bookValueOfEquity, ebitda, revenue,
    dividendPerShare, earningsPerShare, sharePrice,
  } = inputs

  return {
    priceToEarnings: safe(marketCapitalisation, netProfit),
    priceToBook:     safe(marketCapitalisation, bookValueOfEquity),
    priceToSales:    safe(marketCapitalisation, revenue),
    evToEbitda:      safe(marketCapitalisation, ebitda),
    payoutRatio:
      dividendPerShare !== undefined && earningsPerShare !== undefined && earningsPerShare !== 0
        ? safe(dividendPerShare, earningsPerShare)
        : null,
    dividendYield:
      dividendPerShare !== undefined && sharePrice !== undefined
        ? safe(dividendPerShare, sharePrice)
        : null,
  }
}

// ---------------------------------------------------------------------------
// Composite summary
// ---------------------------------------------------------------------------

export interface FinancialRatioSummary {
  liquidity:     LiquidityRatios
  profitability: ProfitabilityRatios
  efficiency:    EfficiencyRatios
  leverage:      LeverageRatios
}

export interface FinancialRatioInputs {
  liquidity:     LiquidityInputs & { operatingCashFlow?: number }
  profitability: ProfitabilityInputs
  efficiency:    EfficiencyInputs
  leverage:      LeverageInputs
}

export function computeAllRatios(inputs: FinancialRatioInputs): FinancialRatioSummary {
  return {
    liquidity:     computeLiquidityRatios(inputs.liquidity),
    profitability: computeProfitabilityRatios(inputs.profitability),
    efficiency:    computeEfficiencyRatios(inputs.efficiency),
    leverage:      computeLeverageRatios(inputs.leverage),
  }
}

// ---------------------------------------------------------------------------
// Formatting helper
// ---------------------------------------------------------------------------

/** Format a ratio as a percentage string, e.g. 0.2334 → "23.3%" */
export function formatRatioAsPercent(ratio: number | null, decimals = 1): string {
  if (ratio === null) return "N/A"
  return `${(ratio * 100).toFixed(decimals)}%`
}

/** Format a ratio as a times multiple, e.g. 2.5 → "2.5x" */
export function formatRatioAsTimes(ratio: number | null, decimals = 2): string {
  if (ratio === null) return "N/A"
  return `${ratio.toFixed(decimals)}x`
}
