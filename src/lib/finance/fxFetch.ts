/**
 * Fetches daily FX rates from the European Central Bank (ECB) reference data.
 * Free, no API key required. Rates are quoted as EUR per 1 EUR (i.e., EUR is base).
 *
 * URL: https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml
 */

import { upsertRate } from "./fxDb"

interface EcbRate {
  currency: string
  rate: number
}

export async function fetchEcbRates(): Promise<EcbRate[]> {
  const res = await fetch(
    "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml",
    { next: { revalidate: 0 } }
  )
  if (!res.ok) throw new Error(`ECB fetch failed: ${res.status}`)

  const xml = await res.text()

  // Parse date
  const dateMatch = xml.match(/time='(\d{4}-\d{2}-\d{2})'/)
  const date = dateMatch ? new Date(dateMatch[1]) : new Date()

  // Parse rates: <Cube currency="USD" rate="1.0836"/>
  const rateMatches = xml.matchAll(/currency='([A-Z]{3})'\s+rate='([\d.]+)'/g)
  const rates: EcbRate[] = []

  for (const m of rateMatches) {
    rates.push({ currency: m[1], rate: parseFloat(m[2]) })
  }

  return rates.map(r => ({ ...r, date })) as any
}

/**
 * Fetch ECB rates and store them for an org.
 * ECB quotes all rates as "1 EUR = X currency", so:
 *   - EUR → USD rate = the ECB rate
 *   - USD → EUR rate = 1 / ECB rate
 * We store EUR as the base (fromCurrency=EUR).
 */
export async function syncEcbRates(orgId: string): Promise<{ count: number; date: Date }> {
  const res = await fetch(
    "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml",
    { cache: "no-store" }
  )
  if (!res.ok) throw new Error(`ECB fetch failed: ${res.status}`)

  const xml = await res.text()

  const dateMatch = xml.match(/time='(\d{4}-\d{2}-\d{2})'/)
  const date = dateMatch ? new Date(dateMatch[1]) : new Date()

  const rateMatches = [...xml.matchAll(/currency='([A-Z]{3})'\s+rate='([\d.]+)'/g)]

  let count = 0
  for (const m of rateMatches) {
    const currency = m[1]
    const rate = parseFloat(m[2])
    // EUR → currency
    await upsertRate(orgId, "EUR", currency, rate, date, "ECB")
    count++
  }

  // Also compute GBP-based cross rates since GBP is common functional currency
  const gbpRate = rateMatches.find(m => m[1] === "GBP")
  if (gbpRate) {
    const gbpPerEur = parseFloat(gbpRate[2])
    for (const m of rateMatches) {
      if (m[1] === "GBP") continue
      const ratePerEur = parseFloat(m[2])
      // GBP → currency = ratePerEur / gbpPerEur
      await upsertRate(orgId, "GBP", m[1], ratePerEur / gbpPerEur, date, "ECB")
      count++
    }
  }

  return { count, date }
}
