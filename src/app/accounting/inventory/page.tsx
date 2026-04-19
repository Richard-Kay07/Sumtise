"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Package, Plus } from "lucide-react"

const items = [
  { sku: "ITEM-001", name: "Office Chairs", category: "Furniture", qty: 12, value: 4800, status: "In Stock" },
  { sku: "ITEM-002", name: "Standing Desks", category: "Furniture", qty: 6, value: 5400, status: "In Stock" },
  { sku: "ITEM-003", name: "Laptops", category: "Electronics", qty: 8, value: 9600, status: "In Stock" },
  { sku: "ITEM-004", name: "Monitor 27\"", category: "Electronics", qty: 2, value: 800, status: "Low Stock" },
  { sku: "ITEM-005", name: "Printer Paper", category: "Supplies", qty: 0, value: 0, status: "Out of Stock" },
]

export default function InventoryPage() {
  const totalValue = items.reduce((s, i) => s + i.value, 0)
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#1A1D24" }}>Inventory</h1>
            <p className="text-gray-500">Stock and asset tracking</p>
          </div>
          <Button style={{ backgroundColor: "#50B0E0" }} className="text-white gap-2">
            <Plus className="h-4 w-4" />Add Item
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          {[
            { label: "Total Items", value: items.length },
            { label: "Total Value", value: `£${totalValue.toLocaleString()}` },
            { label: "Low / Out of Stock", value: items.filter(i => i.status !== "In Stock").length },
          ].map((s) => (
            <Card key={s.label}><CardContent className="pt-5"><p className="text-xs text-gray-500">{s.label}</p><p className="text-2xl font-bold">{s.value}</p></CardContent></Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Stock Items</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-gray-500"><th className="text-left py-3">SKU</th><th className="text-left py-3">Name</th><th className="text-left py-3">Category</th><th className="text-right py-3">Qty</th><th className="text-right py-3">Value</th><th className="text-center py-3">Status</th></tr></thead>
              <tbody>{items.map((i) => (
                <tr key={i.sku} className="border-b hover:bg-gray-50">
                  <td className="py-3 font-mono text-xs">{i.sku}</td>
                  <td className="py-3 font-medium">{i.name}</td>
                  <td className="py-3 text-gray-500">{i.category}</td>
                  <td className="text-right py-3">{i.qty}</td>
                  <td className="text-right py-3">£{i.value.toLocaleString()}</td>
                  <td className="text-center py-3">
                    <Badge className={i.status === "In Stock" ? "bg-green-100 text-green-800" : i.status === "Low Stock" ? "bg-orange-100 text-orange-800" : "bg-red-100 text-red-800"}>{i.status}</Badge>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
