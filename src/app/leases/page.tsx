"use client"

import Link from "next/link"
import { Building, PlusCircle, BarChart3, FileText } from "lucide-react"
import { PageHeader } from "@/components/page-header"

const BRAND = "#50B0E0"
const DARK  = "#1A1D24"

const TILES = [
  { href: "/leases/all",                    icon: Building,   label: "All Leases",          desc: "View and manage all lease contracts" },
  { href: "/leases/new",                    icon: PlusCircle, label: "New Lease",            desc: "Register a new IFRS 16 lease" },
  { href: "/reports/cost-analysis",         icon: BarChart3,  label: "Lease Cost Analysis", desc: "Analyse lease costs and obligations" },
  { href: "/reports/balance-sheet",         icon: FileText,   label: "Balance Sheet",        desc: "View lease liabilities on balance sheet" },
]

export default function LeasesHubPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader crumbs={[{ label: "Projects", href: "/projects" }]} title="Leases" />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold tracking-tight" style={{ color: DARK }}>Lease Register</h2>
          <p className="text-sm text-gray-500 mt-1">IFRS 16 lease accounting, contracts and schedules</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {TILES.map(({ href, icon: Icon, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col gap-3 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:border-[#50B0E0]/40 transition-all"
            >
              <span
                className="flex items-center justify-center w-10 h-10 rounded-xl transition-colors"
                style={{ backgroundColor: `${BRAND}18`, color: BRAND }}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-gray-900 group-hover:text-[#50B0E0] transition-colors">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
