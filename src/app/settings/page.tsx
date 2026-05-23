"use client"

import Link from "next/link"
import {
  Building2, UserCog, Globe, CreditCard, Settings2,
  GitBranch, LayoutGrid, DollarSign, BookOpen, Users, Tags,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"

const BRAND = "#50B0E0"
const DARK  = "#1A1D24"

const TILES = [
  { href: "/settings/organisation",                 icon: Building2,  label: "Organisation",        desc: "Company details, branding and preferences" },
  { href: "/settings/profile",                      icon: UserCog,    label: "Profile",             desc: "Your personal account settings" },
  { href: "/settings/integrations",                 icon: Globe,      label: "Integrations",        desc: "Connect third-party apps and services" },
  { href: "/settings/billing",                      icon: CreditCard, label: "Billing & Plan",      desc: "Subscription, invoices and usage" },
  { href: "/settings/accounting",                   icon: Settings2,  label: "Accounting",          desc: "Accounting periods, methods and defaults" },
  { href: "/settings/accounting/chart-of-accounts", icon: GitBranch,  label: "Chart of Accounts",   desc: "Manage your COA structure" },
  { href: "/settings/modules",                      icon: LayoutGrid, label: "Module Settings",     desc: "Enable or disable app modules" },
  { href: "/settings/currency",                     icon: DollarSign, label: "Multi-Currency / FX", desc: "Exchange rates and currency settings" },
  { href: "/settings/payroll-coa",                  icon: BookOpen,   label: "Payroll COA",         desc: "Payroll chart of accounts mapping" },
  { href: "/settings/related-parties",              icon: Users,      label: "Related Parties",     desc: "Manage related party relationships" },
  { href: "/settings/wga-codes",                    icon: Tags,       label: "WGA / CPID Codes",    desc: "Whole of Government Accounts codes" },
]

export default function SettingsHubPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader crumbs={[{ label: "Dashboard", href: "/" }]} title="Settings" />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold tracking-tight" style={{ color: DARK }}>Settings</h2>
          <p className="text-sm text-gray-500 mt-1">Configure your organisation, modules and preferences</p>
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
