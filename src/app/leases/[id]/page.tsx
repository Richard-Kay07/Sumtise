"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { trpc } from "@/lib/trpc-client"
import { RefreshCw, ChevronLeft, Copy, CheckCircle } from "lucide-react"

const BRAND = "#50B0E0"
const fmt   = (n: number) => `£${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtD  = (d: string | Date) => new Date(d).toLocaleDateString("en-GB")

export default function LeaseDetailPage({ params }: { params: { id: string } }) {
  const { data: orgs } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgs?.[0]?.id ?? ""

  const { data, isLoading, refetch } = trpc.leases.getById.useQuery(
    { organizationId: orgId, id: params.id },
    { enabled: !!orgId }
  )

  const runPosting = trpc.leases.runPeriodPosting.useMutation({ onSuccess: () => refetch() })
  const [postUntil, setPostUntil] = useState(new Date().toISOString().split("T")[0])
  const [copied,    setCopied]    = useState(false)

  const lease     = (data as any)?.lease
  const schedules = (data as any)?.schedules ?? []
  const journals  = (data as any)?.journals  ?? []
  const disclosure = (data as any)?.disclosure ?? ""
  const rou       = lease?.rouAsset

  const copyDisclosure = () => {
    navigator.clipboard.writeText(disclosure).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  if (isLoading || !lease) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex h-14 items-center gap-3">
          <a href="/leases" className="text-gray-400 hover:text-gray-600"><ChevronLeft className="h-5 w-5" /></a>
          <div>
            <h1 className="text-base font-bold leading-tight" style={{ color: "#1A1D24" }}>{lease.description}</h1>
            <p className="text-xs text-gray-500 font-mono">{lease.leaseReference}</p>
          </div>
          <Badge className="text-xs bg-green-100 text-green-700 ml-2">{lease.status}</Badge>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-7">
        <Tabs defaultValue="overview">
          <TabsList className="mb-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="schedule">Amortisation</TabsTrigger>
            <TabsTrigger value="rou">ROU Asset</TabsTrigger>
            <TabsTrigger value="journals">Journals</TabsTrigger>
            <TabsTrigger value="disclosure">Disclosure</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview">
            <div className="grid gap-5 lg:grid-cols-2">
              <Card className="rounded-xl">
                <CardHeader><CardTitle className="text-sm">Key Terms</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {[
                    ["Asset class",        lease.assetClass],
                    ["Treatment",          lease.treatment?.replace(/_/g, " ")],
                    ["Commencement",       fmtD(lease.commencementDate)],
                    ["End date",           lease.endDate ? fmtD(lease.endDate) : "—"],
                    ["Annual payment",     fmt(Number(lease.annualPayment ?? 0))],
                    ["Payment frequency",  lease.paymentFrequency],
                    ["IBR",                lease.incrementalBorrowingRate ? `${lease.incrementalBorrowingRate}%` : "—"],
                    ["Lessor",             lease.lessorName ?? "—"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b pb-1 last:border-b-0">
                      <span className="text-gray-500">{k}</span>
                      <span className="font-medium">{v}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="rounded-xl">
                <CardHeader><CardTitle className="text-sm">Carrying Amounts</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {[
                    ["Present value at inception",       fmt(Number(lease.presentValue ?? 0))],
                    ["ROU asset (carrying amount)",      fmt(Number(rou?.currentCarryingAmount ?? 0))],
                    ["Accumulated depreciation",         fmt(Number(rou?.accumulatedDepreciation ?? 0))],
                    ["Current lease liability",          fmt(Number(lease.currentLiability ?? 0))],
                    ["Non-current lease liability",      fmt(Number(lease.nonCurrentLiability ?? 0))],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b pb-1 last:border-b-0">
                      <span className="text-gray-500">{k}</span>
                      <span className="font-semibold">{v}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Amortisation schedule */}
          <TabsContent value="schedule">
            <Card className="rounded-xl">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-sm">Amortisation Schedule</CardTitle>
                <div className="flex gap-2 items-center">
                  <input type="date" className="border rounded-xl h-8 text-xs px-2 bg-white" value={postUntil} onChange={(e) => setPostUntil(e.target.value)} />
                  <Button className="rounded-xl text-xs h-8 gap-1" style={{ backgroundColor: BRAND }}
                    disabled={runPosting.isPending}
                    onClick={() => runPosting.mutate({ organizationId: orgId, leaseId: lease.id, periodEnd: new Date(postUntil) })}>
                    {runPosting.isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Run posting"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="text-left px-3 py-2">#</th>
                        <th className="text-left px-3 py-2">Payment date</th>
                        <th className="text-right px-3 py-2">Opening liability</th>
                        <th className="text-right px-3 py-2">Payment</th>
                        <th className="text-right px-3 py-2">Interest</th>
                        <th className="text-right px-3 py-2">Principal</th>
                        <th className="text-right px-3 py-2">Closing liability</th>
                        <th className="text-left px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedules.map((s: any) => {
                        const past = s.status === "POSTED"
                        return (
                          <tr key={s.id} className={`border-t ${past ? "text-gray-400" : ""}`}>
                            <td className="px-3 py-2">{s.periodNumber}</td>
                            <td className="px-3 py-2">{fmtD(s.paymentDate)}</td>
                            <td className="px-3 py-2 text-right">{fmt(Number(s.openingLiability ?? 0))}</td>
                            <td className="px-3 py-2 text-right">{fmt(Number(s.paymentAmount ?? 0))}</td>
                            <td className="px-3 py-2 text-right">{fmt(Number(s.interestCharge ?? 0))}</td>
                            <td className="px-3 py-2 text-right">{fmt(Number(s.principalRepayment ?? 0))}</td>
                            <td className="px-3 py-2 text-right font-medium">{fmt(Number(s.closingLiability ?? 0))}</td>
                            <td className="px-3 py-2">
                              <Badge className={`text-xs ${s.status === "POSTED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                                {s.status}
                              </Badge>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ROU Asset */}
          <TabsContent value="rou">
            <Card className="rounded-xl">
              <CardHeader><CardTitle className="text-sm">Right-of-Use Asset</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {rou ? (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: "Initial recognition",     value: fmt(Number(rou.initialRecognitionAmount ?? 0)) },
                        { label: "Accumulated depreciation", value: fmt(Number(rou.accumulatedDepreciation ?? 0)) },
                        { label: "Net book value",           value: fmt(Number(rou.currentCarryingAmount ?? 0)) },
                      ].map((c) => (
                        <Card key={c.label} className="rounded-xl">
                          <CardContent className="pt-4">
                            <p className="text-xs text-gray-500">{c.label}</p>
                            <p className="text-xl font-bold mt-1">{c.value}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 text-gray-500">
                          <tr>
                            <th className="text-left px-3 py-2">Period</th>
                            <th className="text-right px-3 py-2">Depreciation</th>
                            <th className="text-right px-3 py-2">Accumulated</th>
                            <th className="text-right px-3 py-2">NBV</th>
                            <th className="text-left px-3 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(rou.depreciationEntries ?? []).map((d: any, i: number) => (
                            <tr key={i} className={`border-t ${d.status === "POSTED" ? "text-gray-400" : ""}`}>
                              <td className="px-3 py-2">{fmtD(d.periodStart)} – {fmtD(d.periodEnd)}</td>
                              <td className="px-3 py-2 text-right">{fmt(Number(d.depreciationCharge ?? 0))}</td>
                              <td className="px-3 py-2 text-right">{fmt(Number(d.accumulatedDepreciation ?? 0))}</td>
                              <td className="px-3 py-2 text-right font-medium">{fmt(Number(d.closingBookValue ?? 0))}</td>
                              <td className="px-3 py-2"><Badge className={`text-xs ${d.status === "POSTED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{d.status}</Badge></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-400 italic">ROU asset not created (short-term or low-value exemption).</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Journals */}
          <TabsContent value="journals">
            <Card className="rounded-xl">
              <CardHeader><CardTitle className="text-sm">Journal Entries</CardTitle></CardHeader>
              <CardContent>
                {journals.length === 0
                  ? <p className="text-sm text-gray-400 italic">No journal entries yet.</p>
                  : journals.map((j: any, i: number) => (
                    <div key={i} className="mb-4 border rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-700">{j.reference} — {fmtD(j.date)}</span>
                        <Badge className="text-xs bg-blue-100 text-blue-700">{j.journalType}</Badge>
                      </div>
                      <table className="w-full text-xs">
                        <thead className="text-gray-500"><tr><th className="text-left py-1">Account</th><th className="text-right py-1">Debit</th><th className="text-right py-1">Credit</th></tr></thead>
                        <tbody>
                          {(j.lines ?? []).map((l: any, li: number) => (
                            <tr key={li} className="border-t">
                              <td className="py-1">{l.accountCode} — {l.accountName}</td>
                              <td className="text-right py-1">{l.debit > 0 ? fmt(Number(l.debit)) : ""}</td>
                              <td className="text-right py-1">{l.credit > 0 ? fmt(Number(l.credit)) : ""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))
                }
              </CardContent>
            </Card>
          </TabsContent>

          {/* Disclosure */}
          <TabsContent value="disclosure">
            <Card className="rounded-xl">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-sm">IFRS 16 / FRS 102 Disclosure Note</CardTitle>
                <Button variant="outline" className="h-8 rounded-xl text-xs gap-1" onClick={copyDisclosure}>
                  {copied ? <CheckCircle className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm font-mono bg-gray-50 rounded-xl p-4 text-gray-700 min-h-[200px]">
                  {disclosure || "Disclosure note not available."}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
