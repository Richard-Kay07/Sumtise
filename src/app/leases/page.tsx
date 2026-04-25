"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { trpc } from "@/lib/trpc-client"
import { Plus, RefreshCw, ChevronRight } from "lucide-react"
import Link from "next/link"

const BRAND = "#50B0E0"

function statusBadge(status: string) {
  const map: Record<string, string> = {
    ACTIVE:       "bg-green-100 text-green-700",
    EXPIRED:      "bg-gray-100 text-gray-500",
    TERMINATED:   "bg-red-100 text-red-700",
    SHORT_TERM:   "bg-yellow-100 text-yellow-700",
    LOW_VALUE:    "bg-orange-100 text-orange-700",
  }
  return <Badge className={`text-xs ${map[status] ?? "bg-gray-100 text-gray-500"}`}>{status.replace(/_/g, " ")}</Badge>
}

export default function LeasesPage() {
  const { data: orgs } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgs?.[0]?.id ?? ""

  const [status,     setStatus]     = useState("")
  const [assetClass, setAssetClass] = useState("")

  const { data, isLoading } = trpc.leases.list.useQuery(
    {
      organizationId: orgId,
      status:         status     ? (status as any)     : undefined,
      assetClass:     assetClass ? (assetClass as any)  : undefined,
      page: 1, limit: 50,
    },
    { enabled: !!orgId }
  )

  const leases  = (data as any)?.leases ?? []
  const ZERO    = 0

  const totalROU      = leases.reduce((s: number, l: any) => s + Number(l.rouAsset?.currentCarryingAmount ?? l.presentValue ?? 0), 0)
  const totalLiab     = leases.reduce((s: number, l: any) => s + Number(l.currentLiability ?? 0) + Number(l.nonCurrentLiability ?? 0), 0)
  const activeCount   = leases.filter((l: any) => l.status === "ACTIVE").length
  const next12Payments = leases.reduce((s: number, l: any) => s + Number(l.annualPayment ?? 0), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex h-14 items-center justify-between">
          <h1 className="text-xl font-bold" style={{ color: "#1A1D24" }}>Lease Register</h1>
          <Link href="/leases/new">
            <Button className="rounded-xl text-xs gap-1" style={{ backgroundColor: BRAND }}>
              <Plus className="h-3 w-3" /> New lease
            </Button>
          </Link>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-7 space-y-5">
        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: "Total ROU Assets (NBV)",        value: `£${totalROU.toLocaleString()}` },
            { label: "Total Lease Liabilities",       value: `£${totalLiab.toLocaleString()}` },
            { label: "Active leases",                 value: activeCount.toString() },
            { label: "Cash payments due (12 months)", value: `£${next12Payments.toLocaleString()}` },
          ].map((c) => (
            <Card key={c.label} className="rounded-xl">
              <CardContent className="pt-5">
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className="text-2xl font-bold mt-1">{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select className="border rounded-xl h-8 text-xs px-3 bg-white" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {["ACTIVE", "EXPIRED", "TERMINATED", "SHORT_TERM", "LOW_VALUE"].map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
          <select className="border rounded-xl h-8 text-xs px-3 bg-white" value={assetClass} onChange={(e) => setAssetClass(e.target.value)}>
            <option value="">All asset classes</option>
            {["PROPERTY", "VEHICLES", "EQUIPMENT", "IT", "OTHER"].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <Card className="rounded-xl">
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="text-left px-4 py-3">Code</th>
                    <th className="text-left px-4 py-3">Description</th>
                    <th className="text-left px-4 py-3">Asset class</th>
                    <th className="text-left px-4 py-3">Treatment</th>
                    <th className="text-left px-4 py-3">Commenced</th>
                    <th className="text-left px-4 py-3">End date</th>
                    <th className="text-right px-4 py-3">ROU NBV</th>
                    <th className="text-right px-4 py-3">Liability</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? <tr><td colSpan={10} className="text-center py-10"><RefreshCw className="h-5 w-5 animate-spin mx-auto text-gray-400" /></td></tr>
                    : leases.length === 0
                      ? <tr><td colSpan={10} className="text-center py-10 text-gray-400 text-xs italic">No leases found.</td></tr>
                      : leases.map((l: any) => (
                        <tr key={l.id} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs">{l.leaseReference}</td>
                          <td className="px-4 py-3 font-medium">{l.description}</td>
                          <td className="px-4 py-3 text-xs text-gray-600">{l.assetClass}</td>
                          <td className="px-4 py-3 text-xs">
                            <Badge className="text-xs bg-blue-100 text-blue-700">{l.treatment?.replace(/_/g, " ")}</Badge>
                          </td>
                          <td className="px-4 py-3 text-xs">{l.commencementDate ? new Date(l.commencementDate).toLocaleDateString("en-GB") : "—"}</td>
                          <td className="px-4 py-3 text-xs">{l.endDate ? new Date(l.endDate).toLocaleDateString("en-GB") : "—"}</td>
                          <td className="px-4 py-3 text-right">£{Number(l.rouAsset?.currentCarryingAmount ?? l.presentValue ?? 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right">£{(Number(l.currentLiability ?? 0) + Number(l.nonCurrentLiability ?? 0)).toLocaleString()}</td>
                          <td className="px-4 py-3">{statusBadge(l.status)}</td>
                          <td className="px-4 py-3">
                            <Link href={`/leases/${l.id}`} className="text-[#50B0E0] text-xs hover:underline flex items-center gap-1">
                              View <ChevronRight className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
