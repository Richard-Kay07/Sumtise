"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { trpc } from "@/lib/trpc-client"
import { Calendar, Plus, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react"

const SAMPLE_LEAVES = [
  { id: "1", employee: "Alice Johnson", type: "Annual Leave", start: "2026-05-01", end: "2026-05-07", days: 5, status: "Approved", notes: "Summer holiday" },
  { id: "2", employee: "Bob Smith", type: "Sick Leave", start: "2026-04-15", end: "2026-04-16", days: 2, status: "Approved", notes: "Medical appointment" },
  { id: "3", employee: "Carol White", type: "Annual Leave", start: "2026-06-10", end: "2026-06-14", days: 5, status: "Pending", notes: "" },
  { id: "4", employee: "David Brown", type: "Parental Leave", start: "2026-07-01", end: "2026-09-30", days: 65, status: "Approved", notes: "Paternity leave" },
  { id: "5", employee: "Eve Davis", type: "Annual Leave", start: "2026-04-20", end: "2026-04-22", days: 3, status: "Pending", notes: "Family event" },
  { id: "6", employee: "Frank Miller", type: "Unpaid Leave", start: "2026-05-15", end: "2026-05-15", days: 1, status: "Rejected", notes: "Short notice" },
  { id: "7", employee: "Grace Wilson", type: "Annual Leave", start: "2026-08-01", end: "2026-08-15", days: 10, status: "Pending", notes: "International travel" },
]

export default function LeavePage() {
  const [statusFilter, setStatusFilter] = useState("All")
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ employee: "", type: "Annual Leave", start: "", end: "", notes: "" })

  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()

  const filtered = statusFilter === "All" ? SAMPLE_LEAVES : SAMPLE_LEAVES.filter((l) => l.status === statusFilter)

  const pendingCount = SAMPLE_LEAVES.filter((l) => l.status === "Pending").length
  const approvedCount = SAMPLE_LEAVES.filter((l) => l.status === "Approved").length
  const rejectedCount = SAMPLE_LEAVES.filter((l) => l.status === "Rejected").length

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "Approved": return "default"
      case "Pending": return "secondary"
      case "Rejected": return "destructive"
      default: return "outline"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Approved": return <CheckCircle className="h-4 w-4 text-green-600" />
      case "Pending": return <Clock className="h-4 w-4 text-yellow-600" />
      case "Rejected": return <XCircle className="h-4 w-4 text-red-600" />
      default: return null
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Annual Leave": return "bg-blue-50 text-blue-700"
      case "Sick Leave": return "bg-red-50 text-red-700"
      case "Parental Leave": return "bg-purple-50 text-purple-700"
      case "Unpaid Leave": return "bg-gray-50 text-gray-700"
      default: return "bg-gray-50 text-gray-700"
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#1A1D24" }}>
              Leave Management
            </h1>
            <p className="text-gray-600">Track and manage employee leave requests</p>
          </div>
          <Button style={{ backgroundColor: "#50B0E0" }} className="text-white" onClick={() => setShowModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Request Leave
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: "#50B0E020" }}>
                  <Calendar className="h-5 w-5" style={{ color: "#50B0E0" }} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Requests</p>
                  <p className="text-2xl font-bold" style={{ color: "#1A1D24" }}>{SAMPLE_LEAVES.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-50">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-50">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Approved</p>
                  <p className="text-2xl font-bold text-green-600">{approvedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-50">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Rejected</p>
                  <p className="text-2xl font-bold text-red-600">{rejectedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-2 flex-wrap">
              {["All", "Pending", "Approved", "Rejected"].map((s) => (
                <Button
                  key={s}
                  variant={statusFilter === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(s)}
                  style={statusFilter === s ? { backgroundColor: "#50B0E0" } : {}}
                >
                  {s}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Leave Requests ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-4 font-medium text-gray-600">Employee</th>
                    <th className="text-left p-4 font-medium text-gray-600">Type</th>
                    <th className="text-left p-4 font-medium text-gray-600">Start Date</th>
                    <th className="text-left p-4 font-medium text-gray-600">End Date</th>
                    <th className="text-left p-4 font-medium text-gray-600">Days</th>
                    <th className="text-left p-4 font-medium text-gray-600">Status</th>
                    <th className="text-left p-4 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((leave) => (
                    <tr key={leave.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-medium" style={{ color: "#1A1D24" }}>{leave.employee}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-sm ${getTypeColor(leave.type)}`}>{leave.type}</span>
                      </td>
                      <td className="p-4 text-gray-700">{leave.start}</td>
                      <td className="p-4 text-gray-700">{leave.end}</td>
                      <td className="p-4 font-medium">{leave.days}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          {getStatusIcon(leave.status)}
                          <Badge variant={getStatusVariant(leave.status) as any}>{leave.status}</Badge>
                        </div>
                      </td>
                      <td className="p-4">
                        {leave.status === "Pending" && (
                          <div className="flex gap-2">
                            <Button size="sm" className="text-white" style={{ backgroundColor: "#50B0E0" }}>Approve</Button>
                            <Button size="sm" variant="outline" className="text-red-500">Reject</Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
              <Input placeholder="Employee name" value={form.employee} onChange={(e) => setForm({ ...form, employee: e.target.value })} />
            </div>
            <div>
              <Label>Leave Type</Label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full h-10 px-3 border border-input bg-background rounded-md text-sm"
              >
                <option>Annual Leave</option>
                <option>Sick Leave</option>
                <option>Parental Leave</option>
                <option>Unpaid Leave</option>
                <option>Bereavement</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Input placeholder="Optional notes..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button className="flex-1 text-white" style={{ backgroundColor: "#50B0E0" }} onClick={() => setShowModal(false)}>
                Submit Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
