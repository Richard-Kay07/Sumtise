"use client"

import Link from "next/link"
import {
  TrendingUp, Scale, BookOpen, ArrowLeftRight, Clock3, Clock,
  BarChart3, PieChart, Briefcase, Waves, FileSearch, Tags,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"

const BRAND = "#50B0E0"
const DARK  = "#1A1D24"

const TILES = [
  { href: "/reports/income-statement",        icon: TrendingUp,    label: "Income Statement",        desc: "Profit & loss over a period" },
  { href: "/reports/balance-sheet",           icon: Scale,         label: "Balance Sheet",           desc: "Assets, liabilities and equity" },
  { href: "/reports/trial-balance",           icon: BookOpen,      label: "Trial Balance",           desc: "Debit/credit balance verification" },
  { href: "/reports/cashflow",                icon: ArrowLeftRight, label: "Cash Flow Statement",    desc: "Operating, investing, financing flows" },
  { href: "/reports/aged-receivables",        icon: Clock3,        label: "Aged Receivables",        desc: "Outstanding customer balances by age" },
  { href: "/reports/aged-payables",           icon: Clock,         label: "Aged Payables",           desc: "Outstanding supplier balances by age" },
  { href: "/reports/budget-variance",         icon: BarChart3,     label: "Budget Variance",         desc: "Actual vs budgeted performance" },
  { href: "/reports/cost-analysis",           icon: PieChart,      label: "Cost Analysis",           desc: "Breakdown of costs by category" },
  { href: "/reports/project-profitability",   icon: Briefcase,     label: "Project Profitability",   desc: "Revenue and costs per project" },
  { href: "/reports/forecasting",             icon: Waves,         label: "Smart Forecasting",       desc: "AI-assisted financial forecasting" },
  { href: "/reports/tagged-transactions",     icon: FileSearch,    label: "Tagged Transactions",     desc: "Transactions filtered by tags" },
  { href: "/reports/analysis-code-breakdown", icon: Tags,          label: "Analysis Code Breakdown", desc: "Transactions grouped by analysis codes" },
]

export default function ReportsHubPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader crumbs={[{ label: "Dashboard", href: "/" }]} title="Reports" />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold tracking-tight" style={{ color: DARK }}>Reports</h2>
          <p className="text-sm text-gray-500 mt-1">Financial statements, analysis and compliance reports</p>
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
