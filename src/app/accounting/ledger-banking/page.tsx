"use client"

import Link from "next/link"
import { BookOpen, Upload, ClipboardCheck, ArrowLeftRight, Landmark, CreditCard } from "lucide-react"
import { PageHeader } from "@/components/page-header"

const BRAND = "#50B0E0"
const DARK  = "#1A1D24"

const JOURNAL_TILES = [
  { href: "/transactions/journal",        icon: BookOpen,       label: "Manual Journals",   desc: "Create, review and post manual journal entries" },
  { href: "/transactions/journal/import", icon: Upload,         label: "Journal Upload",    desc: "Import journals from Excel or CSV spreadsheet" },
  { href: "/approvals",                   icon: ClipboardCheck, label: "Journal Approvals", desc: "Review and authorise journals pending approval" },
]

const BANKING_TILES = [
  { href: "/banking",               icon: Landmark,      label: "Banking",               desc: "Bank accounts, feeds and transaction overview" },
  { href: "/banking/reconciliation",icon: ArrowLeftRight,label: "Bank Reconciliation",   desc: "Match transactions against bank statements" },
  { href: "/banking/import",        icon: CreditCard,    label: "Import Transactions",   desc: "Import bank statements from CSV or OFX files" },
]

function TileGrid({ tiles }: { tiles: typeof JOURNAL_TILES }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map(({ href, icon: Icon, label, desc }) => (
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
  )
}

export default function LedgerBankingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader crumbs={[{ label: "Accounting", href: "/accounting" }]} title="Ledger & Banking" />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">

        {/* Journals section */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold tracking-tight" style={{ color: DARK }}>Journals</h2>
            <p className="text-sm text-gray-500 mt-0.5">Manual journal entries, bulk upload and approval workflow</p>
          </div>
          <TileGrid tiles={JOURNAL_TILES} />
        </section>

        {/* Banking section */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold tracking-tight" style={{ color: DARK }}>Banking</h2>
            <p className="text-sm text-gray-500 mt-0.5">Bank accounts, statement imports and reconciliation</p>
          </div>
          <TileGrid tiles={BANKING_TILES} />
        </section>

      </main>
    </div>
  )
}
