"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { trpc } from "@/lib/trpc-client"
import { Award, Plus, Search, DollarSign, TrendingDown, CheckCircle, Clock, AlertCircle } from "lucide-react"

const SAMPLE_GRANTS = [
  { id: "1", name: "Innovate UK R&D Grant", funder: "Innovate UK", amount: 150000, received: 90000, remaining: 60000, status: "Active", deadline: "2027-03-31", category: "R&D" },
  { id: "2", name: "Arts Council England", funder: "Arts Council", amount: 25000, received: 25000, remaining: 0, status: "Completed", deadline: "2025-12-31", category: "Arts" },
  { id: "3", name: "Horizon Europe", funder: "EU Commission", amount: 500000, received: 125000, remaining: 375000, status: "Active", deadline: "2028-01-01", category: "Research" },
  { id: "4", name: "Local Enterprise Partnership", funder: "LEP South East", amount: 50000, received: 0, remaining: 50000, status: "Pending", deadline: "2026-06-30", category: "Growth" },
  { id: "5", name: "UKRI Future Leaders", funder: "UKRI", amount: 200000, received: 180000, remaining: 20000, status: "Active", deadline: "2026-09-01", category: "Research" },
  { id: "6", name: "Green Energy Fund", funder: "Dept for Energy", amount: 75000, received: 0, remaining: 75000, status: "Applied", deadline: "2026-12-31", category: "Sustainability" },
]

function fmt(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0 }).format(n)
}

const getStatusStyle = (status: string) => {
  switch (status) {
    case "Active": return "text-green-700 bg-green-50 border border-green-200"
    case "Completed": return "text-blue-700 bg-blue-50 border border-blue-200"
    case "Pending": return "text-yellow-700 bg-yellow-50 border border-yellow-200"
    case "Applied": return "text-purple-700 bg-purple-50 border border-purple-200"
    case "Rejected": return "text-red-700 bg-red-50 border border-red-200"
    default: return "text-gray-700 bg-gray-50 border border-gray-200"
  }
}

export default function GrantsPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("All")
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: "", funder: "", amount: "", deadline: "", category: "R&D" })

  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()

  const filtered = SAMPLE_GRANTS.filter((g) => {
    const matchSearch = !search || g.name.toLowerCase().includes(search.toLowerCase()) || g.funder.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === "All" || g.status === statusFilter
    return matchSearch && matchStatus
  })

  const totalGranted = SAMPLE_GRANTS.reduce((s, g) => s + g.amount, 0)
  const totalReceived = SAMPLE_GRANTS.reduce((s, g) => s + g.received, 0)
  const totalRemaining = SAMPLE_GRANTS.reduce((s, g) => s + g.remaining, 0)
  const activeCount = SAMPLE_GRANTS.filter((g) => g.status === "Active").length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#1A1D24" }}>Grants</h1>
            <p className="text-gray-600">Track grant funding, spending and compliance</p>
          </div>
          <Button className="text-white" style={{ backgroundColor: "#50B0E0" }} onClick={() => setShowModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Grant
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: "#50B0E020" }}>
                  <Award className="h-5 w-5" style={{ color: "#50B0E0" }} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Grants</p>
                  <p className="text-2xl font-bold" style={{ color: "#1A1D24" }}>{SAMPLE_GRANTS.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Awarded</p>
                  <p className="text-2xl font-bold text-blue-600">{fmt(totalGranted)}</p>
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
                  <p className="text-sm text-gray-500">Received</p>
                  <p className="text-2xl font-bold text-green-600">{fmt(totalReceived)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-50">
                  <TrendingDown className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Remaining to Claim</p>
                  <p className="text-2xl font-bold text-orange-600">{fmt(totalRemaining)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search grants or funders..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {["All", "Active", "Completed", "Pending", "Applied"].map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={statusFilter === s ? "default" : "outline"}
                    onClick={() => setStatusFilter(s)}
                    style={statusFilter === s ? { backgroundColor: "#50B0E0" } : {}}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grants Table */}
        <Card>
          <CardHeader>
            <CardTitle>Grants ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-4 font-medium text-gray-600">Grant Name</th>
                    <th className="text-left p-4 font-medium text-gray-600">Funder</th>
                    <th className="text-right p-4 font-medium text-gray-600">Amount</th>
                    <th className="text-right p-4 font-medium text-gray-600">Received</th>
                    <th className="text-right p-4 font-medium text-gray-600">Remaining</th>
                    <th className="text-left p-4 font-medium text-gray-600">Budget Tracking</th>
                    <th className="text-left p-4 font-medium text-gray-600">Deadline</th>
                    <th className="text-left p-4 font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((grant) => {
                    const pct = grant.amount > 0 ? Math.round((grant.received / grant.amount) * 100) : 0
                    return (
                      <tr key={grant.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="p-4">
                          <p className="font-medium" style={{ color: "#1A1D24" }}>{grant.name}</p>
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{grant.category}</span>
                        </td>
                        <td className="p-4 text-gray-600">{grant.funder}</td>
                        <td className="p-4 text-right font-medium">{fmt(grant.amount)}</td>
                        <td className="p-4 text-right text-green-700 font-medium">{fmt(grant.received)}</td>
                        <td className="p-4 text-right text-orange-700 font-medium">{fmt(grant.remaining)}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 min-w-28">
                            <div className="flex-1 bg-gray-100 rounded-full h-2">
                              <div
                                className="h-2 rounded-full"
                                style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#22c55e" : "#50B0E0" }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 w-8">{pct}%</span>
                          </div>
                        </td>
                        <td className="p-4 text-gray-600 text-sm">{grant.deadline}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusStyle(grant.status)}`}>
                            {grant.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Grant Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Grant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Grant Name</Label>
              <Input placeholder="Innovate UK R&D Grant" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Funder / Organisation</Label>
              <Input placeholder="Innovate UK" value={form.funder} onChange={(e) => setForm({ ...form, funder: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Grant Amount (£)</Label>
              <Input type="number" placeholder="50000" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Category</Label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full h-10 px-3 mt-1 border border-input bg-background rounded-md text-sm"
              >
                <option>R&D</option>
                <option>Growth</option>
                <option>Arts</option>
                <option>Research</option>
                <option>Sustainability</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <Label>Grant End Date</Label>
              <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="mt-1" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button className="flex-1 text-white" style={{ backgroundColor: "#50B0E0" }} onClick={() => setShowModal(false)}>
                Add Grant
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
