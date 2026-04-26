"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc-client"
import { FileText, CheckCircle, Loader2 } from "lucide-react"

const BRAND = "#50B0E0"
const fmt = (n: number | string) =>
  `£${Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function quarterStart(q: number, year: number) {
  return new Date(year, (q - 1) * 3, 1)
}
function quarterEnd(q: number, year: number) {
  return new Date(year, q * 3, 0)
}

export default function VatMtdPage() {
  const { data: orgs } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgs?.[0]?.id ?? ""

  const now       = new Date()
  const yearStr   = now.getFullYear().toString()
  const [year,    setYear]   = useState(yearStr)
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3).toString())
  const [scheme,  setScheme]  = useState<"standard" | "cash" | "flat_rate">("standard")
  const [submitted, setSubmitted] = useState(false)

  const q   = parseInt(quarter)
  const y   = parseInt(year)
  const qs  = quarterStart(q, y)
  const qe  = quarterEnd(q, y)

  const { data: vatReturn, isLoading, refetch } = trpc.tax.getVATReturn.useQuery(
    { organizationId: orgId, periodStart: qs, periodEnd: qe, scheme },
    { enabled: !!orgId }
  )

  const { data: submissions } = trpc.tax.listVATSubmissions.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  )

  const submitMutation = trpc.tax.createVATSubmission.useMutation({
    onSuccess: () => { setSubmitted(true); refetch() },
  })

  const vat      = vatReturn as any
  const subs     = (submissions as any) ?? []
  const boxItems = vat ? [
    { box: "Box 1", desc: "VAT due on sales",          value: fmt(vat.box1OutputVAT), highlight: false },
    { box: "Box 2", desc: "VAT due on acquisitions",    value: fmt(vat.box2),          highlight: false },
    { box: "Box 3", desc: "Total VAT due",              value: fmt(vat.box3TotalDue),  highlight: false },
    { box: "Box 4", desc: "VAT reclaimed on purchases", value: fmt(vat.box4InputVAT),  highlight: false },
    { box: "Box 5", desc: "Net VAT payable/repayable",  value: fmt(vat.box5NetVAT),    highlight: true  },
    { box: "Box 6", desc: "Total value of sales (net)", value: fmt(vat.box6SalesNet),  highlight: false },
    { box: "Box 7", desc: "Total purchases (net)",      value: fmt(vat.box7PurchasesNet), highlight: false },
  ] : []

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 flex h-14 items-center">
          <FileText className="h-5 w-5 mr-2" style={{ color: BRAND }} />
          <h1 className="text-xl font-bold" style={{ color: "#1A1D24" }}>VAT Return (MTD)</h1>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Controls */}
        <Card className="rounded-xl">
          <CardContent className="pt-5 flex flex-wrap items-end gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Year</p>
              <select value={year} onChange={e => setYear(e.target.value)}
                className="h-8 px-2 text-sm rounded-xl border border-gray-200 bg-white">
                {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Quarter</p>
              <select value={quarter} onChange={e => setQuarter(e.target.value)}
                className="h-8 px-2 text-sm rounded-xl border border-gray-200 bg-white">
                {["1", "2", "3", "4"].map(q => (
                  <option key={q} value={q}>Q{q}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Scheme</p>
              <select value={scheme} onChange={e => setScheme(e.target.value as any)}
                className="h-8 px-2 text-sm rounded-xl border border-gray-200 bg-white">
                <option value="standard">Standard</option>
                <option value="cash">Cash Accounting</option>
                <option value="flat_rate">Flat Rate</option>
              </select>
            </div>
            <div className="text-xs text-gray-400 pb-1">
              {qs.toLocaleDateString("en-GB")} – {qe.toLocaleDateString("en-GB")}
              {vat && <span className="ml-2 text-gray-400">({vat.transactionsAnalysed} transactions)</span>}
            </div>
          </CardContent>
        </Card>

        {/* VAT boxes */}
        <div className="grid lg:grid-cols-2 gap-5">
          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">VAT Return — Q{quarter} {year}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-300" /></div>
              ) : (
                <div className="space-y-2">
                  {boxItems.map(item => (
                    <div key={item.box} className={`flex justify-between items-center py-2 px-3 rounded-lg ${item.highlight ? "bg-blue-50 border border-blue-100" : "hover:bg-gray-50"}`}>
                      <div>
                        <span className="font-semibold text-xs mr-2" style={{ color: BRAND }}>{item.box}</span>
                        <span className="text-sm text-gray-600">{item.desc}</span>
                      </div>
                      <span className={`font-mono text-sm font-semibold ${item.highlight ? (vat?.isRepayment ? "text-green-600" : "text-red-600") : ""}`}>
                        {item.value}
                      </span>
                    </div>
                  ))}

                  {vat && (
                    <div className="mt-4 pt-3 border-t flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {vat.isRepayment ? "HMRC owes you" : "You owe HMRC"}
                      </span>
                      <span className={`text-lg font-bold ${vat.isRepayment ? "text-green-600" : "text-red-600"}`}>
                        {fmt(vat.box5NetVAT)}
                      </span>
                    </div>
                  )}

                  {vat && !submitted && (
                    <Button
                      className="w-full mt-4 rounded-xl gap-2"
                      style={{ backgroundColor: BRAND }}
                      disabled={submitMutation.isPending}
                      onClick={() => submitMutation.mutate({
                        organizationId: orgId,
                        periodStart: qs,
                        periodEnd: qe,
                        totalAmount: String(vat.box5NetVAT),
                        data: { ...vat },
                      })}
                    >
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
              )}
            </CardContent>
          </Card>

          {/* Submission history */}
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
                        <p className="text-xs font-medium">{new Date(s.periodStart).toLocaleDateString("en-GB")} – {new Date(s.periodEnd).toLocaleDateString("en-GB")}</p>
                        <p className="text-xs text-gray-400">{s.reference ?? "No ref"} · {new Date(s.submissionDate).toLocaleDateString("en-GB")}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono">{fmt(Number(s.totalAmount ?? 0))}</p>
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
