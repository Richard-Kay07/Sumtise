"use client"

import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, type ReactNode,
} from "react"
import { useAuth } from "@clerk/nextjs"
import { trpc } from "@/lib/trpc-client"

const STORAGE_KEY = "sumtise_active_org"

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface OrgInfo {
  id:          string
  name:        string
  slug:        string
  logo?:       string | null
  email?:      string | null
  role:        string
  memberSince: Date | string
}

interface OrgContextValue {
  orgs:      OrgInfo[]
  activeOrg: OrgInfo | null
  orgId:     string
  role:      string
  isLoading: boolean
  switchOrg: (id: string) => void
}

// ─── Context ───────────────────────────────────────────────────────────────────

const OrgContext = createContext<OrgContextValue>({
  orgs:      [],
  activeOrg: null,
  orgId:     "",
  role:      "",
  isLoading: true,
  switchOrg: () => {},
})

// ─── Provider ──────────────────────────────────────────────────────────────────

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth()
  const [activeOrgId, setActiveOrgId] = useState<string>("")
  const initialised = useRef(false)

  const { data: memberships, isLoading } = trpc.organization.getUserOrganizations.useQuery(
    undefined,
    { enabled: !!isSignedIn }
  )

  // Restore from localStorage on first mount
  useEffect(() => {
    if (initialised.current) return
    initialised.current = true
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setActiveOrgId(stored)
    } catch {}
  }, [])

  // When memberships load, validate the stored org or fall back to the first
  useEffect(() => {
    if (!memberships || memberships.length === 0) return
    const orgs = memberships as OrgInfo[]
    const valid = orgs.find((o) => o.id === activeOrgId)
    if (!valid) {
      const first = orgs[0].id
      setActiveOrgId(first)
      try { localStorage.setItem(STORAGE_KEY, first) } catch {}
    }
  }, [memberships, activeOrgId])

  const switchOrg = useCallback((id: string) => {
    try { localStorage.setItem(STORAGE_KEY, id) } catch {}
    setActiveOrgId(id)
    // Reload to flush all tRPC queries that embed the old orgId
    window.location.reload()
  }, [])

  const orgs: OrgInfo[] = (memberships ?? []) as OrgInfo[]
  const activeOrg = orgs.find((o) => o.id === activeOrgId) ?? orgs[0] ?? null

  return (
    <OrgContext.Provider value={{
      orgs,
      activeOrg,
      orgId:     activeOrg?.id   ?? "",
      role:      activeOrg?.role ?? "",
      isLoading,
      switchOrg,
    }}>
      {children}
    </OrgContext.Provider>
  )
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useOrganization() {
  return useContext(OrgContext)
}
