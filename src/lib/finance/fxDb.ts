/**
 * Database-backed FX rate lookup.
 *
 * Resolves exchange rates from the fx_rates table with the following fallback chain:
 *   1. Direct rate (fromCurrency → toCurrency) on or before the target date
 *   2. Inverse rate (toCurrency → fromCurrency) and reciprocal
 *   3. Cross-rate via functional currency (from → FC → to)
 */

import { prisma } from "@/lib/prisma"

export interface ResolvedRate {
  rate: number
  date: Date
  source: string
}

async function directLookup(
  orgId: string,
  from: string,
  to: string,
  date: Date
): Promise<ResolvedRate | null> {
  const row = await prisma.fxRate.findFirst({
    where: {
      orgId,
      fromCurrency: from,
      toCurrency: to,
      date: { lte: date },
    },
    orderBy: { date: "desc" },
  })
  if (!row) return null
  return { rate: Number(row.rate), date: row.date, source: row.source }
}

/**
 * Resolve an exchange rate for `from → to` on or before `date`.
 * Returns 1 when from === to.
 * Returns null when no rate can be found.
 */
export async function resolveRate(
  orgId: string,
  from: string,
  to: string,
  date: Date
): Promise<ResolvedRate | null> {
  if (from === to) return { rate: 1, date, source: "IDENTITY" }

  // 1. Direct
  const direct = await directLookup(orgId, from, to, date)
  if (direct) return direct

  // 2. Inverse
  const inverse = await directLookup(orgId, to, from, date)
  if (inverse) return { rate: 1 / inverse.rate, date: inverse.date, source: inverse.source }

  // 3. Cross via GBP (functional default)
  const pivot = "GBP"
  if (from !== pivot && to !== pivot) {
    const fromPivot = await directLookup(orgId, from, pivot, date)
    const pivotTo = await directLookup(orgId, pivot, to, date)
    if (fromPivot && pivotTo) {
      return {
        rate: fromPivot.rate * pivotTo.rate,
        date: fromPivot.date > pivotTo.date ? fromPivot.date : pivotTo.date,
        source: "CROSS",
      }
    }
    // Try inverse pivots
    const pivotFrom = await directLookup(orgId, pivot, from, date)
    const toInverse = await directLookup(orgId, to, pivot, date)
    if (pivotFrom && toInverse) {
      return {
        rate: (1 / pivotFrom.rate) * (1 / toInverse.rate),
        date: pivotFrom.date > toInverse.date ? pivotFrom.date : toInverse.date,
        source: "CROSS",
      }
    }
  }

  return null
}

/**
 * Upsert a rate — used by ECB fetcher and manual entry.
 */
export async function upsertRate(
  orgId: string,
  fromCurrency: string,
  toCurrency: string,
  rate: number,
  date: Date,
  source: "MANUAL" | "ECB" | "AUTO" = "MANUAL"
) {
  const dateOnly = new Date(date)
  dateOnly.setUTCHours(0, 0, 0, 0)

  return prisma.fxRate.upsert({
    where: { orgId_fromCurrency_toCurrency_date: { orgId, fromCurrency, toCurrency, date: dateOnly } },
    update: { rate, source, updatedAt: new Date() },
    create: { orgId, fromCurrency, toCurrency, rate, date: dateOnly, source },
  })
}
