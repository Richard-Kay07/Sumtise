"use client"

import { useState, Suspense } from "react"
import { trpc } from "@/lib/trpc-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Lock, Unlock, CheckCircle2, Circle, Plus, RefreshCw,
  ChevronRight, AlertTriangle, BarChart3, BookOpen, X,
} from "lucide-react"
import { format } from "date-fns"

// ─── Types ────────────────────────────────────────────────────────────────────

type PeriodStatus = "OPEN" | "LOCKED" | "CLOSED"

interface Period {
  id: string
  fiscalYear: number
  periodNumber: number
  name: string
  startDate: string
  endDate: string
  status: PeriodStatus
  isAdjustment: boolean
  lockedAt?: string | null
  closedAt?: string | null
  _count?: { transactions: number; accruals: number; closingEntries: number }
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PeriodStatus }) {
  if (status === "OPEN") return <Badge variant="outline" className="text-green-600 border-green-300">Open</Badge>
  if (status === "LOCKED") return <Badge variant="outline" className="text-amber-600 border-amber-300">Locked</Badge>
  return <Badge variant="outline" className="text-slate-500 border-slate-300">Closed</Badge>
}

// ─── Period row ───────────────────────────────────────────────────────────────

function PeriodRow({
  period,
  orgId,
  onSelect,
  selected,
}: {
  period: Period
  orgId: string
  onSelect: (id: string) => void
  selected: boolean
}) {
  const utils = trpc.useUtils()

  const lock = trpc.periodEnd.lockPeriod.useMutation({
    onSuccess: () => utils.periodEnd.listPeriods.invalidate(),
  })
  const unlock = trpc.periodEnd.unlockPeriod.useMutation({
    onSuccess: () => utils.periodEnd.listPeriods.invalidate(),
  })
  const close = trpc.periodEnd.closePeriod.useMutation({
    onSuccess: () => {
      utils.periodEnd.listPeriods.invalidate()
      utils.periodEnd.getPeriod.invalidate()
    },
  })

  return (
    <tr
      className={`border-b cursor-pointer transition-colors ${selected ? "bg-blue-50" : "hover:bg-muted/40"}`}
      onClick={() => onSelect(period.id)}
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground w-8">
            P{String(period.periodNumber).padStart(2, "0")}
          </span>
          <span className="font-medium text-sm">{period.name}</span>
          {period.isAdjustment && (
            <Badge variant="secondary" className="text-xs">Adj</Badge>
          )}
        </div>
      </td>
      <td className="py-3 px-4 text-sm text-muted-foreground">
        {format(new Date(period.startDate), "dd MMM")} – {format(new Date(period.endDate), "dd MMM yyyy")}
      </td>
      <td className="py-3 px-4">
        <StatusBadge status={period.status} />
      </td>
      <td className="py-3 px-4 text-sm text-muted-foreground text-right">
        {period._count?.transactions ?? 0} txns
      </td>
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          {period.status === "OPEN" && (
            <Button
              size="sm" variant="outline"
              disabled={lock.isPending}
              onClick={() => lock.mutate({ organizationId: orgId, periodId: period.id })}
            >
              <Lock className="h-3 w-3 mr-1" /> Lock
            </Button>
          )}
          {period.status === "LOCKED" && (
            <>
              <Button
                size="sm" variant="outline"
                disabled={unlock.isPending}
                onClick={() => unlock.mutate({ organizationId: orgId, periodId: period.id })}
              >
                <Unlock className="h-3 w-3 mr-1" /> Unlock
              </Button>
              <Button
                size="sm" variant="default"
                disabled={close.isPending}
                onClick={() => {
                  if (confirm(`Close "${period.name}"? This will post closing entries and cannot be undone.`)) {
                    close.mutate({ organizationId: orgId, periodId: period.id, postClosingEntries: true })
                  }
                }}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" /> Close
              </Button>
            </>
          )}
          {period.status === "CLOSED" && (
            <span className="text-xs text-muted-foreground">
              {period.closedAt ? format(new Date(period.closedAt), "dd MMM yyyy") : "Closed"}
            </span>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── Accrual modal ────────────────────────────────────────────────────────────

function AccrualPanel({ periodId, orgId }: { periodId: string; orgId: string }) {
  const utils = trpc.useUtils()

  const { data: accruals } = trpc.periodEnd.listAccruals.useQuery(
    { organizationId: orgId, periodId },
    { enabled: !!periodId }
  )

  const { data: accounts } = trpc.chartOfAccounts.getAll.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  )

  const create = trpc.periodEnd.createAccrual.useMutation({
    onSuccess: () => {
      utils.periodEnd.listAccruals.invalidate()
      setForm(defaultForm)
    },
  })
  const post = trpc.periodEnd.postAccrual.useMutation({
    onSuccess: () => utils.periodEnd.listAccruals.invalidate(),
  })
  const reverse = trpc.periodEnd.reverseAccrual.useMutation({
    onSuccess: () => utils.periodEnd.listAccruals.invalidate(),
  })

  const defaultForm = {
    description: "", amount: "", debitAccountId: "", creditAccountId: "",
    type: "ACCRUED_EXPENSE" as const, reference: "", autoReverse: true,
  }
  const [form, setForm] = useState(defaultForm)
  const [showForm, setShowForm] = useState(false)

  const expenseAccounts = accounts?.filter(a => ["EXPENSE", "ASSET", "LIABILITY"].includes(a.type)) ?? []

  const typeLabels: Record<string, string> = {
    ACCRUED_EXPENSE: "Accrued Expense",
    ACCRUED_INCOME: "Accrued Income",
    PREPAYMENT: "Prepayment",
    DEFERRED_INCOME: "Deferred Income",
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Accruals & Prepayments</h3>
        <Button size="sm" variant="outline" onClick={() => setShowForm(v => !v)}>
          <Plus className="h-3 w-3 mr-1" /> New Accrual
        </Button>
      </div>

      {showForm && (
        <Card className="border-dashed">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Description</Label>
                <Input
                  placeholder="e.g. Accrued rent December"
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <select
                  className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                  value={form.type}
                  onChange={e => setForm(p => ({ ...p, type: e.target.value as any }))}
                >
                  {Object.entries(typeLabels).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Amount</Label>
                <Input
                  type="number" placeholder="0.00"
                  value={form.amount}
                  onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Debit Account</Label>
                <select
                  className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                  value={form.debitAccountId}
                  onChange={e => setForm(p => ({ ...p, debitAccountId: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {accounts?.map(a => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Credit Account</Label>
                <select
                  className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                  value={form.creditAccountId}
                  onChange={e => setForm(p => ({ ...p, creditAccountId: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {accounts?.map(a => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input
                  type="checkbox" id="autoReverse"
                  checked={form.autoReverse}
                  onChange={e => setForm(p => ({ ...p, autoReverse: e.target.checked }))}
                />
                <label htmlFor="autoReverse" className="text-xs">Auto-reverse in next period</label>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={create.isPending || !form.description || !form.amount || !form.debitAccountId || !form.creditAccountId}
                onClick={() => create.mutate({
                  organizationId: orgId,
                  periodId,
                  description: form.description,
                  amount: parseFloat(form.amount),
                  debitAccountId: form.debitAccountId,
                  creditAccountId: form.creditAccountId,
                  type: form.type,
                  autoReverse: form.autoReverse,
                })}
              >
                Save Accrual
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!accruals?.length ? (
        <p className="text-sm text-muted-foreground">No accruals for this period.</p>
      ) : (
        <div className="space-y-2">
          {accruals.map(a => (
            <div key={a.id} className="flex items-center justify-between p-3 border rounded text-sm">
              <div>
                <div className="font-medium">{a.description}</div>
                <div className="text-xs text-muted-foreground">
                  {typeLabels[a.type]} · £{Number(a.amount).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={a.status === "POSTED" ? "secondary" : a.status === "REVERSED" ? "outline" : "outline"} className="text-xs">
                  {a.status}
                </Badge>
                {a.status === "DRAFT" && (
                  <Button size="sm" variant="outline" onClick={() => post.mutate({ organizationId: orgId, accrualId: a.id })} disabled={post.isPending}>
                    Post
                  </Button>
                )}
                {a.status === "POSTED" && a.autoReverse && (
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => {
                    const revPeriodId = prompt("Enter reversal period ID:")
                    if (revPeriodId) reverse.mutate({ organizationId: orgId, accrualId: a.id, reversalPeriodId: revPeriodId })
                  }} disabled={reverse.isPending}>
                    Reverse
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

function PeriodEndContent() {
  const utils = trpc.useUtils()
  const { data: orgs } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgs?.[0]?.id ?? ""

  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)

  const { data: fiscalYears } = trpc.periodEnd.listFiscalYears.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  )

  const { data: periods, isLoading } = trpc.periodEnd.listPeriods.useQuery(
    { organizationId: orgId, fiscalYear: selectedYear },
    { enabled: !!orgId }
  )

  const { data: periodDetail } = trpc.periodEnd.getPeriodSummary.useQuery(
    { organizationId: orgId, periodId: selectedPeriodId! },
    { enabled: !!orgId && !!selectedPeriodId }
  )

  const generate = trpc.periodEnd.generateFiscalYear.useMutation({
    onSuccess: () => utils.periodEnd.listPeriods.invalidate(),
  })

  const regularPeriods = periods?.filter(p => !p.isAdjustment) ?? []
  const adjPeriods = periods?.filter(p => p.isAdjustment) ?? []

  const allYears = fiscalYears ?? [currentYear]
  if (!allYears.includes(selectedYear)) allYears.push(selectedYear)

  if (!orgId) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Period-End Close
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage accounting periods, lock months, post accruals, and run year-end closing entries.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="border rounded px-3 py-2 text-sm bg-background"
            value={selectedYear}
            onChange={e => { setSelectedYear(parseInt(e.target.value)); setSelectedPeriodId(null) }}
          >
            {[...new Set([...allYears, currentYear])].sort((a, b) => b - a).map(y => (
              <option key={y} value={y}>FY {y}</option>
            ))}
          </select>
          <Button
            variant="outline" size="sm"
            disabled={generate.isPending}
            onClick={() => generate.mutate({ organizationId: orgId, fiscalYear: selectedYear, includeAdjustmentPeriods: true })}
          >
            <Plus className="h-4 w-4 mr-2" />
            {generate.isPending ? "Generating…" : `Generate FY${selectedYear}`}
          </Button>
        </div>
      </div>

      {generate.isSuccess && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">
          Generated {generate.data.created} periods for FY{selectedYear}.
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Period list */}
        <div className="col-span-2 space-y-4">
          {/* Regular periods */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Regular Periods (P01–P12)</CardTitle>
              <CardDescription>Monthly accounting periods for FY{selectedYear}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 text-sm text-muted-foreground">Loading…</div>
              ) : !regularPeriods.length ? (
                <div className="p-4 text-sm text-muted-foreground">
                  No periods generated yet. Click "Generate FY{selectedYear}" above.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left py-2 px-4 font-medium text-muted-foreground">Period</th>
                      <th className="text-left py-2 px-4 font-medium text-muted-foreground">Dates</th>
                      <th className="text-left py-2 px-4 font-medium text-muted-foreground">Status</th>
                      <th className="text-right py-2 px-4 font-medium text-muted-foreground">Txns</th>
                      <th className="py-2 px-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {regularPeriods.map(p => (
                      <PeriodRow
                        key={p.id}
                        period={p as Period}
                        orgId={orgId}
                        onSelect={setSelectedPeriodId}
                        selected={selectedPeriodId === p.id}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Adjustment periods */}
          {adjPeriods.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Adjustment Periods (P13–P16)</CardTitle>
                <CardDescription>
                  SAP-style year-end adjustment windows. P13 = Pre-Audit, P14 = Post-Audit, P15 = Tax, P16 = Final Close.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left py-2 px-4 font-medium text-muted-foreground">Period</th>
                      <th className="text-left py-2 px-4 font-medium text-muted-foreground">Date</th>
                      <th className="text-left py-2 px-4 font-medium text-muted-foreground">Status</th>
                      <th className="text-right py-2 px-4 font-medium text-muted-foreground">Txns</th>
                      <th className="py-2 px-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {adjPeriods.map(p => (
                      <PeriodRow
                        key={p.id}
                        period={p as Period}
                        orgId={orgId}
                        onSelect={setSelectedPeriodId}
                        selected={selectedPeriodId === p.id}
                      />
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Detail panel */}
        <div className="space-y-4">
          {selectedPeriodId && periodDetail ? (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{periodDetail.period.name}</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedPeriodId(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <StatusBadge status={periodDetail.period.status as PeriodStatus} />
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-muted/30 rounded p-2">
                      <div className="text-xs text-muted-foreground">Transactions</div>
                      <div className="font-semibold">{periodDetail.transactionCount}</div>
                    </div>
                    <div className={`rounded p-2 ${periodDetail.isBalanced ? "bg-green-50" : "bg-red-50"}`}>
                      <div className="text-xs text-muted-foreground">Balanced</div>
                      <div className={`font-semibold ${periodDetail.isBalanced ? "text-green-700" : "text-red-700"}`}>
                        {periodDetail.isBalanced ? "Yes" : "No"}
                      </div>
                    </div>
                    <div className="bg-muted/30 rounded p-2">
                      <div className="text-xs text-muted-foreground">Revenue</div>
                      <div className="font-semibold">£{periodDetail.revenue.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div className="bg-muted/30 rounded p-2">
                      <div className="text-xs text-muted-foreground">Expenses</div>
                      <div className="font-semibold">£{periodDetail.expenses.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div className={`col-span-2 rounded p-2 ${periodDetail.netProfit >= 0 ? "bg-green-50" : "bg-red-50"}`}>
                      <div className="text-xs text-muted-foreground">Net Profit</div>
                      <div className={`font-semibold ${periodDetail.netProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
                        £{periodDetail.netProfit.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  {!periodDetail.isBalanced && (
                    <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 p-2 rounded">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                      Ledger is out of balance. Investigate before locking.
                    </div>
                  )}

                  {periodDetail.period.lockedAt && (
                    <div className="text-xs text-muted-foreground">
                      Locked: {format(new Date(periodDetail.period.lockedAt), "dd MMM yyyy HH:mm")}
                    </div>
                  )}
                  {periodDetail.period.closedAt && (
                    <div className="text-xs text-muted-foreground">
                      Closed: {format(new Date(periodDetail.period.closedAt), "dd MMM yyyy HH:mm")}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Accruals panel */}
              {periodDetail.period.status !== "CLOSED" && (
                <Card>
                  <CardContent className="pt-4">
                    <AccrualPanel periodId={selectedPeriodId} orgId={orgId} />
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="border-dashed">
              <CardContent className="pt-6 text-center text-sm text-muted-foreground">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Select a period to view details and manage accruals
              </CardContent>
            </Card>
          )}

          {/* Workflow guide */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Month-End Workflow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              {[
                "Reconcile bank accounts",
                "Post depreciation",
                "Post accruals & prepayments",
                "Review trial balance",
                "Lock period",
                "Run closing entries (year-end)",
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-mono shrink-0">{i + 1}</span>
                  {step}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function PeriodEndPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <PeriodEndContent />
    </Suspense>
  )
}
