"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Upload, Download, CheckCircle, AlertTriangle, RefreshCw, BookOpen, FileText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { trpc } from "@/lib/trpc-client"
import { useOrganization } from "@/contexts/organization-context"
import { JOURNAL_CSV_TEMPLATE } from "@/lib/journal-import/csv-parser"
import { format } from "date-fns"

type Step = "upload" | "preview" | "done"

export default function JournalImportPage() {
  const router = useRouter()
  const { orgId } = useOrganization()

  const [step, setStep]               = useState<Step>("upload")
  const [file, setFile]               = useState<File | null>(null)
  const [csvBase64, setCsvBase64]     = useState<string>("")
  const [previewData, setPreviewData] = useState<any>(null)
  const [result, setResult]           = useState<any>(null)
  const [error, setError]             = useState<string | null>(null)

  // ── Mutations ────────────────────────────────────────────────────────────────

  const previewMutation = trpc.manualJournals.previewImport.useMutation({
    onSuccess: (data) => { setPreviewData(data); setStep("preview") },
    onError:   (e)    => setError(e.message),
  })

  const importMutation = trpc.manualJournals.importJournals.useMutation({
    onSuccess: (data) => { setResult(data); setStep("done") },
    onError:   (e)    => setError(e.message),
  })

  // ── File selection ────────────────────────────────────────────────────────────

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.name.match(/\.(csv|txt)$/i)) {
      setError("Only CSV files are supported")
      return
    }
    setFile(f)
    setError(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const ab = ev.target?.result as ArrayBuffer
      const bytes = new Uint8Array(ab)
      let binary = ""
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
      setCsvBase64(btoa(binary))
    }
    reader.readAsArrayBuffer(f)
  }, [])

  // ── Template download ─────────────────────────────────────────────────────────

  function downloadTemplate() {
    const blob = new Blob([JOURNAL_CSV_TEMPLATE], { type: "text/csv" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href = url; a.download = "journal_import_template.csv"; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Handlers ──────────────────────────────────────────────────────────────────

  function handlePreview() {
    if (!orgId || !csvBase64) return
    setError(null)
    previewMutation.mutate({ organizationId: orgId, csvBase64 })
  }

  function handleImport() {
    if (!orgId || !csvBase64) return
    setError(null)
    importMutation.mutate({ organizationId: orgId, csvBase64 })
  }

  // ─────────────────────────────────────────────────────────────────────────────

  const hasErrors  = (previewData?.errors?.length ?? 0) > 0
  const canImport  = previewData && !hasErrors && (previewData?.journals?.length ?? 0) > 0

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        crumbs={[{ label: "Journals", href: "/transactions/journal" }]}
        title="Import Journals from CSV"
      />

      <main className="container mx-auto py-6 max-w-5xl space-y-6">

        {/* Step indicator */}
        <div className="flex items-center gap-3 text-sm">
          {(["upload", "preview", "done"] as Step[]).map((s, i) => (
            <span key={s} className="flex items-center gap-2">
              {i > 0 && <span className="text-muted-foreground">›</span>}
              <span className={`font-medium ${step === s ? "text-primary" : "text-muted-foreground"}`}>
                {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
              </span>
            </span>
          ))}
        </div>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── Step 1: Upload ──────────────────────────────────────────────────── */}
        {step === "upload" && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Upload CSV File</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                  <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm font-medium mb-1">
                    {file ? file.name : "Choose a CSV file"}
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">CSV or TXT format</p>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    id="csv-upload"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById("csv-upload")?.click()}
                  >
                    {file ? "Change File" : "Select File"}
                  </Button>
                </div>

                {file && (
                  <p className="text-xs text-muted-foreground">
                    {file.name} · {(file.size / 1024).toFixed(1)} KB
                  </p>
                )}

                <Button
                  className="w-full"
                  disabled={!csvBase64 || previewMutation.isPending}
                  onClick={handlePreview}
                >
                  {previewMutation.isPending
                    ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Parsing…</>
                    : "Preview Import"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>CSV Format</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <p className="text-muted-foreground">
                  Each row is one journal line. Rows sharing the same <strong>reference</strong> are
                  grouped into one journal entry. Debits must equal credits per group.
                </p>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1 pr-3 font-semibold">Column</th>
                      <th className="text-left py-1 font-semibold">Required</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-muted-foreground">
                    {[
                      ["date",             "Yes", "YYYY-MM-DD or DD/MM/YYYY"],
                      ["reference",        "Yes", "Groups lines into one journal"],
                      ["description",      "Yes", "Journal-level description"],
                      ["account_code",     "Yes", "Must exist in your COA"],
                      ["debit",            "—",   "Leave blank for credit lines"],
                      ["credit",           "—",   "Leave blank for debit lines"],
                      ["line_description", "No",  "Per-line memo"],
                      ["notes",            "No",  "Journal-level notes"],
                      ["currency",         "No",  "Defaults to GBP"],
                    ].map(([col, req, desc]) => (
                      <tr key={col}>
                        <td className="py-1 pr-3 font-mono">{col}</td>
                        <td className="py-1 pr-3">{req}</td>
                        <td className="py-1 text-gray-400">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <Button variant="outline" size="sm" className="w-full" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Step 2: Preview ─────────────────────────────────────────────────── */}
        {step === "preview" && previewData && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex flex-wrap gap-3">
              <Badge className="bg-blue-100 text-blue-700 text-sm py-1 px-3">
                {previewData.metadata.journalCount} journal{previewData.metadata.journalCount !== 1 ? "s" : ""}
              </Badge>
              <Badge className="bg-green-100 text-green-700 text-sm py-1 px-3">
                {previewData.metadata.parsedRows} rows parsed
              </Badge>
              {hasErrors && (
                <Badge className="bg-red-100 text-red-700 text-sm py-1 px-3">
                  {previewData.errors.length} error{previewData.errors.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>

            {/* Errors */}
            {hasErrors && (
              <Card className="border-red-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-red-700 flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4" /> Validation Errors
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm text-red-700 max-h-48 overflow-y-auto">
                    {previewData.errors.map((err: any, i: number) => (
                      <div key={i}>Row {err.row}: {err.message}</div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Fix errors in the CSV and re-upload before importing.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Journal previews */}
            {previewData.journals.map((journal: any, ji: number) => {
              const totalDebits  = journal.lines.reduce((s: number, l: any) => s + l.debit,  0)
              const totalCredits = journal.lines.reduce((s: number, l: any) => s + l.credit, 0)
              return (
                <Card key={ji} className={journal.isBalanced ? "" : "border-red-200"}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        {journal.reference}
                        {!journal.isBalanced && (
                          <Badge className="bg-red-100 text-red-700 ml-1">Unbalanced</Badge>
                        )}
                      </CardTitle>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(journal.date), "dd MMM yyyy")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{journal.description}</p>
                  </CardHeader>
                  <CardContent>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-1.5 pr-3 font-medium">Account Code</th>
                          <th className="text-left py-1.5 pr-3 font-medium">Account Name</th>
                          <th className="text-left py-1.5 pr-3 font-medium">Memo</th>
                          <th className="text-right py-1.5 pr-3 font-medium">Debit</th>
                          <th className="text-right py-1.5 font-medium">Credit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {journal.lines.map((line: any, li: number) => (
                          <tr key={li} className={!line.accountId ? "bg-red-50" : ""}>
                            <td className="py-1.5 pr-3 font-mono text-xs">{line.accountCode}</td>
                            <td className="py-1.5 pr-3">
                              {line.accountName ?? (
                                <span className="text-red-600 text-xs">Not found</span>
                              )}
                            </td>
                            <td className="py-1.5 pr-3 text-muted-foreground text-xs">{line.lineDescription ?? ""}</td>
                            <td className="py-1.5 pr-3 text-right font-medium">
                              {line.debit > 0 ? line.debit.toFixed(2) : ""}
                            </td>
                            <td className="py-1.5 text-right font-medium">
                              {line.credit > 0 ? line.credit.toFixed(2) : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t font-semibold">
                          <td colSpan={3} className="py-1.5 text-right pr-3 text-xs text-muted-foreground">Total</td>
                          <td className="py-1.5 pr-3 text-right">{totalDebits.toFixed(2)}</td>
                          <td className="py-1.5 text-right">{totalCredits.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </CardContent>
                </Card>
              )
            })}

            {/* Action buttons */}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => { setStep("upload"); setPreviewData(null) }}>
                Back
              </Button>
              <Button
                disabled={!canImport || importMutation.isPending}
                onClick={handleImport}
              >
                {importMutation.isPending
                  ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Importing…</>
                  : <><Upload className="h-4 w-4 mr-2" />Import {previewData.metadata.journalCount} Journal{previewData.metadata.journalCount !== 1 ? "s" : ""}</>}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Done ────────────────────────────────────────────────────── */}
        {step === "done" && result && (
          <Card>
            <CardContent className="pt-8 pb-10 text-center space-y-4">
              <CheckCircle className="mx-auto h-14 w-14 text-green-500" />
              <h2 className="text-xl font-semibold">Import Complete</h2>
              <p className="text-muted-foreground">
                {result.imported} journal{result.imported !== 1 ? "s" : ""} created as drafts.
                Review and submit them for approval from the Journals list.
              </p>
              <div className="flex justify-center gap-3 pt-2">
                <Button variant="outline" onClick={() => { setStep("upload"); setFile(null); setCsvBase64(""); setPreviewData(null); setResult(null) }}>
                  Import Another
                </Button>
                <Link href="/transactions/journal">
                  <Button>
                    <BookOpen className="h-4 w-4 mr-2" />
                    View Journals
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

      </main>
    </div>
  )
}
