"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, Download } from "lucide-react"

const returns = [
  { period: "Jan–Mar 2024", output: 6200, input: 2400, net: 3800, due: "30/04/2024", status: "Pending" },
  { period: "Oct–Dec 2023", output: 5900, input: 2200, net: 3700, due: "31/01/2024", status: "Filed" },
  { period: "Jul–Sep 2023", output: 5750, input: 2100, net: 3650, due: "31/10/2023", status: "Filed" },
]

export default function VatNonMtdPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#1A1D24" }}>VAT – Non-MTD</h1>
            <p className="text-gray-500">Manual VAT returns and paper submissions</p>
          </div>
          <Button style={{ backgroundColor: "#50B0E0" }} className="text-white gap-2">
            <Download className="h-4 w-4" />Export VAT Return
          </Button>
        </div>

        <Card className="mb-6 bg-amber-50 border-amber-200">
          <CardContent className="pt-5">
            <p className="text-sm text-amber-700 font-medium">Non-MTD VAT returns must be submitted manually via HMRC&apos;s online portal or by post. Ensure you file before the due date to avoid penalties.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />VAT Return History</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-gray-500"><th className="text-left py-3">Period</th><th className="text-right py-3">Output VAT</th><th className="text-right py-3">Input VAT</th><th className="text-right py-3">Net Due</th><th className="text-right py-3">Due Date</th><th className="text-center py-3">Status</th></tr></thead>
              <tbody>{returns.map((r) => (
                <tr key={r.period} className="border-b hover:bg-gray-50">
                  <td className="py-3 font-medium">{r.period}</td>
                  <td className="text-right py-3">£{r.output.toLocaleString()}</td>
                  <td className="text-right py-3 text-green-600">£{r.input.toLocaleString()}</td>
                  <td className="text-right py-3 font-bold">£{r.net.toLocaleString()}</td>
                  <td className="text-right py-3 text-gray-400">{r.due}</td>
                  <td className="text-center py-3"><Badge className={r.status === "Filed" ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}>{r.status}</Badge></td>
                </tr>
              ))}</tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
