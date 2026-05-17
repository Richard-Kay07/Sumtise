"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc-client"
import { useOrganization, type OrgInfo } from "@/contexts/organization-context"
import {
  ChevronDown, Check, Plus, Building2,
  Crown, ShieldCheck, BookOpen, Eye, Loader2, X,
} from "lucide-react"

// ─── Brand tokens ──────────────────────────────────────────────────────────────
const NAV_BG = "#1D3348"

// ─── Role helpers ──────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  OWNER:       { label: "Owner",       icon: <Crown className="h-3 w-3" />,       color: "text-amber-400" },
  ADMIN:       { label: "Admin",       icon: <ShieldCheck className="h-3 w-3" />, color: "text-blue-400" },
  ACCOUNTANT:  { label: "Accountant",  icon: <BookOpen className="h-3 w-3" />,    color: "text-emerald-400" },
  BOOKKEEPER:  { label: "Bookkeeper",  icon: <BookOpen className="h-3 w-3" />,    color: "text-teal-400" },
  VIEWER:      { label: "Viewer",      icon: <Eye className="h-3 w-3" />,         color: "text-gray-400" },
}

// Deterministic colour from org name — cycles through 6 palettes
const AVATAR_PALETTES = [
  { bg: "#50B0E0", text: "#fff" },
  { bg: "#10B981", text: "#fff" },
  { bg: "#8B5CF6", text: "#fff" },
  { bg: "#F59E0B", text: "#fff" },
  { bg: "#EF4444", text: "#fff" },
  { bg: "#EC4899", text: "#fff" },
]

function orgColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length]
}

function OrgAvatar({ name, size = 26 }: { name: string; size?: number }) {
  const { bg, text } = orgColor(name)
  return (
    <span
      className="inline-flex items-center justify-center rounded-md font-bold shrink-0 uppercase"
      style={{ width: size, height: size, fontSize: size * 0.42, backgroundColor: bg, color: text }}
    >
      {name.trim()[0]}
    </span>
  )
}

// ─── Create Organisation modal ─────────────────────────────────────────────────

function CreateOrgModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [error, setError] = useState("")

  const createOrg = trpc.organization.create.useMutation({
    onSuccess: (org) => {
      try { localStorage.setItem("sumtise_active_org", org.id) } catch {}
      window.location.reload()
    },
    onError: (e) => setError(e.message),
  })

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">New Organisation</h2>
            <p className="text-xs text-gray-500 mt-0.5">Creates a separate ledger with its own Chart of Accounts</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-700">Organisation Name</label>
            <input
              autoFocus
              className="mt-1 w-full h-9 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#50B0E0]/40 focus:border-[#50B0E0]"
              placeholder="e.g. Acme Ltd"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && name.trim() && createOrg.mutate({ name: name.trim(), slug })}
            />
          </div>

          {slug && (
            <p className="text-[10px] text-gray-400">Identifier: <code className="bg-gray-100 px-1 rounded">{slug}</code></p>
          )}

          {error && (
            <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 h-9 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={!name.trim() || createOrg.isPending}
              onClick={() => createOrg.mutate({ name: name.trim(), slug })}
              className="flex-1 h-9 rounded-xl text-sm text-white font-medium transition-opacity disabled:opacity-50"
              style={{ backgroundColor: "#50B0E0" }}
            >
              {createOrg.isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main OrgSwitcher ──────────────────────────────────────────────────────────

export function OrgSwitcher() {
  const { orgs, activeOrg, switchOrg, isLoading } = useOrganization()
  const [open, setOpen]           = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />
      </div>
    )
  }

  if (!activeOrg) return null

  const roleInfo = ROLE_LABELS[activeOrg.role] ?? ROLE_LABELS.VIEWER

  return (
    <>
      <div ref={ref} className="relative">
        {/* Trigger */}
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all"
          style={{
            backgroundColor: open ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)",
            borderColor: "rgba(255,255,255,0.16)",
          }}
          title="Switch organisation / ledger"
        >
          <OrgAvatar name={activeOrg.name} size={22} />
          <div className="text-left hidden sm:block">
            <p className="text-[12px] font-semibold text-white leading-none truncate max-w-[120px]">
              {activeOrg.name}
            </p>
            <p className={`text-[10px] leading-none mt-0.5 flex items-center gap-0.5 ${roleInfo.color}`}>
              {roleInfo.icon}
              {roleInfo.label}
            </p>
          </div>
          <ChevronDown
            className="h-3 w-3 text-white/50 shrink-0 transition-transform"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </button>

        {/* Dropdown panel */}
        {open && (
          <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[100]">

            {/* Header */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Organisations & Ledgers</p>
            </div>

            {/* Org list */}
            <div className="py-1.5 max-h-72 overflow-y-auto">
              {orgs.map((org) => {
                const isActive  = org.id === activeOrg.id
                const ri        = ROLE_LABELS[org.role] ?? ROLE_LABELS.VIEWER
                return (
                  <button
                    key={org.id}
                    onClick={() => { setOpen(false); if (!isActive) switchOrg(org.id) }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isActive
                        ? "bg-[#50B0E0]/8 text-[#50B0E0]"
                        : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <OrgAvatar name={org.name} size={32} />

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{org.name}</p>
                      <p className={`text-[11px] flex items-center gap-1 mt-0.5 ${ri.color}`}>
                        {ri.icon}
                        {ri.label}
                      </p>
                    </div>

                    {isActive && <Check className="h-4 w-4 text-[#50B0E0] shrink-0" />}
                  </button>
                )
              })}
            </div>

            {/* Footer — create new */}
            <div className="border-t border-gray-100 py-1.5">
              <button
                onClick={() => { setOpen(false); setShowCreate(true) }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-500 hover:bg-gray-50 hover:text-[#50B0E0] transition-colors"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-md border-2 border-dashed border-gray-300">
                  <Plus className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-sm font-medium">New Organisation</p>
                  <p className="text-[10px] text-gray-400">Separate ledger &amp; Chart of Accounts</p>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreate && <CreateOrgModal onClose={() => setShowCreate(false)} />}
    </>
  )
}
