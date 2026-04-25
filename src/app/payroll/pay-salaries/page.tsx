"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc-client"
import { DollarSign, Users, Play, CheckCircle, Loader2, ChevronDown } from "lucide-react"

function fmt(n: number) {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  DRAFT: "secondary",
  PENDING_APPROVAL: "secondary",
  APPROVED: "default",
  PROCESSED: "default",
  CANCELLED: "outline",
}

export default function PaySalariesPage() {
  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = organizations?.[0]?.id ?? ""

  const { data, isLoading, refetch } = trpc.payroll.runs.getAll.useQuery(
    { organizationId: orgId, page: 1, limit: 20 },
    { enabled: !!orgId }
  )

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  const runs = data?.runs ?? []
  const activeRun = selectedRunId
    ? runs.find((r) => r.id === selectedRunId) ?? runs[0]
    : runs[0]

  const approve = trpc.payroll.runs.approve.useMutation({
    onSuccess: () => refetch(),
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!activeRun) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-6 px-4">
          <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: "#1A1D24" }}>Pay Salaries &amp; Wages</h1>
          <Card>
            <CardContent className="py-16 text-center text-gray-500">
              No payroll runs found. Create a payroll run first.
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const entries = activeRun.entries ?? []
  const totalGross = Number(activeRun.totalGross)
  const totalDeductions = Number(activeRun.totalDeductions)
  const totalNet = Number(activeRun.totalNet)
  const canApprove = activeRun.status === "DRAFT" || activeRun.status === "PENDING_APPROVAL"

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#1A1D24" }}>Pay Salaries &amp; Wages</h1>
            <div className="flex items-center gap-2 mt-1">
              {runs.length > 1 ? (
                <div className="relative">
                  <select
                    className="text-sm text-gray-500 border rounded px-2 py-1 pr-6 appearance-none bg-white"
                    value={activeRun.id}
                    onChange={(e) => setSelectedRunId(e.target.value)}
                  >
                    {runs.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.runNumber} — {new Date(r.payDate).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-1 top-1.5 h-3 w-3 text-gray-400 pointer-events-none" />
                </div>
              ) : (
                <span className="text-sm text-gray-500">
                  {activeRun.runNumber} — {new Date(activeRun.payDate).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
                </span>
              )}
              <Badge variant={STATUS_VARIANT[activeRun.status] ?? "outline"}>{activeRun.status.replace("_", " ")}</Badge>
            </div>
          </div>
          <Button
            style={{ backgroundColor: "#50B0E0" }}
            className="text-white gap-2"
            disabled={!canApprove || approve.isPending}
            onClick={() => approve.mutate({ organizationId: orgId, id: activeRun.id })}
          >
            {approve.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {activeRun.status === "APPROVED" ? "Approved" : "Approve Pay Run"}
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-4 mb-6">
          {[
            { label: "Employees", value: activeRun.employeeCount, icon: <Users className="h-5 w-5 text-gray-400" /> },
            { label: "Total Gross", value: fmt(totalGross), icon: <DollarSign className="h-5 w-5 text-gray-400" /> },
            { label: "Total Deductions", value: fmt(totalDeductions), icon: <DollarSign className="h-5 w-5 text-gray-400" /> },
            { label: "Total Net Pay", value: fmt(totalNet), icon: <CheckCircle className="h-5 w-5 text-green-500" /> },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  {s.icon}
                  <div>
                    <p className="text-xs text-gray-500">{s.label}</p>
                    <p className="text-xl font-bold">{s.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle>Employee Pay Breakdown</CardTitle></CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <p className="text-center py-8 text-gray-500 text-sm">No payroll entries in this run yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="text-left py-3 px-4">Employee</th>
                      <th className="text-right py-3 px-4">Gross</th>
                      <th className="text-right py-3 px-4">PAYE</th>
                      <th className="text-right py-3 px-4">NI</th>
                      <th className="text-right py-3 px-4">Pension</th>
                      <th className="text-right py-3 px-4">Net Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="font-medium">{e.employee.firstName} {e.employee.lastName}</div>
                          <div className="text-xs text-gray-400">{e.employee.employeeNumber}</div>
                        </td>
                        <td className="text-right py-3 px-4">{fmt(Number(e.grossPay))}</td>
                        <td className="text-right py-3 px-4 text-red-500">{fmt(Number(e.taxAmount))}</td>
                        <td className="text-right py-3 px-4 text-red-500">{fmt(Number(e.nationalInsurance))}</td>
                        <td className="text-right py-3 px-4 text-orange-500">{fmt(Number(e.pensionEmployee))}</td>
                        <td className="text-right py-3 px-4 font-bold text-green-600">{fmt(Number(e.netPay))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-bold">
                      <td className="py-3 px-4">Total ({entries.length})</td>
                      <td className="text-right py-3 px-4">{fmt(totalGross)}</td>
                      <td className="text-right py-3 px-4 text-red-500">{fmt(entries.reduce((s, e) => s + Number(e.taxAmount), 0))}</td>
                      <td className="text-right py-3 px-4 text-red-500">{fmt(entries.reduce((s, e) => s + Number(e.nationalInsurance), 0))}</td>
                      <td className="text-right py-3 px-4 text-orange-500">{fmt(entries.reduce((s, e) => s + Number(e.pensionEmployee), 0))}</td>
                      <td className="text-right py-3 px-4 text-green-600">{fmt(totalNet)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        {approve.error && (
          <p className="mt-3 text-sm text-red-500 text-center">{approve.error.message}</p>
        )}
      </div>
    </div>
  )
}
