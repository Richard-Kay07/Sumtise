"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { trpc } from "@/lib/trpc-client"
import { Users, Plus, Search, Download, Mail, Loader2 } from "lucide-react"

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: "Full Time",
  PART_TIME: "Part Time",
  CONTRACTOR: "Contractor",
  TEMPORARY: "Temporary",
  INTERN: "Intern",
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  ON_LEAVE: "secondary",
  INACTIVE: "outline",
  TERMINATED: "outline",
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0 }).format(amount)
}

const DEFAULT_FORM = {
  employeeNumber: "",
  firstName: "",
  lastName: "",
  email: "",
  employmentType: "FULL_TIME" as const,
  salary: "",
  startDate: new Date().toISOString().split("T")[0],
}

export default function EmployeesPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("All")
  const [showAddModal, setShowAddModal] = useState(false)
  const [form, setForm] = useState(DEFAULT_FORM)

  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = organizations?.[0]?.id ?? ""

  const { data, isLoading, refetch } = trpc.payroll.employees.getAll.useQuery(
    { organizationId: orgId, page: 1, limit: 100 },
    { enabled: !!orgId }
  )

  const createEmployee = trpc.payroll.employees.create.useMutation({
    onSuccess: () => {
      refetch()
      setShowAddModal(false)
      setForm(DEFAULT_FORM)
    },
  })

  const employees = data?.employees ?? []

  const filtered = employees.filter((e) => {
    const fullName = `${e.firstName} ${e.lastName}`.toLowerCase()
    const matchesSearch = !searchTerm || fullName.includes(searchTerm.toLowerCase()) || e.employeeNumber.includes(searchTerm)
    const matchesStatus = statusFilter === "All" || e.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const activeCount = employees.filter((e) => e.status === "ACTIVE").length
  const totalPayroll = employees.reduce((s, e) => s + Number(e.salary ?? 0), 0)

  const handleCreate = () => {
    if (!orgId || !form.employeeNumber || !form.firstName || !form.lastName || !form.startDate) return
    createEmployee.mutate({
      organizationId: orgId,
      employeeNumber: form.employeeNumber,
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email || undefined,
      employmentType: form.employmentType,
      salary: form.salary ? Number(form.salary) : undefined,
      startDate: new Date(form.startDate),
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#1A1D24" }}>Employees</h1>
            <p className="text-gray-600">Manage your workforce and employee records</p>
          </div>
          <Button style={{ backgroundColor: "#50B0E0" }} className="text-white" onClick={() => setShowAddModal(true)}>
            <Plus className="mr-2 h-4 w-4" />Add Employee
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: "#50B0E020" }}>
                  <Users className="h-5 w-5" style={{ color: "#50B0E0" }} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Employees</p>
                  <p className="text-2xl font-bold" style={{ color: "#1A1D24" }}>{employees.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-50">
                  <Users className="h-5 w-5 text-green-600" />
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
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">On Leave</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {employees.filter((e) => e.status === "ON_LEAVE").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-50">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Annual Payroll</p>
                  <p className="text-2xl font-bold text-purple-600">{formatCurrency(totalPayroll)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by name or employee number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="md:w-44">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full h-10 px-3 border border-input bg-background rounded-md text-sm"
                >
                  <option value="All">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="ON_LEAVE">On Leave</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="TERMINATED">Terminated</option>
                </select>
              </div>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />Export
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {isLoading ? "Loading..." : `Employees (${filtered.length})`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {employees.length === 0 ? "No employees yet. Add your first employee." : "No employees match your filters."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-4 font-medium text-gray-600">Name</th>
                      <th className="text-left p-4 font-medium text-gray-600">Employee #</th>
                      <th className="text-left p-4 font-medium text-gray-600">Type</th>
                      <th className="text-left p-4 font-medium text-gray-600">Salary (Annual)</th>
                      <th className="text-left p-4 font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((employee) => (
                      <tr key={employee.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="p-4">
                          <div>
                            <p className="font-medium" style={{ color: "#1A1D24" }}>
                              {employee.firstName} {employee.lastName}
                            </p>
                            {employee.email && (
                              <p className="text-sm text-gray-500 flex items-center gap-1">
                                <Mail className="h-3 w-3" /> {employee.email}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-gray-600 text-sm">{employee.employeeNumber}</td>
                        <td className="p-4">
                          <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm">
                            {EMPLOYMENT_TYPE_LABELS[employee.employmentType] ?? employee.employmentType}
                          </span>
                        </td>
                        <td className="p-4 font-medium">
                          {employee.salary ? formatCurrency(Number(employee.salary)) : "—"}
                        </td>
                        <td className="p-4">
                          <Badge variant={STATUS_VARIANT[employee.status] ?? "outline"}>
                            {employee.status.replace("_", " ")}
                          </Badge>
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

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>First Name *</Label>
                <Input placeholder="John" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div>
                <Label>Last Name *</Label>
                <Input placeholder="Doe" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Employee Number *</Label>
              <Input placeholder="EMP-001" value={form.employeeNumber} onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input placeholder="john@company.com" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Employment Type</Label>
              <select
                value={form.employmentType}
                onChange={(e) => setForm({ ...form, employmentType: e.target.value as typeof form.employmentType })}
                className="w-full h-10 px-3 border border-input bg-background rounded-md text-sm"
              >
                {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Start Date *</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <Label>Annual Salary (£)</Label>
              <Input placeholder="50000" type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} />
            </div>
            {createEmployee.error && (
              <p className="text-sm text-red-500">{createEmployee.error.message}</p>
            )}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button
                className="flex-1 text-white"
                style={{ backgroundColor: "#50B0E0" }}
                onClick={handleCreate}
                disabled={createEmployee.isPending || !form.employeeNumber || !form.firstName || !form.lastName}
              >
                {createEmployee.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Employee"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
