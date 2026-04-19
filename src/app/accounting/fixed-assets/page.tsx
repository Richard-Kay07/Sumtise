"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Building2, Plus } from "lucide-react"

const assets = [
  { ref: "FA-001", name: "Office Premises Lease", category: "Property", cost: 120000, depreciation: 12000, netValue: 108000, method: "Straight Line", status: "Active" },
  { ref: "FA-002", name: "Company Vehicles", category: "Transport", cost: 45000, depreciation: 9000, netValue: 36000, method: "Reducing Balance", status: "Active" },
  { ref: "FA-003", name: "IT Equipment", category: "Technology", cost: 28000, depreciation: 7000, netValue: 21000, method: "Straight Line", status: "Active" },
  { ref: "FA-004", name: "Office Furniture", category: "Furniture", cost: 15000, depreciation: 3000, netValue: 12000, method: "Straight Line", status: "Active" },
  { ref: "FA-005", name: "Old Server Rack", category: "Technology", cost: 8000, depreciation: 8000, netValue: 0, method: "Straight Line", status: "Fully Depreciated" },
]

export default function FixedAssetsPage() {
  const totals = assets.reduce((a, f) => ({ cost: a.cost + f.cost, dep: a.dep + f.depreciation, net: a.net + f.netValue }), { cost: 0, dep: 0, net: 0 })
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#1A1D24" }}>Fixed Assets</h1>
            <p className="text-gray-500">Asset register and depreciation</p>
          </div>
          <Button style={{ backgroundColor: "#50B0E0" }} className="text-white gap-2">
            <Plus className="h-4 w-4" />Add Asset
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          {[
            { label: "Total Cost", value: `£${totals.cost.toLocaleString()}` },
            { label: "Total Depreciation", value: `£${totals.dep.toLocaleString()}` },
            { label: "Net Book Value", value: `£${totals.net.toLocaleString()}` },
          ].map((s) => (
            <Card key={s.label}><CardContent className="pt-5"><p className="text-xs text-gray-500">{s.label}</p><p className="text-2xl font-bold">{s.value}</p></CardContent></Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Asset Register</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-gray-500"><th className="text-left py-3">Ref</th><th className="text-left py-3">Asset</th><th className="text-left py-3">Category</th><th className="text-right py-3">Cost</th><th className="text-right py-3">Depreciation</th><th className="text-right py-3">Net Value</th><th className="text-left py-3">Method</th><th className="text-center py-3">Status</th></tr></thead>
              <tbody>{assets.map((a) => (
                <tr key={a.ref} className="border-b hover:bg-gray-50">
                  <td className="py-3 font-mono text-xs">{a.ref}</td>
                  <td className="py-3 font-medium">{a.name}</td>
                  <td className="py-3 text-gray-500">{a.category}</td>
                  <td className="text-right py-3">£{a.cost.toLocaleString()}</td>
                  <td className="text-right py-3 text-red-500">£{a.depreciation.toLocaleString()}</td>
                  <td className="text-right py-3 font-bold">£{a.netValue.toLocaleString()}</td>
                  <td className="py-3 text-gray-500 text-xs">{a.method}</td>
                  <td className="text-center py-3"><Badge className={a.status === "Active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>{a.status}</Badge></td>
                </tr>
              ))}</tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
