"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DollarSign, Users, Play, CheckCircle } from "lucide-react"

const employees = [
  { name: "Sarah Johnson", role: "Senior Developer", salary: 6500, paye: 1625, ni: 780, pension: 195, net: 3900 },
  { name: "James Smith", role: "Marketing Manager", salary: 4800, paye: 1152, ni: 576, pension: 144, net: 2928 },
  { name: "Emma Wilson", role: "Accountant", salary: 4200, paye: 966, ni: 504, pension: 126, net: 2604 },
  { name: "Oliver Brown", role: "Sales Executive", salary: 3800, paye: 836, ni: 456, pension: 114, net: 2394 },
]

export default function PaySalariesPage() {
  const totals = employees.reduce((acc, e) => ({
    salary: acc.salary + e.salary, paye: acc.paye + e.paye, ni: acc.ni + e.ni,
    pension: acc.pension + e.pension, net: acc.net + e.net
  }), { salary: 0, paye: 0, ni: 0, pension: 0, net: 0 })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#1A1D24" }}>Pay Salaries & Wages</h1>
            <p className="text-gray-500">April 2024 Pay Run</p>
          </div>
          <Button style={{ backgroundColor: "#50B0E0" }} className="text-white gap-2">
            <Play className="h-4 w-4" />Process Pay Run
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-4 mb-6">
          {[
            { label: "Employees", value: employees.length, icon: <Users className="h-5 w-5 text-gray-400" /> },
            { label: "Total Gross", value: `£${totals.salary.toLocaleString()}`, icon: <DollarSign className="h-5 w-5 text-gray-400" /> },
            { label: "Total PAYE & NI", value: `£${(totals.paye + totals.ni).toLocaleString()}`, icon: <DollarSign className="h-5 w-5 text-gray-400" /> },
            { label: "Total Net Pay", value: `£${totals.net.toLocaleString()}`, icon: <CheckCircle className="h-5 w-5 text-green-500" /> },
          ].map((s) => (
            <Card key={s.label}><CardContent className="pt-5"><div className="flex items-center gap-3">{s.icon}<div><p className="text-xs text-gray-500">{s.label}</p><p className="text-xl font-bold">{s.value}</p></div></div></CardContent></Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle>Employee Pay Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-gray-500"><th className="text-left py-3 px-4">Employee</th><th className="text-right py-3 px-4">Gross</th><th className="text-right py-3 px-4">PAYE</th><th className="text-right py-3 px-4">NI</th><th className="text-right py-3 px-4">Pension</th><th className="text-right py-3 px-4">Net Pay</th></tr></thead>
                <tbody>{employees.map((e) => (
                  <tr key={e.name} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4"><div className="font-medium">{e.name}</div><div className="text-xs text-gray-400">{e.role}</div></td>
                    <td className="text-right py-3 px-4">£{e.salary.toLocaleString()}</td>
                    <td className="text-right py-3 px-4 text-red-500">£{e.paye.toLocaleString()}</td>
                    <td className="text-right py-3 px-4 text-red-500">£{e.ni.toLocaleString()}</td>
                    <td className="text-right py-3 px-4 text-orange-500">£{e.pension.toLocaleString()}</td>
                    <td className="text-right py-3 px-4 font-bold text-green-600">£{e.net.toLocaleString()}</td>
                  </tr>
                ))}</tbody>
                <tfoot><tr className="bg-gray-50 font-bold"><td className="py-3 px-4">Total</td><td className="text-right py-3 px-4">£{totals.salary.toLocaleString()}</td><td className="text-right py-3 px-4 text-red-500">£{totals.paye.toLocaleString()}</td><td className="text-right py-3 px-4 text-red-500">£{totals.ni.toLocaleString()}</td><td className="text-right py-3 px-4 text-orange-500">£{totals.pension.toLocaleString()}</td><td className="text-right py-3 px-4 text-green-600">£{totals.net.toLocaleString()}</td></tr></tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
