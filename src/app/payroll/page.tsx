"use client"

import Link from "next/link"
import {
  Users, Clock, Banknote, Send, PiggyBank,
  CalendarOff, Receipt, Settings,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"

const BRAND = "#50B0E0"
const DARK  = "#1A1D24"

const TILES = [
  { href: "/payroll/employees",         icon: Users,       label: "Employees",          desc: "Manage employee records and contracts" },
  { href: "/payroll/timesheets",         icon: Clock,       label: "Timesheets",          desc: "Track hours worked and overtime" },
  { href: "/payroll/pay-salaries",       icon: Banknote,    label: "Pay Salaries",        desc: "Run payroll and approve salary payments" },
  { href: "/payroll/rti-submission",     icon: Send,        label: "RTI Submission",      desc: "Submit Real Time Information to HMRC" },
  { href: "/payroll/pension-submission", icon: PiggyBank,   label: "Pension Submission",  desc: "Submit pension contributions" },
  { href: "/payroll/leave",              icon: CalendarOff, label: "Leave",               desc: "Manage holidays and absence requests" },
  { href: "/payroll/taxes-submission",   icon: Receipt,     label: "Taxes Submission",    desc: "Submit payroll taxes and deductions" },
  { href: "/payroll/settings",           icon: Settings,    label: "Payroll Settings",    desc: "Configure payroll periods and rules" },
]

export default function PayrollHubPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader crumbs={[{ label: "Dashboard", href: "/" }]} title="Payroll" />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold tracking-tight" style={{ color: DARK }}>Payroll</h2>
          <p className="text-sm text-gray-500 mt-1">Manage your team, run payroll, and stay compliant</p>
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
