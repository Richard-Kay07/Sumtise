"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { trpc } from "@/lib/trpc-client"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import {
  Calculator,
  FileText,
  AlertTriangle,
  CheckCircle,
  Download,
  Upload,
  Clock,
  Globe,
  RefreshCw,
  Send,
  Save,
} from "lucide-react"
import { Logo } from "@/components/logo"

type TaxType = "VAT" | "CORPORATION_TAX" | "RTI_PAYE"
type VATScheme = "standard" | "cash" | "flat_rate"

type CalcParams = {
  periodStart: Date
  periodEnd: Date
  scheme: VATScheme
  type: TaxType
}

const TAX_TYPE_LABELS: Record<TaxType, string> = {
  VAT: "VAT",
  CORPORATION_TAX: "Corporation Tax",
  RTI_PAYE: "PAYE / RTI",
}

const SUBMISSION_TYPE_LABELS: Record<string, string> = {
  VAT_RETURN: "VAT Return",
  CORPORATION_TAX: "Corporation Tax",
  RTI_PAYE: "PAYE / RTI",
  RTI_NI: "National Insurance",
  OTHER: "Other",
}

const REGIONS = [
  { code: "UK", name: "United Kingdom", flag: "🇬🇧" },
  { code: "ZA", name: "South Africa",   flag: "🇿🇦" },
  { code: "KE", name: "Kenya",          flag: "🇰🇪" },
  { code: "ZM", name: "Zambia",         flag: "🇿🇲" },
]

function getRegionTaxTypes(region: string): TaxType[] {
  switch (region) {
    case "UK": return ["VAT", "CORPORATION_TAX", "RTI_PAYE"]
    default:   return ["VAT", "RTI_PAYE"]
  }
}

function statusBadgeVariant(status: string) {
  switch (status) {
    case "ACCEPTED":  return "default"    as const
    case "SUBMITTED": return "secondary"  as const
    case "DRAFT":     return "outline"    as const
    case "REJECTED":  return "destructive" as const
    case "AMENDED":   return "secondary"  as const
    default:          return "outline"    as const
  }
}

function StatusIcon({ status }: { status: string }) {
  const cls = "h-5 w-5 flex-shrink-0 text-muted-foreground"
  switch (status) {
    case "ACCEPTED":  return <CheckCircle className={cls} />
    case "SUBMITTED": return <Upload className={cls} />
    case "REJECTED":  return <AlertTriangle className={cls} />
    case "DRAFT":     return <FileText className={cls} />
    default:          return <Clock className={cls} />
  }
}

export default function TaxPage() {
  const { toast } = useToast()

  const [activeTab, setActiveTab]           = useState("returns")
  const [selectedRegion, setSelectedRegion] = useState("UK")
  const [selectedType, setSelectedType]     = useState<TaxType>("VAT")
  const [vatScheme, setVatScheme]           = useState<VATScheme>("standard")
  const [periodStartStr, setPeriodStartStr] = useState("")
  const [periodEndStr, setPeriodEndStr]     = useState("")
  const [calcParams, setCalcParams]         = useState<CalcParams | null>(null)
  const [manualAmount, setManualAmount]     = useState("")
  const [manualReference, setManualReference] = useState("")

  // ── Org ──────────────────────────────────────────────────────────────────
  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()
  const orgId = organizations?.[0]?.id ?? ""

  // ── Auto-populate VAT quarter dates ──────────────────────────────────────
  const { data: quarterDates } = trpc.tax.getVATQuarterDates.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId },
  )

  useEffect(() => {
    if (quarterDates && !periodStartStr && !periodEndStr) {
      setPeriodStartStr(new Date(quarterDates.start).toISOString().split("T")[0])
      setPeriodEndStr(new Date(quarterDates.end).toISOString().split("T")[0])
    }
  }, [quarterDates]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Submissions list ──────────────────────────────────────────────────────
  const {
    data: submissions,
    refetch: refetchSubmissions,
    isLoading: submissionsLoading,
  } = trpc.tax.listAllSubmissions.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId },
  )

  // ── VAT calculation (fires when calcParams set + type = VAT) ─────────────
  const {
    data: vatResult,
    isFetching: vatCalculating,
  } = trpc.tax.getVATReturn.useQuery(
    {
      organizationId: orgId,
      periodStart:    calcParams?.periodStart ?? new Date(),
      periodEnd:      calcParams?.periodEnd   ?? new Date(),
      scheme:         calcParams?.scheme      ?? "standard",
    },
    { enabled: !!calcParams && calcParams.type === "VAT" && !!orgId },
  )

  // ── CT calculation ────────────────────────────────────────────────────────
  const {
    data: ctResult,
    isFetching: ctCalculating,
  } = trpc.tax.getCorporationTaxEstimate.useQuery(
    {
      organizationId: orgId,
      periodStart:    calcParams?.periodStart ?? new Date(),
      periodEnd:      calcParams?.periodEnd   ?? new Date(),
    },
    { enabled: !!calcParams && calcParams.type === "CORPORATION_TAX" && !!orgId },
  )

  const isCalculating = vatCalculating || ctCalculating

  // ── Mutations ─────────────────────────────────────────────────────────────
  const saveVATDraft = trpc.tax.saveVATDraft.useMutation({
    onSuccess: () => {
      toast({ title: "Draft saved", description: "VAT return saved as draft." })
      void refetchSubmissions()
    },
    onError: (e) => toast({ title: "Error saving draft", description: e.message, variant: "destructive" }),
  })

  const saveCTDraft = trpc.tax.saveCTDraft.useMutation({
    onSuccess: () => {
      toast({ title: "Draft saved", description: "Corporation tax return saved as draft." })
      void refetchSubmissions()
    },
    onError: (e) => toast({ title: "Error saving draft", description: e.message, variant: "destructive" }),
  })

  const submitVAT = trpc.tax.createVATSubmission.useMutation({
    onSuccess: () => {
      toast({
        title: "Return submitted",
        description: "VAT return recorded as submitted. File via HMRC Government Gateway to complete.",
      })
      void refetchSubmissions()
    },
    onError: (e) => toast({ title: "Submission error", description: e.message, variant: "destructive" }),
  })

  const submitCT = trpc.tax.createCorporationTaxSubmission.useMutation({
    onSuccess: () => {
      toast({ title: "Return submitted", description: "Corporation tax return recorded as submitted." })
      void refetchSubmissions()
    },
    onError: (e) => toast({ title: "Submission error", description: e.message, variant: "destructive" }),
  })

  const submitRTI = trpc.tax.createRTISubmission.useMutation({
    onSuccess: () => {
      toast({ title: "RTI submitted", description: "RTI submission recorded." })
      void refetchSubmissions()
    },
    onError: (e) => toast({ title: "Submission error", description: e.message, variant: "destructive" }),
  })

  const submitDraft = trpc.tax.submitDraft.useMutation({
    onSuccess: () => {
      toast({ title: "Submitted", description: "Submission status updated to submitted." })
      void refetchSubmissions()
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  })

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCalculate = () => {
    if (!periodStartStr || !periodEndStr) {
      toast({ title: "Select period", description: "Choose a start and end date first.", variant: "destructive" })
      return
    }
    setCalcParams({
      periodStart: new Date(periodStartStr),
      periodEnd:   new Date(periodEndStr),
      scheme:      vatScheme,
      type:        selectedType,
    })
  }

  const getCalculatedAmount = () => {
    if (selectedType === "VAT" && vatResult)         return String(vatResult.box5NetVAT)
    if (selectedType === "CORPORATION_TAX" && ctResult) return String(ctResult.ctLiability)
    return "0"
  }

  const handleSaveDraft = () => {
    if (!calcParams) return
    const amount = getCalculatedAmount()
    if (selectedType === "VAT") {
      saveVATDraft.mutate({
        organizationId: orgId,
        periodStart:    calcParams.periodStart,
        periodEnd:      calcParams.periodEnd,
        totalAmount:    amount,
        data:           vatResult as Record<string, unknown>,
      })
    } else if (selectedType === "CORPORATION_TAX") {
      saveCTDraft.mutate({
        organizationId: orgId,
        periodStart:    calcParams.periodStart,
        periodEnd:      calcParams.periodEnd,
        totalAmount:    amount,
        data:           ctResult as Record<string, unknown>,
      })
    }
  }

  const handleSubmitNow = () => {
    if (!periodStartStr || !periodEndStr) {
      toast({ title: "Select period", description: "Choose a start and end date first.", variant: "destructive" })
      return
    }

    // Non-UK or RTI — manual entry path
    if (selectedRegion !== "UK" || selectedType === "RTI_PAYE") {
      if (!manualAmount) {
        toast({ title: "Enter amount", description: "Enter the tax amount before submitting.", variant: "destructive" })
        return
      }
      submitRTI.mutate({
        organizationId: orgId,
        submissionType: "RTI_PAYE",
        periodStart:    new Date(periodStartStr),
        periodEnd:      new Date(periodEndStr),
        totalAmount:    manualAmount,
        reference:      manualReference || undefined,
      })
      return
    }

    if (!calcParams) {
      toast({ title: "Calculate first", description: "Click Calculate before submitting.", variant: "destructive" })
      return
    }

    const amount = getCalculatedAmount()
    if (selectedType === "VAT") {
      submitVAT.mutate({
        organizationId: orgId,
        periodStart:    calcParams.periodStart,
        periodEnd:      calcParams.periodEnd,
        totalAmount:    amount,
        data:           vatResult as Record<string, unknown>,
      })
    } else if (selectedType === "CORPORATION_TAX") {
      submitCT.mutate({
        organizationId: orgId,
        periodStart:    calcParams.periodStart,
        periodEnd:      calcParams.periodEnd,
        totalAmount:    amount,
        data:           ctResult as Record<string, unknown>,
      })
    }
  }

  // ── Compliance stats from real data ───────────────────────────────────────
  const complianceStats = useMemo(() => {
    if (!submissions || submissions.length === 0) {
      return { score: 100, drafts: 0, overdue: 0, total: 0 }
    }
    const total     = submissions.length
    const compliant = submissions.filter(s => s.status === "SUBMITTED" || s.status === "ACCEPTED").length
    const draftList = submissions.filter(s => s.status === "DRAFT")
    const now       = new Date()
    const overdue   = draftList.filter(s => new Date(s.periodEnd) < now).length
    return {
      score:   Math.round((compliant / total) * 100),
      drafts:  draftList.length,
      overdue,
      total,
    }
  }, [submissions])

  // ── Derived ───────────────────────────────────────────────────────────────
  const isUKCalculable    = selectedRegion === "UK" && selectedType !== "RTI_PAYE"
  const hasResult         = (selectedType === "VAT" && !!vatResult) ||
                            (selectedType === "CORPORATION_TAX" && !!ctResult)
  const isSaving          = saveVATDraft.isLoading || saveCTDraft.isLoading
  const isSubmitting      = submitVAT.isLoading || submitCT.isLoading || submitRTI.isLoading

  const goCalculate = () => setActiveTab("calculate")

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <a className="mr-6" href="/">
              <Logo size={32} showText={true} />
            </a>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="w-full flex-1 md:w-auto md:flex-none">
              <h1 className="text-2xl font-bold">Tax Compliance</h1>
            </div>
            <nav className="flex items-center space-x-2">
              <Button variant="outline" onClick={goCalculate}>
                <Calculator className="mr-2 h-4 w-4" />
                Calculate Tax
              </Button>
              <Button onClick={goCalculate}>
                <FileText className="mr-2 h-4 w-4" />
                New Return
              </Button>
            </nav>
          </div>
        </div>
      </div>

      <main className="container mx-auto py-6">
        <div className="grid gap-6 lg:grid-cols-4">
          {/* ── Left panel ────────────────────────────────────────────────── */}
          <div className="lg:col-span-1 space-y-6">
            {/* Region selector */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Globe className="mr-2 h-5 w-5" />
                  Tax Region
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {REGIONS.map((r) => (
                    <Button
                      key={r.code}
                      variant={selectedRegion === r.code ? "default" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => {
                        setSelectedRegion(r.code)
                        setSelectedType(getRegionTaxTypes(r.code)[0])
                        setCalcParams(null)
                      }}
                    >
                      <span className="mr-2">{r.flag}</span>
                      {r.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Tax type selector */}
            <Card>
              <CardHeader>
                <CardTitle>Tax Types</CardTitle>
                <CardDescription>
                  {REGIONS.find(r => r.code === selectedRegion)?.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {getRegionTaxTypes(selectedRegion).map((type) => (
                    <Button
                      key={type}
                      variant={selectedType === type ? "default" : "ghost"}
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => { setSelectedType(type); setCalcParams(null) }}
                    >
                      {TAX_TYPE_LABELS[type]}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Compliance summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Compliance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-center p-3 border rounded-lg">
                    <div className={`text-2xl font-bold ${
                      complianceStats.score >= 80 ? "text-green-600"
                      : complianceStats.score >= 50 ? "text-orange-600"
                      : "text-red-600"
                    }`}>
                      {complianceStats.score}%
                    </div>
                    <div className="text-xs text-muted-foreground">Compliance Score</div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total submissions</span>
                      <span className="font-medium">{complianceStats.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Drafts pending</span>
                      <span className="font-medium text-blue-600">{complianceStats.drafts}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Overdue drafts</span>
                      <span className="font-medium text-red-600">{complianceStats.overdue}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Main content ──────────────────────────────────────────────── */}
          <div className="lg:col-span-3">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6">
                <TabsTrigger value="returns">Returns</TabsTrigger>
                <TabsTrigger value="calculate">Calculate &amp; Submit</TabsTrigger>
              </TabsList>

              {/* ── Returns tab ─────────────────────────────────────────── */}
              <TabsContent value="returns">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Tax Submissions</span>
                      <Button variant="outline" size="sm" onClick={() => void refetchSubmissions()}>
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Refresh
                      </Button>
                    </CardTitle>
                    <CardDescription>
                      All recorded tax submissions for your organisation
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {submissionsLoading ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                      </div>
                    ) : !submissions || submissions.length === 0 ? (
                      <div className="text-center py-12">
                        <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-4 text-lg font-semibold">No submissions yet</h3>
                        <p className="text-muted-foreground mb-4">
                          Use the Calculate &amp; Submit tab to create your first return.
                        </p>
                        <Button onClick={goCalculate}>
                          <Calculator className="mr-2 h-4 w-4" />
                          Calculate &amp; Submit
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {submissions.map((sub) => (
                          <div key={sub.id} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center space-x-3 min-w-0">
                                <StatusIcon status={sub.status} />
                                <div className="min-w-0">
                                  <div className="font-medium">
                                    {SUBMISSION_TYPE_LABELS[sub.submissionType] ?? sub.submissionType}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {formatDate(sub.periodStart)} – {formatDate(sub.periodEnd)}
                                    {sub.reference && (
                                      <span className="ml-2">• Ref: {sub.reference}</span>
                                    )}
                                  </div>
                                  {sub.submittedAt && (
                                    <div className="text-xs text-muted-foreground">
                                      Submitted {formatDate(sub.submittedAt)}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center space-x-3 flex-shrink-0">
                                <div className="text-right">
                                  {sub.totalAmount != null && (
                                    <div className="font-bold">
                                      {formatCurrency(Number(sub.totalAmount))}
                                    </div>
                                  )}
                                  <Badge variant={statusBadgeVariant(sub.status)}>
                                    {sub.status}
                                  </Badge>
                                </div>
                                <div className="flex space-x-1">
                                  <Button variant="outline" size="sm" title="Download">
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  {sub.status === "DRAFT" && (
                                    <Button
                                      size="sm"
                                      onClick={() => submitDraft.mutate({ organizationId: orgId, submissionId: sub.id })}
                                      disabled={submitDraft.isLoading}
                                    >
                                      <Send className="h-4 w-4 mr-1" />
                                      Submit
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Calculate & Submit tab ───────────────────────────────── */}
              <TabsContent value="calculate">
                <div className="space-y-6">
                  {/* Period & options */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Calculator className="mr-2 h-5 w-5" />
                        {TAX_TYPE_LABELS[selectedType]} —{" "}
                        {REGIONS.find(r => r.code === selectedRegion)?.name}
                      </CardTitle>
                      <CardDescription>
                        {isUKCalculable
                          ? "Figures are derived from your recorded transactions."
                          : "Enter the tax amount manually and record the submission."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <div>
                          <Label htmlFor="period-start">Period Start</Label>
                          <Input
                            id="period-start"
                            type="date"
                            value={periodStartStr}
                            onChange={(e) => { setPeriodStartStr(e.target.value); setCalcParams(null) }}
                          />
                        </div>
                        <div>
                          <Label htmlFor="period-end">Period End</Label>
                          <Input
                            id="period-end"
                            type="date"
                            value={periodEndStr}
                            onChange={(e) => { setPeriodEndStr(e.target.value); setCalcParams(null) }}
                          />
                        </div>
                        {selectedType === "VAT" && selectedRegion === "UK" && (
                          <div>
                            <Label htmlFor="vat-scheme">VAT Scheme</Label>
                            <select
                              id="vat-scheme"
                              value={vatScheme}
                              onChange={(e) => { setVatScheme(e.target.value as VATScheme); setCalcParams(null) }}
                              className="w-full h-10 px-3 border border-input bg-background rounded-md text-sm"
                            >
                              <option value="standard">Standard (invoice basis)</option>
                              <option value="cash">Cash Accounting</option>
                              <option value="flat_rate">Flat Rate Scheme</option>
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Manual entry for non-UK or PAYE */}
                      {!isUKCalculable && (
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div>
                            <Label htmlFor="manual-amount">Tax Amount</Label>
                            <Input
                              id="manual-amount"
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={manualAmount}
                              onChange={(e) => setManualAmount(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="manual-ref">Reference (optional)</Label>
                            <Input
                              id="manual-ref"
                              placeholder="PAYE ref, tax period, etc."
                              value={manualReference}
                              onChange={(e) => setManualReference(e.target.value)}
                            />
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center gap-3 mt-6">
                        {isUKCalculable && (
                          <Button onClick={handleCalculate} disabled={isCalculating}>
                            {isCalculating ? (
                              <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Calculating…</>
                            ) : (
                              <><Calculator className="mr-2 h-4 w-4" /> Calculate</>
                            )}
                          </Button>
                        )}

                        {(hasResult || !isUKCalculable) && (
                          <>
                            {isUKCalculable && (
                              <Button variant="outline" onClick={handleSaveDraft} disabled={isSaving}>
                                <Save className="mr-2 h-4 w-4" />
                                {isSaving ? "Saving…" : "Save Draft"}
                              </Button>
                            )}
                            <Button onClick={handleSubmitNow} disabled={isSubmitting}>
                              <Send className="mr-2 h-4 w-4" />
                              {isSubmitting ? "Submitting…" : "Submit Return"}
                            </Button>
                          </>
                        )}
                      </div>

                      {isUKCalculable && !hasResult && !isCalculating && (
                        <p className="text-sm text-muted-foreground mt-3">
                          Click Calculate to derive figures from your recorded transactions for this period.
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* VAT return boxes */}
                  {selectedType === "VAT" && vatResult && (
                    <Card>
                      <CardHeader>
                        <CardTitle>VAT Return Boxes</CardTitle>
                        <CardDescription>
                          {vatResult.transactionsAnalysed} transactions analysed ·{" "}
                          {vatResult.scheme} scheme
                          {vatResult.isRepayment && " · HMRC owes you a repayment"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {[
                            { box: "Box 1", label: "VAT due on sales and other outputs",  amount: Number(vatResult.box1OutputVAT) },
                            { box: "Box 2", label: "VAT due on EC acquisitions",           amount: Number(vatResult.box2) },
                            { box: "Box 3", label: "Total VAT due (Box 1 + Box 2)",       amount: Number(vatResult.box3TotalDue), highlight: true },
                            { box: "Box 4", label: "VAT reclaimed on purchases / inputs", amount: Number(vatResult.box4InputVAT) },
                            { box: "Box 6", label: "Total value of sales (ex. VAT)",      amount: Number(vatResult.box6SalesNet) },
                            { box: "Box 7", label: "Total value of purchases (ex. VAT)",  amount: Number(vatResult.box7PurchasesNet) },
                          ].map(({ box, label, amount, highlight }) => (
                            <div
                              key={box}
                              className={`flex items-center justify-between p-3 border rounded-lg ${
                                highlight ? "bg-muted/50 font-semibold" : ""
                              }`}
                            >
                              <div>
                                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded mr-2">{box}</span>
                                <span className="text-sm">{label}</span>
                              </div>
                              <span className="font-medium tabular-nums">{formatCurrency(amount)}</span>
                            </div>
                          ))}

                          {/* Box 5 — highlighted total */}
                          <div className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                            vatResult.isRepayment
                              ? "border-green-500 bg-green-50 dark:bg-green-950"
                              : "border-red-500 bg-red-50 dark:bg-red-950"
                          }`}>
                            <div>
                              <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded mr-2">Box 5</span>
                              <span className="font-bold">
                                Net VAT {vatResult.isRepayment ? "repayable to you" : "due to HMRC"}
                              </span>
                            </div>
                            <span className={`text-xl font-bold tabular-nums ${
                              vatResult.isRepayment ? "text-green-600" : "text-red-600"
                            }`}>
                              {formatCurrency(Math.abs(Number(vatResult.box5NetVAT)))}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Corporation tax breakdown */}
                  {selectedType === "CORPORATION_TAX" && ctResult && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Corporation Tax Estimate</CardTitle>
                        <CardDescription>
                          {ctResult.rateBand} band · {(ctResult.effectiveRate * 100).toFixed(2)}% effective rate
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {[
                            { label: "Revenue",                        amount: ctResult.revenue },
                            { label: "Allowable expenses",             amount: ctResult.expenses },
                            { label: "Trading profit (gross)",         amount: ctResult.tradingProfitGross },
                            { label: "Capital allowances deducted",    amount: ctResult.capitalAllowances },
                            { label: "Chargeable profit",              amount: ctResult.tradingProfitChargeable },
                            { label: "Gross corporation tax",          amount: ctResult.grossCT },
                            { label: "Marginal relief",                amount: -ctResult.marginalRelief },
                          ].map(({ label, amount }) => (
                            <div key={label} className="flex items-center justify-between p-3 border rounded-lg">
                              <span className="text-sm text-muted-foreground">{label}</span>
                              <span className="font-medium tabular-nums">{formatCurrency(amount)}</span>
                            </div>
                          ))}

                          <div className="flex items-center justify-between p-4 rounded-lg border-2 border-red-500 bg-red-50 dark:bg-red-950">
                            <span className="font-bold">CT Liability</span>
                            <span className="text-xl font-bold text-red-600 tabular-nums">
                              {formatCurrency(ctResult.ctLiability)}
                            </span>
                          </div>

                          {ctResult.rdRelief && (
                            <div className="p-3 border rounded-lg bg-blue-50 dark:bg-blue-950 text-sm">
                              <div className="font-medium mb-1">R&amp;D Relief Available</div>
                              <div className="text-muted-foreground">
                                Enhanced deduction: {formatCurrency(ctResult.rdRelief.enhancedDeductionGBP)}
                                {" · "}
                                CT saving: {formatCurrency(ctResult.rdRelief.ctSavingGBP)}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Non-UK notice */}
                  {selectedRegion !== "UK" && (
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-start space-x-3 text-sm text-muted-foreground">
                          <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                          <p>
                            Automatic calculation from transactions is currently available for UK returns only.
                            Enter your figures above to record the submission.
                            Direct SARS / KRA / ZRA filing integrations are on the roadmap.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* HMRC notice for UK submissions */}
                  {selectedRegion === "UK" && (
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-start space-x-3 text-sm text-muted-foreground">
                          <AlertTriangle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                          <p>
                            Submitting here records the return in Sumtise. To complete filing with HMRC,
                            log in to your Government Gateway account and submit via Making Tax Digital.
                            Direct HMRC API submission is coming in a future release.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  )
}
