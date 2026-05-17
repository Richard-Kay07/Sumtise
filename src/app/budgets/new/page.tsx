"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { trpc } from "@/lib/trpc-client"
import { Loader2, PiggyBank } from "lucide-react"
import { PageHeader } from "@/components/page-header"

const BRAND = "#50B0E0"

const BUDGET_TYPES = [
  { value: "ANNUAL",    label: "Annual",    hint: "Full-year operating budget" },
  { value: "QUARTERLY", label: "Quarterly", hint: "Quarter-by-quarter plan" },
  { value: "MONTHLY",   label: "Monthly",   hint: "Month-level control budget" },
  { value: "PROJECT",   label: "Project",   hint: "Capital or project budget" },
  { value: "GRANT",     label: "Grant",     hint: "Grant expenditure plan" },
]

export default function NewBudgetPage() {
  const router = useRouter()
  const { data: orgs } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgs?.[0]?.id ?? ""

  const { data: projects } = trpc.projects?.list?.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  ) as any ?? { data: undefined }

  const [form, setForm] = useState({
    name:        "",
    description: "",
    budgetType:  "ANNUAL" as string,
    periodStart: "",
    periodEnd:   "",
    currency:    "GBP",
    projectId:   "",
    notes:       "",
  })

  const create = trpc.budgets.create.useMutation({
    onSuccess: (budget) => router.push(`/budgets/${budget.id}`),
  })

  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }))
  const valid = form.name.trim() && form.periodStart && form.periodEnd && form.budgetType

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        crumbs={[{ label: "Budgets", href: "/budgets" }]}
        title="New Budget"
        icon={<PiggyBank className="h-4 w-4" />}
      />

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Budget type selection */}
        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">Budget Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {BUDGET_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => set({ budgetType: t.value })}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    form.budgetType === t.value
                      ? "border-[#50B0E0] bg-[#50B0E0]/10 text-[#50B0E0]"
                      : "border-gray-100 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <p className="text-xs font-bold">{t.label}</p>
                  <p className="text-[10px] mt-0.5 opacity-70">{t.hint}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Details */}
        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">Budget Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Budget Name <span className="text-red-400">*</span></Label>
              <Input
                className="mt-1 rounded-xl"
                placeholder="e.g. FY 2025/26 Operating Budget"
                value={form.name}
                onChange={e => set({ name: e.target.value })}
              />
            </div>

            <div>
              <Label>Description</Label>
              <Input
                className="mt-1 rounded-xl"
                placeholder="Optional description"
                value={form.description}
                onChange={e => set({ description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Period Start <span className="text-red-400">*</span></Label>
                <Input
                  type="date"
                  className="mt-1 rounded-xl"
                  value={form.periodStart}
                  onChange={e => set({ periodStart: e.target.value })}
                />
              </div>
              <div>
                <Label>Period End <span className="text-red-400">*</span></Label>
                <Input
                  type="date"
                  className="mt-1 rounded-xl"
                  value={form.periodEnd}
                  onChange={e => set({ periodEnd: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Currency</Label>
                <select
                  value={form.currency}
                  onChange={e => set({ currency: e.target.value })}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-input bg-background text-sm"
                >
                  {["GBP", "USD", "EUR", "ZAR", "KES", "ZMW"].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              {projects?.projects?.length > 0 && (
                <div>
                  <Label>Link to Project</Label>
                  <select
                    value={form.projectId}
                    onChange={e => set({ projectId: e.target.value })}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-input bg-background text-sm"
                  >
                    <option value="">— None —</option>
                    {projects.projects.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <Label>Notes</Label>
              <textarea
                className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm resize-none"
                rows={3}
                placeholder="Internal notes about this budget…"
                value={form.notes}
                onChange={e => set({ notes: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Link href="/budgets">
            <Button variant="outline" className="rounded-xl">Cancel</Button>
          </Link>
          <Button
            className="rounded-xl text-white px-8"
            style={{ backgroundColor: BRAND }}
            disabled={!valid || create.isPending || !orgId}
            onClick={() => create.mutate({
              organizationId: orgId,
              name:           form.name.trim(),
              description:    form.description || undefined,
              budgetType:     form.budgetType as any,
              periodStart:    form.periodStart,
              periodEnd:      form.periodEnd,
              currency:       form.currency,
              projectId:      form.projectId || undefined,
              notes:          form.notes || undefined,
            })}
          >
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Budget"}
          </Button>
        </div>

        {create.error && (
          <p className="text-sm text-red-500 bg-red-50 rounded-xl p-3">{create.error.message}</p>
        )}
      </main>
    </div>
  )
}
