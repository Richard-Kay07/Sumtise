"use client"

import Link from "next/link"
import {
  FileText, Receipt, PiggyBank, RefreshCw, Wallet,
  BookOpen, ArrowLeftRight, Scale, Layers, Package,
  CalendarClock, Settings2, GitBranch, Tags,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"

const BRAND = "#50B0E0"
const DARK  = "#1A1D24"

const TILES = [
  { href: "/invoices",                               icon: FileText,     label: "Invoices",             desc: "Create and manage customer invoices" },
  { href: "/expenses",                               icon: Receipt,      label: "Expenses",              desc: "Record and track business expenses" },
  { href: "/budgets",                                icon: PiggyBank,    label: "Budgets",               desc: "Plan and monitor budgets" },
  { href: "/invoices/recurring",                     icon: RefreshCw,    label: "Recurring Invoices",    desc: "Set up automated recurring billing" },
  { href: "/expenses/payment-run",                   icon: Wallet,       label: "Payment Runs",          desc: "Batch pay multiple supplier invoices" },
  { href: "/transactions/journal",                   icon: BookOpen,     label: "Journals",              desc: "View and post manual journal entries" },
  { href: "/banking/reconciliation",                 icon: ArrowLeftRight, label: "Bank Reconciliation", desc: "Reconcile transactions with bank feeds" },
  { href: "/reports/trial-balance",                  icon: Scale,        label: "Trial Balance",         desc: "Verify debit/credit balance" },
  { href: "/accounting/fixed-assets",                icon: Layers,       label: "Fixed Assets",          desc: "Track and depreciate fixed assets" },
  { href: "/accounting/inventory",                   icon: Package,      label: "Inventory Management",  desc: "Manage stock levels and valuations" },
  { href: "/accounting/period-end",                  icon: CalendarClock, label: "Period End & Close",   desc: "Run period-end close and reconciliations" },
  { href: "/settings/accounting",                    icon: Settings2,    label: "Accounting Settings",   desc: "Accounting periods, methods and defaults" },
  { href: "/settings/accounting/chart-of-accounts",  icon: GitBranch,    label: "Chart of Accounts",    desc: "Manage your COA structure" },
  { href: "/settings/accounting/analysis-codes",     icon: Tags,         label: "Analysis Codes",        desc: "Tag and classify transactions" },
]

export default function AccountingHubPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader crumbs={[{ label: "Dashboard", href: "/" }]} title="Accounting" />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold tracking-tight" style={{ color: DARK }}>Accounting</h2>
          <p className="text-sm text-gray-500 mt-1">Invoices, expenses, banking, assets and period-end controls</p>
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
