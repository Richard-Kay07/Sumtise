"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { trpc } from "@/lib/trpc-client"
import { Plus, Search, ChevronDown, ChevronRight, Edit, Loader2, X, Lock, ShieldAlert } from "lucide-react"
import Link from "next/link"
import { useOrganization } from "@/contexts/organization-context"
import { PageHeader } from "@/components/page-header"

// ─── Types ────────────────────────────────────────────────────────────────────

type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE"
type NormalBalance = "DR" | "CR"
type VatTreatment = "STANDARD_RATE" | "REDUCED_RATE" | "ZERO_RATE" | "EXEMPT" | "OUT_OF_SCOPE" | "NOT_APPLICABLE"

const TYPE_LABELS: Record<AccountType, string> = {
  ASSET:     "Assets",
  LIABILITY: "Liabilities",
  EQUITY:    "Equity",
  REVENUE:   "Income",
  EXPENSE:   "Expenses",
}

const TYPE_COLORS: Record<AccountType, string> = {
  ASSET:     "bg-blue-50 text-blue-700 border-blue-200",
  LIABILITY: "bg-red-50 text-red-700 border-red-200",
  EQUITY:    "bg-purple-50 text-purple-700 border-purple-200",
  REVENUE:   "bg-green-50 text-green-700 border-green-200",
  EXPENSE:   "bg-orange-50 text-orange-700 border-orange-200",
}

const NB_BADGE: Record<NormalBalance, string> = {
  DR: "bg-blue-100 text-blue-700",
  CR: "bg-green-100 text-green-700",
}

const VAT_LABELS: Record<VatTreatment, string> = {
  STANDARD_RATE:  "Std 20%",
  REDUCED_RATE:   "Reduced 5%",
  ZERO_RATE:      "Zero 0%",
  EXEMPT:         "Exempt",
  OUT_OF_SCOPE:   "Out of scope",
  NOT_APPLICABLE: "",
}

const VAT_COLORS: Record<VatTreatment, string> = {
  STANDARD_RATE:  "bg-amber-100 text-amber-700",
  REDUCED_RATE:   "bg-yellow-100 text-yellow-700",
  ZERO_RATE:      "bg-sky-100 text-sky-700",
  EXEMPT:         "bg-gray-100 text-gray-600",
  OUT_OF_SCOPE:   "bg-gray-100 text-gray-400",
  NOT_APPLICABLE: "",
}

const ACCOUNT_TYPES: AccountType[] = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]
const VAT_OPTIONS: VatTreatment[] = ["STANDARD_RATE", "REDUCED_RATE", "ZERO_RATE", "EXEMPT", "OUT_OF_SCOPE", "NOT_APPLICABLE"]

// ─── Account form ─────────────────────────────────────────────────────────────

type FormState = {
  code: string
  name: string
  type: AccountType
  subType: string
  normalBalance: NormalBalance
  description: string
  vatTreatment: VatTreatment
  parentId: string
  projectCode: string
  grantCode: string
  costCentreCode: string
  departmentCode: string
  fundCode: string
  analysisCode1: string
  analysisCode2: string
  analysisCode3: string
  isControlAccount: boolean
}

const EMPTY_FORM: FormState = {
  code: "", name: "", type: "EXPENSE", subType: "",
  normalBalance: "DR", description: "", vatTreatment: "NOT_APPLICABLE", parentId: "",
  projectCode: "", grantCode: "", costCentreCode: "", departmentCode: "",
  fundCode: "", analysisCode1: "", analysisCode2: "", analysisCode3: "",
  isControlAccount: false,
}

function AccountForm({
  form,
  setForm,
  accounts,
  onSubmit,
  onCancel,
  isPending,
  error,
  title,
}: {
  form: FormState
  setForm: (f: FormState) => void
  accounts: any[]
  onSubmit: () => void
  onCancel: () => void
  isPending: boolean
  error?: string
  title: string
}) {
  const set = (patch: Partial<FormState>) => setForm({ ...form, ...patch })

  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 mt-2">
        {form.isControlAccount && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
            <span>This is a <strong>control account</strong>. Its balance is maintained by the sub-ledger (invoices, bills, payroll or VAT). Do not post to it directly.</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Code <span className="text-red-500">*</span></Label>
            <Input className="mt-1 font-mono" placeholder="e.g. 6510" value={form.code} onChange={e => set({ code: e.target.value })} />
          </div>
          <div>
            <Label>Type <span className="text-red-500">*</span></Label>
            <select
              value={form.type}
              onChange={e => set({ type: e.target.value as AccountType })}
              className="w-full h-10 px-3 mt-1 border border-input bg-background rounded-md text-sm"
            >
              {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </div>
        </div>

        <div>
          <Label>Name <span className="text-red-500">*</span></Label>
          <Input className="mt-1" placeholder="e.g. Accountancy & Audit Fees" value={form.name} onChange={e => set({ name: e.target.value })} />
        </div>

        <div>
          <Label>Description</Label>
          <Input className="mt-1" placeholder="Optional explanation for this account" value={form.description} onChange={e => set({ description: e.target.value })} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Normal Balance</Label>
            <select
              value={form.normalBalance}
              onChange={e => set({ normalBalance: e.target.value as NormalBalance })}
              className="w-full h-10 px-3 mt-1 border border-input bg-background rounded-md text-sm"
            >
              <option value="DR">DR — Debit increases</option>
              <option value="CR">CR — Credit increases</option>
            </select>
          </div>
          <div>
            <Label>VAT Treatment</Label>
            <select
              value={form.vatTreatment}
              onChange={e => set({ vatTreatment: e.target.value as VatTreatment })}
              className="w-full h-10 px-3 mt-1 border border-input bg-background rounded-md text-sm"
            >
              {VAT_OPTIONS.map(v => <option key={v} value={v}>{VAT_LABELS[v] || "Not applicable"}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Sub-type</Label>
            <Input className="mt-1" placeholder="e.g. TRADE_DEBTOR" value={form.subType} onChange={e => set({ subType: e.target.value })} />
          </div>
          <div>
            <Label>Parent Account</Label>
            <select
              value={form.parentId}
              onChange={e => set({ parentId: e.target.value })}
              className="w-full h-10 px-3 mt-1 border border-input bg-background rounded-md text-sm"
            >
              <option value="">— None (top level) —</option>
              {accounts
                .filter(a => a.type === form.type)
                .sort((a, b) => a.code.localeCompare(b.code))
                .map(a => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
            </select>
          </div>
        </div>

        <div className="border-t pt-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Analysis Codes</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Project Code</Label>
              <Input className="mt-1" placeholder="e.g. PRJ-001" value={form.projectCode} onChange={e => set({ projectCode: e.target.value })} />
            </div>
            <div>
              <Label>Grant Code</Label>
              <Input className="mt-1" placeholder="e.g. GNT-2024" value={form.grantCode} onChange={e => set({ grantCode: e.target.value })} />
            </div>
            <div>
              <Label>Cost Centre</Label>
              <Input className="mt-1" placeholder="e.g. CC-ADMIN" value={form.costCentreCode} onChange={e => set({ costCentreCode: e.target.value })} />
            </div>
            <div>
              <Label>Department</Label>
              <Input className="mt-1" placeholder="e.g. FINANCE" value={form.departmentCode} onChange={e => set({ departmentCode: e.target.value })} />
            </div>
            <div>
              <Label>Fund</Label>
              <Input className="mt-1" placeholder="e.g. RESTRICTED" value={form.fundCode} onChange={e => set({ fundCode: e.target.value })} />
            </div>
            <div>
              <Label>Analysis Code 1</Label>
              <Input className="mt-1" placeholder="Free-form" value={form.analysisCode1} onChange={e => set({ analysisCode1: e.target.value })} />
            </div>
            <div>
              <Label>Analysis Code 2</Label>
              <Input className="mt-1" placeholder="Free-form" value={form.analysisCode2} onChange={e => set({ analysisCode2: e.target.value })} />
            </div>
            <div>
              <Label>Analysis Code 3</Label>
              <Input className="mt-1" placeholder="Free-form" value={form.analysisCode3} onChange={e => set({ analysisCode3: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="border-t pt-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Controls</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isControlAccount}
              onChange={e => set({ isControlAccount: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm">Control account — populated by sub-ledger only, no direct posting</span>
          </label>
        </div>

        {error && <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button
            className="flex-1 text-white"
            style={{ backgroundColor: "#50B0E0" }}
            disabled={isPending || !form.code || !form.name}
            onClick={onSubmit}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      </div>
    </DialogContent>
  )
}

// ─── Section component ────────────────────────────────────────────────────────

function AccountSection({
  type,
  accounts,
  allAccounts,
  onEdit,
}: {
  type: AccountType
  accounts: any[]
  allAccounts: any[]
  onEdit: (a: any) => void
}) {
  const [open, setOpen] = useState(true)

  const topLevel = accounts.filter(a => !a.parentId)
  const children = accounts.filter(a => a.parentId)

  // Build display list: top-level rows followed by their children, indented
  const rows: Array<{ account: any; depth: number }> = []
  const addWithChildren = (acc: any, depth: number) => {
    rows.push({ account: acc, depth })
    children.filter(c => c.parentId === acc.id).sort((a,b) => a.code.localeCompare(b.code)).forEach(c => addWithChildren(c, depth + 1))
  }
  topLevel.sort((a,b) => a.code.localeCompare(b.code)).forEach(a => addWithChildren(a, 0))

  // Also catch orphans (parentId set but parent in a different type — shouldn't happen but safe)
  const listedIds = new Set(rows.map(r => r.account.id))
  accounts.filter(a => !listedIds.has(a.id)).sort((a,b) => a.code.localeCompare(b.code)).forEach(a => rows.push({ account: a, depth: 0 }))

  return (
    <Card>
      <CardHeader className="pb-3">
        <button
          className="flex items-center justify-between w-full text-left"
          onClick={() => setOpen(!open)}
        >
          <div className="flex items-center gap-3">
            {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
            <CardTitle className="text-base">{TYPE_LABELS[type]}</CardTitle>
            <span className={`text-xs font-medium px-2 py-0.5 rounded border ${TYPE_COLORS[type]}`}>
              {accounts.length} accounts
            </span>
          </div>
        </button>
      </CardHeader>

      {open && (
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-3 py-2 w-20">Code</th>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2 hidden lg:table-cell">Description</th>
                  <th className="text-center px-3 py-2 w-16">NB</th>
                  <th className="text-center px-3 py-2 w-24 hidden md:table-cell">VAT</th>
                  <th className="text-center px-3 py-2 w-16">Status</th>
                  <th className="w-10 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ account, depth }) => (
                  <tr key={account.id} className={`border-b last:border-0 hover:bg-gray-50 transition-colors ${account.isControlAccount ? "bg-amber-50/30" : ""}`}>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{account.code}</td>
                    <td className="px-3 py-2.5">
                      <span style={{ paddingLeft: `${depth * 16}px` }} className="inline-flex items-center gap-1.5 font-medium text-gray-800">
                        {depth > 0 && <span className="text-gray-300">└</span>}
                        {account.name}
                        {account.isControlAccount && (
                          <span title="Control account — no direct posting">
                            <Lock className="h-3 w-3 text-amber-500 inline" />
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 text-xs hidden lg:table-cell max-w-xs truncate">
                      {account.description || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold ${NB_BADGE[account.normalBalance as NormalBalance] ?? "bg-gray-100 text-gray-500"}`}>
                        {account.normalBalance ?? "DR"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center hidden md:table-cell">
                      {account.vatTreatment && account.vatTreatment !== "NOT_APPLICABLE" ? (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${VAT_COLORS[account.vatTreatment as VatTreatment]}`}>
                          {VAT_LABELS[account.vatTreatment as VatTreatment]}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${account.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                        {account.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <button
                        className="text-gray-300 hover:text-gray-600 transition-colors"
                        onClick={() => onEdit(account)}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ChartOfAccountsPage() {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<AccountType | "">("")
  const [showCreate, setShowCreate] = useState(false)
  const [editAccount, setEditAccount] = useState<any | null>(null)
  const [createForm, setCreateForm] = useState<FormState>(EMPTY_FORM)

  const { orgId } = useOrganization()

  const { data: accounts = [], isLoading, refetch } = trpc.chartOfAccounts.getAll.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  )

  const utils = trpc.useUtils()

  const create = trpc.chartOfAccounts.create.useMutation({
    onSuccess: () => { refetch(); setShowCreate(false); setCreateForm(EMPTY_FORM) },
  })

  const update = trpc.chartOfAccounts.update.useMutation({
    onSuccess: () => { refetch(); setEditAccount(null) },
  })

  const deactivate = trpc.chartOfAccounts.delete.useMutation({
    onSuccess: () => refetch(),
  })

  // Filtered view
  const filtered = accounts.filter(a => {
    const q = search.toLowerCase()
    const matchSearch = !q || a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q) || (a.description ?? "").toLowerCase().includes(q)
    const matchType = !typeFilter || a.type === typeFilter
    return matchSearch && matchType
  })

  const byType = (type: AccountType) => filtered.filter(a => a.type === type)

  // Summary counts
  const totals = ACCOUNT_TYPES.map(t => ({ type: t, count: accounts.filter(a => a.type === t).length }))

  // Edit form init
  const openEdit = (account: any) => {
    setEditAccount({
      ...account,
      form: {
        code: account.code,
        name: account.name,
        type: account.type,
        subType: account.subType ?? "",
        normalBalance: account.normalBalance ?? "DR",
        description: account.description ?? "",
        vatTreatment: account.vatTreatment ?? "NOT_APPLICABLE",
        parentId: account.parentId ?? "",
        projectCode: account.projectCode ?? "",
        grantCode: account.grantCode ?? "",
        costCentreCode: account.costCentreCode ?? "",
        departmentCode: account.departmentCode ?? "",
        fundCode: account.fundCode ?? "",
        analysisCode1: account.analysisCode1 ?? "",
        analysisCode2: account.analysisCode2 ?? "",
        analysisCode3: account.analysisCode3 ?? "",
        isControlAccount: account.isControlAccount ?? false,
      } as FormState,
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader crumbs={[{ label: "Settings", href: "/settings" }, { label: "Accounting", href: "/settings/accounting" }]} title="Chart of Accounts" />
      <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#1A1D24" }}>Chart of Accounts</h1>
            <p className="text-gray-500 mt-1">FRS 102 — {accounts.length} accounts across {ACCOUNT_TYPES.filter(t => accounts.some(a => a.type === t)).length} categories</p>
          </div>
          <div className="flex gap-2">
            <Link href="/settings/accounting">
              <Button variant="outline">← Settings</Button>
            </Link>
            <Button
              className="text-white"
              style={{ backgroundColor: "#50B0E0" }}
              onClick={() => { setCreateForm(EMPTY_FORM); setShowCreate(true) }}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Account
            </Button>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-5 gap-3">
          {totals.map(({ type, count }) => (
            <button
              key={type}
              onClick={() => setTypeFilter(typeFilter === type ? "" : type)}
              className={`rounded-xl border p-3 text-left transition-all ${typeFilter === type ? TYPE_COLORS[type] + " border-current" : "bg-white border-gray-100 hover:border-gray-300"}`}
            >
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{TYPE_LABELS[type]}</p>
              <p className="text-2xl font-bold mt-0.5" style={{ color: "#1A1D24" }}>{count}</p>
            </button>
          ))}
        </div>

        {/* Search + filter bar */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex gap-3 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  className="pl-9"
                  placeholder="Search by code, name or description…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value as AccountType | "")}
                className="h-10 px-3 border border-input bg-background rounded-md text-sm min-w-[140px]"
              >
                <option value="">All types</option>
                {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
              {(search || typeFilter) && (
                <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setTypeFilter("") }}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Account sections */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
          </div>
        ) : accounts.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-gray-500">
              No accounts found. Click <strong>New Account</strong> to add the first one.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {ACCOUNT_TYPES.map(type => {
              const rows = byType(type)
              if (rows.length === 0) return null
              return (
                <AccountSection
                  key={type}
                  type={type}
                  accounts={rows}
                  allAccounts={accounts}
                  onEdit={openEdit}
                />
              )
            })}
            {filtered.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-gray-400">
                  No accounts match your search.
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Create modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <AccountForm
          title="New Account"
          form={createForm}
          setForm={setCreateForm}
          accounts={accounts}
          isPending={create.isPending}
          error={create.error?.message}
          onCancel={() => setShowCreate(false)}
          onSubmit={() =>
            create.mutate({
              organizationId: orgId,
              code: createForm.code,
              name: createForm.name,
              type: createForm.type,
              subType: createForm.subType || undefined,
              normalBalance: createForm.normalBalance,
              description: createForm.description || undefined,
              vatTreatment: createForm.vatTreatment,
              parentId: createForm.parentId || undefined,
              projectCode: createForm.projectCode || undefined,
              grantCode: createForm.grantCode || undefined,
              costCentreCode: createForm.costCentreCode || undefined,
              departmentCode: createForm.departmentCode || undefined,
              fundCode: createForm.fundCode || undefined,
              analysisCode1: createForm.analysisCode1 || undefined,
              analysisCode2: createForm.analysisCode2 || undefined,
              analysisCode3: createForm.analysisCode3 || undefined,
              isControlAccount: createForm.isControlAccount,
            })
          }
        />
      </Dialog>

      {/* Edit modal */}
      {editAccount && (
        <Dialog open={!!editAccount} onOpenChange={o => { if (!o) setEditAccount(null) }}>
          <AccountForm
            title={`Edit — ${editAccount.code} ${editAccount.name}`}
            form={editAccount.form}
            setForm={f => setEditAccount({ ...editAccount, form: f })}
            accounts={accounts.filter(a => a.id !== editAccount.id)}
            isPending={update.isPending}
            error={update.error?.message}
            onCancel={() => setEditAccount(null)}
            onSubmit={() =>
              update.mutate({
                id: editAccount.id,
                organizationId: orgId,
                data: {
                  code:           editAccount.form.code,
                  name:           editAccount.form.name,
                  type:           editAccount.form.type,
                  subType:        editAccount.form.subType || undefined,
                  normalBalance:  editAccount.form.normalBalance,
                  description:    editAccount.form.description || undefined,
                  vatTreatment:   editAccount.form.vatTreatment,
                  parentId:       editAccount.form.parentId || undefined,
                  projectCode:    editAccount.form.projectCode || undefined,
                  grantCode:      editAccount.form.grantCode || undefined,
                  costCentreCode: editAccount.form.costCentreCode || undefined,
                  departmentCode: editAccount.form.departmentCode || undefined,
                  fundCode:       editAccount.form.fundCode || undefined,
                  analysisCode1:    editAccount.form.analysisCode1 || undefined,
                  analysisCode2:    editAccount.form.analysisCode2 || undefined,
                  analysisCode3:    editAccount.form.analysisCode3 || undefined,
                  isControlAccount: editAccount.form.isControlAccount,
                },
              })
            }
          />
        </Dialog>
      )}
    </div>
  )
}
