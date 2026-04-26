"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc-client"
import {
  CheckSquare, Square, ChevronRight, Lock, RefreshCw,
  DollarSign, Receipt, CreditCard, Building2, BookOpen,
} from "lucide-react"
import Link from "next/link"

const BRAND = "#50B0E0"

interface CheckItem {
  label:    string
  category: string
  href:     string
  icon:     React.ReactNode
}

const CHECKLIST: CheckItem[] = [
  { label: "Reconcile bank accounts",          category: "Banking",     href: "/banking/reconciliation",        icon: <DollarSign className="h-4 w-4" /> },
  { label: "Review accounts receivable",       category: "Debtors",     href: "/reports/aged-receivables",      icon: <Receipt className="h-4 w-4" /> },
  { label: "Review accounts payable",          category: "Creditors",   href: "/reports/aged-payables",         icon: <CreditCard className="h-4 w-4" /> },
  { label: "Post depreciation journals",       category: "Assets",      href: "/accounting/fixed-assets",       icon: <Building2 className="h-4 w-4" /> },
  { label: "Accrue expenses",                  category: "Accruals",    href: "/transactions/journal",          icon: <BookOpen className="h-4 w-4" /> },
  { label: "Prepayment adjustments",           category: "Prepayments", href: "/transactions/journal",          icon: <BookOpen className="h-4 w-4" /> },
  { label: "VAT reconciliation",               category: "Tax",         href: "/tax/vat-mtd",                   icon: <Receipt className="h-4 w-4" /> },
  { label: "Review P&L variance vs budget",   category: "Reporting",   href: "/reports/budget-variance",       icon: <ChevronRight className="h-4 w-4" /> },
  { label: "Review trial balance",             category: "Reporting",   href: "/reports/trial-balance",         icon: <ChevronRight className="h-4 w-4" /> },
]

export default function PeriodEndPage() {
  const { data: orgs } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgs?.[0]?.id ?? ""

  const [checked, setChecked] = useState<Set<number>>(new Set())
  const toggle = (i: number) =>
    setChecked(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })

  const { data: trialData } = trpc.reports.getTrialBalance.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  )

  const tb = trialData as any
  const totalDebits  = Number(tb?.totalDebits  ?? 0)
  const totalCredits = Number(tb?.totalCredits ?? 0)
  const balanced     = Math.abs(totalDebits - totalCredits) < 0.01
  const fmt = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const done    = checked.size
  const total   = CHECKLIST.length
  const pct     = Math.round((done / total) * 100)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5" style={{ color: BRAND }} />
            <h1 className="text-xl font-bold" style={{ color: "#1A1D24" }}>Period End</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{done}/{total} complete</span>
            <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: BRAND }} />
            </div>
            {done > 0 && (
              <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1"
                onClick={() => setChecked(new Set())}>
                <RefreshCw className="h-3.5 w-3.5" /> Reset
              </Button>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Ledger health */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="rounded-xl">
            <CardContent className="pt-5">
              <p className="text-xs text-gray-500">Total Debits</p>
              <p className="text-2xl font-bold mt-1">{fmt(totalDebits)}</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl">
            <CardContent className="pt-5">
              <p className="text-xs text-gray-500">Total Credits</p>
              <p className="text-2xl font-bold mt-1">{fmt(totalCredits)}</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl">
            <CardContent className="pt-5">
              <p className="text-xs text-gray-500">Ledger Balance</p>
              <p className={`text-2xl font-bold mt-1 ${balanced ? "text-green-600" : "text-red-500"}`}>
                {balanced ? "Balanced ✓" : `Out by ${fmt(Math.abs(totalDebits - totalCredits))}`}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Checklist */}
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckSquare className="h-4 w-4" style={{ color: BRAND }} />
              Period-End Checklist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {Object.entries(
                CHECKLIST.reduce((groups: Record<string, typeof CHECKLIST>, item, i) => {
                  ;(groups[item.category] = groups[item.category] || []).push({ ...item, _idx: i } as any)
                  return groups
                }, {})
              ).map(([cat, items]) => (
                <div key={cat} className="mb-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-1">{cat}</p>
                  {items.map((item: any) => {
                    const i = item._idx
                    const done = checked.has(i)
                    return (
                      <div key={i} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-gray-50 group">
                        <div className="flex items-center gap-3">
                          <button onClick={() => toggle(i)} className="flex-shrink-0">
                            {done
                              ? <CheckSquare className="h-4.5 w-4.5 text-green-500" style={{ width: 18, height: 18 }} />
                              : <Square className="h-4.5 w-4.5 text-gray-300 group-hover:text-gray-400" style={{ width: 18, height: 18 }} />}
                          </button>
                          <span className={`text-sm ${done ? "line-through text-gray-400" : "text-gray-700"}`}>
                            {item.label}
                          </span>
                        </div>
                        <Link href={item.href}
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#50B0E0] opacity-0 group-hover:opacity-100 transition-opacity">
                          Open <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            {done === total && (
              <div className="mt-4 p-4 rounded-xl bg-green-50 border border-green-200 text-center">
                <p className="text-sm font-semibold text-green-700">All period-end tasks completed!</p>
                <p className="text-xs text-green-600 mt-1">Consider locking the period in Settings → Accounting.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
