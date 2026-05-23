"use client"

import Link from "next/link"
import {
  FileText, RefreshCw, RotateCcw, Bell,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"

const BRAND = "#50B0E0"
const DARK  = "#1A1D24"

const TILES = [
  { href: "/invoices/all",        icon: FileText,   label: "All Invoices",       desc: "View and manage all your invoices" },
  { href: "/invoices/recurring",  icon: RefreshCw,  label: "Recurring Invoices", desc: "Set up automated recurring billing" },
  { href: "/invoices/credit-note", icon: RotateCcw, label: "Credit Notes",       desc: "Issue credit notes to customers" },
  { href: "/invoices/reminders",  icon: Bell,       label: "Payment Reminders",  desc: "Chase overdue invoices automatically" },
]

export default function InvoicesHubPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader crumbs={[{ label: "Accounting", href: "/accounting" }]} title="Invoices" />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold tracking-tight" style={{ color: DARK }}>Invoices</h2>
          <p className="text-sm text-gray-500 mt-1">Create, send and track customer invoices</p>
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
