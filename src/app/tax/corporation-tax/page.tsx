"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BarChart3, FileText } from "lucide-react"

const filings = [
  { period: "Year ending 31 Mar 2024", profit: 127000, taxRate: "25%", taxDue: 31750, due: "31/03/2025", status: "In Progress" },
  { period: "Year ending 31 Mar 2023", profit: 108000, taxRate: "19%", taxDue: 20520, due: "31/03/2024", status: "Filed" },
  { period: "Year ending 31 Mar 2022", profit: 95000, taxRate: "19%", taxDue: 18050, due: "31/03/2023", status: "Filed" },
]

export default function CorporationTaxPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#1A1D24" }}>Corporation Tax</h1>
            <p className="text-gray-500">CT600 returns and corporation tax payments</p>
          </div>
          <Button style={{ backgroundColor: "#50B0E0" }} className="text-white gap-2">
            <FileText className="h-4 w-4" />Prepare CT600
          </Button>
        </div>

        <Card className="mb-6 border-l-4" style={{ borderLeftColor: "#50B0E0" }}>
          <CardHeader><CardTitle>Current Year Estimate – Year ending 31 Mar 2024</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6 text-center">
              <div><p className="text-sm text-gray-500">Taxable Profit</p><p className="text-2xl font-bold">£127,000</p></div>
              <div><p className="text-sm text-gray-500">Tax Rate</p><p className="text-2xl font-bold" style={{ color: "#50B0E0" }}>25%</p></div>
              <div><p className="text-sm text-gray-500">Estimated Tax Due</p><p className="text-2xl font-bold text-red-600">£31,750</p></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Filing History</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-gray-500"><th className="text-left py-3">Period</th><th className="text-right py-3">Taxable Profit</th><th className="text-right py-3">Rate</th><th className="text-right py-3">Tax Due</th><th className="text-right py-3">Due Date</th><th className="text-center py-3">Status</th></tr></thead>
              <tbody>{filings.map((f) => (
                <tr key={f.period} className="border-b hover:bg-gray-50">
                  <td className="py-3 font-medium">{f.period}</td>
                  <td className="text-right py-3">£{f.profit.toLocaleString()}</td>
                  <td className="text-right py-3">{f.taxRate}</td>
                  <td className="text-right py-3 font-bold">£{f.taxDue.toLocaleString()}</td>
                  <td className="text-right py-3 text-gray-400">{f.due}</td>
                  <td className="text-center py-3"><Badge className={f.status === "Filed" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}>{f.status}</Badge></td>
                </tr>
              ))}</tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
