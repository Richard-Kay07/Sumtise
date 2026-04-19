"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { trpc } from "@/lib/trpc-client"
import { Users, Plus, Search, Download, Edit, Trash2, Mail, Phone } from "lucide-react"

const SAMPLE_EMPLOYEES = [
  { id: "1", name: "Alice Johnson", role: "Software Engineer", department: "Engineering", salary: 75000, status: "Active", email: "alice@company.com" },
  { id: "2", name: "Bob Smith", role: "Product Manager", department: "Product", salary: 85000, status: "Active", email: "bob@company.com" },
  { id: "3", name: "Carol White", role: "Designer", department: "Design", salary: 65000, status: "Active", email: "carol@company.com" },
  { id: "4", name: "David Brown", role: "Accountant", department: "Finance", salary: 60000, status: "Active", email: "david@company.com" },
  { id: "5", name: "Eve Davis", role: "HR Manager", department: "HR", salary: 70000, status: "On Leave", email: "eve@company.com" },
  { id: "6", name: "Frank Miller", role: "Sales Rep", department: "Sales", salary: 55000, status: "Active", email: "frank@company.com" },
  { id: "7", name: "Grace Wilson", role: "Marketing Manager", department: "Marketing", salary: 72000, status: "Inactive", email: "grace@company.com" },
]

const DEPARTMENTS = ["All", "Engineering", "Product", "Design", "Finance", "HR", "Sales", "Marketing"]

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0 }).format(amount)
}

export default function EmployeesPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("All")
  const [statusFilter, setStatusFilter] = useState("All")
  const [showAddModal, setShowAddModal] = useState(false)
  const [newEmployee, setNewEmployee] = useState({ name: "", role: "", department: "", salary: "", email: "" })

  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()

  const filtered = SAMPLE_EMPLOYEES.filter((e) => {
    const matchesSearch =
      !searchTerm ||
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.role.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesDept = departmentFilter === "All" || e.department === departmentFilter
    const matchesStatus = statusFilter === "All" || e.status === statusFilter
    return matchesSearch && matchesDept && matchesStatus
  })

  const totalPayroll = filtered.reduce((s, e) => s + e.salary, 0)
  const activeCount = SAMPLE_EMPLOYEES.filter((e) => e.status === "Active").length

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "Active": return "default"
      case "On Leave": return "secondary"
      case "Inactive": return "outline"
      default: return "outline"
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#1A1D24" }}>
              Employees
            </h1>
            <p className="text-gray-600">Manage your workforce and employee records</p>
          </div>
          <Button style={{ backgroundColor: "#50B0E0" }} className="text-white" onClick={() => setShowAddModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Employee
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: "#50B0E020" }}>
                  <Users className="h-5 w-5" style={{ color: "#50B0E0" }} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Employees</p>
                  <p className="text-2xl font-bold" style={{ color: "#1A1D24" }}>{SAMPLE_EMPLOYEES.length}</p>
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
                  <p className="text-sm text-gray-500">Departments</p>
                  <p className="text-2xl font-bold text-blue-600">{DEPARTMENTS.length - 1}</p>
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

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search employees by name or role..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="md:w-44">
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="w-full h-10 px-3 border border-input bg-background rounded-md text-sm"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d === "All" ? "All Departments" : d}</option>
                  ))}
                </select>
              </div>
              <div className="md:w-44">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full h-10 px-3 border border-input bg-background rounded-md text-sm"
                >
                  <option value="All">All Status</option>
                  <option value="Active">Active</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Employees ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-4 font-medium text-gray-600">Name</th>
                    <th className="text-left p-4 font-medium text-gray-600">Role</th>
                    <th className="text-left p-4 font-medium text-gray-600">Department</th>
                    <th className="text-left p-4 font-medium text-gray-600">Salary (Annual)</th>
                    <th className="text-left p-4 font-medium text-gray-600">Status</th>
                    <th className="text-left p-4 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((employee) => (
                    <tr key={employee.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <div>
                          <p className="font-medium" style={{ color: "#1A1D24" }}>{employee.name}</p>
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {employee.email}
                          </p>
                        </div>
                      </td>
                      <td className="p-4 text-gray-700">{employee.role}</td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm">{employee.department}</span>
                      </td>
                      <td className="p-4 font-medium">{formatCurrency(employee.salary)}</td>
                      <td className="p-4">
                        <Badge variant={getStatusVariant(employee.status) as any}>{employee.status}</Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" className="text-red-500 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Employee Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Full Name</Label>
              <Input placeholder="John Doe" value={newEmployee.name} onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input placeholder="john@company.com" value={newEmployee.email} onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })} />
            </div>
            <div>
              <Label>Role / Job Title</Label>
              <Input placeholder="Software Engineer" value={newEmployee.role} onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })} />
            </div>
            <div>
              <Label>Department</Label>
              <select
                value={newEmployee.department}
                onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })}
                className="w-full h-10 px-3 border border-input bg-background rounded-md text-sm"
              >
                <option value="">Select department</option>
                {DEPARTMENTS.filter((d) => d !== "All").map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Annual Salary (£)</Label>
              <Input placeholder="50000" type="number" value={newEmployee.salary} onChange={(e) => setNewEmployee({ ...newEmployee, salary: e.target.value })} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button className="flex-1 text-white" style={{ backgroundColor: "#50B0E0" }} onClick={() => setShowAddModal(false)}>
                Add Employee
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
