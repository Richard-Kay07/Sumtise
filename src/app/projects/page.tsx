"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { trpc } from "@/lib/trpc-client"
import { Briefcase, Plus, Search, TrendingUp, DollarSign, CheckCircle, Clock } from "lucide-react"

const SAMPLE_PROJECTS = [
  { id: "1", name: "Website Redesign", client: "Acme Corp", budget: 25000, spent: 18500, status: "Active", complete: 74, deadline: "2026-06-30" },
  { id: "2", name: "ERP Implementation", client: "TechStart Ltd", budget: 80000, spent: 45000, status: "Active", complete: 56, deadline: "2026-09-15" },
  { id: "3", name: "Mobile App Dev", client: "RetailPlus", budget: 40000, spent: 40000, status: "Completed", complete: 100, deadline: "2026-03-31" },
  { id: "4", name: "Data Migration", client: "FinServ UK", budget: 15000, spent: 3000, status: "On Hold", complete: 20, deadline: "2026-08-01" },
  { id: "5", name: "Security Audit", client: "Global Insure", budget: 12000, spent: 9600, status: "Active", complete: 80, deadline: "2026-05-15" },
  { id: "6", name: "Cloud Migration", client: "ManufactCo", budget: 60000, spent: 0, status: "Planning", complete: 0, deadline: "2026-12-31" },
  { id: "7", name: "CRM Integration", client: "SalesForce Ltd", budget: 22000, spent: 22500, status: "Completed", complete: 100, deadline: "2026-02-28" },
]

function fmt(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0 }).format(n)
}

const getStatusVariant = (status: string) => {
  switch (status) {
    case "Active": return "default"
    case "Completed": return "secondary"
    case "On Hold": return "outline"
    case "Planning": return "outline"
    default: return "outline"
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "Active": return "text-green-700 bg-green-50 border border-green-200"
    case "Completed": return "text-blue-700 bg-blue-50 border border-blue-200"
    case "On Hold": return "text-orange-700 bg-orange-50 border border-orange-200"
    case "Planning": return "text-gray-700 bg-gray-50 border border-gray-200"
    default: return "text-gray-700 bg-gray-50"
  }
}

const getProgressColor = (complete: number, spent: number, budget: number) => {
  if (spent > budget) return "bg-red-500"
  if (complete === 100) return "bg-green-500"
  return "#50B0E0"
}

export default function ProjectsPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("All")
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: "", client: "", budget: "", deadline: "" })

  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()

  const filtered = SAMPLE_PROJECTS.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.client.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === "All" || p.status === statusFilter
    return matchSearch && matchStatus
  })

  const totalBudget = SAMPLE_PROJECTS.reduce((s, p) => s + p.budget, 0)
  const totalSpent = SAMPLE_PROJECTS.reduce((s, p) => s + p.spent, 0)
  const activeCount = SAMPLE_PROJECTS.filter((p) => p.status === "Active").length
  const completedCount = SAMPLE_PROJECTS.filter((p) => p.status === "Completed").length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#1A1D24" }}>Projects</h1>
            <p className="text-gray-600">Track project budgets, progress and profitability</p>
          </div>
          <Button className="text-white" style={{ backgroundColor: "#50B0E0" }} onClick={() => setShowModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: "#50B0E020" }}>
                  <Briefcase className="h-5 w-5" style={{ color: "#50B0E0" }} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Projects</p>
                  <p className="text-2xl font-bold" style={{ color: "#1A1D24" }}>{SAMPLE_PROJECTS.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-50">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Active</p>
                  <p className="text-2xl font-bold text-green-600">{activeCount}</p>
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
                  <p className="text-sm text-gray-500">Total Budget</p>
                  <p className="text-2xl font-bold text-blue-600">{fmt(totalBudget)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-50">
                  <CheckCircle className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Spent</p>
                  <p className="text-2xl font-bold text-purple-600">{fmt(totalSpent)}</p>
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
                  placeholder="Search projects or clients..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                {["All", "Active", "Completed", "On Hold", "Planning"].map((s) => (
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

        {/* Projects Table */}
        <Card>
          <CardHeader>
            <CardTitle>Projects ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-4 font-medium text-gray-600">Project</th>
                    <th className="text-left p-4 font-medium text-gray-600">Client</th>
                    <th className="text-right p-4 font-medium text-gray-600">Budget</th>
                    <th className="text-right p-4 font-medium text-gray-600">Spent</th>
                    <th className="text-left p-4 font-medium text-gray-600">Progress</th>
                    <th className="text-left p-4 font-medium text-gray-600">Deadline</th>
                    <th className="text-left p-4 font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((project) => {
                    const overBudget = project.spent > project.budget
                    return (
                      <tr key={project.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="p-4 font-medium" style={{ color: "#1A1D24" }}>{project.name}</td>
                        <td className="p-4 text-gray-600">{project.client}</td>
                        <td className="p-4 text-right">{fmt(project.budget)}</td>
                        <td className={`p-4 text-right font-medium ${overBudget ? "text-red-600" : "text-gray-700"}`}>
                          {fmt(project.spent)}
                          {overBudget && <span className="text-xs ml-1 text-red-500">(over budget)</span>}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 min-w-32">
                            <div className="flex-1 bg-gray-100 rounded-full h-2">
                              <div
                                className="h-2 rounded-full transition-all"
                                style={{
                                  width: `${project.complete}%`,
                                  backgroundColor: overBudget ? "#ef4444" : project.complete === 100 ? "#22c55e" : "#50B0E0"
                                }}
                              />
                            </div>
                            <span className="text-sm text-gray-600 w-10 text-right">{project.complete}%</span>
                          </div>
                        </td>
                        <td className="p-4 text-gray-600 text-sm">{project.deadline}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(project.status)}`}>
                            {project.status}
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

      {/* New Project Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Project Name</Label>
              <Input placeholder="Website Redesign" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Client</Label>
              <Input placeholder="Client name" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Budget (£)</Label>
              <Input type="number" placeholder="25000" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Deadline</Label>
              <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="mt-1" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button className="flex-1 text-white" style={{ backgroundColor: "#50B0E0" }} onClick={() => setShowModal(false)}>
                Create Project
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
