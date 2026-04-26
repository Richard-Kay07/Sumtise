"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc-client"
import { Receipt, ChevronRight } from "lucide-react"
import Link from "next/link"

const BRAND = "#50B0E0"

const TYPE_LABELS: Record<string, string> = {
  VAT_RETURN:       "VAT Return",
  CORPORATION_TAX:  "Corporation Tax",
  RTI_PAYE:         "RTI PAYE",
  RTI_NI:           "RTI / NI",
  OTHER:            "Other",
}

const TYPE_COLORS: Record<string, string> = {
  VAT_RETURN:       "bg-blue-100 text-blue-700",
  CORPORATION_TAX:  "bg-purple-100 text-purple-700",
  RTI_PAYE:         "bg-green-100 text-green-700",
  RTI_NI:           "bg-teal-100 text-teal-700",
  OTHER:            "bg-gray-100 text-gray-500",
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:     "bg-gray-100 text-gray-500",
  SUBMITTED: "bg-blue-100 text-blue-700",
  ACCEPTED:  "bg-green-100 text-green-700",
  REJECTED:  "bg-red-100 text-red-700",
  AMENDED:   "bg-yellow-100 text-yellow-700",
}

export default function TaxesSubmissionPage() {
  const { data: orgs } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgs?.[0]?.id ?? ""

  const [typeFilter, setTypeFilter] = useState("")

  const { data: subs } = trpc.tax.listAllSubmissions.useQuery(
    {
      organizationId: orgId,
      type: typeFilter ? (typeFilter as any) : undefined,
    },
    { enabled: !!orgId }
  )

  const submissions = (subs as any[]) ?? []
  const totalAmount = submissions.reduce((s, sub) => s + Number(sub.totalAmount ?? 0), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 flex h-14 items-center">
          <Receipt className="h-5 w-5 mr-2" style={{ color: BRAND }} />
          <h1 className="text-xl font-bold" style={{ color: "#1A1D24" }}>Tax Submissions</h1>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Total Submissions",  value: submissions.length.toString() },
            { label: "Total Tax Submitted", value: `£${totalAmount.toLocaleString("en-GB", { minimumFractionDigits: 0 })}` },
            { label: "This Year",          value: submissions.filter(s => new Date(s.submissionDate).getFullYear() === new Date().getFullYear()).length.toString() },
          ].map(c => (
            <Card key={c.label} className="rounded-xl">
              <CardContent className="pt-5">
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className="text-2xl font-bold mt-1">{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick links */}
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { label: "Submit VAT Return", href: "/tax/vat-mtd", icon: "📋" },
            { label: "Submit Corporation Tax", href: "/tax/corporation-tax", icon: "🏢" },
            { label: "Submit RTI / PAYE", href: "/payroll/rti-submission", icon: "👥" },
          ].map(l => (
            <Link key={l.href} href={l.href}>
              <Card className="rounded-xl cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="pt-4 pb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{l.icon}</span>
                    <span className="text-sm font-medium text-gray-700">{l.label}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Filter + table */}
        <div className="flex flex-wrap gap-2">
          {(["", "VAT_RETURN", "CORPORATION_TAX", "RTI_PAYE", "RTI_NI"] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                typeFilter === t ? "text-white border-transparent" : "text-gray-600 border-gray-200 hover:border-gray-300"
              }`} style={typeFilter === t ? { backgroundColor: BRAND, borderColor: BRAND } : {}}>
              {t ? TYPE_LABELS[t] : "All"}
            </button>
          ))}
        </div>

        <Card className="rounded-xl overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">All Submissions</CardTitle>
          </CardHeader>
          {submissions.length === 0 ? (
            <CardContent className="py-8 text-center">
              <p className="text-sm text-gray-400">No tax submissions recorded yet.</p>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-left text-xs text-gray-500">
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Period</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s: any) => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${TYPE_COLORS[s.submissionType] ?? "bg-gray-100 text-gray-500"}`}>
                          {TYPE_LABELS[s.submissionType] ?? s.submissionType}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(s.periodStart).toLocaleDateString("en-GB")} – {new Date(s.periodEnd).toLocaleDateString("en-GB")}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{s.reference ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono">£{Number(s.totalAmount ?? 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{new Date(s.submissionDate).toLocaleDateString("en-GB")}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${STATUS_COLORS[s.status] ?? "bg-gray-100 text-gray-500"}`}>{s.status}</Badge>
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
