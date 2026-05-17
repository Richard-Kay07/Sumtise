"use client"

import { useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { trpc } from "@/lib/trpc-client"
import {
  Plus, Trash2, Pencil, Loader2, CheckCircle,
  AlertTriangle, TrendingUp, TrendingDown, Lock, Info,
  PiggyBank, Copy,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"

const BRAND = "#50B0E0"
const fmt = (n: number | string, currency = "GBP") =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(n))

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:    { label: "Draft",    color: "text-gray-600",  bg: "bg-gray-100" },
  APPROVED: { label: "Approved", color: "text-blue-700",  bg: "bg-blue-100" },
  ACTIVE:   { label: "Active",   color: "text-green-700", bg: "bg-green-100" },
  CLOSED:   { label: "Closed",   color: "text-orange-700",bg: "bg-orange-100" },
  ARCHIVED: { label: "Archived", color: "text-gray-400",  bg: "bg-gray-50" },
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT:    ["APPROVED"],
  APPROVED: ["ACTIVE", "DRAFT"],
  ACTIVE:   ["CLOSED"],
  CLOSED:   ["ARCHIVED"],
  ARCHIVED: [],
}

const TYPE_ORDER = ["REVENUE", "ASSET", "LIABILITY", "EQUITY", "EXPENSE"]

// ─── Account selector ─────────────────────────────────────────────────────────

function AccountOption({ account }: { account: any }) {
  return (
    <option value={account.id}>
      {account.code} — {account.name}
      {account.subType ? ` (${account.subType.replace(/_/g, " ")})` : ""}
    </option>
  )
}

// ─── Add / Edit line modal ────────────────────────────────────────────────────

type LineForm = {
  accountId:      string
  description:    string
  budgetedAmount: string
  periodStart:    string
  periodEnd:      string
  notes:          string
}

function LineModal({
  open,
  onClose,
  orgId,
  budgetPeriodStart,
  budgetPeriodEnd,
  accounts,
  initialValues,
  onSave,
  isPending,
  error,
  title,
}: {
  open:             boolean
  onClose:          () => void
  orgId:            string
  budgetPeriodStart: string
  budgetPeriodEnd:   string
  accounts:         any[]
  initialValues?:   Partial<LineForm>
  onSave:           (f: LineForm) => void
  isPending:        boolean
  error?:           string
  title:            string
}) {
  const [form, setForm] = useState<LineForm>({
    accountId:      initialValues?.accountId      ?? "",
    description:    initialValues?.description    ?? "",
    budgetedAmount: initialValues?.budgetedAmount ?? "",
    periodStart:    initialValues?.periodStart    ?? budgetPeriodStart,
    periodEnd:      initialValues?.periodEnd      ?? budgetPeriodEnd,
    notes:          initialValues?.notes          ?? "",
  })
  const set = (patch: Partial<LineForm>) => setForm(f => ({ ...f, ...patch }))

  // Group accounts by type
  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {}
    for (const acc of accounts) {
      if (!groups[acc.type]) groups[acc.type] = []
      groups[acc.type].push(acc)
    }
    return groups
  }, [accounts])

  const selectedAccount = accounts.find(a => a.id === form.accountId)
  const valid = form.accountId && form.budgetedAmount && Number(form.budgetedAmount) > 0

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">

          {/* Account selector */}
          <div>
            <Label>Account <span className="text-red-400">*</span></Label>
            <select
              value={form.accountId}
              onChange={e => set({ accountId: e.target.value })}
              className="mt-1 w-full h-10 px-3 rounded-xl border border-input bg-background text-sm"
            >
              <option value="">— Select an account —</option>
              {TYPE_ORDER
                .filter(t => grouped[t]?.length)
                .map(type => (
                  <optgroup key={type} label={type}>
                    {grouped[type].map(acc => (
                      <AccountOption key={acc.id} account={acc} />
                    ))}
                  </optgroup>
                ))}
            </select>
          </div>

          {/* Selected account info panel */}
          {selectedAccount && (
            <div className="flex items-start gap-2 bg-[#50B0E0]/6 border border-[#50B0E0]/20 rounded-xl p-3 text-xs text-gray-600">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[#50B0E0]" />
              <div>
                <p className="font-medium text-gray-800">
                  {selectedAccount.code} — {selectedAccount.name}
                </p>
                {selectedAccount.description && (
                  <p className="mt-0.5 text-gray-500">{selectedAccount.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    selectedAccount.normalBalance === "DR"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-green-100 text-green-700"
                  }`}>
                    {selectedAccount.normalBalance}
                  </span>
                  <span className="text-gray-400">{selectedAccount.type}</span>
                  {selectedAccount.subType && (
                    <span className="text-gray-400">· {selectedAccount.subType.replace(/_/g, " ")}</span>
                  )}
                </div>
                {selectedAccount.type === "REVENUE" && (
                  <p className="mt-1 text-[#50B0E0]">
                    Income account — favourable variance = actual &gt; budgeted
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            <Label>Description</Label>
            <Input
              className="mt-1 rounded-xl"
              placeholder="Optional line description"
              value={form.description}
              onChange={e => set({ description: e.target.value })}
            />
          </div>

          <div>
            <Label>Budgeted Amount <span className="text-red-400">*</span></Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
              <Input
                className="pl-7 rounded-xl"
                type="number"
                min="0"
                step="100"
                placeholder="0"
                value={form.budgetedAmount}
                onChange={e => set({ budgetedAmount: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Period Start</Label>
              <Input
                type="date"
                className="mt-1 rounded-xl"
                value={form.periodStart}
                onChange={e => set({ periodStart: e.target.value })}
              />
            </div>
            <div>
              <Label>Period End</Label>
              <Input
                type="date"
                className="mt-1 rounded-xl"
                value={form.periodEnd}
                onChange={e => set({ periodEnd: e.target.value })}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-xl p-3">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="flex-1 rounded-xl text-white"
              style={{ backgroundColor: BRAND }}
              disabled={!valid || isPending}
              onClick={() => onSave(form)}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Line"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BudgetDetailPage() {
  const params   = useParams()
  const router   = useRouter()
  const budgetId = params?.id as string

  const { data: orgs }  = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgs?.[0]?.id ?? ""

  const { data: budget, isLoading, refetch } = trpc.budgets.getById.useQuery(
    { organizationId: orgId, id: budgetId },
    { enabled: !!orgId && !!budgetId }
  )

  const { data: accounts = [] } = trpc.budgets.getAvailableAccounts.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  )

  const updateBudget = trpc.budgets.update.useMutation({ onSuccess: () => refetch() })
  const deleteBudget = trpc.budgets.delete.useMutation({
    onSuccess: () => router.push("/budgets"),
  })
  const addLine    = trpc.budgets.addLine.useMutation({ onSuccess: () => { setShowAddLine(false); refetch() } })
  const updateLine = trpc.budgets.updateLine.useMutation({ onSuccess: () => { setEditLine(null); refetch() } })
  const deleteLine = trpc.budgets.deleteLine.useMutation({ onSuccess: () => refetch() })
  const copyBudget = trpc.budgets.copyBudget.useMutation({
    onSuccess: (b) => router.push(`/budgets/${b.id}`),
  })

  const [showAddLine,   setShowAddLine]   = useState(false)
  const [editLine,      setEditLine]      = useState<any | null>(null)
  const [showCopy,      setShowCopy]      = useState(false)
  const [copyName,      setCopyName]      = useState("")
  const [copyStart,     setCopyStart]     = useState("")
  const [copyEnd,       setCopyEnd]       = useState("")

  if (isLoading || !budget) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
      </div>
    )
  }

  const b       = budget as any
  const lines   = b.lines ?? []
  const status  = b.status
  const cfg     = STATUS_CFG[status] ?? STATUS_CFG.DRAFT
  const transitions = STATUS_TRANSITIONS[status] ?? []
  const isEditable  = status === "DRAFT"

  const periodFmt = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })

  const periodStart = b.periodStart?.slice?.(0, 10) ?? ""
  const periodEnd   = b.periodEnd?.slice?.(0, 10)   ?? ""

  // Totals — revenue accounts contribute to income, expense to costs
  const ZERO = 0
  const totalBudgeted = lines.reduce((s: number, l: any) => s + Number(l.budgetedAmount), ZERO)
  const totalActual   = lines.reduce((s: number, l: any) => s + Number(l.actualAmount),   ZERO)
  const totalVariance = totalBudgeted - totalActual

  // Group lines by account type for display
  const linesByType = useMemo(() => {
    const groups: Record<string, any[]> = {}
    for (const line of lines) {
      const t = line.account?.type ?? "EXPENSE"
      if (!groups[t]) groups[t] = []
      groups[t].push(line)
    }
    return groups
  }, [lines])

  return (
    <div className="min-h-screen bg-gray-50">

      <PageHeader
        crumbs={[{ label: "Budgets", href: "/budgets" }]}
        title={b.name}
        icon={<PiggyBank className="h-4 w-4" />}
        actions={
          <div className="flex items-center gap-2">
            {/* Status badge */}
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
              {cfg.label}
            </span>
            {b.budgetType && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-500 uppercase tracking-wide">
                {b.budgetType}
              </span>
            )}
            {/* Status transitions */}
            {transitions.map(next => (
              <Button
                key={next}
                size="sm"
                variant="outline"
                className="rounded-lg text-xs"
                disabled={updateBudget.isPending}
                onClick={() => updateBudget.mutate({ organizationId: orgId, id: budgetId, status: next as any })}
              >
                {next === "APPROVED" ? "Approve" :
                 next === "ACTIVE"   ? "Activate" :
                 next === "CLOSED"   ? "Close" :
                 next === "ARCHIVED" ? "Archive" :
                 next === "DRAFT"    ? "Reopen" : next}
              </Button>
            ))}

            <Button
              size="sm" variant="outline" className="rounded-lg text-xs gap-1.5"
              onClick={() => { setCopyName(`${b.name} (Copy)`); setShowCopy(true) }}
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </Button>

            {isEditable && (
              <Button
                size="sm" variant="ghost" className="rounded-lg text-xs text-red-500 hover:bg-red-50"
                disabled={deleteBudget.isPending}
                onClick={() => {
                  if (confirm("Delete this draft budget and all its lines?")) {
                    deleteBudget.mutate({ organizationId: orgId, id: budgetId })
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}

            {isEditable && (
              <Button
                size="sm"
                className="rounded-lg text-white text-xs gap-1.5"
                style={{ backgroundColor: BRAND }}
                onClick={() => setShowAddLine(true)}
              >
                <Plus className="h-3.5 w-3.5" /> Add Line
              </Button>
            )}
          </div>
        }
      />

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">

        {/* Meta strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Period", value: `${periodFmt(b.periodStart)} – ${periodFmt(b.periodEnd)}` },
            { label: "Currency", value: b.currency ?? "GBP" },
            { label: "Project", value: b.project?.name ?? "—" },
            { label: "Lines", value: lines.length.toString() },
          ].map(({ label, value }) => (
            <Card key={label} className="rounded-xl border-gray-100 shadow-sm">
              <CardContent className="pt-4 pb-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
                <p className="text-sm font-semibold text-gray-700 mt-0.5 truncate">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Summary totals */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Budgeted", value: fmt(totalBudgeted, b.currency),
              sub: `${lines.length} line${lines.length !== 1 ? "s" : ""}`, color: "" },
            { label: "Total Actual", value: fmt(totalActual, b.currency),
              sub: "from posted transactions", color: "" },
            { label: "Net Variance", value: fmt(Math.abs(totalVariance), b.currency),
              sub: totalVariance >= 0 ? "under budget" : "over budget",
              color: totalVariance >= 0 ? "text-green-600" : "text-red-600" },
          ].map(c => (
            <Card key={c.label} className="rounded-xl border-gray-100 shadow-sm">
              <CardContent className="pt-4 pb-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{c.label}</p>
                <p className={`text-xl font-bold mt-0.5 ${c.color}`}>{c.value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{c.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Lines table — grouped by account type */}
        {lines.length === 0 ? (
          <Card className="rounded-2xl border-gray-100 shadow-sm">
            <CardContent className="py-16 text-center text-gray-400">
              <PiggyBank className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No budget lines yet</p>
              {isEditable && (
                <Button
                  className="mt-4 rounded-xl text-white"
                  style={{ backgroundColor: BRAND }}
                  onClick={() => setShowAddLine(true)}
                >
                  <Plus className="h-4 w-4 mr-1.5" /> Add First Line
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {TYPE_ORDER.filter(t => linesByType[t]?.length).map(type => {
              const typeLines = linesByType[type] ?? []
              const typeTotal = typeLines.reduce((s: number, l: any) => s + Number(l.budgetedAmount), 0)
              const typeActual = typeLines.reduce((s: number, l: any) => s + Number(l.actualAmount), 0)

              return (
                <Card key={type} className="rounded-2xl border-gray-100 shadow-sm overflow-hidden">
                  <CardHeader className="pb-2 pt-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold text-gray-700">{type}</CardTitle>
                      <div className="text-xs text-gray-400 font-mono">
                        {fmt(typeActual, b.currency)} / {fmt(typeTotal, b.currency)}
                      </div>
                    </div>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-y border-gray-100">
                        <tr className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          <th className="px-4 py-2.5">Account</th>
                          <th className="px-4 py-2.5 hidden md:table-cell">Description</th>
                          <th className="px-4 py-2.5 text-center w-12 hidden lg:table-cell">NB</th>
                          <th className="px-4 py-2.5 text-right">Budgeted</th>
                          <th className="px-4 py-2.5 text-right">Actual</th>
                          <th className="px-4 py-2.5 text-right">Variance</th>
                          <th className="px-4 py-2.5 w-10" />
                        </tr>
                      </thead>
                      <tbody>
                        {typeLines.map((line: any) => {
                          const budgeted   = Number(line.budgetedAmount)
                          const actual     = Number(line.actualAmount)
                          const isRevenue  = line.account?.type === "REVENUE" || line.account?.normalBalance === "CR"
                          const rawVar     = budgeted - actual
                          const variance   = isRevenue ? -rawVar : rawVar
                          const favourable = variance >= 0
                          const pct        = budgeted > 0 ? Math.abs((actual - budgeted) / budgeted * 100) : null

                          return (
                            <tr key={line.id} className={`border-b last:border-0 hover:bg-gray-50/60 transition-colors ${!favourable ? "bg-red-50/20" : ""}`}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-xs text-gray-400">{line.account?.code}</span>
                                  <span className="font-medium text-gray-800 text-xs">{line.account?.name}</span>
                                  {line.account?.isControlAccount && (
                                    <Lock className="h-3 w-3 text-amber-400" title="Control account" />
                                  )}
                                </div>
                                {line.account?.subType && (
                                  <p className="text-[10px] text-gray-400 mt-0.5 ml-0">
                                    {line.account.subType.replace(/_/g, " ")}
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">
                                {line.description ?? "—"}
                              </td>
                              <td className="px-4 py-3 text-center hidden lg:table-cell">
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  line.account?.normalBalance === "DR"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-green-100 text-green-700"
                                }`}>
                                  {line.account?.normalBalance ?? "DR"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-xs">{fmt(budgeted, b.currency)}</td>
                              <td className="px-4 py-3 text-right font-mono text-xs">{fmt(actual, b.currency)}</td>
                              <td className={`px-4 py-3 text-right font-mono text-xs font-semibold ${
                                favourable ? "text-green-600" : "text-red-600"
                              }`}>
                                <div className="flex items-center justify-end gap-1">
                                  {favourable
                                    ? <TrendingDown className="h-3 w-3" />
                                    : <TrendingUp className="h-3 w-3" />}
                                  {!favourable && "("}
                                  {fmt(Math.abs(variance), b.currency)}
                                  {!favourable && ")"}
                                  {pct != null && (
                                    <span className="text-[10px] opacity-70 ml-0.5">
                                      {pct.toFixed(0)}%
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                {isEditable && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      className="text-gray-300 hover:text-blue-500 transition-colors p-0.5"
                                      onClick={() => setEditLine(line)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      className="text-gray-300 hover:text-red-500 transition-colors p-0.5"
                                      onClick={() => {
                                        if (confirm("Remove this budget line?")) {
                                          deleteLine.mutate({ organizationId: orgId, lineId: line.id })
                                        }
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {/* Description / Notes */}
        {(b.description || b.notes) && (
          <Card className="rounded-2xl border-gray-100 shadow-sm">
            <CardContent className="pt-4 pb-4 space-y-2">
              {b.description && <p className="text-sm text-gray-600">{b.description}</p>}
              {b.notes && <p className="text-xs text-gray-400 italic">{b.notes}</p>}
            </CardContent>
          </Card>
        )}
      </main>

      {/* Add line modal */}
      {showAddLine && (
        <LineModal
          open={showAddLine}
          onClose={() => setShowAddLine(false)}
          orgId={orgId}
          budgetPeriodStart={periodStart}
          budgetPeriodEnd={periodEnd}
          accounts={accounts as any[]}
          title="Add Budget Line"
          isPending={addLine.isPending}
          error={addLine.error?.message}
          onSave={f => addLine.mutate({
            organizationId: orgId,
            budgetId,
            accountId:      f.accountId,
            description:    f.description || undefined,
            budgetedAmount: f.budgetedAmount,
            periodStart:    f.periodStart,
            periodEnd:      f.periodEnd,
            notes:          f.notes || undefined,
          })}
        />
      )}

      {/* Edit line modal */}
      {editLine && (
        <LineModal
          open={!!editLine}
          onClose={() => setEditLine(null)}
          orgId={orgId}
          budgetPeriodStart={periodStart}
          budgetPeriodEnd={periodEnd}
          accounts={accounts as any[]}
          title={`Edit — ${editLine.account?.code} ${editLine.account?.name}`}
          isPending={updateLine.isPending}
          error={updateLine.error?.message}
          initialValues={{
            accountId:      editLine.accountId,
            description:    editLine.description ?? "",
            budgetedAmount: String(Number(editLine.budgetedAmount)),
            periodStart:    editLine.periodStart?.slice?.(0, 10) ?? periodStart,
            periodEnd:      editLine.periodEnd?.slice?.(0, 10)   ?? periodEnd,
            notes:          editLine.notes ?? "",
          }}
          onSave={f => updateLine.mutate({
            organizationId: orgId,
            lineId:         editLine.id,
            budgetedAmount: f.budgetedAmount,
            description:    f.description || undefined,
            notes:          f.notes || undefined,
          })}
        />
      )}

      {/* Copy budget modal */}
      <Dialog open={showCopy} onOpenChange={setShowCopy}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Copy Budget</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>New Budget Name</Label>
              <Input className="mt-1 rounded-xl" value={copyName} onChange={e => setCopyName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Period Start</Label>
                <Input type="date" className="mt-1 rounded-xl" value={copyStart} onChange={e => setCopyStart(e.target.value)} />
              </div>
              <div>
                <Label>Period End</Label>
                <Input type="date" className="mt-1 rounded-xl" value={copyEnd} onChange={e => setCopyEnd(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowCopy(false)}>Cancel</Button>
              <Button
                className="flex-1 rounded-xl text-white"
                style={{ backgroundColor: BRAND }}
                disabled={!copyName || !copyStart || !copyEnd || copyBudget.isPending}
                onClick={() => copyBudget.mutate({
                  organizationId: orgId,
                  sourceBudgetId: budgetId,
                  newName:        copyName,
                  newPeriodStart: copyStart,
                  newPeriodEnd:   copyEnd,
                })}
              >
                {copyBudget.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Copy"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
