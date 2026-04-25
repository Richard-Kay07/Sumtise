"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { trpc } from "@/lib/trpc-client"
import {
  Plus, RefreshCw, Save, ChevronRight, Trash2, Eye, RotateCcw,
  CheckCircle, XCircle, Clock,
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts"

const BRAND = "#50B0E0"

const COMPONENT_LABELS: Record<string, string> = {
  GROSS_SALARY:     "Gross Salary",
  EMPLOYER_NI:      "Employer NI",
  EMPLOYER_PENSION: "Employer Pension",
  INCOME_TAX:       "Income Tax Deducted",
  EMPLOYEE_NI:      "Employee NI",
  STUDENT_LOAN:     "Student Loan",
  BONUS:            "Bonus / Commission",
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    DRAFT:    "bg-yellow-100 text-yellow-700",
    POSTED:   "bg-green-100 text-green-700",
    REVERSED: "bg-red-100 text-red-700",
  }
  return <Badge className={`text-xs ${map[status] ?? "bg-gray-100 text-gray-600"}`}>{status}</Badge>
}

// ── TAB 1: Account Mappings ───────────────────────────────────────────────────

function MappingsTab({ orgId }: { orgId: string }) {
  const { data: mappings, isLoading, refetch } = trpc.payrollCOA.listMappings.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  )
  const { data: coa } = trpc.chartOfAccounts.getAll.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  )
  const seed   = trpc.payrollCOA.seedDefaultMappings.useMutation({ onSuccess: () => refetch() })
  const update = trpc.payrollCOA.updateMapping.useMutation({ onSuccess: () => refetch() })

  const accounts = coa ?? []

  if (isLoading) return <div className="py-12 text-center text-gray-400"><RefreshCw className="h-5 w-5 animate-spin mx-auto" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Map each payroll component to its debit and credit accounts.</p>
        <Button variant="outline" className="rounded-xl text-xs gap-1" onClick={() => seed.mutate({ organizationId: orgId })}>
          {seed.isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
          Use UK defaults
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs">
            <tr>
              <th className="text-left px-4 py-3">Component</th>
              <th className="text-left px-4 py-3">Debit account</th>
              <th className="text-left px-4 py-3">Credit account</th>
              <th className="text-left px-4 py-3">Default CC</th>
            </tr>
          </thead>
          <tbody>
            {(mappings ?? Object.keys(COMPONENT_LABELS).map((k) => ({ id: k, componentType: k, debitAccountId: null, creditAccountId: null, defaultCostCentre: null }))).map((m: any) => (
              <tr key={m.id} className="border-t">
                <td className="px-4 py-3 font-medium">{COMPONENT_LABELS[m.componentType] ?? m.componentType}</td>
                <td className="px-4 py-3">
                  <select
                    className="text-xs border rounded-lg px-2 py-1.5 w-48 bg-white"
                    value={m.debitAccountId ?? ""}
                    onChange={(e) => update.mutate({ organizationId: orgId, mappingId: m.id, debitAccountId: e.target.value || null })}
                  >
                    <option value="">— select account —</option>
                    {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select
                    className="text-xs border rounded-lg px-2 py-1.5 w-48 bg-white"
                    value={m.creditAccountId ?? ""}
                    onChange={(e) => update.mutate({ organizationId: orgId, mappingId: m.id, creditAccountId: e.target.value || null })}
                  >
                    <option value="">— select account —</option>
                    {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <Input
                    className="text-xs h-8 w-28 rounded-lg"
                    placeholder="CC001"
                    defaultValue={m.defaultCostCentre ?? ""}
                    onBlur={(e) => update.mutate({ organizationId: orgId, mappingId: m.id, defaultCostCentre: e.target.value || null })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── TAB 2: Employee Allocations ───────────────────────────────────────────────

function AllocationRow({ rule }: { rule: any }) {
  return (
    <tr className="border-t hover:bg-gray-50">
      <td className="px-4 py-3 font-medium text-sm">{rule.employeeName ?? rule.employeeId}</td>
      <td className="px-4 py-3 text-xs text-gray-600">{rule.splits?.map((s: any) => `${s.costCentre ?? s.projectId ?? s.grantId ?? "—"} (${s.percentage}%)`).join(", ") ?? "—"}</td>
      <td className="px-4 py-3 text-xs text-gray-500">{rule.effectiveFrom ? new Date(rule.effectiveFrom).toLocaleDateString("en-GB") : "—"}</td>
      <td className="px-4 py-3">
        <Button variant="ghost" className="h-7 text-xs rounded-lg px-2" onClick={() => {}}>
          Edit <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </td>
    </tr>
  )
}

function AllocationsTab({ orgId }: { orgId: string }) {
  const [showNew, setShowNew]   = useState(false)
  const [splits, setSplits]     = useState([{ costCentre: "", percentage: 100 }])
  const [empId, setEmpId]       = useState("")
  const [effFrom, setEffFrom]   = useState(new Date().toISOString().split("T")[0])
  const create = trpc.payrollCOA.createAllocationRule.useMutation({ onSuccess: () => setShowNew(false) })

  const { data: rules, isLoading } = trpc.payrollCOA.listAllocationRules.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  )

  const totalPct = splits.reduce((s, r) => s + Number(r.percentage), 0)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">Define how each employee's pay costs are allocated across dimensions.</p>
        <Button className="rounded-xl text-xs gap-1" style={{ backgroundColor: BRAND }} onClick={() => setShowNew(true)}>
          <Plus className="h-3 w-3" /> New allocation
        </Button>
      </div>

      {showNew && (
        <Card className="rounded-xl border-blue-100 bg-blue-50/30">
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Employee ID</Label>
                <Input className="rounded-xl h-8 text-xs mt-1" value={empId} onChange={(e) => setEmpId(e.target.value)} placeholder="emp_xxx" />
              </div>
              <div>
                <Label className="text-xs">Effective from</Label>
                <Input type="date" className="rounded-xl h-8 text-xs mt-1" value={effFrom} onChange={(e) => setEffFrom(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-2 block">Allocation splits</Label>
              <div className="space-y-2">
                {splits.map((row, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input className="rounded-xl h-8 text-xs flex-1" placeholder="Cost centre / project" value={row.costCentre}
                      onChange={(e) => setSplits((p) => p.map((s, j) => j === i ? { ...s, costCentre: e.target.value } : s))} />
                    <Input type="number" className="rounded-xl h-8 text-xs w-20" placeholder="%" value={row.percentage}
                      onChange={(e) => setSplits((p) => p.map((s, j) => j === i ? { ...s, percentage: Number(e.target.value) } : s))} />
                    {splits.length > 1 && (
                      <button onClick={() => setSplits((p) => p.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5 text-red-400" /></button>
                    )}
                  </div>
                ))}
                <button className="text-xs text-[#50B0E0] hover:underline" onClick={() => setSplits((p) => [...p, { costCentre: "", percentage: 0 }])}>
                  + Add row
                </button>
                {totalPct !== 100 && <p className="text-xs text-red-500">Total must equal 100% (currently {totalPct}%)</p>}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" className="rounded-xl text-xs" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button className="rounded-xl text-xs gap-1" style={{ backgroundColor: BRAND }}
                disabled={totalPct !== 100 || !empId || create.isPending}
                onClick={() => create.mutate({
                  organizationId: orgId,
                  employeeId: empId,
                  effectiveFrom: new Date(effFrom),
                  splits: splits.map((s) => ({ costCentre: s.costCentre || undefined, percentage: s.percentage })),
                })}>
                <Save className="h-3 w-3" /> Save rule
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs">
            <tr>
              <th className="text-left px-4 py-3">Employee</th>
              <th className="text-left px-4 py-3">Allocation</th>
              <th className="text-left px-4 py-3">Effective from</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? <tr><td colSpan={4} className="text-center py-8"><RefreshCw className="h-4 w-4 animate-spin mx-auto text-gray-400" /></td></tr>
              : (rules ?? []).map((r: any) => <AllocationRow key={r.id} rule={r} />)
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── TAB 3: Journal History ────────────────────────────────────────────────────

function JournalHistoryTab({ orgId }: { orgId: string }) {
  const [preview, setPreview]   = useState<any>(null)
  const { data: journals, isLoading, refetch } = trpc.payrollCOA.listJournals.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  )
  const post    = trpc.payrollCOA.postJournal.useMutation({ onSuccess: () => refetch() })
  const reverse = trpc.payrollCOA.reverseJournal.useMutation({ onSuccess: () => refetch() })

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs">
            <tr>
              <th className="text-left px-4 py-3">Run date</th>
              <th className="text-left px-4 py-3">Reference</th>
              <th className="text-right px-4 py-3">Employees</th>
              <th className="text-right px-4 py-3">Gross</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? <tr><td colSpan={6} className="text-center py-8"><RefreshCw className="h-4 w-4 animate-spin mx-auto text-gray-400" /></td></tr>
              : (journals ?? []).map((j: any) => (
                <tr key={j.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">{new Date(j.runDate ?? j.createdAt).toLocaleDateString("en-GB")}</td>
                  <td className="px-4 py-3 font-mono text-xs">{j.reference}</td>
                  <td className="px-4 py-3 text-right">{j.employeeCount ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-medium">£{Number(j.grossAmount ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3">{statusBadge(j.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button variant="ghost" className="h-7 text-xs rounded-lg px-2" onClick={() => setPreview(j)}><Eye className="h-3 w-3" /></Button>
                      {j.status === "DRAFT"  && <Button className="h-7 text-xs rounded-lg px-2" style={{ backgroundColor: BRAND }} onClick={() => { if (confirm("Post this journal?")) post.mutate({ organizationId: orgId, journalId: j.id }) }}>Post</Button>}
                      {j.status === "POSTED" && <Button variant="ghost" className="h-7 text-xs rounded-lg px-2 text-red-500" onClick={() => { const reason = prompt("Reversal reason?"); if (reason) reverse.mutate({ organizationId: orgId, journalId: j.id, reason }) }}><RotateCcw className="h-3 w-3" /></Button>}
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Journal: {preview.reference}</h3>
              <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr><th className="text-left px-3 py-2">Account</th><th className="text-right px-3 py-2">Debit</th><th className="text-right px-3 py-2">Credit</th><th className="text-left px-3 py-2">Dimension</th></tr>
              </thead>
              <tbody>
                {(preview.lines ?? []).map((l: any, i: number) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2 text-xs">{l.accountCode} — {l.accountName}</td>
                    <td className="px-3 py-2 text-right">{l.debit > 0 ? `£${Number(l.debit).toLocaleString()}` : ""}</td>
                    <td className="px-3 py-2 text-right">{l.credit > 0 ? `£${Number(l.credit).toLocaleString()}` : ""}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{l.costCentre ?? l.projectId ?? l.grantId ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── TAB 4: Pay Cost Analysis ──────────────────────────────────────────────────

const COLOURS = [BRAND, "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"]

function PayCostAnalysisTab({ orgId }: { orgId: string }) {
  const [period, setPeriod] = useState(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`
  })
  const [dimension, setDimension] = useState<"COST_CENTRE" | "PROJECT" | "GRANT" | "COMPONENT">("COST_CENTRE")

  const start = new Date(`${period}-01`)
  const end   = new Date(start.getFullYear(), start.getMonth() + 1, 0)

  const { data, isLoading } = trpc.payrollCOA.getPayCostBreakdown.useQuery(
    { organizationId: orgId, periodStart: start, periodEnd: end, groupBy: dimension },
    { enabled: !!orgId }
  )

  const rows  = (data as any)?.rows ?? []
  const total = rows.reduce((s: number, r: any) => s + Number(r.total ?? 0), 0)

  const chartData = rows.map((r: any) => ({
    name: r.label ?? r.dimensionValue ?? r.code ?? "—",
    Gross: Number(r.grossSalary ?? 0),
    NI:    Number(r.employerNI ?? 0),
    Pension: Number(r.pension ?? 0),
  }))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <Label className="text-xs">Period</Label>
          <Input type="month" className="rounded-xl h-8 text-xs mt-1 w-36" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Breakdown by</Label>
          <select className="border rounded-xl h-8 text-xs px-2 mt-1 block" value={dimension} onChange={(e) => setDimension(e.target.value as any)}>
            <option value="COST_CENTRE">Cost Centre</option>
            <option value="PROJECT">Project</option>
            <option value="GRANT">Grant</option>
            <option value="COMPONENT">Component</option>
          </select>
        </div>
      </div>

      {isLoading
        ? <div className="py-12 text-center"><RefreshCw className="h-5 w-5 animate-spin mx-auto text-gray-400" /></div>
        : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => `£${Number(v).toLocaleString()}`} />
                <Bar dataKey="Gross" stackId="a" fill={BRAND} radius={[0, 0, 0, 0]} />
                <Bar dataKey="NI"    stackId="a" fill="#10B981" />
                <Bar dataKey="Pension" stackId="a" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>
                    <th className="text-left px-4 py-3">Dimension</th>
                    <th className="text-right px-4 py-3">Gross Salary</th>
                    <th className="text-right px-4 py-3">Employer NI</th>
                    <th className="text-right px-4 py-3">Pension</th>
                    <th className="text-right px-4 py-3">Total</th>
                    <th className="text-right px-4 py-3">% of payroll</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any, i: number) => (
                    <tr key={i} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{r.label ?? r.dimensionValue ?? r.code ?? "—"}</td>
                      <td className="px-4 py-3 text-right">£{Number(r.grossSalary ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">£{Number(r.employerNI ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">£{Number(r.pension ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-semibold">£{Number(r.total ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{total > 0 ? ((Number(r.total ?? 0) / total) * 100).toFixed(1) : "0"}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      }
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PayrollCOAPage() {
  const { data: orgs } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgs?.[0]?.id ?? ""

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 flex h-14 items-center gap-3">
          <h1 className="text-xl font-bold" style={{ color: "#1A1D24" }}>Payroll COA Integration</h1>
          <a href="/settings/modules" className="text-xs text-[#50B0E0] hover:underline flex items-center gap-1">
            Module settings <ChevronRight className="h-3 w-3" />
          </a>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-7">
        <Tabs defaultValue="mappings">
          <TabsList className="mb-5">
            <TabsTrigger value="mappings">Account Mappings</TabsTrigger>
            <TabsTrigger value="allocations">Employee Allocations</TabsTrigger>
            <TabsTrigger value="journals">Journal History</TabsTrigger>
            <TabsTrigger value="analysis">Pay Cost Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="mappings">
            <Card className="rounded-xl">
              <CardHeader><CardTitle className="text-base">Account Mappings</CardTitle><CardDescription>Map payroll components to chart of account entries.</CardDescription></CardHeader>
              <CardContent><MappingsTab orgId={orgId} /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="allocations">
            <Card className="rounded-xl">
              <CardHeader><CardTitle className="text-base">Employee Cost Allocations</CardTitle><CardDescription>Define how each employee's costs are split across dimensions.</CardDescription></CardHeader>
              <CardContent><AllocationsTab orgId={orgId} /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="journals">
            <Card className="rounded-xl">
              <CardHeader><CardTitle className="text-base">Payroll Journal History</CardTitle><CardDescription>Post, review, and reverse payroll COA journals.</CardDescription></CardHeader>
              <CardContent><JournalHistoryTab orgId={orgId} /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analysis">
            <Card className="rounded-xl">
              <CardHeader><CardTitle className="text-base">Pay Cost Analysis</CardTitle><CardDescription>Break down payroll costs by dimension and period.</CardDescription></CardHeader>
              <CardContent><PayCostAnalysisTab orgId={orgId} /></CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
