"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Receipt, CreditCard } from "lucide-react"

const payments = [
  { period: "March 2024", paye: 2461, ni: 1812, studentLoan: 0, total: 4273, due: "19/04/2024", status: "Paid" },
  { period: "February 2024", paye: 2461, ni: 1812, studentLoan: 0, total: 4273, due: "19/03/2024", status: "Paid" },
  { period: "January 2024", paye: 2400, ni: 1770, studentLoan: 0, total: 4170, due: "19/02/2024", status: "Paid" },
]

export default function TaxesSubmissionPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#1A1D24" }}>Taxes Submission</h1>
            <p className="text-gray-500">PAYE and National Insurance payments to HMRC</p>
          </div>
          <Button style={{ backgroundColor: "#50B0E0" }} className="text-white gap-2">
            <CreditCard className="h-4 w-4" />Pay HMRC
          </Button>
        </div>
        <Card className="mb-6 border-l-4" style={{ borderLeftColor: "#50B0E0" }}>
          <CardHeader><CardTitle>April 2024 – Payment Due 19 May 2024</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6 text-center">
              <div><p className="text-sm text-gray-500">PAYE</p><p className="text-2xl font-bold">£2,461</p></div>
              <div><p className="text-sm text-gray-500">National Insurance</p><p className="text-2xl font-bold">£1,812</p></div>
              <div><p className="text-sm text-gray-500">Total Due to HMRC</p><p className="text-2xl font-bold text-red-600">£4,273</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" />Payment History</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-gray-500"><th className="text-left py-3">Period</th><th className="text-right py-3">PAYE</th><th className="text-right py-3">NI</th><th className="text-right py-3">Student Loan</th><th className="text-right py-3">Total</th><th className="text-right py-3">Due Date</th><th className="text-center py-3">Status</th></tr></thead>
              <tbody>{payments.map((p) => (
                <tr key={p.period} className="border-b hover:bg-gray-50">
                  <td className="py-3 font-medium">{p.period}</td>
                  <td className="text-right py-3">£{p.paye.toLocaleString()}</td>
                  <td className="text-right py-3">£{p.ni.toLocaleString()}</td>
                  <td className="text-right py-3">£{p.studentLoan}</td>
                  <td className="text-right py-3 font-bold">£{p.total.toLocaleString()}</td>
                  <td className="text-right py-3 text-gray-400">{p.due}</td>
                  <td className="text-center py-3"><Badge className="bg-green-100 text-green-800">{p.status}</Badge></td>
                </tr>
              ))}</tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
