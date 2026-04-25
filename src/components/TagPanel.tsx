"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Tag, Plus, Save, RefreshCw, AlertTriangle } from "lucide-react"

const BRAND = "#50B0E0"

const CATEGORY_COLOURS: Record<string, string> = {
  PROJECT:       "#8B5CF6",
  GRANT:         "#10B981",
  RELATED_PARTY: "#F59E0B",
  WGA_CPID:      "#EF4444",
  CUSTOM:        "#6B7280",
}

interface TagPanelProps {
  organizationId: string
  transactionId:  string
  accountType?:   string
  lineDescription?: string
  onClose: () => void
}

interface SplitRow {
  tagId:      string
  categoryId: string
  amount:     string
  isPercent:  boolean
}

export function TagPanel({ organizationId, transactionId, accountType, lineDescription, onClose }: TagPanelProps) {
  const [splitMode,  setSplitMode]  = useState(false)
  const [splits,     setSplits]     = useState<SplitRow[]>([])
  const [notes,      setNotes]      = useState("")
  const [saving,     setSaving]     = useState(false)

  const { data: existing, isLoading: loadingExisting, refetch } = trpc.tags.getTransactionTags.useQuery(
    { organizationId, transactionId },
    { enabled: true }
  )

  const { data: categories } = trpc.tags.listCategories.useQuery(
    { organizationId, isEnabled: true },
    { enabled: true }
  )

  const { data: projects }      = trpc.projects.list.useQuery({ organizationId, page: 1, limit: 100 }, { enabled: true })
  const { data: grantsData }    = trpc.grants.list.useQuery({ organizationId, page: 1, limit: 100 }, { enabled: true })
  const { data: relatedParties } = trpc.tags.listRelatedParties.useQuery({ organizationId }, { enabled: true })
  const { data: cpidCodes }     = trpc.tags.listCPIDCodes.useQuery({ organizationId }, { enabled: true })

  const addTag   = trpc.tags.addTag.useMutation({ onSuccess: () => refetch() })
  const removeTag = trpc.tags.removeTag.useMutation({ onSuccess: () => refetch() })
  const bulkAdd  = trpc.tags.bulkAddTags.useMutation({ onSuccess: () => { refetch(); setSplits([]) } })

  const existingTags = (existing as any) ?? []
  const cats         = (categories as any) ?? []

  const saveSplits = async () => {
    setSaving(true)
    try {
      await bulkAdd.mutateAsync({
        organizationId,
        transactionId,
        tags: splits.map((s) => ({
          tagCategoryId: s.categoryId,
          tagId:         s.tagId || undefined,
          allocationAmount: s.amount ? parseFloat(s.amount) : undefined,
          notes: notes || undefined,
        })),
      })
    } finally {
      setSaving(false)
    }
  }

  const getOptionsForCategory = (cat: any) => {
    switch (cat.categoryType) {
      case "PROJECT":       return (projects as any)?.projects?.map((p: any) => ({ id: p.id, label: `${p.projectNumber} — ${p.name}` })) ?? []
      case "GRANT":         return (grantsData as any)?.grants?.map((g: any) => ({ id: g.id, label: `${g.grantNumber} — ${g.name}` })) ?? []
      case "RELATED_PARTY": return (relatedParties as any)?.map((p: any) => ({ id: p.id, label: p.name })) ?? []
      case "WGA_CPID":      return (cpidCodes as any)?.map((c: any) => ({ id: c.id, label: `${c.cpid} — ${c.entityName}` })) ?? []
      default:              return cat.tags?.map((t: any) => ({ id: t.id, label: t.name })) ?? []
    }
  }

  return (
    <div className="border-t bg-white shadow-inner">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">
            Tags — {lineDescription || "Transaction line"}
          </span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
      </div>

      <div className="px-4 py-3 space-y-4">
        {/* Existing tags */}
        {loadingExisting
          ? <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />
          : existingTags.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Active tags</p>
              <div className="flex flex-wrap gap-2">
                {existingTags.map((t: any) => (
                  <span key={t.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: CATEGORY_COLOURS[t.categoryType] ?? "#6B7280" }}>
                    {t.code ? `${t.code}: ` : ""}{t.name ?? t.tagName}
                    <button onClick={() => removeTag.mutate({ organizationId, tagId: t.id })} className="ml-0.5 hover:opacity-70"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            </div>
          )
        }

        {/* Add tag per category */}
        {cats.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500">Add tags</p>
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                <input type="checkbox" checked={splitMode} onChange={(e) => setSplitMode(e.target.checked)} className="rounded" />
                Split tagging
              </label>
            </div>

            {!splitMode && (
              <div className="grid gap-2">
                {cats.map((cat: any) => {
                  const options = getOptionsForCategory(cat)
                  return (
                    <div key={cat.id} className="flex items-center gap-2">
                      <span className="text-xs w-24 text-gray-600 flex-shrink-0" style={{ color: CATEGORY_COLOURS[cat.categoryType] ?? "#6B7280" }}>
                        {cat.name}
                      </span>
                      <select
                        className="flex-1 border rounded-xl h-8 text-xs px-2 bg-white"
                        defaultValue=""
                        onChange={(e) => {
                          if (!e.target.value) return
                          addTag.mutate({
                            organizationId,
                            transactionId,
                            tagCategoryId:  cat.id,
                            tagId:          e.target.value || undefined,
                            notes:          notes || undefined,
                          })
                          e.target.value = ""
                        }}
                      >
                        <option value="">— add {cat.name} —</option>
                        {options.map((o: any) => <option key={o.id} value={o.id}>{o.label}</option>)}
                      </select>
                    </div>
                  )
                })}
              </div>
            )}

            {splitMode && (
              <div className="space-y-2">
                {splits.map((row, i) => {
                  const cat     = cats.find((c: any) => c.id === row.categoryId) ?? cats[0]
                  const options = cat ? getOptionsForCategory(cat) : []
                  return (
                    <div key={i} className="flex gap-2 items-center">
                      <select className="border rounded-xl h-8 text-xs px-2 bg-white w-28" value={row.categoryId}
                        onChange={(e) => setSplits((p) => p.map((s, j) => j === i ? { ...s, categoryId: e.target.value, tagId: "" } : s))}>
                        {cats.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <select className="flex-1 border rounded-xl h-8 text-xs px-2 bg-white" value={row.tagId}
                        onChange={(e) => setSplits((p) => p.map((s, j) => j === i ? { ...s, tagId: e.target.value } : s))}>
                        <option value="">— select —</option>
                        {options.map((o: any) => <option key={o.id} value={o.id}>{o.label}</option>)}
                      </select>
                      <Input type="number" className="w-20 h-8 text-xs rounded-xl" placeholder="£ or %" value={row.amount}
                        onChange={(e) => setSplits((p) => p.map((s, j) => j === i ? { ...s, amount: e.target.value } : s))} />
                      <button onClick={() => setSplits((p) => p.filter((_, j) => j !== i))}><X className="h-3.5 w-3.5 text-red-400" /></button>
                    </div>
                  )
                })}
                <button className="text-xs text-[#50B0E0] hover:underline flex items-center gap-1"
                  onClick={() => setSplits((p) => [...p, { categoryId: cats[0]?.id ?? "", tagId: "", amount: "", isPercent: false }])}>
                  <Plus className="h-3 w-3" /> Add row
                </button>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <div>
          <Label className="text-xs">Notes (optional)</Label>
          <Input className="h-8 text-xs rounded-xl mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note on this tag" />
        </div>

        {/* Save */}
        {splitMode && splits.length > 0 && (
          <div className="flex justify-end">
            <Button className="h-8 rounded-xl text-xs gap-1" style={{ backgroundColor: BRAND }} disabled={saving} onClick={saveSplits}>
              {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save tags
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Inline tag count badge (shown on transaction lines before clicking) ───────

export function TagBadge({ tags }: { tags: any[] }) {
  if (!tags || tags.length === 0) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
      <Tag className="h-3 w-3" />
      {tags.length}
      <span className="flex gap-0.5">
        {[...new Set(tags.map((t: any) => t.categoryType))].map((type: any) => (
          <span key={type} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CATEGORY_COLOURS[type] ?? "#6B7280" }} />
        ))}
      </span>
    </span>
  )
}
