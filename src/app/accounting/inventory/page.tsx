"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { trpc } from "@/lib/trpc-client"
import { Plus, Search, Package, AlertTriangle } from "lucide-react"
import Link from "next/link"

const BRAND = "#50B0E0"
const fmt   = (n: number) => `£${Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function InventoryPage() {
  const { data: orgs } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgs?.[0]?.id ?? ""

  const [search,   setSearch]   = useState("")
  const [lowStock, setLowStock] = useState(false)
  const [page,     setPage]     = useState(1)

  const { data, isLoading } = trpc.inventory.list.useQuery(
    { organizationId: orgId, search: search || undefined, lowStock: lowStock || undefined, page, limit: 20 },
    { enabled: !!orgId }
  )

  const { data: valuation } = trpc.inventory.getStockValuation.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  )

  const items      = (data as any)?.items ?? []
  const pagination = (data as any)?.pagination
  const val        = valuation as any
  const totalValue = Number(val?.totalValue ?? 0)
  const lowStockCount = Number(val?.lowStockCount ?? 0)
  const totalItems = pagination?.total ?? 0

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5" style={{ color: BRAND }} />
            <h1 className="text-xl font-bold" style={{ color: "#1A1D24" }}>Inventory</h1>
          </div>
          <Link href="/accounting/inventory/new">
            <Button className="rounded-xl text-xs gap-1" style={{ backgroundColor: BRAND }}>
              <Plus className="h-3.5 w-3.5" /> New Item
            </Button>
          </Link>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: "Total Items",        value: totalItems.toString() },
            { label: "Total Stock Value",  value: fmt(totalValue) },
            { label: "Low Stock Alerts",   value: lowStockCount.toString() },
            { label: "Categories",         value: (val?.byCategory?.length ?? 0).toString() },
          ].map(c => (
            <Card key={c.label} className="rounded-xl">
              <CardContent className="pt-5">
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className="text-2xl font-bold mt-1">{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
            <Input placeholder="Search SKU or name…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="pl-8 h-8 text-xs rounded-xl w-52" />
          </div>
          <button onClick={() => { setLowStock(b => !b); setPage(1) }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              lowStock ? "text-white border-transparent" : "text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-600"
            }`} style={lowStock ? { backgroundColor: "#F97316", borderColor: "#F97316" } : {}}>
            <AlertTriangle className="h-3.5 w-3.5" /> Low Stock
          </button>
        </div>

        <Card className="rounded-xl overflow-hidden">
          {isLoading ? (
            <CardContent className="py-12 text-center text-gray-400 text-sm">Loading…</CardContent>
          ) : items.length === 0 ? (
            <CardContent className="py-12 text-center">
              <Package className="mx-auto h-10 w-10 text-gray-200 mb-3" />
              <p className="text-sm text-gray-500">No inventory items found.</p>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-left text-xs text-gray-500">
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Costing</th>
                    <th className="px-4 py-3 text-right">Qty on Hand</th>
                    <th className="px-4 py-3 text-right">Unit Cost</th>
                    <th className="px-4 py-3 text-right">Stock Value</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any) => (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                      onClick={() => (window.location.href = `/accounting/inventory/${item.id}`)}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.sku}</td>
                      <td className="px-4 py-3 font-medium">{item.name}</td>
                      <td className="px-4 py-3 text-gray-500">{item.category ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{(item.costingMethod ?? "WEIGHTED_AVG").replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className={item.isLowStock ? "text-orange-600 font-semibold" : ""}>
                          {Number(item.quantityOnHand).toLocaleString("en-GB", { maximumFractionDigits: 2 })}
                        </span>
                        {item.isLowStock && <AlertTriangle className="inline h-3 w-3 ml-1 text-orange-500" />}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{fmt(Number(item.unitCost))}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">{fmt(Number(item.stockValue))}</td>
                      <td className="px-4 py-3">
                        <Badge className={item.isActive ? "bg-green-100 text-green-700 text-xs" : "bg-gray-100 text-gray-500 text-xs"}>
                          {item.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{pagination.total} items</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-7 rounded-lg" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <span className="px-3 py-1">{page} / {pagination.totalPages}</span>
              <Button variant="outline" size="sm" className="h-7 rounded-lg" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
