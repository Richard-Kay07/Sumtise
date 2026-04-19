"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc-client"
import { Clock, CheckCircle, AlertCircle, Send, ChevronLeft, ChevronRight } from "lucide-react"

const SAMPLE_TIMESHEETS = [
  { id: "1", employee: "Alice Johnson", week: "14 Apr – 18 Apr 2026", hours: 40, overtime: 2, status: "Approved" },
  { id: "2", employee: "Bob Smith", week: "14 Apr – 18 Apr 2026", hours: 38, overtime: 0, status: "Approved" },
  { id: "3", employee: "Carol White", week: "14 Apr – 18 Apr 2026", hours: 40, overtime: 5, status: "Pending" },
  { id: "4", employee: "David Brown", week: "14 Apr – 18 Apr 2026", hours: 35, overtime: 0, status: "Pending" },
  { id: "5", employee: "Eve Davis", week: "14 Apr – 18 Apr 2026", hours: 40, overtime: 0, status: "Draft" },
  { id: "6", employee: "Frank Miller", week: "14 Apr – 18 Apr 2026", hours: 42, overtime: 2, status: "Approved" },
  { id: "7", employee: "Grace Wilson", week: "14 Apr – 18 Apr 2026", hours: 36, overtime: 0, status: "Draft" },
]

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"]

const DAILY_HOURS = [
  { name: "Alice Johnson", hours: [8, 8, 9, 8, 7] },
  { name: "Bob Smith", hours: [8, 7, 8, 8, 7] },
  { name: "Carol White", hours: [9, 9, 8, 8, 6] },
]

export default function TimesheetsPage() {
  const [view, setView] = useState<"table" | "calendar">("table")
  const [currentWeek, setCurrentWeek] = useState("14 Apr – 18 Apr 2026")

  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()

  const totalHours = SAMPLE_TIMESHEETS.reduce((s, t) => s + t.hours, 0)
  const totalOvertime = SAMPLE_TIMESHEETS.reduce((s, t) => s + t.overtime, 0)
  const pendingCount = SAMPLE_TIMESHEETS.filter((t) => t.status === "Pending").length

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "Approved": return "default"
      case "Pending": return "secondary"
      case "Draft": return "outline"
      default: return "outline"
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#1A1D24" }}>Timesheets</h1>
            <p className="text-gray-600">Track hours worked and overtime</p>
          </div>
          <div className="flex gap-3">
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button
                className={`px-4 py-2 text-sm font-medium ${view === "table" ? "text-white" : "text-gray-600 bg-white"}`}
                style={view === "table" ? { backgroundColor: "#50B0E0" } : {}}
                onClick={() => setView("table")}
              >
                Table
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium ${view === "calendar" ? "text-white" : "text-gray-600 bg-white"}`}
                style={view === "calendar" ? { backgroundColor: "#50B0E0" } : {}}
                onClick={() => setView("calendar")}
              >
                Weekly
              </button>
            </div>
            <Button className="text-white" style={{ backgroundColor: "#50B0E0" }}>
              <Send className="mr-2 h-4 w-4" />
              Submit Timesheets
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: "#50B0E020" }}>
                  <Clock className="h-5 w-5" style={{ color: "#50B0E0" }} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Hours</p>
                  <p className="text-2xl font-bold" style={{ color: "#1A1D24" }}>{totalHours}h</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-50">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Overtime Hours</p>
                  <p className="text-2xl font-bold text-orange-600">{totalOvertime}h</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-50">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Pending Approval</p>
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
                  <p className="text-2xl font-bold text-green-600">{SAMPLE_TIMESHEETS.filter((t) => t.status === "Approved").length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {view === "table" ? (
          <Card>
            <CardHeader>
              <CardTitle>Week: {currentWeek}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-4 font-medium text-gray-600">Employee</th>
                      <th className="text-left p-4 font-medium text-gray-600">Week</th>
                      <th className="text-left p-4 font-medium text-gray-600">Regular Hours</th>
                      <th className="text-left p-4 font-medium text-gray-600">Overtime</th>
                      <th className="text-left p-4 font-medium text-gray-600">Total</th>
                      <th className="text-left p-4 font-medium text-gray-600">Status</th>
                      <th className="text-left p-4 font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SAMPLE_TIMESHEETS.map((ts) => (
                      <tr key={ts.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="p-4 font-medium" style={{ color: "#1A1D24" }}>{ts.employee}</td>
                        <td className="p-4 text-gray-600 text-sm">{ts.week}</td>
                        <td className="p-4">{ts.hours}h</td>
                        <td className="p-4">
                          {ts.overtime > 0 ? (
                            <span className="text-orange-600 font-medium">+{ts.overtime}h</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="p-4 font-bold">{ts.hours + ts.overtime}h</td>
                        <td className="p-4">
                          <Badge variant={getStatusVariant(ts.status) as any}>{ts.status}</Badge>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            {ts.status === "Pending" && (
                              <Button size="sm" className="text-white" style={{ backgroundColor: "#50B0E0" }}>Approve</Button>
                            )}
                            {ts.status === "Draft" && (
                              <Button size="sm" variant="outline">Submit</Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Weekly Calendar View</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm"><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="text-sm font-medium px-3">{currentWeek}</span>
                  <Button variant="outline" size="sm"><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-4 font-medium text-gray-600">Employee</th>
                      {WEEK_DAYS.map((d) => (
                        <th key={d} className="text-center p-4 font-medium text-gray-600">{d}</th>
                      ))}
                      <th className="text-center p-4 font-medium text-gray-600">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DAILY_HOURS.map((row) => (
                      <tr key={row.name} className="border-b hover:bg-gray-50">
                        <td className="p-4 font-medium" style={{ color: "#1A1D24" }}>{row.name}</td>
                        {row.hours.map((h, i) => (
                          <td key={i} className="p-4 text-center">
                            <div
                              className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-sm font-medium ${h >= 8 ? "bg-green-100 text-green-700" : h > 0 ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-400"}`}
                            >
                              {h > 0 ? `${h}h` : "—"}
                            </div>
                          </td>
                        ))}
                        <td className="p-4 text-center font-bold">{row.hours.reduce((s, h) => s + h, 0)}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
