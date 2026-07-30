"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import {
  ShieldCheck, AlertTriangle, Link2, RefreshCw, CheckCircle2, XCircle, ExternalLink,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { trpc } from "@/lib/trpc-client"
import { useOrganization } from "@/contexts/organization-context"
import { format } from "date-fns"

/** Human-readable text for the ?hmrc_error= codes set by the OAuth callback. */
const ERROR_TEXT: Record<string, string> = {
  missing_params: "HMRC did not return the expected parameters. Try connecting again.",
  invalid_state_malformed: "The authorisation response was malformed. Try connecting again.",
  invalid_state_bad_signature:
    "The authorisation response failed a security check. Start the connection again from this page.",
  invalid_state_expired: "The authorisation request timed out. Try connecting again.",
  state_user_mismatch:
    "The authorisation was started by a different user. Sign in as that user, or start again here.",
  not_a_member: "You are no longer a member of this organisation.",
  token_exchange_failed: "HMRC rejected the authorisation. Try connecting again.",
  access_denied: "You declined access at HMRC. Connect again to grant permission.",
}

export default function TaxSettingsPage() {
  const { orgId, isLoading: orgLoading, error: orgError, reload: reloadOrgs } = useOrganization()
  const params = useSearchParams()

  const [vrn, setVrn] = useState("")
  const [vrnError, setVrnError] = useState<string | null>(null)
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null)

  const connectionQuery = trpc.tax.getHmrcConnection.useQuery(
    { organizationId: orgId ?? "" },
    { enabled: !!orgId },
  )

  const connectMutation = trpc.tax.connectHmrc.useMutation({
    onSuccess: ({ authorizationUrl }) => {
      // Full navigation, not a router push — this leaves our origin for HMRC.
      window.location.href = authorizationUrl
    },
    onError: (e) => setBanner({ kind: "err", text: e.message }),
  })

  const vrnMutation = trpc.tax.setVatRegistrationNumber.useMutation({
    onSuccess: () => {
      setVrnError(null)
      setBanner({ kind: "ok", text: "VAT registration number saved." })
      connectionQuery.refetch()
    },
    onError: (e) => setVrnError(e.message),
  })

  // Surface the outcome of the OAuth round trip.
  useEffect(() => {
    if (params.get("hmrc_connected")) {
      setBanner({ kind: "ok", text: "Connected to HMRC." })
    }
    const err = params.get("hmrc_error")
    if (err) {
      setBanner({ kind: "err", text: ERROR_TEXT[err] ?? `Connection failed: ${err}` })
    }
  }, [params])

  const conn = connectionQuery.data as
    | { status: string; connectedAt?: string | Date; lastSyncAt?: string | Date | null; vatRegistrationNumber?: string | null }
    | null
    | undefined

  const isConnected = !!conn && conn.status === "ACTIVE"
  const needsReconnect =
    !!conn && (conn.status === "EXPIRED" || conn.status === "REVOKED" || conn.status === "ERROR")
  const hasVrn = !!conn?.vatRegistrationNumber

  useEffect(() => {
    if (conn?.vatRegistrationNumber) setVrn(conn.vatRegistrationNumber)
  }, [conn?.vatRegistrationNumber])

  function saveVrn() {
    if (!orgId) return
    const cleaned = vrn.replace(/[^0-9]/g, "")
    if (cleaned.length !== 9) {
      setVrnError("Enter exactly 9 digits — no GB prefix and no spaces.")
      return
    }
    vrnMutation.mutate({ organizationId: orgId, vrn: cleaned })
  }

  // An empty orgId disables every control on this page. Say so, rather than
  // presenting a dead button with no explanation.
  if (!orgLoading && !orgId) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader crumbs={[{ label: "Tax", href: "/tax" }]} title="Tax Settings" />
        <main className="container mx-auto py-6 max-w-2xl">
          <Card className="border-amber-200">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
              <h2 className="text-lg font-semibold">{orgError ? "Could not load your organisation" : "No organisation selected"}</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {orgError
                  ? `Loading your organisation failed: ${orgError}`
                  : "Your account is not a member of any organisation, so there is nothing to connect to HMRC."}
              </p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                If you expected to see one, your sign-in may not be linked to it yet.
                Reload the page first — the link is created automatically on load.
              </p>
              <Button variant="outline" size="sm" onClick={() => { reloadOrgs(); window.location.reload() }}>
                <RefreshCw className="h-4 w-4 mr-2" />Reload
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader crumbs={[{ label: "Tax", href: "/tax" }]} title="Tax Settings" />

      <main className="container mx-auto py-6 max-w-3xl space-y-6">

        {banner && (
          <div
            className={`rounded-md border px-4 py-3 text-sm flex items-start gap-2 ${
              banner.kind === "ok"
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            {banner.kind === "ok"
              ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
            <span>{banner.text}</span>
          </div>
        )}

        {/* ── HMRC connection ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4" /> HMRC — Making Tax Digital
              </CardTitle>
              {connectionQuery.isLoading ? (
                <Badge variant="outline">Checking…</Badge>
              ) : isConnected ? (
                <Badge className="bg-green-100 text-green-700">Connected</Badge>
              ) : needsReconnect ? (
                <Badge className="bg-amber-100 text-amber-700">Reconnection needed</Badge>
              ) : (
                <Badge variant="outline">Not connected</Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-5 text-sm">
            <p className="text-muted-foreground">
              Connecting authorises Sumtise to retrieve your VAT obligations and submit
              VAT returns to HMRC on your behalf. HMRC authorisation lasts 18 months,
              after which you will need to reconnect.
            </p>

            {conn && (
              <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-xs">
                <span className="font-medium text-foreground">Status</span>
                <span className="text-muted-foreground">{conn.status}</span>
                <span className="font-medium text-foreground">Connected</span>
                <span className="text-muted-foreground">
                  {conn.connectedAt
                    ? format(new Date(conn.connectedAt), "dd MMM yyyy HH:mm")
                    : "—"}
                </span>
                {conn.lastSyncAt && (
                  <>
                    <span className="font-medium text-foreground">Last synced</span>
                    <span className="text-muted-foreground">
                      {format(new Date(conn.lastSyncAt), "dd MMM yyyy HH:mm")}
                    </span>
                  </>
                )}
              </div>
            )}

            {needsReconnect && (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Your HMRC authorisation is no longer valid. Reconnect before filing.</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={!orgId || connectMutation.isPending}
                onClick={() => orgId && connectMutation.mutate({ organizationId: orgId })}
              >
                {connectMutation.isPending ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Redirecting…</>
                ) : (
                  <><Link2 className="h-4 w-4 mr-2" />{conn ? "Reconnect to HMRC" : "Connect to HMRC"}</>
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground border-t pt-3">
              <strong className="text-foreground">Which HMRC account to use.</strong>{" "}
              Sign in with the Government Gateway account enrolled for VAT (MTD). If you
              are an accountant filing for a client, you must use your{" "}
              <a
                className="underline inline-flex items-center gap-0.5"
                href="https://www.gov.uk/guidance/get-an-hmrc-agent-services-account"
                target="_blank"
                rel="noreferrer"
              >
                Agent Services Account <ExternalLink className="h-3 w-3" />
              </a>{" "}
              — not an older Government Gateway agent ID.
            </p>
          </CardContent>
        </Card>

        {/* ── VAT registration number ─────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">VAT Registration Number</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              HMRC does not return your VRN when you connect, so it must be entered here.
              Every VAT call uses it — obligations and returns will fail without it.
            </p>

            <div className="flex flex-wrap gap-2 items-start">
              <div className="flex-1 min-w-[200px]">
                <input
                  value={vrn}
                  onChange={(e) => { setVrn(e.target.value); setVrnError(null) }}
                  placeholder="123456789"
                  inputMode="numeric"
                  aria-label="VAT registration number"
                  aria-invalid={!!vrnError}
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  9 digits, without the GB prefix or spaces.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!orgId || !conn || vrnMutation.isPending}
                onClick={saveVrn}
              >
                {vrnMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </div>

            {vrnError && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <XCircle className="h-3 w-3" />{vrnError}
              </p>
            )}

            {!conn && (
              <p className="text-xs text-muted-foreground">
                Connect to HMRC first, then set the VAT registration number.
              </p>
            )}

            {isConnected && hasVrn && (
              <p className="text-xs text-green-700 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Ready to file. Go to VAT (MTD) to retrieve your obligations.
              </p>
            )}
          </CardContent>
        </Card>

      </main>
    </div>
  )
}
