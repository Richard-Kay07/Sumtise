"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { trpc } from "@/lib/trpc-client"
import {
  FolderKanban, Landmark, Users, Building2, BookOpen, Tags, Scale,
  Briefcase, ChevronRight, RefreshCw, AlertTriangle, CheckCircle,
  Wallet, BarChart3, DollarSign,
} from "lucide-react"

const BRAND = "#50B0E0"

// ── Confirmation modal ────────────────────────────────────────────────────────

function DisableModal({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <h3 className="font-semibold text-gray-900">Disable {name}?</h3>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          Disabling this will hide the {name.toLowerCase()} UI but will <strong>not delete</strong> any
          existing data. You can re-enable it at any time.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel} className="rounded-xl">Cancel</Button>
          <Button onClick={onConfirm} className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white">
            Disable
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-white border border-green-200 rounded-xl shadow-lg px-4 py-3 max-w-sm">
      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
      <span className="text-sm text-gray-700">{message}</span>
      <button onClick={onClose} className="ml-2 text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
    </div>
  )
}

// ── Toggle row ────────────────────────────────────────────────────────────────

function ModuleRow({
  icon: Icon,
  name,
  description,
  enabled,
  configureHref,
  onToggle,
}: {
  icon: React.ElementType
  name: string
  description: string
  enabled: boolean
  configureHref?: string
  onToggle: (next: boolean) => void
}) {
  return (
    <div className="flex items-center gap-4 py-4 border-b last:border-b-0">
      <div className="flex-shrink-0 h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: "#EFF8FD" }}>
        <Icon className="h-4 w-4" style={{ color: BRAND }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-gray-900">{name}</span>
          {enabled && <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700">Active</Badge>}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {enabled && configureHref && (
          <a href={configureHref} className="text-xs flex items-center gap-1 text-[#50B0E0] hover:underline">
            Configure <ChevronRight className="h-3 w-3" />
          </a>
        )}
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="mb-5 rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ModulesSettingsPage() {
  const { data: orgs } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgs?.[0]?.id ?? ""

  const { data: settings, isLoading, refetch } = trpc.modules.getSettings.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  )
  const update = trpc.modules.updateSettings.useMutation({ onSuccess: () => refetch() })

  const [toast, setToast]   = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ key: string; name: string } | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const toggle = (key: keyof typeof settings, name: string, next: boolean) => {
    if (!next) {
      setConfirm({ key: key as string, name })
      return
    }
    update.mutateAsync({ organizationId: orgId, [key]: true } as any)
      .then(() => showToast(`${name} enabled. You can now use this feature.`))
      .catch(() => {})
  }

  const confirmDisable = () => {
    if (!confirm) return
    update.mutateAsync({ organizationId: orgId, [confirm.key]: false } as any)
      .then(() => {
        showToast(`${confirm.name} disabled. Existing data is preserved.`)
        setConfirm(null)
      })
      .catch(() => setConfirm(null))
  }

  const s = settings as any

  if (isLoading || !s) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 flex h-14 items-center gap-3">
          <h1 className="text-xl font-bold" style={{ color: "#1A1D24" }}>Feature Modules</h1>
          <Badge className="bg-gray-100 text-gray-600 text-xs">Owner / Admin only</Badge>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-7">
        {/* Section 1 — Transaction Analysis */}
        <Section title="Transaction Analysis" description="Classification dimensions applied to individual transaction lines.">
          <ModuleRow icon={FolderKanban}   name="Project tagging"           description="Tag transactions to specific projects for project-level P&L." enabled={!!s.enableProjectTagging}      configureHref="/projects"                  onToggle={(v) => toggle("enableProjectTagging",     "Project tagging",        v)} />
          <ModuleRow icon={Landmark}        name="Grant tagging"             description="Tag transactions to grants for grant spend reporting."        enabled={!!s.enableGrantTagging}        configureHref="/grants"                    onToggle={(v) => toggle("enableGrantTagging",       "Grant tagging",          v)} />
          <ModuleRow icon={Users}           name="Related party transactions" description="Flag and disclose related party transactions (FRS 102 §33)." enabled={!!s.enableRelatedPartyTagging} configureHref="/settings/related-parties"  onToggle={(v) => toggle("enableRelatedPartyTagging","Related party transactions", v)} />
          <ModuleRow icon={Building2}       name="WGA / CPID codes"          description="Tag transactions with government counterparty IDs for WGA returns." enabled={!!s.enableWGACPIDCodes} configureHref="/settings/wga-codes"        onToggle={(v) => toggle("enableWGACPIDCodes",       "WGA / CPID codes",       v)} />
          <ModuleRow icon={BookOpen}        name="Fund accounting"           description="Restricted/unrestricted fund tracking for charities and public sector." enabled={!!s.enableFundAccounting ?? false} onToggle={(v) => toggle("enableFundAccounting", "Fund accounting", v)} />
          <ModuleRow icon={Tags}            name="Custom tag categories"     description="Create your own classification dimensions."                    enabled={!!s.enableCustomTags ?? false}  onToggle={(v) => toggle("enableCustomTags",         "Custom tag categories",  v)} />
        </Section>

        {/* Section 2 — Lease Accounting */}
        <Section title="Lease Accounting" description="Right-of-Use assets and lease liabilities under IFRS 16 / FRS 102.">
          <ModuleRow icon={Scale} name="IFRS 16 / FRS 102 leases" description="On-balance-sheet recognition of ROU assets and lease liabilities." enabled={!!s.enableIFRS16Leases} configureHref="/leases" onToggle={(v) => toggle("enableIFRS16Leases", "IFRS 16 / FRS 102 leases", v)} />
          {s.enableIFRS16Leases && (
            <div className="mt-3 ml-13 pl-2 border-l-2 border-blue-100">
              <p className="text-xs text-gray-500 mb-2 ml-2">Accounting standard</p>
              <div className="flex gap-2 ml-2">
                {["FRS 102", "IFRS 16", "FRS 105"].map((std) => (
                  <button key={std} className="px-3 py-1.5 text-xs rounded-xl border font-medium transition-colors hover:border-[#50B0E0] hover:text-[#50B0E0]">
                    {std}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* Section 3 — Payroll COA */}
        <Section title="Payroll COA Integration" description="Auto-generate double-entry journals from payroll runs and allocate costs.">
          <ModuleRow icon={DollarSign} name="Payroll COA posting"       description="Auto-generate double-entry journals from payroll runs."         enabled={!!s.enablePayrollCOAPosting}      configureHref="/settings/payroll-coa" onToggle={(v) => toggle("enablePayrollCOAPosting",   "Payroll COA posting",        v)} />
          <ModuleRow icon={BarChart3}  name="Cost centre allocation"    description="Split payroll costs across departments and cost centres."       enabled={!!s.enableCostCentreAllocation ?? false}    onToggle={(v) => toggle("enableCostCentreAllocation","Cost centre allocation",     v)} />
          <ModuleRow icon={Briefcase} name="Project allocation"         description="Allocate pay costs to projects."                               enabled={!!s.enableProjectAllocation ?? false}        onToggle={(v) => toggle("enableProjectAllocation",   "Project allocation",         v)} />
          <ModuleRow icon={Wallet}    name="Grant allocation"           description="Allocate pay costs to grants."                                 enabled={!!s.enableGrantAllocation ?? false}          onToggle={(v) => toggle("enableGrantAllocation",     "Grant allocation",           v)} />
        </Section>

        {/* Section 4 — Reporting Standards */}
        <Section title="Reporting Standards" description="Affects COA seeding, report labels, and compliance output.">
          <div className="py-3 border-b">
            <p className="text-sm font-medium text-gray-900 mb-3">Reporting standard</p>
            <div className="flex flex-wrap gap-2">
              {["FRS 102", "IFRS", "FRS 105", "IPSAS", "UK GAAP"].map((std) => (
                <button key={std} className="px-3 py-1.5 text-xs rounded-xl border border-gray-200 font-medium text-gray-600 hover:border-[#50B0E0] hover:text-[#50B0E0] transition-colors">
                  {std}
                </button>
              ))}
            </div>
          </div>
          <ModuleRow icon={Building2} name="Whole of Government Accounts" description="Enable WGA schedule generation and CPID code tagging."   enabled={!!s.enableWGACPIDCodes}          onToggle={(v) => toggle("enableWGACPIDCodes", "Whole of Government Accounts", v)} />
          <ModuleRow icon={DollarSign} name="Multi-currency FX"           description="Record and report in multiple currencies with FX translation." enabled={!!s.enableMultiCurrency ?? false} onToggle={(v) => toggle("enableMultiCurrency", "Multi-currency FX", v)} />
        </Section>
      </main>

      {confirm && (
        <DisableModal name={confirm.name} onConfirm={confirmDisable} onCancel={() => setConfirm(null)} />
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
