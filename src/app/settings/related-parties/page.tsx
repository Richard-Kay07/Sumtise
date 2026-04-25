"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { trpc } from "@/lib/trpc-client"
import { Plus, RefreshCw, Copy, CheckCircle, ExternalLink } from "lucide-react"

const BRAND = "#50B0E0"

function DisclosureModal({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const [start, setStart] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0])
  const [end,   setEnd]   = useState(new Date().toISOString().split("T")[0])
  const [copied, setCopied] = useState(false)

  const { data, isFetching, refetch } = trpc.tags.getRelatedPartyDisclosure.useQuery(
    { organizationId: orgId, periodStart: new Date(start), periodEnd: new Date(end) },
    { enabled: false }
  )

  const text = (data as any)?.disclosureText ?? ""

  const copy = () => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">FRS 102 Related Party Disclosure</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <Label className="text-xs">Period start</Label>
            <Input type="date" className="h-8 text-xs rounded-xl mt-1" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="flex-1">
            <Label className="text-xs">Period end</Label>
            <Input type="date" className="h-8 text-xs rounded-xl mt-1" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button className="h-8 text-xs rounded-xl" style={{ backgroundColor: BRAND }} onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Generate"}
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto border rounded-xl p-4 bg-gray-50 text-sm font-mono whitespace-pre-wrap text-gray-700 min-h-[200px]">
          {text || <span className="text-gray-400 italic">Click Generate to produce the disclosure note.</span>}
        </div>
        {text && (
          <Button variant="outline" className="mt-3 rounded-xl text-xs gap-1 self-end" onClick={copy}>
            {copied ? <CheckCircle className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied!" : "Copy to clipboard"}
          </Button>
        )}
      </div>
    </div>
  )
}

export default function RelatedPartiesPage() {
  const { data: orgs } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgs?.[0]?.id ?? ""

  const { data, isLoading, refetch } = trpc.tags.listRelatedParties.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  )

  const create = trpc.tags.createRelatedParty.useMutation({ onSuccess: () => { refetch(); setShowForm(false) } })
  const archive = trpc.tags.archiveRelatedParty.useMutation({ onSuccess: () => refetch() })

  const [showForm,       setShowForm]       = useState(false)
  const [showDisclosure, setShowDisclosure] = useState(false)
  const [form, setForm] = useState({ name: "", relationship: "", companiesHouseNo: "", ownershipPercent: "" })

  const parties = (data as any) ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 flex h-14 items-center justify-between">
          <h1 className="text-xl font-bold" style={{ color: "#1A1D24" }}>Related Parties</h1>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl text-xs gap-1" onClick={() => setShowDisclosure(true)}>
              FRS 102 Disclosure
            </Button>
            <Button className="rounded-xl text-xs gap-1" style={{ backgroundColor: BRAND }} onClick={() => setShowForm(true)}>
              <Plus className="h-3 w-3" /> New related party
            </Button>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-7">
        {showForm && (
          <Card className="mb-5 rounded-xl border-blue-100 bg-blue-50/30">
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Name *</Label>
                  <Input className="h-8 text-xs rounded-xl mt-1" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Relationship</Label>
                  <select className="w-full border rounded-xl h-8 text-xs px-2 mt-1 bg-white" value={form.relationship} onChange={(e) => setForm((p) => ({ ...p, relationship: e.target.value }))}>
                    <option value="">— select —</option>
                    {["DIRECTOR", "SHAREHOLDER", "SUBSIDIARY", "PARENT", "ASSOCIATE", "KEY_MANAGEMENT", "OTHER"].map((r) => (
                      <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Companies House No.</Label>
                  <Input className="h-8 text-xs rounded-xl mt-1" value={form.companiesHouseNo} onChange={(e) => setForm((p) => ({ ...p, companiesHouseNo: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Ownership %</Label>
                  <Input type="number" className="h-8 text-xs rounded-xl mt-1" value={form.ownershipPercent} onChange={(e) => setForm((p) => ({ ...p, ownershipPercent: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" className="rounded-xl text-xs" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button className="rounded-xl text-xs gap-1" style={{ backgroundColor: BRAND }}
                  disabled={!form.name || create.isPending}
                  onClick={() => create.mutate({
                    organizationId: orgId,
                    name: form.name,
                    relationship: form.relationship as any || "OTHER",
                    companiesHouseNo: form.companiesHouseNo || undefined,
                    ownershipPercent: form.ownershipPercent ? parseFloat(form.ownershipPercent) : undefined,
                  })}>
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="rounded-xl">
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>
                    <th className="text-left px-4 py-3">Name</th>
                    <th className="text-left px-4 py-3">Relationship</th>
                    <th className="text-left px-4 py-3">Companies House No.</th>
                    <th className="text-right px-4 py-3">Ownership %</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Transactions (YTD)</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? <tr><td colSpan={7} className="text-center py-8"><RefreshCw className="h-4 w-4 animate-spin mx-auto text-gray-400" /></td></tr>
                    : parties.map((p: any) => (
                      <tr key={p.id} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{p.name}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">{p.relationship?.replace(/_/g, " ")}</td>
                        <td className="px-4 py-3 font-mono text-xs">{p.companiesHouseNo ?? "—"}</td>
                        <td className="px-4 py-3 text-right">{p.ownershipPercent != null ? `${p.ownershipPercent}%` : "—"}</td>
                        <td className="px-4 py-3">
                          <Badge className={p.isActive ?? true ? "bg-green-100 text-green-700 text-xs" : "bg-gray-100 text-gray-500 text-xs"}>
                            {p.isActive ?? true ? "Active" : "Archived"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <a href={`/reports/tagged-transactions?relatedPartyId=${p.id}`} className="text-[#50B0E0] text-xs hover:underline flex items-center gap-1">
                            View <ExternalLink className="h-3 w-3" />
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          <Button variant="ghost" className="h-7 text-xs rounded-lg px-2 text-red-500"
                            onClick={() => archive.mutate({ organizationId: orgId, id: p.id })}>
                            Archive
                          </Button>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>

      {showDisclosure && <DisclosureModal orgId={orgId} onClose={() => setShowDisclosure(false)} />}
    </div>
  )
}
