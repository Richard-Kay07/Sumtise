"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { trpc } from "@/lib/trpc-client"
import { Calendar, Plus, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react"

const LEAVE_TYPE_LABELS: Record<string, string> = {
  ANNUAL: "Annual Leave",
  SICK: "Sick Leave",
  MATERNITY: "Maternity Leave",
  PATERNITY: "Paternity Leave",
  UNPAID: "Unpaid Leave",
  OTHER: "Other",
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  APPROVED: "default",
  PENDING: "secondary",
  REJECTED: "destructive",
  CANCELLED: "outline",
}

function StatusIcon({ status }: { status: string }) {
  if (status === "APPROVED") return <CheckCircle className="h-4 w-4 text-green-600" />
  if (status === "PENDING") return <Clock className="h-4 w-4 text-yellow-600" />
  if (status === "REJECTED") return <XCircle className="h-4 w-4 text-red-600" />
  return null
}

export default function LeavePage() {
  const [statusFilter, setStatusFilter] = useState<string>("All")
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    employeeId: "",
    leaveType: "ANNUAL",
    startDate: "",
    endDate: "",
    daysRequested: "",
    reason: "",
  })
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const { data: orgs } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgs?.[0]?.id ?? ""

  const { data: empData } = trpc.payroll.employees.getAll.useQuery(
    { organizationId: orgId, status: "ACTIVE", page: 1, limit: 100 },
    { enabled: !!orgId }
  )
  const employees = empData?.employees ?? []

  const { data, isLoading, refetch } = trpc.payroll.leave.getAll.useQuery(
    { organizationId: orgId, status: statusFilter !== "All" ? (statusFilter as any) : undefined },
    { enabled: !!orgId }
  )
  const leaves = data?.leaves ?? []

  const utils = trpc.useUtils()

  const create = trpc.payroll.leave.create.useMutation({
    onSuccess: () => {
      refetch()
      setShowModal(false)
      setForm({ employeeId: "", leaveType: "ANNUAL", startDate: "", endDate: "", daysRequested: "", reason: "" })
    },
  })

  const approve = trpc.payroll.leave.approve.useMutation({
    onSuccess: () => refetch(),
  })

  const reject = trpc.payroll.leave.reject.useMutation({
    onSuccess: () => {
      refetch()
      setRejectId(null)
      setRejectReason("")
    },
  })

  const handleSubmit = () => {
    if (!form.employeeId || !form.startDate || !form.endDate || !form.daysRequested) return
    create.mutate({
      organizationId: orgId,
      employeeId: form.employeeId,
      leaveType: form.leaveType as any,
      startDate: new Date(form.startDate),
      endDate: new Date(form.endDate),
      daysRequested: Number(form.daysRequested),
      reason: form.reason || undefined,
    })
  }

  const pendingCount = leaves.filter((l) => l.status === "PENDING").length
  const approvedCount = leaves.filter((l) => l.status === "APPROVED").length
  const rejectedCount = leaves.filter((l) => l.status === "REJECTED").length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#1A1D24" }}>Leave Management</h1>
            <p className="text-gray-600">Track and manage employee leave requests</p>
          </div>
          <Button style={{ backgroundColor: "#50B0E0" }} className="text-white" onClick={() => setShowModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Request Leave
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4 mb-6">
          {[
            { label: "Total Requests", value: leaves.length, icon: <Calendar className="h-5 w-5" style={{ color: "#50B0E0" }} />, bg: "#50B0E020", color: "" },
            { label: "Pending", value: pendingCount, icon: <Clock className="h-5 w-5 text-yellow-600" />, bg: "bg-yellow-50", color: "text-yellow-600" },
            { label: "Approved", value: approvedCount, icon: <CheckCircle className="h-5 w-5 text-green-600" />, bg: "bg-green-50", color: "text-green-600" },
            { label: "Rejected", value: rejectedCount, icon: <XCircle className="h-5 w-5 text-red-600" />, bg: "bg-red-50", color: "text-red-600" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${s.bg}`}>{s.icon}</div>
                  <div>
                    <p className="text-sm text-gray-500">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.color}`} style={!s.color ? { color: "#1A1D24" } : {}}>{s.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-2 flex-wrap">
              {["All", "PENDING", "APPROVED", "REJECTED", "CANCELLED"].map((s) => (
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
          <CardHeader>
            <CardTitle>Leave Requests ({leaves.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
            ) : leaves.length === 0 ? (
              <p className="text-center py-12 text-gray-500">No leave requests found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-4 font-medium text-gray-600">Employee</th>
                      <th className="text-left p-4 font-medium text-gray-600">Type</th>
                      <th className="text-left p-4 font-medium text-gray-600">Start</th>
                      <th className="text-left p-4 font-medium text-gray-600">End</th>
                      <th className="text-left p-4 font-medium text-gray-600">Days</th>
                      <th className="text-left p-4 font-medium text-gray-600">Status</th>
                      <th className="text-left p-4 font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.map((leave) => (
                      <tr key={leave.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="p-4 font-medium" style={{ color: "#1A1D24" }}>
                          {leave.employee.firstName} {leave.employee.lastName}
                          <div className="text-xs text-gray-400">{leave.employee.employeeNumber}</div>
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-1 rounded text-sm bg-blue-50 text-blue-700">
                            {LEAVE_TYPE_LABELS[leave.leaveType] ?? leave.leaveType}
                          </span>
                        </td>
                        <td className="p-4 text-gray-700 text-sm">{new Date(leave.startDate).toLocaleDateString("en-GB")}</td>
                        <td className="p-4 text-gray-700 text-sm">{new Date(leave.endDate).toLocaleDateString("en-GB")}</td>
                        <td className="p-4 font-medium">{Number(leave.daysRequested)}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            <StatusIcon status={leave.status} />
                            <Badge variant={STATUS_VARIANT[leave.status] ?? "outline"}>{leave.status}</Badge>
                          </div>
                        </td>
                        <td className="p-4">
                          {leave.status === "PENDING" && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="text-white"
                                style={{ backgroundColor: "#50B0E0" }}
                                disabled={approve.isPending}
                                onClick={() => approve.mutate({ organizationId: orgId, id: leave.id })}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-500"
                                onClick={() => setRejectId(leave.id)}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
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

      {/* Request Leave Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Leave</DialogTitle>
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
            <div>
              <Label>Leave Type</Label>
              <select
                value={form.leaveType}
                onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
                className="w-full h-10 px-3 mt-1 border border-input bg-background rounded-md text-sm"
              >
                {Object.entries(LEAVE_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date</Label>
                <Input type="date" className="mt-1" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" className="mt-1" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Days Requested</Label>
              <Input type="number" min="0.5" step="0.5" className="mt-1" value={form.daysRequested} onChange={(e) => setForm({ ...form, daysRequested: e.target.value })} />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input className="mt-1" placeholder="Reason for leave…" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
            {create.error && <p className="text-sm text-red-500">{create.error.message}</p>}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button
                className="flex-1 text-white"
                style={{ backgroundColor: "#50B0E0" }}
                disabled={create.isPending}
                onClick={handleSubmit}
              >
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={!!rejectId} onOpenChange={(o) => { if (!o) setRejectId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Reason (optional)</Label>
              <Input className="mt-1" placeholder="Reason for rejection…" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            </div>
            {reject.error && <p className="text-sm text-red-500">{reject.error.message}</p>}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setRejectId(null)}>Cancel</Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={reject.isPending}
                onClick={() => rejectId && reject.mutate({ organizationId: orgId, id: rejectId, reason: rejectReason || undefined })}
              >
                {reject.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
