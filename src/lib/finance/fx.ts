/**
 * Multi-currency conversion and FX gain/loss utilities.
 *
 * Design principles:
 *   - Functional / pure — no side effects, no I/O.
 *   - Rate data is passed in by the caller (fetched separately from an FX provider).
 *   - Supports spot, average, and closing-rate translation methods.
 *   - Computes realised and unrealised FX gains/losses per IAS 21.
 */

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

export type CurrencyCode = string  // ISO 4217, e.g. "GBP", "USD", "EUR"

/**
 * An exchange rate from `base` to `quote`, i.e.:
 *   1 unit of `base` = `rate` units of `quote`
 */
export interface ExchangeRate {
  base:  CurrencyCode
  quote: CurrencyCode
  rate:  number
  date?: Date
}

export interface RateStore {
  /** Look up a rate. Returns undefined if not found. */
  getRate(from: CurrencyCode, to: CurrencyCode, date?: Date): ExchangeRate | undefined
}

// ---------------------------------------------------------------------------
// Simple in-memory rate store
// ---------------------------------------------------------------------------

export class InMemoryRateStore implements RateStore {
  private rates: ExchangeRate[] = []

  add(rate: ExchangeRate): void {
    this.rates.push(rate)
  }

  addMany(rates: ExchangeRate[]): void {
    this.rates.push(...rates)
  }

  getRate(from: CurrencyCode, to: CurrencyCode, _date?: Date): ExchangeRate | undefined {
    if (from === to) return { base: from, quote: to, rate: 1 }

    // Direct match
    const direct = this.rates.find((r) => r.base === from && r.quote === to)
    if (direct) return direct

    // Inverse
    const inverse = this.rates.find((r) => r.base === to && r.quote === from)
    if (inverse) return { base: from, quote: to, rate: 1 / inverse.rate, date: inverse.date }

    // Cross via GBP
    const toBase   = this.rates.find((r) => r.quote === from && r.base === "GBP") ??
                     this.rates.find((r) => r.base === from && r.quote === "GBP")
    const fromBase = this.rates.find((r) => r.base === "GBP"  && r.quote === to) ??
                     this.rates.find((r) => r.base === to      && r.quote === "GBP")

    if (toBase && fromBase) {
      const toGBP  = toBase.base === "GBP" ? 1 / toBase.rate : toBase.rate
      const gbpToTarget = fromBase.base === "GBP" ? fromBase.rate : 1 / fromBase.rate
      return { base: from, quote: to, rate: toGBP * gbpToTarget }
    }

    return undefined
  }
}

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

export interface ConversionResult {
  fromAmount:   number
  toAmount:     number
  fromCurrency: CurrencyCode
  toCurrency:   CurrencyCode
  rate:         number
}

export function convert(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  store: RateStore,
  date?: Date
): ConversionResult {
  if (from === to) {
    return { fromAmount: amount, toAmount: amount, fromCurrency: from, toCurrency: to, rate: 1 }
  }

  const rate = store.getRate(from, to, date)
  if (!rate) {
    throw new Error(`No exchange rate found for ${from} → ${to}`)
  }

  return {
    fromAmount:   amount,
    toAmount:     amount * rate.rate,
    fromCurrency: from,
    toCurrency:   to,
    rate:         rate.rate,
  }
}

// ---------------------------------------------------------------------------
// IAS 21 translation methods
// ---------------------------------------------------------------------------

export type TranslationMethod = "spot" | "average" | "closing"

/**
 * Translate a foreign-currency amount using a specific IAS 21 method.
 *
 * IAS 21 rules:
 *   - Monetary items (cash, receivables, payables): closing rate
 *   - Income/expenses: average rate for the period (or spot if practicable)
 *   - Non-monetary items at historical cost: spot rate at transaction date
 */
export interface TranslationInput {
  foreignAmount:  number
  foreignCurrency: CurrencyCode
  functionalCurrency: CurrencyCode
  method:         TranslationMethod
  spotRate?:      number  // when method = "spot"
  averageRate?:   number  // when method = "average"
  closingRate?:   number  // when method = "closing"
}

export interface TranslationResult {
  functionalAmount: number
  rateUsed:         number
  method:           TranslationMethod
}

export function translateAmount(input: TranslationInput): TranslationResult {
  const { foreignAmount, method, spotRate, averageRate, closingRate } = input

  let rateUsed: number
  if (method === "spot" && spotRate !== undefined) {
    rateUsed = spotRate
  } else if (method === "average" && averageRate !== undefined) {
    rateUsed = averageRate
  } else if (method === "closing" && closingRate !== undefined) {
    rateUsed = closingRate
  } else {
    throw new Error(`Rate not provided for translation method "${method}"`)
  }

  return {
    functionalAmount: foreignAmount * rateUsed,
    rateUsed,
    method,
  }
}

// ---------------------------------------------------------------------------
// Realised FX gain / loss
// ---------------------------------------------------------------------------

export interface RealisedFXInput {
  /** Foreign-currency amount of the transaction (e.g. invoice or bill) */
  foreignAmount:       number
  foreignCurrency:     CurrencyCode
  functionalCurrency:  CurrencyCode
  /** Rate at which the transaction was originally recognised */
  transactionRate:     number
  /** Rate at which settlement actually occurred */
  settlementRate:      number
  /** "receivable" = we receive payment; "payable" = we make payment */
  type: "receivable" | "payable"
}

export interface RealisedFXResult {
  /** Gain is positive, loss is negative (in functional currency) */
  gainLoss: number
  transactionValue:  number  // functional currency at transaction rate
  settlementValue:   number  // functional currency at settlement rate
}

export function computeRealisedFX(input: RealisedFXInput): RealisedFXResult {
  const {
    foreignAmount,
    transactionRate,
    settlementRate,
    type,
  } = input

  const transactionValue = foreignAmount * transactionRate
  const settlementValue  = foreignAmount * settlementRate
  const difference       = settlementValue - transactionValue

  // For receivables: higher settlement rate = gain (we received more)
  // For payables:    higher settlement rate = loss (we paid more)
  const gainLoss = type === "receivable" ? difference : -difference

  return { gainLoss, transactionValue, settlementValue }
}

// ---------------------------------------------------------------------------
// Unrealised FX gain / loss (retranslation at period-end)
// ---------------------------------------------------------------------------

export interface UnrealisedFXInput {
  /** Outstanding balance in foreign currency */
  foreignBalance:      number
  foreignCurrency:     CurrencyCode
  functionalCurrency:  CurrencyCode
  /** Rate at which the balance was last recognised / retranslated */
  previousRate:        number
  /** Current closing rate */
  closingRate:         number
  type: "asset" | "liability"
}

export interface UnrealisedFXResult {
  gainLoss: number
  previousFunctionalValue: number
  currentFunctionalValue:  number
}

export function computeUnrealisedFX(input: UnrealisedFXInput): UnrealisedFXResult {
  const { foreignBalance, previousRate, closingRate, type } = input

  const previousFunctionalValue = foreignBalance * previousRate
  const currentFunctionalValue  = foreignBalance * closingRate
  const difference              = currentFunctionalValue - previousFunctionalValue

  // For assets: higher closing rate = gain; for liabilities: higher closing rate = loss
  const gainLoss = type === "asset" ? difference : -difference

  return { gainLoss, previousFunctionalValue, currentFunctionalValue }
}

// ---------------------------------------------------------------------------
// Average rate calculation
// ---------------------------------------------------------------------------

export interface WeightedRateInput {
  transactions: Array<{ amount: number; rate: number }>
}

/** Compute the volume-weighted average exchange rate for a set of transactions. */
export function weightedAverageRate(input: WeightedRateInput): number {
  const { transactions } = input
  if (transactions.length === 0) return 0

  const totalAmount   = transactions.reduce((s, t) => s + t.amount, 0)
  if (totalAmount === 0) return 0

  const weightedSum   = transactions.reduce((s, t) => s + t.amount * t.rate, 0)
  return weightedSum / totalAmount
}

/** Simple arithmetic average rate for a period. */
export function simpleAverageRate(rates: number[]): number {
  if (rates.length === 0) return 0
  return rates.reduce((s, r) => s + r, 0) / rates.length
}

// ---------------------------------------------------------------------------
// Currency rounding
// ---------------------------------------------------------------------------

const CURRENCY_DECIMALS: Record<string, number> = {
  JPY: 0, KWD: 3, BHD: 3, OMR: 3, TND: 3,
}

export function roundToCurrency(amount: number, currency: CurrencyCode): number {
  const decimals = CURRENCY_DECIMALS[currency] ?? 2
  const factor   = Math.pow(10, decimals)
  return Math.round(amount * factor) / factor
}
