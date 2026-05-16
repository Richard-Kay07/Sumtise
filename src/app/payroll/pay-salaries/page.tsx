"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { trpc } from "@/lib/trpc-client"
import { DollarSign, Users, Play, CheckCircle, Loader2, ChevronDown, Plus, UserPlus } from "lucide-react"

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

  const { data: empData } = trpc.payroll.employees.getAll.useQuery(
    { organizationId: orgId, status: "ACTIVE", page: 1, limit: 100 },
    { enabled: !!orgId }
  )
  const employees = empData?.employees ?? []

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [showNewRun, setShowNewRun] = useState(false)
  const [showAddEntry, setShowAddEntry] = useState(false)

  const [runForm, setRunForm] = useState({
    runNumber: "",
    payPeriodStart: "",
    payPeriodEnd: "",
    payDate: "",
    notes: "",
  })

  const [entryForm, setEntryForm] = useState({
    employeeId: "",
    grossPay: "",
    taxAmount: "",
    nationalInsurance: "",
    pensionEmployee: "",
    pensionEmployer: "",
    netPay: "",
  })

  const runs = data?.runs ?? []
  const activeRun = selectedRunId
    ? runs.find((r) => r.id === selectedRunId) ?? runs[0]
    : runs[0]

  const approve = trpc.payroll.runs.approve.useMutation({
    onSuccess: () => refetch(),
  })

  const createRun = trpc.payroll.runs.create.useMutation({
    onSuccess: (run) => {
      refetch()
      setShowNewRun(false)
      setSelectedRunId(run.id)
      setRunForm({ runNumber: "", payPeriodStart: "", payPeriodEnd: "", payDate: "", notes: "" })
    },
  })

  const addEntry = trpc.payroll.runs.addEntry.useMutation({
    onSuccess: () => {
      refetch()
      setShowAddEntry(false)
      setEntryForm({ employeeId: "", grossPay: "", taxAmount: "", nationalInsurance: "", pensionEmployee: "", pensionEmployer: "", netPay: "" })
    },
  })

  const handleCreateRun = () => {
    if (!runForm.runNumber || !runForm.payPeriodStart || !runForm.payPeriodEnd || !runForm.payDate) return
    createRun.mutate({
      organizationId: orgId,
      runNumber: runForm.runNumber,
      payPeriodStart: new Date(runForm.payPeriodStart),
      payPeriodEnd: new Date(runForm.payPeriodEnd),
      payDate: new Date(runForm.payDate),
      notes: runForm.notes || undefined,
    })
  }

  const handleAddEntry = () => {
    if (!activeRun || !entryForm.employeeId || !entryForm.grossPay) return
    addEntry.mutate({
      organizationId: orgId,
      payrollRunId: activeRun.id,
      employeeId: entryForm.employeeId,
      grossPay: Number(entryForm.grossPay),
      taxAmount: Number(entryForm.taxAmount) || 0,
      nationalInsurance: Number(entryForm.nationalInsurance) || 0,
      pensionEmployee: Number(entryForm.pensionEmployee) || 0,
      pensionEmployer: Number(entryForm.pensionEmployer) || 0,
      netPay: Number(entryForm.netPay) || Number(entryForm.grossPay) - Number(entryForm.taxAmount) - Number(entryForm.nationalInsurance) - Number(entryForm.pensionEmployee),
    })
  }

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
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#1A1D24" }}>Pay Salaries &amp; Wages</h1>
            <Button style={{ backgroundColor: "#50B0E0" }} className="text-white gap-2" onClick={() => setShowNewRun(true)}>
              <Plus className="h-4 w-4" />
              New Pay Run
            </Button>
          </div>
          <Card>
            <CardContent className="py-16 text-center text-gray-500">
              No payroll runs found.{" "}
              <button className="text-blue-500 underline" onClick={() => setShowNewRun(true)}>Create the first pay run</button>
            </CardContent>
          </Card>
        </div>

        <Dialog open={showNewRun} onOpenChange={setShowNewRun}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>New Pay Run</DialogTitle></DialogHeader>
            <NewRunForm form={runForm} setForm={setRunForm} onSubmit={handleCreateRun} onCancel={() => setShowNewRun(false)} isPending={createRun.isPending} error={createRun.error?.message} />
          </DialogContent>
        </Dialog>
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowNewRun(true)}>
              <Plus className="h-4 w-4 mr-1" />New Run
            </Button>
            {canApprove && (
              <Button
                style={{ backgroundColor: "#50B0E0" }}
                className="text-white gap-2"
                disabled={!canApprove || approve.isPending}
                onClick={() => approve.mutate({ organizationId: orgId, id: activeRun.id })}
              >
                {approve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Approve Pay Run
              </Button>
            )}
            {activeRun.status === "APPROVED" && (
              <Badge variant="default" className="px-3 py-2">
                <CheckCircle className="h-4 w-4 mr-1" />Approved
              </Badge>
            )}
          </div>
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
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Employee Pay Breakdown</CardTitle>
              {canApprove && (
                <Button size="sm" variant="outline" onClick={() => setShowAddEntry(true)}>
                  <UserPlus className="h-4 w-4 mr-1" />Add Entry
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No payroll entries yet.{" "}
                {canApprove && (
                  <button className="text-blue-500 underline" onClick={() => setShowAddEntry(true)}>Add the first entry</button>
                )}
              </div>
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

      {/* New Pay Run Modal */}
      <Dialog open={showNewRun} onOpenChange={setShowNewRun}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Pay Run</DialogTitle></DialogHeader>
          <NewRunForm
            form={runForm}
            setForm={setRunForm}
            onSubmit={handleCreateRun}
            onCancel={() => setShowNewRun(false)}
            isPending={createRun.isPending}
            error={createRun.error?.message}
          />
        </DialogContent>
      </Dialog>

      {/* Add Entry Modal */}
      <Dialog open={showAddEntry} onOpenChange={setShowAddEntry}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Payroll Entry</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Employee</Label>
              <select
                value={entryForm.employeeId}
                onChange={(e) => setEntryForm({ ...entryForm, employeeId: e.target.value })}
                className="w-full h-10 px-3 mt-1 border border-input bg-background rounded-md text-sm"
              >
                <option value="">Select employee…</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} ({emp.employeeNumber})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Gross Pay (£)</Label>
                <Input type="number" min="0" step="0.01" className="mt-1" value={entryForm.grossPay} onChange={(e) => setEntryForm({ ...entryForm, grossPay: e.target.value })} />
              </div>
              <div>
                <Label>PAYE Tax (£)</Label>
                <Input type="number" min="0" step="0.01" className="mt-1" value={entryForm.taxAmount} onChange={(e) => setEntryForm({ ...entryForm, taxAmount: e.target.value })} />
              </div>
              <div>
                <Label>NI (£)</Label>
                <Input type="number" min="0" step="0.01" className="mt-1" value={entryForm.nationalInsurance} onChange={(e) => setEntryForm({ ...entryForm, nationalInsurance: e.target.value })} />
              </div>
              <div>
                <Label>Pension Employee (£)</Label>
                <Input type="number" min="0" step="0.01" className="mt-1" value={entryForm.pensionEmployee} onChange={(e) => setEntryForm({ ...entryForm, pensionEmployee: e.target.value })} />
              </div>
              <div>
                <Label>Pension Employer (£)</Label>
                <Input type="number" min="0" step="0.01" className="mt-1" value={entryForm.pensionEmployer} onChange={(e) => setEntryForm({ ...entryForm, pensionEmployer: e.target.value })} />
              </div>
              <div>
                <Label>Net Pay (£)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1"
                  placeholder="Auto-calculated"
                  value={entryForm.netPay}
                  onChange={(e) => setEntryForm({ ...entryForm, netPay: e.target.value })}
                />
              </div>
            </div>
            {addEntry.error && <p className="text-sm text-red-500">{addEntry.error.message}</p>}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowAddEntry(false)}>Cancel</Button>
              <Button
                className="flex-1 text-white"
                style={{ backgroundColor: "#50B0E0" }}
                disabled={addEntry.isPending}
                onClick={handleAddEntry}
              >
                {addEntry.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Entry"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function NewRunForm({
  form,
  setForm,
  onSubmit,
  onCancel,
  isPending,
  error,
}: {
  form: any
  setForm: (f: any) => void
  onSubmit: () => void
  onCancel: () => void
  isPending: boolean
  error?: string
}) {
  return (
    <div className="space-y-4 mt-2">
      <div>
        <Label>Run Number</Label>
        <Input className="mt-1" placeholder="e.g. PAY-2026-05" value={form.runNumber} onChange={(e) => setForm({ ...form, runNumber: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Period Start</Label>
          <Input type="date" className="mt-1" value={form.payPeriodStart} onChange={(e) => setForm({ ...form, payPeriodStart: e.target.value })} />
        </div>
        <div>
          <Label>Period End</Label>
          <Input type="date" className="mt-1" value={form.payPeriodEnd} onChange={(e) => setForm({ ...form, payPeriodEnd: e.target.value })} />
        </div>
      </div>
      <div>
        <Label>Pay Date</Label>
        <Input type="date" className="mt-1" value={form.payDate} onChange={(e) => setForm({ ...form, payDate: e.target.value })} />
      </div>
      <div>
        <Label>Notes (optional)</Label>
        <Input className="mt-1" placeholder="Any notes…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-3 pt-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1 text-white" style={{ backgroundColor: "#50B0E0" }} disabled={isPending} onClick={onSubmit}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Run"}
        </Button>
      </div>
    </div>
  )
}
