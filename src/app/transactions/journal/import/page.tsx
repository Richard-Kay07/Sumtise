"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import {
  Upload, Download, CheckCircle, AlertTriangle, RefreshCw,
  BookOpen, FileSpreadsheet, FileText, ShieldCheck, XCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { trpc } from "@/lib/trpc-client"
import { useOrganization } from "@/contexts/organization-context"
import {
  JOURNAL_COLUMNS,
  JOURNAL_CSV_TEMPLATE,
  parseJournalCSV,
  type JournalParseResult,
} from "@/lib/journal-import/csv-parser"
import { format } from "date-fns"

type Step = "upload" | "preview" | "done"
type FileKind = "csv" | "xlsx" | null

// ─── Client-side pre-validation (no server call) ──────────────────────────────

async function validateFileClientSide(
  ab: ArrayBuffer,
  ext: string,
): Promise<JournalParseResult> {
  let csvText: string
  if (ext === "xlsx" || ext === "xls") {
    const XLSX = await import("xlsx")
    const data = new Uint8Array(ab)
    const wb   = XLSX.read(data, { type: "array", cellDates: true })
    csvText    = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], { blankrows: false })
  } else {
    csvText = new TextDecoder().decode(ab)
  }
  return parseJournalCSV(csvText)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function JournalImportPage() {
  const { orgId } = useOrganization()

  const [step, setStep]                 = useState<Step>("upload")
  const [file, setFile]                 = useState<File | null>(null)
  const [fileKind, setFileKind]         = useState<FileKind>(null)
  const [csvBase64, setCsvBase64]       = useState<string>("")
  const [localResult, setLocalResult]   = useState<JournalParseResult | null>(null)
  const [previewData, setPreviewData]   = useState<any>(null)
  const [result, setResult]             = useState<any>(null)
  const [uploadError, setUploadError]   = useState<string | null>(null)

  // ── tRPC ─────────────────────────────────────────────────────────────────────

  const templateMutation = trpc.manualJournals.generateTemplate.useMutation({
    onSuccess: ({ base64 }) => {
      const bytes = atob(base64)
      const arr   = new Uint8Array(bytes.length)
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
      const blob = new Blob([arr], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href = url; a.download = "journal_import_template.xlsx"; a.click()
      URL.revokeObjectURL(url)
    },
  })

  const previewMutation = trpc.manualJournals.previewImport.useMutation({
    onSuccess: (data) => { setPreviewData(data); setStep("preview") },
    onError:   (e)    => setUploadError(e.message),
  })

  const importMutation = trpc.manualJournals.importJournals.useMutation({
    onSuccess: (data) => { setResult(data); setStep("done") },
    onError:   (e)    => setUploadError(e.message),
  })

  // ── File selection + immediate client-side validation ────────────────────────

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const ext = f.name.split(".").pop()?.toLowerCase() ?? ""
    if (!["csv", "txt", "xlsx", "xls"].includes(ext)) {
      setUploadError("Only CSV (.csv / .txt) or Excel (.xlsx) files are supported")
      return
    }
    setFile(f)
    setFileKind(ext === "xlsx" || ext === "xls" ? "xlsx" : "csv")
    setUploadError(null)
    setLocalResult(null)

    const reader = new FileReader()
    reader.onload = async (ev) => {
      const ab    = ev.target?.result as ArrayBuffer
      // Encode to base64 for server calls
      const bytes = new Uint8Array(ab)
      let bin = ""
      for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i])
      setCsvBase64(btoa(bin))
      // Run client-side validation immediately
      const validation = await validateFileClientSide(ab, ext)
      setLocalResult(validation)
    }
    reader.readAsArrayBuffer(f)
  }, [])

  // ── Handlers ──────────────────────────────────────────────────────────────────

  function handlePreview() {
    if (!orgId || !csvBase64) return
    setUploadError(null)
    previewMutation.mutate({ organizationId: orgId, csvBase64 })
  }

  function handleImport() {
    if (!orgId || !csvBase64) return
    setUploadError(null)
    importMutation.mutate({ organizationId: orgId, csvBase64, filename: file?.name ?? "upload" })
  }

  function reset() {
    setStep("upload"); setFile(null); setFileKind(null)
    setCsvBase64(""); setLocalResult(null); setPreviewData(null)
    setResult(null); setUploadError(null)
  }

  function downloadCSV() {
    const blob = new Blob([JOURNAL_CSV_TEMPLATE], { type: "text/csv" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a"); a.href = url; a.download = "journal_template.csv"; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Derived state ─────────────────────────────────────────────────────────────

  const localErrors      = localResult?.errors ?? []
  const localHasErrors   = localErrors.length > 0
  const localJournalCount = localResult?.journals.length ?? 0
  const localBalanced    = localResult?.journals.every((j) => j.isBalanced) ?? false
  const canPreview       = !!csvBase64 && !localHasErrors && localJournalCount > 0

  const serverErrors     = (previewData?.errors ?? [])
  const serverHasErrors  = serverErrors.length > 0
  const canImport        = previewData && !serverHasErrors && (previewData?.journals?.length ?? 0) > 0

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        crumbs={[
          { label: "Journals", href: "/transactions/journal" },
        ]}
        title="Journal Upload"
      />

      <main className="container mx-auto py-6 max-w-5xl space-y-6">

        {/* Step indicator */}
        <div className="flex items-center gap-3 text-sm">
          {(["upload", "preview", "done"] as Step[]).map((s, i) => (
            <span key={s} className="flex items-center gap-2">
              {i > 0 && <span className="text-muted-foreground">›</span>}
              <span className={`font-medium ${step === s ? "text-primary" : "text-muted-foreground"}`}>
                {i + 1}. {s === "upload" ? "Upload & Validate" : s === "preview" ? "Server Preview" : "Done"}
              </span>
            </span>
          ))}
        </div>

        {uploadError && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <XCircle className="h-4 w-4 shrink-0" />{uploadError}
          </div>
        )}

        {/* ── STEP 1 — Upload & client-side validation ────────────────────────── */}
        {step === "upload" && (
          <div className="grid gap-6 md:grid-cols-2">

            {/* Left: file upload */}
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle>Upload Spreadsheet</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <label
                    htmlFor="file-upload"
                    className="block border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary/40 transition-colors"
                  >
                    {fileKind === "xlsx"
                      ? <FileSpreadsheet className="mx-auto h-10 w-10 text-green-500 mb-3" />
                      : fileKind === "csv"
                      ? <FileText className="mx-auto h-10 w-10 text-blue-500 mb-3" />
                      : <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />}
                    <p className="text-sm font-medium mb-1">
                      {file ? file.name : "Click to choose a file"}
                    </p>
                    <p className="text-xs text-muted-foreground">Excel (.xlsx) or CSV (.csv / .txt)</p>
                    {file && (
                      <Badge className="mt-2" variant="outline">
                        {fileKind?.toUpperCase()} · {(file.size / 1024).toFixed(1)} KB
                      </Badge>
                    )}
                  </label>
                  <input type="file" accept=".csv,.txt,.xlsx,.xls" id="file-upload" className="hidden" onChange={handleFileChange} />

                  {/* Client-side validation results */}
                  {localResult && (
                    <div className={`rounded-md border px-4 py-3 text-sm space-y-2 ${localHasErrors ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
                      <div className="flex items-center gap-2 font-medium">
                        {localHasErrors
                          ? <><XCircle className="h-4 w-4 text-red-500" /><span className="text-red-700">Validation failed</span></>
                          : <><ShieldCheck className="h-4 w-4 text-green-600" /><span className="text-green-700">Pre-validation passed</span></>}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs">
                        <span className="text-muted-foreground">{localResult.metadata.parsedRows} rows</span>
                        <span className="text-muted-foreground">{localJournalCount} journal{localJournalCount !== 1 ? "s" : ""}</span>
                        {localResult.metadata.journalCount > 0 && (
                          <span className={localBalanced ? "text-green-600" : "text-red-600"}>
                            {localBalanced ? "All balanced ✓" : "Balance errors ✗"}
                          </span>
                        )}
                      </div>
                      {localHasErrors && (
                        <div className="text-red-700 space-y-0.5 max-h-36 overflow-y-auto">
                          {localErrors.map((e, i) => (
                            <div key={i} className="text-xs">Row {e.row}: {e.message}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <Button
                    className="w-full"
                    disabled={!canPreview || previewMutation.isPending}
                    onClick={handlePreview}
                  >
                    {previewMutation.isPending
                      ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Checking accounts…</>
                      : "Validate & Preview"}
                  </Button>

                  {!canPreview && localResult && !localHasErrors && (
                    <p className="text-xs text-muted-foreground text-center">No valid journals found in file</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right: template download + column guide */}
            <Card>
              <CardHeader><CardTitle>Templates &amp; Format Guide</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <p className="text-muted-foreground text-xs">
                  Download the Excel template — it includes your live Chart of Accounts
                  on a reference sheet and sample balanced journals pre-dated to today.
                </p>

                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => orgId && templateMutation.mutate({ organizationId: orgId })}
                    disabled={templateMutation.isPending || !orgId}
                  >
                    {templateMutation.isPending
                      ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Generating…</>
                      : <><FileSpreadsheet className="h-4 w-4 mr-2" />Download Excel Template (.xlsx)</>}
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start" onClick={downloadCSV}>
                    <FileText className="h-4 w-4 mr-2" />Download CSV Template (.csv)
                  </Button>
                </div>

                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="text-left p-2 font-semibold">Column</th>
                        <th className="text-left p-2 font-semibold">Req</th>
                        <th className="text-left p-2 font-semibold">Purpose</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {JOURNAL_COLUMNS.map((c) => (
                        <tr key={c.key} className={c.required ? "bg-amber-50/40" : ""}>
                          <td className="p-2 font-mono">{c.header}</td>
                          <td className="p-2">{c.required ? <span className="text-amber-700 font-bold">YES</span> : <span className="text-muted-foreground">—</span>}</td>
                          <td className="p-2 text-muted-foreground">{c.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── STEP 2 — Server preview (account resolution) ────────────────────── */}
        {step === "preview" && previewData && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <Badge className="bg-blue-100 text-blue-700 text-sm py-1 px-3">
                {previewData.metadata.journalCount} journal{previewData.metadata.journalCount !== 1 ? "s" : ""}
              </Badge>
              <Badge className="bg-green-100 text-green-700 text-sm py-1 px-3">
                {previewData.metadata.parsedRows} rows
              </Badge>
              {serverHasErrors && (
                <Badge className="bg-red-100 text-red-700 text-sm py-1 px-3">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {serverErrors.length} error{serverErrors.length !== 1 ? "s" : ""}
                </Badge>
              )}
              {fileKind && (
                <Badge variant="outline" className="text-xs">
                  {fileKind === "xlsx" ? <FileSpreadsheet className="h-3 w-3 mr-1" /> : <FileText className="h-3 w-3 mr-1" />}
                  {file?.name}
                </Badge>
              )}
            </div>

            {serverHasErrors && (
              <Card className="border-red-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-red-700 flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4" /> Account Validation Errors
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm text-red-700 max-h-48 overflow-y-auto">
                    {serverErrors.map((e: any, i: number) => (
                      <div key={i}>Row {e.row}: {e.message}</div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Correct the account codes in your file and re-upload.
                  </p>
                </CardContent>
              </Card>
            )}

            {previewData.journals.map((journal: any, ji: number) => (
              <Card key={ji} className={journal.isBalanced ? "" : "border-red-200"}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      {journal.reference}
                      {journal.period && (
                        <Badge variant="outline" className="text-xs">Period {journal.period}</Badge>
                      )}
                      {!journal.isBalanced && (
                        <Badge className="bg-red-100 text-red-700">Unbalanced</Badge>
                      )}
                    </CardTitle>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(journal.date), "dd MMM yyyy")} · {journal.currency}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{journal.description}</p>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[700px]">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-1.5 pr-2 font-medium">Code</th>
                        <th className="text-left py-1.5 pr-2 font-medium">Account</th>
                        <th className="text-left py-1.5 pr-2 font-medium">Type</th>
                        <th className="text-left py-1.5 pr-2 font-medium">Dept</th>
                        <th className="text-left py-1.5 pr-2 font-medium">Cost Centre</th>
                        <th className="text-left py-1.5 pr-2 font-medium">Analysis</th>
                        <th className="text-left py-1.5 pr-2 font-medium">Memo</th>
                        <th className="text-right py-1.5 pr-2 font-medium">Debit</th>
                        <th className="text-right py-1.5 font-medium">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {journal.lines.map((line: any, li: number) => (
                        <tr key={li} className={!line.accountId ? "bg-red-50" : ""}>
                          <td className="py-1.5 pr-2 font-mono">{line.accountCode}</td>
                          <td className="py-1.5 pr-2">
                            {line.accountName ?? <span className="text-red-600 font-medium">Not found</span>}
                          </td>
                          <td className="py-1.5 pr-2 text-muted-foreground">{line.accountType ?? ""}</td>
                          <td className="py-1.5 pr-2 text-muted-foreground">{line.department ?? ""}</td>
                          <td className="py-1.5 pr-2 text-muted-foreground">{line.costCentre ?? ""}</td>
                          <td className="py-1.5 pr-2 text-muted-foreground">
                            {[line.analysisCode1, line.analysisCode2, line.analysisCode3].filter(Boolean).join(" · ") || ""}
                          </td>
                          <td className="py-1.5 pr-2 text-muted-foreground">{line.lineDescription ?? ""}</td>
                          <td className="py-1.5 pr-2 text-right font-medium">{line.debit > 0 ? line.debit.toFixed(2) : ""}</td>
                          <td className="py-1.5 text-right font-medium">{line.credit > 0 ? line.credit.toFixed(2) : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t font-semibold">
                        <td colSpan={7} className="py-1.5 text-right pr-2 text-muted-foreground text-xs">Total</td>
                        <td className="py-1.5 pr-2 text-right">{journal.totalDebits.toFixed(2)}</td>
                        <td className="py-1.5 text-right">{journal.totalCredits.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </CardContent>
              </Card>
            ))}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => { setStep("upload"); setPreviewData(null) }}>Back</Button>
              <Button disabled={!canImport || importMutation.isPending} onClick={handleImport}>
                {importMutation.isPending
                  ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Importing…</>
                  : <><Upload className="h-4 w-4 mr-2" />Import {previewData.metadata.journalCount} Journal{previewData.metadata.journalCount !== 1 ? "s" : ""}</>}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3 — Done + audit details ───────────────────────────────────── */}
        {step === "done" && result && (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-8 pb-8 text-center space-y-4">
                <CheckCircle className="mx-auto h-14 w-14 text-green-500" />
                <h2 className="text-xl font-semibold">Import Complete</h2>
                <p className="text-muted-foreground">
                  {result.imported} journal{result.imported !== 1 ? "s" : ""} created as drafts.
                  Review and submit them for approval from the Journals list.
                </p>
                <div className="flex justify-center gap-3 pt-2">
                  <Button variant="outline" onClick={reset}>Import Another</Button>
                  <Link href="/transactions/journal">
                    <Button><BookOpen className="h-4 w-4 mr-2" />View Journals</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Audit record */}
            <Card className="border-blue-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-blue-700">
                  <ShieldCheck className="h-4 w-4" /> Audit Record
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1 text-muted-foreground">
                <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                  <span className="font-medium text-foreground">Import Batch ID</span>
                  <span className="font-mono break-all">{result.importBatchId}</span>
                  <span className="font-medium text-foreground">File</span>
                  <span>{file?.name ?? "unknown"}</span>
                  <span className="font-medium text-foreground">Journals Created</span>
                  <span>{result.imported}</span>
                  <span className="font-medium text-foreground">Timestamp</span>
                  <span>{format(new Date(), "dd MMM yyyy HH:mm:ss 'UTC'")}</span>
                  <span className="font-medium text-foreground">Status</span>
                  <span>DRAFT — pending submission and approval</span>
                </div>
                <p className="pt-2 text-xs text-muted-foreground">
                  The import batch ID is stored in each journal's metadata and in the audit log,
                  allowing auditors to trace all journals created from this file.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

      </main>
    </div>
  )
}
