"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { trpc } from "@/lib/trpc-client"
import { Shield, Plus, CheckCircle, Loader2 } from "lucide-react"

const BRAND = "#50B0E0"

export default function PensionSubmissionPage() {
  const { data: orgs } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgs?.[0]?.id ?? ""

  const [showForm,    setShowForm]    = useState(false)
  const [periodStart, setPeriodStart] = useState("")
  const [periodEnd,   setPeriodEnd]   = useState("")
  const [totalAmount, setTotalAmount] = useState("")
  const [reference,   setReference]   = useState("")
  const [empCount,    setEmpCount]    = useState("")

  const { data: subs, refetch } = trpc.tax.listAllSubmissions.useQuery(
    { organizationId: orgId, type: "OTHER" },
    { enabled: !!orgId }
  )

  const submitMutation = trpc.tax.createRTISubmission.useMutation({
    onSuccess: () => {
      setShowForm(false)
      setPeriodStart(""); setPeriodEnd(""); setTotalAmount(""); setReference(""); setEmpCount("")
      refetch()
    },
  })

  // Filter for pension submissions (stored with type OTHER and reference containing "PENSION")
  const all         = (subs as any[]) ?? []
  const pensionSubs = all.filter(s => s.reference?.toUpperCase().includes("PENSION") || s.submissionType === "OTHER")
  const totalPension = pensionSubs.reduce((sum, s) => sum + Number(s.totalAmount ?? 0), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" style={{ color: BRAND }} />
            <h1 className="text-xl font-bold" style={{ color: "#1A1D24" }}>Pension Submissions</h1>
          </div>
          <Button className="rounded-xl text-xs gap-1" style={{ backgroundColor: BRAND }}
            onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5" /> Record Submission
          </Button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Total Submissions",      value: pensionSubs.length.toString() },
            { label: "Total Pension Submitted", value: `£${totalPension.toLocaleString("en-GB", { minimumFractionDigits: 2 })}` },
            { label: "Auto-Enrolment Status",  value: "Active" },
          ].map(c => (
            <Card key={c.label} className="rounded-xl">
              <CardContent className="pt-5">
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className="text-2xl font-bold mt-1">{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {showForm && (
          <Card className="rounded-xl border-blue-200 bg-blue-50/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Record Pension Submission</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Total Contribution (£)</p>
                  <Input type="number" placeholder="0.00" value={totalAmount}
                    onChange={e => setTotalAmount(e.target.value)}
                    className="h-8 text-sm rounded-xl" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Pension Provider Ref.</p>
                  <Input placeholder="PENSION-2024-01" value={reference}
                    onChange={e => setReference(e.target.value)}
                    className="h-8 text-sm rounded-xl" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Period Start</p>
                  <Input type="date" value={periodStart}
                    onChange={e => setPeriodStart(e.target.value)}
                    className="h-8 text-sm rounded-xl" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Period End</p>
                  <Input type="date" value={periodEnd}
                    onChange={e => setPeriodEnd(e.target.value)}
                    className="h-8 text-sm rounded-xl" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Employee Count</p>
                  <Input type="number" placeholder="0" value={empCount}
                    onChange={e => setEmpCount(e.target.value)}
                    className="h-8 text-sm rounded-xl" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button className="rounded-xl text-xs gap-1.5" style={{ backgroundColor: BRAND }}
                  disabled={!periodStart || !periodEnd || !totalAmount || submitMutation.isPending}
                  onClick={() => submitMutation.mutate({
                    organizationId: orgId,
                    submissionType: "RTI_NI",
                    periodStart: new Date(periodStart),
                    periodEnd: new Date(periodEnd),
                    totalAmount,
                    reference: reference ? `PENSION-${reference}` : "PENSION",
                    employeeCount: empCount ? parseInt(empCount) : undefined,
                  })}>
                  {submitMutation.isPending
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                    : <><CheckCircle className="h-3.5 w-3.5" /> Save Submission</>}
                </Button>
                <Button variant="outline" className="rounded-xl text-xs" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="rounded-xl overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Submission History</CardTitle>
          </CardHeader>
          {pensionSubs.length === 0 ? (
            <CardContent className="py-8 text-center">
              <p className="text-sm text-gray-400">No pension submissions recorded yet.</p>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-left text-xs text-gray-500">
                    <th className="px-4 py-3">Period</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3 text-center">Employees</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pensionSubs.map((s: any) => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(s.periodStart).toLocaleDateString("en-GB")} – {new Date(s.periodEnd).toLocaleDateString("en-GB")}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{s.reference ?? "—"}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{s.employeeCount ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono">£{Number(s.totalAmount ?? 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{new Date(s.submissionDate).toLocaleDateString("en-GB")}</td>
                      <td className="px-4 py-3">
                        <Badge className="text-xs bg-green-100 text-green-700">{s.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </div>
  )
}
