"use client"

import Link from "next/link"
import {
  Briefcase, BarChart3, BadgePercent, FileText,
  Building, PlusCircle, ScrollText,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"

const BRAND = "#50B0E0"
const DARK  = "#1A1D24"

const TILES = [
  { href: "/projects/all",  icon: Briefcase,   label: "All Projects",           desc: "View and manage all project accounts" },
  { href: "/grants",        icon: BadgePercent, label: "Grants Management",      desc: "Manage grants, funding and reporting" },
  { href: "/leases",        icon: Building,    label: "Lease Register",         desc: "IFRS 16 lease contracts and schedules" },
  { href: "/reports/project-profitability", icon: BarChart3, label: "Project Profitability", desc: "Revenue and costs per project" },
  { href: "/reports/cost-analysis",         icon: FileText,  label: "Cost Analysis",         desc: "Breakdown of costs by category" },
]

export default function ProjectsHubPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader crumbs={[{ label: "Dashboard", href: "/" }]} title="Projects" />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold tracking-tight" style={{ color: DARK }}>Projects</h2>
          <p className="text-sm text-gray-500 mt-1">Project accounting, grants management and IFRS 16 leases</p>
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
