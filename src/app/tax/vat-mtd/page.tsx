"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import {
  FileText, CheckCircle2, Loader2, AlertTriangle, XCircle, ShieldCheck,
  RefreshCw, Send, Link2, Info,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { trpc } from "@/lib/trpc-client"
import { useOrganization } from "@/contexts/organization-context"
import { collectBrowserFingerprint } from "@/lib/hmrc/fingerprint-client"
import type { BrowserFingerprint } from "@/lib/hmrc/fraud-prevention"
import { format } from "date-fns"

const fmt = (n: number | string | null | undefined) =>
  n === null || n === undefined
    ? "—"
    : `£${Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

interface Obligation {
  start: string
  end: string
  due: string
  status: string
  periodKey: string
  received?: string
}

export default function VatMtdPage() {
  const { orgId } = useOrganization()

  const [fingerprint, setFingerprint] = useState<BrowserFingerprint | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [declared, setDeclared] = useState(false)
  const [receipt, setReceipt] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // Collect ONCE on mount. The fingerprint includes window size, so recollecting
  // on every render would change the tRPC query key on any resize and refetch.
  useEffect(() => {
    try {
      setFingerprint(collectBrowserFingerprint())
    } catch {
      // Non-fatal: the server refuses the HMRC call rather than sending
      // placeholder fraud prevention data.
    }
  }, [])

  const connection = trpc.tax.getHmrcConnection.useQuery(
    { organizationId: orgId ?? "" },
    { enabled: !!orgId },
  )

  const conn = connection.data as
    | { status: string; vatRegistrationNumber?: string | null }
    | null
    | undefined

  const isReady = !!conn && conn.status === "ACTIVE" && !!conn.vatRegistrationNumber

  // Ask HMRC for a wide window; their cap is 366 days.
  const range = useMemo(() => {
    const to = new Date()
    const from = new Date(to)
    from.setDate(from.getDate() - 365)
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    return { from: iso(from), to: iso(to) }
  }, [])

  const obligations = trpc.tax.getVatObligations.useQuery(
    {
      organizationId: orgId ?? "",
      fromDate: range.from,
      toDate: range.to,
      ...(fingerprint ? { fingerprint } : {}),
    },
    { enabled: !!orgId && isReady && !!fingerprint, retry: false },
  )

  const list: Obligation[] = (obligations.data?.obligations as Obligation[]) ?? []
  const open = list.filter((o) => o.status !== "F")
  const selected = list.find((o) => o.periodKey === selectedKey) ?? null

  // Derived server-side from source documents, keyed on HMRC's own periodKey —
  // the same code path submission uses, so what is reviewed is what is filed.
  const vatReturn = trpc.tax.previewVatReturn.useQuery(
    { organizationId: orgId ?? "", periodKey: selectedKey ?? "" },
    { enabled: !!orgId && !!selectedKey },
  )

  const vat = vatReturn.data as any
  const box = vat?.boxes

  const submitMutation = trpc.tax.submitMtdVatReturn.useMutation({
    onSuccess: (data) => { setReceipt(data); setError(null) },
    onError: (e) => setError(e.message),
  })

  function submit() {
    if (!orgId || !selected || !box || !fingerprint) return
    setError(null)
    submitMutation.mutate({
      organizationId: orgId,
      periodKey: selected.periodKey,
      finalised: true,
      fingerprint,
      // Not sent to HMRC — lets the server detect that a document changed
      // between review and submission and refuse rather than file blind.
      reviewed: {
        box1: box.box1OutputVat,
        box4: box.box4InputVat,
        box5: Math.abs(box.box5NetVatSigned),
        box6: box.box6SalesExVat,
        box7: box.box7PurchasesExVat,
      },
    })
  }

  const isRepayment = box ? box.box5NetVatSigned < 0 : false

  const boxes = box ? [
    { n: "1", desc: "VAT due on sales and other outputs", value: fmt(box.box1OutputVat) },
    { n: "2", desc: "VAT due on acquisitions from EU (NI Protocol)", value: fmt(box.box2Acquisitions), note: true },
    { n: "3", desc: "Total VAT due (Box 1 + Box 2)", value: fmt(box.box3TotalVatDue) },
    { n: "4", desc: "VAT reclaimed on purchases and other inputs", value: fmt(box.box4InputVat) },
    { n: "5", desc: isRepayment ? "Net VAT to be reclaimed" : "Net VAT to pay to HMRC", value: fmt(Math.abs(box.box5NetVatSigned)), strong: true },
    { n: "6", desc: "Total value of sales excluding VAT", value: `£${box.box6SalesExVat.toLocaleString("en-GB")}` },
    { n: "7", desc: "Total value of purchases excluding VAT", value: `£${box.box7PurchasesExVat.toLocaleString("en-GB")}` },
    { n: "8", desc: "Total value of goods supplied to EU (NI Protocol)", value: `£${box.box8GoodsSuppliedExVat.toLocaleString("en-GB")}`, note: true },
    { n: "9", desc: "Total value of acquisitions from EU (NI Protocol)", value: `£${box.box9AcquisitionsExVat.toLocaleString("en-GB")}`, note: true },
  ] : []

  // ── Not connected ──────────────────────────────────────────────────────────
  if (!connection.isLoading && !isReady) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader crumbs={[{ label: "Tax", href: "/tax" }]} title="VAT Return (MTD)" />
        <main className="container mx-auto py-6 max-w-3xl">
          <Card>
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground" />
              <h2 className="text-lg font-semibold">
                {!conn ? "Not connected to HMRC" : "Setup incomplete"}
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {!conn
                  ? "Connect your HMRC account to retrieve your VAT obligations and file returns."
                  : conn.status !== "ACTIVE"
                  ? `Your HMRC connection status is ${conn.status}. Reconnect before filing.`
                  : "Your VAT registration number has not been set."}
              </p>
              <Link href="/tax/settings">
                <Button><Link2 className="h-4 w-4 mr-2" />Go to Tax Settings</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  // ── Filed ──────────────────────────────────────────────────────────────────
  if (receipt) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader crumbs={[{ label: "Tax", href: "/tax" }]} title="VAT Return (MTD)" />
        <main className="container mx-auto py-6 max-w-3xl space-y-6">
          <Card className="border-green-200">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" />
              <h2 className="text-xl font-semibold">Submitted to HMRC</h2>
              <p className="text-sm text-muted-foreground">
                HMRC has accepted the return. Keep the receipt below — it is your proof of filing.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">HMRC Receipt</CardTitle>
            </CardHeader>
            <CardContent className="text-xs">
              <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5">
                <span className="font-medium">Form bundle number</span>
                <span className="font-mono">{receipt.formBundleNumber}</span>
                <span className="font-medium">Processing date</span>
                <span>{receipt.processingDate}</span>
                {receipt.chargeRefNumber && (
                  <>
                    <span className="font-medium">Charge reference</span>
                    <span className="font-mono">{receipt.chargeRefNumber}</span>
                  </>
                )}
                {receipt.paymentIndicator && (
                  <>
                    <span className="font-medium">Payment method held</span>
                    <span>{receipt.paymentIndicator === "DD" ? "Direct Debit" : "Bank details"}</span>
                  </>
                )}
                {receipt.receiptId && (
                  <>
                    <span className="font-medium">Receipt ID</span>
                    <span className="font-mono break-all">{receipt.receiptId}</span>
                  </>
                )}
              </div>
              <p className="mt-4 text-muted-foreground">
                A VAT return cannot be amended through the API. Corrections go through
                HMRC&apos;s separate amendment process.
              </p>
            </CardContent>
          </Card>

          <Button variant="outline" onClick={() => { setReceipt(null); setSelectedKey(null); setDeclared(false); obligations.refetch() }}>
            Back to obligations
          </Button>
        </main>
      </div>
    )
  }

  // ── Main ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <PageHeader crumbs={[{ label: "Tax", href: "/tax" }]} title="VAT Return (MTD)" />

      <main className="container mx-auto py-6 max-w-3xl space-y-6">

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
            <XCircle className="h-4 w-4 mt-0.5 shrink-0" /><span>{error}</span>
          </div>
        )}

        {/* ── Obligations from HMRC ────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> VAT Obligations
              </CardTitle>
              <Button
                size="sm" variant="outline"
                onClick={() => obligations.refetch()}
                disabled={obligations.isFetching}
              >
                {obligations.isFetching
                  ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />Refreshing</>
                  : <><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh from HMRC</>}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="text-sm">
            {!fingerprint && (
              <p className="text-xs text-muted-foreground">Preparing secure session…</p>
            )}

            {obligations.isLoading && (
              <p className="text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />Retrieving obligations from HMRC…
              </p>
            )}

            {obligations.error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                {obligations.error.message}
              </div>
            )}

            {!obligations.isLoading && !obligations.error && list.length === 0 && (
              <p className="text-muted-foreground text-xs">
                HMRC returned no VAT obligations for the last 12 months.
              </p>
            )}

            {list.length > 0 && (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left p-2 font-semibold">Period</th>
                      <th className="text-left p-2 font-semibold">Due</th>
                      <th className="text-left p-2 font-semibold">Key</th>
                      <th className="text-left p-2 font-semibold">Status</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {list.map((o) => {
                      const isSel = o.periodKey === selectedKey
                      const filed = o.status === "F"
                      return (
                        <tr key={o.periodKey} className={isSel ? "bg-primary/5" : ""}>
                          <td className="p-2">
                            {format(new Date(o.start), "dd MMM yyyy")} – {format(new Date(o.end), "dd MMM yyyy")}
                          </td>
                          <td className="p-2">{format(new Date(o.due), "dd MMM yyyy")}</td>
                          <td className="p-2 font-mono">{o.periodKey}</td>
                          <td className="p-2">
                            {filed
                              ? <Badge className="bg-green-100 text-green-700">Filed</Badge>
                              : new Date(o.due) < new Date()
                              ? <Badge className="bg-red-100 text-red-700">Overdue</Badge>
                              : <Badge variant="outline">Open</Badge>}
                          </td>
                          <td className="p-2 text-right">
                            {!filed && (
                              <Button
                                size="sm"
                                variant={isSel ? "default" : "outline"}
                                onClick={() => { setSelectedKey(o.periodKey); setDeclared(false); setError(null) }}
                              >
                                {isSel ? "Selected" : "Prepare"}
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {list.length > 0 && open.length === 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                All obligations in this window have been filed.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── The nine boxes ──────────────────────────────────────────────── */}
        {selected && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Return for {format(new Date(selected.start), "dd MMM yyyy")} – {format(new Date(selected.end), "dd MMM yyyy")}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Period key <span className="font-mono">{selected.periodKey}</span> · due{" "}
                {format(new Date(selected.due), "dd MMM yyyy")}
              </p>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {vatReturn.isLoading && (
                <p className="text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />Calculating from your ledger…
                </p>
              )}

              {vatReturn.error && (
                <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  {vatReturn.error.message}
                </div>
              )}

              {vat?.alreadyFiled && (
                <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800 flex items-start gap-2">
                  <Info className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    This period was already filed with HMRC (receipt{" "}
                    <span className="font-mono">{vat.hmrcReceiptId}</span>). It cannot be
                    submitted again.
                  </span>
                </div>
              )}

              {(vat?.blockers ?? []).map((b: string, i: number) => (
                <div key={`bl-${i}`} className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 flex items-start gap-2">
                  <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{b}</span>
                </div>
              ))}

              {(vat?.warnings ?? []).map((w: string, i: number) => (
                <div key={`wn-${i}`} className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}

              {vat && (
                <>
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-xs">
                      <tbody className="divide-y">
                        {boxes.map((b) => (
                          <tr key={b.n} className={b.strong ? "bg-muted/40 font-semibold" : ""}>
                            <td className="p-2 w-14 text-muted-foreground">Box {b.n}</td>
                            <td className="p-2">{b.desc}</td>
                            <td className="p-2 text-right font-mono whitespace-nowrap">{b.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    Calculated from the VAT actually charged on your documents in this
                    period: {vat.counts.invoices} invoice(s), {vat.counts.creditNotes} credit
                    note(s), {vat.counts.bills} bill(s), {vat.counts.debitNotes} debit note(s).
                    Boxes 2, 8 and 9 apply only to Northern Ireland Protocol trade and cannot
                    be calculated automatically — they are submitted as zero.
                  </p>

                  {/* Declaration */}
                  <label className="flex items-start gap-2.5 rounded-md border p-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={declared}
                      onChange={(e) => setDeclared(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span className="text-xs leading-relaxed">
                      <strong>Declaration.</strong> I confirm the information above is correct
                      and complete to the best of my knowledge. I understand that submitting
                      false information may result in penalties, and that a submitted return
                      cannot be amended through this software.
                    </span>
                  </label>

                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-xs text-muted-foreground">
                      {isRepayment
                        ? `HMRC owes you ${fmt(Math.abs(box.box5NetVatSigned))}`
                        : `You owe HMRC ${fmt(Math.abs(box.box5NetVatSigned))}`}
                    </p>
                    <Button
                      onClick={submit}
                      disabled={!declared || !fingerprint || submitMutation.isPending || (vat?.blockers?.length ?? 0) > 0 || vat?.alreadyFiled}
                    >
                      {submitMutation.isPending
                        ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting to HMRC…</>
                        : <><Send className="h-4 w-4 mr-2" />Submit return to HMRC</>}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
