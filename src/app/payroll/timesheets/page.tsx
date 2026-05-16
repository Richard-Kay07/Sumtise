"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { trpc } from "@/lib/trpc-client"
import { Clock, CheckCircle, AlertCircle, Send, Plus, Loader2 } from "lucide-react"

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  APPROVED: "default",
  SUBMITTED: "secondary",
  DRAFT: "outline",
  REJECTED: "destructive",
}

export default function TimesheetsPage() {
  const [statusFilter, setStatusFilter] = useState("All")
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    employeeId: "",
    weekStartDate: "",
    weekEndDate: "",
    regularHours: "",
    overtimeHours: "0",
    notes: "",
  })

  const { data: orgs } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgs?.[0]?.id ?? ""

  const { data: empData } = trpc.payroll.employees.getAll.useQuery(
    { organizationId: orgId, status: "ACTIVE", page: 1, limit: 100 },
    { enabled: !!orgId }
  )
  const employees = empData?.employees ?? []

  const { data, isLoading, refetch } = trpc.payroll.timesheets.getAll.useQuery(
    { organizationId: orgId, status: statusFilter !== "All" ? (statusFilter as any) : undefined },
    { enabled: !!orgId }
  )
  const timesheets = data?.timesheets ?? []

  const create = trpc.payroll.timesheets.create.useMutation({
    onSuccess: () => {
      refetch()
      setShowCreate(false)
      setForm({ employeeId: "", weekStartDate: "", weekEndDate: "", regularHours: "", overtimeHours: "0", notes: "" })
    },
  })

  const submit = trpc.payroll.timesheets.submit.useMutation({ onSuccess: () => refetch() })
  const approve = trpc.payroll.timesheets.approve.useMutation({ onSuccess: () => refetch() })
  const reject = trpc.payroll.timesheets.reject.useMutation({ onSuccess: () => refetch() })

  const totalHours = timesheets.reduce((s, t) => s + Number(t.totalHours), 0)
  const totalOvertime = timesheets.reduce((s, t) => s + Number(t.overtimeHours), 0)
  const pendingCount = timesheets.filter((t) => t.status === "SUBMITTED").length
  const approvedCount = timesheets.filter((t) => t.status === "APPROVED").length

  const handleCreate = () => {
    if (!form.employeeId || !form.weekStartDate || !form.weekEndDate || !form.regularHours) return
    create.mutate({
      organizationId: orgId,
      employeeId: form.employeeId,
      weekStartDate: new Date(form.weekStartDate),
      weekEndDate: new Date(form.weekEndDate),
      regularHours: Number(form.regularHours),
      overtimeHours: Number(form.overtimeHours) || 0,
      notes: form.notes || undefined,
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#1A1D24" }}>Timesheets</h1>
            <p className="text-gray-600">Track hours worked and overtime</p>
          </div>
          <Button className="text-white" style={{ backgroundColor: "#50B0E0" }} onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Timesheet
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4 mb-6">
          {[
            { label: "Total Hours", value: `${totalHours.toFixed(1)}h`, icon: <Clock className="h-5 w-5" style={{ color: "#50B0E0" }} />, cls: "" },
            { label: "Overtime", value: `${totalOvertime.toFixed(1)}h`, icon: <Clock className="h-5 w-5 text-orange-600" />, cls: "text-orange-600" },
            { label: "Awaiting Approval", value: pendingCount, icon: <AlertCircle className="h-5 w-5 text-yellow-600" />, cls: "text-yellow-600" },
            { label: "Approved", value: approvedCount, icon: <CheckCircle className="h-5 w-5 text-green-600" />, cls: "text-green-600" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gray-100">{s.icon}</div>
                  <div>
                    <p className="text-sm text-gray-500">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.cls}`} style={!s.cls ? { color: "#1A1D24" } : {}}>{s.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-2 flex-wrap">
              {["All", "DRAFT", "SUBMITTED", "APPROVED", "REJECTED"].map((s) => (
                <Button
                  key={s}
                  variant={statusFilter === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(s)}
                  style={statusFilter === s ? { backgroundColor: "#50B0E0" } : {}}
                >
                  {s === "All" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Timesheets ({timesheets.length})</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
            ) : timesheets.length === 0 ? (
              <p className="text-center py-12 text-gray-500">No timesheets found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-4 font-medium text-gray-600">Employee</th>
                      <th className="text-left p-4 font-medium text-gray-600">Week</th>
                      <th className="text-left p-4 font-medium text-gray-600">Regular</th>
                      <th className="text-left p-4 font-medium text-gray-600">Overtime</th>
                      <th className="text-left p-4 font-medium text-gray-600">Total</th>
                      <th className="text-left p-4 font-medium text-gray-600">Status</th>
                      <th className="text-left p-4 font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timesheets.map((ts) => (
                      <tr key={ts.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="p-4 font-medium" style={{ color: "#1A1D24" }}>
                          {ts.employee.firstName} {ts.employee.lastName}
                          <div className="text-xs text-gray-400">{ts.employee.employeeNumber}</div>
                        </td>
                        <td className="p-4 text-sm text-gray-600">
                          {new Date(ts.weekStartDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          {" – "}
                          {new Date(ts.weekEndDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="p-4">{Number(ts.regularHours)}h</td>
                        <td className="p-4">
                          {Number(ts.overtimeHours) > 0 ? (
                            <span className="text-orange-600 font-medium">+{Number(ts.overtimeHours)}h</span>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="p-4 font-bold">{Number(ts.totalHours)}h</td>
                        <td className="p-4">
                          <Badge variant={STATUS_VARIANT[ts.status] ?? "outline"}>{ts.status}</Badge>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            {ts.status === "DRAFT" && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={submit.isPending}
                                onClick={() => submit.mutate({ organizationId: orgId, id: ts.id })}
                              >
                                <Send className="h-3 w-3 mr-1" />Submit
                              </Button>
                            )}
                            {ts.status === "SUBMITTED" && (
                              <>
                                <Button
                                  size="sm"
                                  className="text-white"
                                  style={{ backgroundColor: "#50B0E0" }}
                                  disabled={approve.isPending}
                                  onClick={() => approve.mutate({ organizationId: orgId, id: ts.id })}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-500"
                                  disabled={reject.isPending}
                                  onClick={() => reject.mutate({ organizationId: orgId, id: ts.id })}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Timesheet Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Timesheet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Employee</Label>
              <select
                value={form.employeeId}
                onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
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
                <Label>Week Start</Label>
                <Input type="date" className="mt-1" value={form.weekStartDate} onChange={(e) => setForm({ ...form, weekStartDate: e.target.value })} />
              </div>
              <div>
                <Label>Week End</Label>
                <Input type="date" className="mt-1" value={form.weekEndDate} onChange={(e) => setForm({ ...form, weekEndDate: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Regular Hours</Label>
                <Input type="number" min="0" step="0.5" className="mt-1" value={form.regularHours} onChange={(e) => setForm({ ...form, regularHours: e.target.value })} />
              </div>
              <div>
                <Label>Overtime Hours</Label>
                <Input type="number" min="0" step="0.5" className="mt-1" value={form.overtimeHours} onChange={(e) => setForm({ ...form, overtimeHours: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input className="mt-1" placeholder="Any notes…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            {create.error && <p className="text-sm text-red-500">{create.error.message}</p>}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button
                className="flex-1 text-white"
                style={{ backgroundColor: "#50B0E0" }}
                disabled={create.isPending}
                onClick={handleCreate}
              >
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
