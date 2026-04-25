"use client"

import { useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { trpc } from "@/lib/trpc-client"
import { Plus, RefreshCw, Upload, Download, Table2 } from "lucide-react"

const BRAND = "#50B0E0"

function WGAScheduleModal({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const [start, setStart] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0])
  const [end,   setEnd]   = useState(new Date().toISOString().split("T")[0])

  const { data, isFetching, refetch } = trpc.tags.getWGASchedule.useQuery(
    { organizationId: orgId, periodStart: new Date(start), periodEnd: new Date(end) },
    { enabled: false }
  )

  const rows = (data as any)?.rows ?? []

  const exportCSV = () => {
    const header = "CPID,Entity,Income from entity,Expenditure to entity,Net\n"
    const body   = rows.map((r: any) =>
      `"${r.cpid}","${r.entityName}",${r.income},${r.expenditure},${r.net}`
    ).join("\n")
    const blob = new Blob([header + body], { type: "text/csv" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a"); a.href = url; a.download = "wga-schedule.csv"; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">WGA Schedule</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="flex gap-3 mb-4">
          <div>
            <Label className="text-xs">Period start</Label>
            <Input type="date" className="h-8 text-xs rounded-xl mt-1 w-36" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Period end</Label>
            <Input type="date" className="h-8 text-xs rounded-xl mt-1 w-36" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <Button className="h-8 text-xs rounded-xl" style={{ backgroundColor: BRAND }} onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Generate"}
            </Button>
            {rows.length > 0 && (
              <Button variant="outline" className="h-8 text-xs rounded-xl gap-1" onClick={exportCSV}>
                <Download className="h-3 w-3" /> CSV
              </Button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2">CPID</th>
                <th className="text-left px-3 py-2">Entity</th>
                <th className="text-right px-3 py-2">Income from entity</th>
                <th className="text-right px-3 py-2">Expenditure to entity</th>
                <th className="text-right px-3 py-2">Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0
                ? <tr><td colSpan={5} className="text-center py-6 text-gray-400 text-xs italic">No data. Click Generate to produce the schedule.</td></tr>
                : rows.map((r: any, i: number) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{r.cpid}</td>
                    <td className="px-3 py-2">{r.entityName}</td>
                    <td className="px-3 py-2 text-right">£{Number(r.income ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">£{Number(r.expenditure ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-semibold">{Number(r.net ?? 0) >= 0 ? "" : "-"}£{Math.abs(Number(r.net ?? 0)).toLocaleString()}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const CSV_TEMPLATE = "cpid,entityName,entityType,departmentGroup\nDWP001,Department for Work and Pensions,CENTRAL_GOVERNMENT,DWP\n"

export default function WGACodesPage() {
  const { data: orgs } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = orgs?.[0]?.id ?? ""

  const [search,      setSearch]      = useState("")
  const [showForm,    setShowForm]    = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [form, setForm] = useState({ cpid: "", entityName: "", entityType: "CENTRAL_GOVERNMENT", departmentGroup: "" })
  const fileRef = useRef<HTMLInputElement>(null)

  const { data, isLoading, refetch } = trpc.tags.listCPIDCodes.useQuery(
    { organizationId: orgId, search: search || undefined },
    { enabled: !!orgId }
  )
  const create = trpc.tags.createCPIDCode.useMutation({ onSuccess: () => { refetch(); setShowForm(false) } })
  const bulkImport = trpc.tags.bulkImportCPIDCodes.useMutation({ onSuccess: () => refetch() })

  const codes = (data as any) ?? []

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const rows = text.split("\n").slice(1).filter(Boolean).map((line) => {
        const [cpid, entityName, entityType, departmentGroup] = line.split(",").map((c) => c.replace(/"/g, "").trim())
        return { cpid, entityName, entityType: entityType || "OTHER", departmentGroup }
      }).filter((r) => r.cpid && r.entityName)
      bulkImport.mutate({ organizationId: orgId, codes: rows as any })
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 flex h-14 items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#1A1D24" }}>WGA / CPID Codes</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl text-xs gap-1" onClick={() => setShowSchedule(true)}>
              <Table2 className="h-3 w-3" /> WGA Schedule
            </Button>
            <Button variant="outline" className="rounded-xl text-xs gap-1" onClick={() => {
              const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" })
              const url  = URL.createObjectURL(blob)
              const a    = document.createElement("a"); a.href = url; a.download = "cpid-template.csv"; a.click()
              URL.revokeObjectURL(url)
            }}>
              <Download className="h-3 w-3" /> Template
            </Button>
            <Button variant="outline" className="rounded-xl text-xs gap-1" onClick={() => fileRef.current?.click()}>
              <Upload className="h-3 w-3" /> Import CSV
            </Button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
            <Button className="rounded-xl text-xs gap-1" style={{ backgroundColor: BRAND }} onClick={() => setShowForm(true)}>
              <Plus className="h-3 w-3" /> New CPID code
            </Button>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-7 space-y-4">
        <p className="text-sm text-gray-500">
          Whole of Government Accounts (WGA) consolidation requires transactions with other government bodies to be tagged with the counterparty&apos;s CPID code. This allows cross-departmental balances to be eliminated in the consolidated accounts.
        </p>

        <Input
          className="rounded-xl h-9 text-sm max-w-sm"
          placeholder="Search by CPID or entity name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {showForm && (
          <Card className="rounded-xl border-blue-100 bg-blue-50/30">
            <CardContent className="pt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">CPID *</Label>
                  <Input className="h-8 text-xs rounded-xl mt-1" value={form.cpid} onChange={(e) => setForm((p) => ({ ...p, cpid: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Entity name *</Label>
                  <Input className="h-8 text-xs rounded-xl mt-1" value={form.entityName} onChange={(e) => setForm((p) => ({ ...p, entityName: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Entity type</Label>
                  <select className="w-full border rounded-xl h-8 text-xs px-2 mt-1 bg-white" value={form.entityType} onChange={(e) => setForm((p) => ({ ...p, entityType: e.target.value }))}>
                    {["CENTRAL_GOVERNMENT", "LOCAL_GOVERNMENT", "DEVOLVED_ADMINISTRATION", "PUBLIC_CORPORATION", "NHS", "OTHER"].map((t) => (
                      <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Department group</Label>
                  <Input className="h-8 text-xs rounded-xl mt-1" value={form.departmentGroup} onChange={(e) => setForm((p) => ({ ...p, departmentGroup: e.target.value }))} placeholder="e.g. HMRC, DWP" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" className="rounded-xl text-xs" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button className="rounded-xl text-xs gap-1" style={{ backgroundColor: BRAND }}
                  disabled={!form.cpid || !form.entityName || create.isPending}
                  onClick={() => create.mutate({ organizationId: orgId, cpid: form.cpid, entityName: form.entityName, entityType: form.entityType as any, departmentGroup: form.departmentGroup || undefined })}>
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="rounded-xl">
          <CardContent className="pt-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="text-left px-4 py-3">CPID</th>
                  <th className="text-left px-4 py-3">Entity Name</th>
                  <th className="text-left px-4 py-3">Entity Type</th>
                  <th className="text-left px-4 py-3">Dept Group</th>
                  <th className="text-left px-4 py-3">Transactions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? <tr><td colSpan={5} className="text-center py-8"><RefreshCw className="h-4 w-4 animate-spin mx-auto text-gray-400" /></td></tr>
                  : codes.length === 0
                    ? <tr><td colSpan={5} className="text-center py-8 text-gray-400 text-xs italic">No CPID codes found.</td></tr>
                    : codes.map((c: any) => (
                      <tr key={c.id} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs font-semibold">{c.cpid}</td>
                        <td className="px-4 py-3 font-medium">{c.entityName}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">{c.entityType?.replace(/_/g, " ")}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{c.departmentGroup ?? "—"}</td>
                        <td className="px-4 py-3">
                          <a href={`/reports/tagged-transactions?cpid=${c.cpid}`} className="text-[#50B0E0] text-xs hover:underline">
                            View
                          </a>
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </CardContent>
        </Card>
      </main>

      {showSchedule && <WGAScheduleModal orgId={orgId} onClose={() => setShowSchedule(false)} />}
    </div>
  )
}
