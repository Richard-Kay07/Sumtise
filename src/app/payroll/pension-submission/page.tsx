"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Shield, Upload } from "lucide-react"

const submissions = [
  { period: "March 2024", employees: 4, employer: 780, employee: 520, total: 1300, status: "Submitted", date: "01/04/2024" },
  { period: "February 2024", employees: 4, employer: 780, employee: 520, total: 1300, status: "Submitted", date: "01/03/2024" },
  { period: "January 2024", employees: 4, employer: 760, employee: 510, total: 1270, status: "Submitted", date: "01/02/2024" },
]

export default function PensionSubmissionPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#1A1D24" }}>Pension Submission</h1>
            <p className="text-gray-500">Auto-enrolment pension contributions</p>
          </div>
          <Button style={{ backgroundColor: "#50B0E0" }} className="text-white gap-2">
            <Upload className="h-4 w-4" />Submit to Provider
          </Button>
        </div>
        <Card className="mb-6">
          <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" style={{ color: "#50B0E0" }} />April 2024 – Pending Submission</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6 text-center">
              <div><p className="text-sm text-gray-500">Employer Contributions</p><p className="text-2xl font-bold" style={{ color: "#50B0E0" }}>£780</p></div>
              <div><p className="text-sm text-gray-500">Employee Contributions</p><p className="text-2xl font-bold">£520</p></div>
              <div><p className="text-sm text-gray-500">Total Due</p><p className="text-2xl font-bold text-green-600">£1,300</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Submission History</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-gray-500"><th className="text-left py-3">Period</th><th className="text-right py-3">Employees</th><th className="text-right py-3">Employer</th><th className="text-right py-3">Employee</th><th className="text-right py-3">Total</th><th className="text-center py-3">Status</th><th className="text-right py-3">Date</th></tr></thead>
              <tbody>{submissions.map((s) => (
                <tr key={s.period} className="border-b hover:bg-gray-50">
                  <td className="py-3 font-medium">{s.period}</td>
                  <td className="text-right py-3">{s.employees}</td>
                  <td className="text-right py-3">£{s.employer}</td>
                  <td className="text-right py-3">£{s.employee}</td>
                  <td className="text-right py-3 font-medium">£{s.total.toLocaleString()}</td>
                  <td className="text-center py-3"><Badge variant="default" className="bg-green-100 text-green-800">{s.status}</Badge></td>
                  <td className="text-right py-3 text-gray-400">{s.date}</td>
                </tr>
              ))}</tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
