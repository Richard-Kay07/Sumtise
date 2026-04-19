"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, Upload } from "lucide-react"

const returns = [
  { period: "Jan–Mar 2024", vatDue: 8420, vatReclaimed: 3210, netVat: 5210, due: "07/05/2024", status: "Due" },
  { period: "Oct–Dec 2023", vatDue: 7980, vatReclaimed: 2980, netVat: 5000, due: "07/02/2024", status: "Submitted" },
  { period: "Jul–Sep 2023", vatDue: 8100, vatReclaimed: 3050, netVat: 5050, due: "07/11/2023", status: "Submitted" },
]

export default function VatMtdPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#1A1D24" }}>VAT – Making Tax Digital</h1>
            <p className="text-gray-500">MTD VAT returns submitted digitally to HMRC</p>
          </div>
          <Button style={{ backgroundColor: "#50B0E0" }} className="text-white gap-2">
            <Upload className="h-4 w-4" />Submit Return
          </Button>
        </div>

        <Card className="mb-6 border-l-4" style={{ borderLeftColor: "#50B0E0" }}>
          <CardHeader><CardTitle>Jan–Mar 2024 – Due 7 May 2024</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6 text-center">
              <div><p className="text-sm text-gray-500">VAT on Sales</p><p className="text-2xl font-bold">£8,420</p></div>
              <div><p className="text-sm text-gray-500">VAT Reclaimed</p><p className="text-2xl font-bold text-green-600">£3,210</p></div>
              <div><p className="text-sm text-gray-500">Net VAT Due</p><p className="text-2xl font-bold text-red-600">£5,210</p></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />VAT Return History</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-gray-500"><th className="text-left py-3">Period</th><th className="text-right py-3">VAT Due</th><th className="text-right py-3">VAT Reclaimed</th><th className="text-right py-3">Net VAT</th><th className="text-right py-3">Due Date</th><th className="text-center py-3">Status</th></tr></thead>
              <tbody>{returns.map((r) => (
                <tr key={r.period} className="border-b hover:bg-gray-50">
                  <td className="py-3 font-medium">{r.period}</td>
                  <td className="text-right py-3">£{r.vatDue.toLocaleString()}</td>
                  <td className="text-right py-3 text-green-600">£{r.vatReclaimed.toLocaleString()}</td>
                  <td className="text-right py-3 font-bold">£{r.netVat.toLocaleString()}</td>
                  <td className="text-right py-3 text-gray-400">{r.due}</td>
                  <td className="text-center py-3"><Badge className={r.status === "Submitted" ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}>{r.status}</Badge></td>
                </tr>
              ))}</tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
