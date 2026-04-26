"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { trpc } from "@/lib/trpc-client"
import { BarChart3, CheckCircle, Loader2 } from "lucide-react"

const BRAND = "#50B0E0"
const fmt   = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const fmtPct = (n: number) => `${(n * 100).toFixed(2)}%`

export default function CorporationTaxPage() {
  const { data: orgs } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgs?.[0]?.id ?? ""

  const now = new Date()
  const [yearStart, setYearStart] = useState(`${now.getFullYear() - 1}-04-01`)
  const [yearEnd,   setYearEnd]   = useState(`${now.getFullYear()}-03-31`)
  const [capex,     setCapex]     = useState("")
  const [rdSpend,   setRdSpend]   = useState("")
  const [rdScheme,  setRdScheme]  = useState<"sme" | "rdec">("sme")
  const [submitted, setSubmitted] = useState(false)

  const { data: estimate, isLoading } = trpc.tax.getCorporationTaxEstimate.useQuery(
    {
      organizationId:       orgId,
      periodStart:          new Date(yearStart),
      periodEnd:            new Date(yearEnd),
      qualifyingCapex:      capex || undefined,
      qualifyingRandDSpend: rdSpend || undefined,
      randDScheme:          rdSpend ? rdScheme : undefined,
    },
    { enabled: !!orgId && !!yearStart && !!yearEnd }
  )

  const { data: submissions } = trpc.tax.listCorporationTaxSubmissions.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  )

  const submitMutation = trpc.tax.createCorporationTaxSubmission.useMutation({
    onSuccess: () => setSubmitted(true),
  })

  const ct   = estimate as any
  const subs = (submissions as any) ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 flex h-14 items-center">
          <BarChart3 className="h-5 w-5 mr-2" style={{ color: BRAND }} />
          <h1 className="text-xl font-bold" style={{ color: "#1A1D24" }}>Corporation Tax</h1>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Inputs */}
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Accounting Period</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Period Start</p>
              <Input type="date" value={yearStart} onChange={e => setYearStart(e.target.value)}
                className="h-8 text-sm rounded-xl w-40" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Period End</p>
              <Input type="date" value={yearEnd} onChange={e => setYearEnd(e.target.value)}
                className="h-8 text-sm rounded-xl w-40" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Qualifying Capex (£)</p>
              <Input type="number" placeholder="0" value={capex} onChange={e => setCapex(e.target.value)}
                className="h-8 text-sm rounded-xl w-36" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">R&D Spend (£)</p>
              <Input type="number" placeholder="0" value={rdSpend} onChange={e => setRdSpend(e.target.value)}
                className="h-8 text-sm rounded-xl w-36" />
            </div>
            {rdSpend && (
              <div>
                <p className="text-xs text-gray-500 mb-1">R&D Scheme</p>
                <select value={rdScheme} onChange={e => setRdScheme(e.target.value as any)}
                  className="h-8 px-2 text-sm rounded-xl border border-gray-200 bg-white">
                  <option value="sme">SME</option>
                  <option value="rdec">RDEC</option>
                </select>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-2 gap-5">
          {/* Estimate */}
          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">CT Estimate</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-300" /></div>
              ) : ct ? (
                <div className="space-y-2">
                  {[
                    { label: "Revenue",                      value: fmt(ct.revenue) },
                    { label: "Expenses",                     value: `(${fmt(ct.expenses)})` },
                    { label: "Gross Trading Profit",         value: fmt(Math.max(0, ct.tradingProfitGross)), bold: true },
                    { label: "Capital Allowances",           value: ct.capitalAllowances > 0 ? `(${fmt(ct.capitalAllowances)})` : "—" },
                    { label: "Chargeable Profits",           value: fmt(Math.max(0, ct.tradingProfitChargeable)), bold: true },
                    { label: "Rate Band",                    value: ct.rateBand ?? "—" },
                    { label: "Gross CT",                     value: fmt(ct.grossCT) },
                    { label: "Marginal Relief",              value: ct.marginalRelief > 0 ? `(${fmt(ct.marginalRelief)})` : "—" },
                    { label: "CT Liability",                 value: fmt(ct.ctLiability), bold: true, highlight: true },
                    { label: "Effective Rate",               value: fmtPct(ct.effectiveRate) },
                  ].map(row => (
                    <div key={row.label} className={`flex justify-between py-1.5 ${row.highlight ? "border-t-2 border-gray-200 pt-2 mt-1" : ""}`}>
                      <span className="text-sm text-gray-600">{row.label}</span>
                      <span className={`text-sm font-mono ${row.bold ? "font-semibold" : ""} ${row.highlight ? "text-red-600 text-base" : ""}`}>{row.value}</span>
                    </div>
                  ))}

                  {ct.rdRelief && (
                    <div className="mt-3 p-3 bg-purple-50 rounded-xl border border-purple-100">
                      <p className="text-xs font-medium text-purple-700 mb-1">R&D Relief</p>
                      {[
                        { label: "Enhanced Deduction", value: fmt(ct.rdRelief.enhancedDeductionGBP ?? 0) },
                        { label: "CT Saving",           value: fmt(ct.rdRelief.ctSavingGBP ?? 0) },
                      ].map(r => (
                        <div key={r.label} className="flex justify-between text-xs">
                          <span className="text-purple-600">{r.label}</span>
                          <span className="font-mono text-purple-700">{r.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {!submitted && (
                    <Button className="w-full mt-3 rounded-xl gap-2" style={{ backgroundColor: BRAND }}
                      disabled={submitMutation.isPending}
                      onClick={() => submitMutation.mutate({
                        organizationId: orgId,
                        periodStart: new Date(yearStart),
                        periodEnd: new Date(yearEnd),
                        totalAmount: String(ct.ctLiability),
                        data: { ...ct },
                      })}>
                      {submitMutation.isPending
                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Recording…</>
                        : <><CheckCircle className="h-4 w-4" /> Record Submission</>}
                    </Button>
                  )}
                  {submitted && (
                    <div className="mt-3 p-3 rounded-xl bg-green-50 border border-green-200 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-700">Submission recorded.</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-6">Enter period dates above to calculate.</p>
              )}
            </CardContent>
          </Card>

          {/* History */}
          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Submission History</CardTitle>
            </CardHeader>
            <CardContent>
              {subs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No submissions recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {subs.slice(0, 8).map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="text-xs font-medium">
                          {new Date(s.periodStart).toLocaleDateString("en-GB")} – {new Date(s.periodEnd).toLocaleDateString("en-GB")}
                        </p>
                        <p className="text-xs text-gray-400">{new Date(s.submissionDate).toLocaleDateString("en-GB")}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono">£{Number(s.totalAmount ?? 0).toLocaleString()}</p>
                        <Badge className="text-[10px] bg-green-100 text-green-700">{s.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
