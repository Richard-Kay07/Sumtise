"use client"

import Link from "next/link"
import {
  Send, FileText, Banknote, Settings2,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"

const BRAND = "#50B0E0"
const DARK  = "#1A1D24"

const TILES = [
  { href: "/tax/vat-mtd",         icon: Send,      label: "VAT Return (MTD)",  desc: "Submit VAT via Making Tax Digital" },
  { href: "/tax/vat-non-mtd",     icon: FileText,  label: "VAT (Non-MTD)",     desc: "Manual VAT submission and reporting" },
  { href: "/tax/corporation-tax", icon: Banknote,  label: "Corporation Tax",   desc: "CT600 preparation and submission" },
  { href: "/tax/settings",        icon: Settings2, label: "Tax Settings",      desc: "Configure tax rates and periods" },
]

export default function TaxHubPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader crumbs={[{ label: "Dashboard", href: "/" }]} title="Tax" />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold tracking-tight" style={{ color: DARK }}>Tax</h2>
          <p className="text-sm text-gray-500 mt-1">Manage VAT, corporation tax, and compliance</p>
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
