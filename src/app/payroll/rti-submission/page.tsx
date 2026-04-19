"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, Upload } from "lucide-react"

const submissions = [
  { type: "FPS", period: "April 2024", employees: 4, status: "Pending", due: "19/05/2024" },
  { type: "FPS", period: "March 2024", employees: 4, status: "Accepted", due: "19/04/2024", submitted: "05/04/2024" },
  { type: "EPS", period: "March 2024", employees: 4, status: "Accepted", due: "19/04/2024", submitted: "05/04/2024" },
  { type: "FPS", period: "February 2024", employees: 4, status: "Accepted", due: "19/03/2024", submitted: "04/03/2024" },
]

export default function RTISubmissionPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#1A1D24" }}>RTI Submission</h1>
            <p className="text-gray-500">Real Time Information submissions to HMRC</p>
          </div>
          <Button style={{ backgroundColor: "#50B0E0" }} className="text-white gap-2">
            <Upload className="h-4 w-4" />Submit to HMRC
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          {[
            { label: "FPS Due", value: "19 May 2024", desc: "Full Payment Submission", color: "text-orange-500" },
            { label: "EPS Due", value: "19 May 2024", desc: "Employer Payment Summary", color: "text-blue-500" },
            { label: "Last Accepted", value: "05 Apr 2024", desc: "March FPS", color: "text-green-600" },
          ].map((s) => (
            <Card key={s.label}><CardContent className="pt-5"><p className="text-xs text-gray-500">{s.label}</p><p className={`text-xl font-bold ${s.color}`}>{s.value}</p><p className="text-xs text-gray-400">{s.desc}</p></CardContent></Card>
          ))}
        </div>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Submission History</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-gray-500"><th className="text-left py-3">Type</th><th className="text-left py-3">Period</th><th className="text-right py-3">Employees</th><th className="text-center py-3">Status</th><th className="text-right py-3">Due Date</th><th className="text-right py-3">Submitted</th></tr></thead>
              <tbody>{submissions.map((s, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="py-3"><Badge variant="outline">{s.type}</Badge></td>
                  <td className="py-3">{s.period}</td>
                  <td className="text-right py-3">{s.employees}</td>
                  <td className="text-center py-3"><Badge className={s.status === "Accepted" ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}>{s.status}</Badge></td>
                  <td className="text-right py-3 text-gray-500">{s.due}</td>
                  <td className="text-right py-3">{s.submitted ?? "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
