"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { Upload, Download, CheckCircle, AlertTriangle, RefreshCw, BookOpen, FileSpreadsheet, FileText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { trpc } from "@/lib/trpc-client"
import { useOrganization } from "@/contexts/organization-context"
import { JOURNAL_COLUMNS, JOURNAL_CSV_TEMPLATE } from "@/lib/journal-import/csv-parser"
import { format } from "date-fns"

type Step = "upload" | "preview" | "done"
type FileKind = "csv" | "xlsx" | null

export default function JournalImportPage() {
  const { orgId } = useOrganization()

  const [step, setStep]             = useState<Step>("upload")
  const [file, setFile]             = useState<File | null>(null)
  const [fileKind, setFileKind]     = useState<FileKind>(null)
  const [csvBase64, setCsvBase64]   = useState<string>("")
  const [previewData, setPreviewData] = useState<any>(null)
  const [result, setResult]         = useState<any>(null)
  const [error, setError]           = useState<string | null>(null)

  // COA data for rich template download
  const { data: templateData } = trpc.manualJournals.getTemplateData.useQuery(
    { organizationId: orgId ?? "" },
    { enabled: !!orgId }
  )

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
    const ext = f.name.split(".").pop()?.toLowerCase()
    if (!["csv", "txt", "xlsx", "xls"].includes(ext ?? "")) {
      setError("Only CSV, TXT, or Excel (.xlsx) files are supported")
      return
    }
    const kind: FileKind = ext === "xlsx" || ext === "xls" ? "xlsx" : "csv"
    setFile(f)
    setFileKind(kind)
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

  // ── Template download (Excel, with COA reference sheet) ──────────────────────

  async function downloadExcelTemplate() {
    // Dynamically import xlsx so it's not bundled unless needed
    const XLSX = await import("xlsx")

    const wb = XLSX.utils.book_new()

    // ── Sheet 1: Import Data ──────────────────────────────────────────────────
    const importHeaders = JOURNAL_COLUMNS.map((c) => c.header)
    const sampleRows = [
      // Sample journal 1 — debit line
      ["2024-01-31","JNL-001","Accrued expenses","6100","6100","Rent Expense","EXPENSE",
       "Operations","CC-001","","","",500,"","Accrued rent Q1","","GBP"],
      // Sample journal 1 — credit line
      ["2024-01-31","JNL-001","Accrued expenses","2100","2100","Accruals Payable","LIABILITY",
       "","","","","","",500,"Accruals payable","","GBP"],
      // Sample journal 2 — debit line
      ["2024-01-31","JNL-002","Prepaid insurance","1200","1200","Prepayments","ASSET",
       "Finance","","","","",250,"","Prepayment Q1","","GBP"],
      // Sample journal 2 — credit line
      ["2024-01-31","JNL-002","Prepaid insurance","6200","6200","Insurance Expense","EXPENSE",
       "","","","","","",250,"Insurance expense","","GBP"],
    ]

    const wsImport = XLSX.utils.aoa_to_sheet([importHeaders, ...sampleRows])

    // Column widths
    wsImport["!cols"] = JOURNAL_COLUMNS.map((c) => ({ wch: c.width }))

    // Freeze header row
    wsImport["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" }

    XLSX.utils.book_append_sheet(wb, wsImport, "Journal Import")

    // ── Sheet 2: Account Reference ────────────────────────────────────────────
    const refHeaders = [
      "account_code", "nominal_code", "account_name", "account_type", "sub_type",
      "normal_balance", "department", "cost_centre",
      "analysis_code_1", "analysis_code_2", "analysis_code_3",
      "project_code", "grant_code", "fund_code",
      "is_control_account", "description",
    ]

    const accounts = templateData?.accounts ?? []
    const refRows = accounts.map((a: any) => [
      a.code, a.code, a.name, a.type, a.subType ?? "",
      a.normalBalance, a.departmentCode ?? "", a.costCentreCode ?? "",
      a.analysisCode1 ?? "", a.analysisCode2 ?? "", a.analysisCode3 ?? "",
      a.projectCode ?? "", a.grantCode ?? "", a.fundCode ?? "",
      a.isControlAccount ? "Yes" : "No", a.description ?? "",
    ])

    const wsRef = XLSX.utils.aoa_to_sheet([refHeaders, ...refRows])
    wsRef["!cols"] = [
      { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 14 }, { wch: 16 },
      { wch: 14 }, { wch: 16 }, { wch: 14 },
      { wch: 16 }, { wch: 16 }, { wch: 16 },
      { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 16 }, { wch: 30 },
    ]
    wsRef["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" }
    XLSX.utils.book_append_sheet(wb, wsRef, "Account Reference")

    // ── Sheet 3: Instructions ─────────────────────────────────────────────────
    const instrRows = [
      ["JOURNAL IMPORT — INSTRUCTIONS"],
      [""],
      ["Sheet: Journal Import"],
      ["  Fill in this sheet with your journal lines. Each row is one line."],
      ["  Rows sharing the same 'reference' value are grouped into one journal entry."],
      ["  Debits must equal credits per group (journal must balance)."],
      [""],
      ["Required columns:"],
      ...JOURNAL_COLUMNS.filter((c) => c.required).map((c) => [
        `  ${c.header}`, c.description, `e.g. ${c.example}`,
      ]),
      [""],
      ["Optional columns:"],
      ...JOURNAL_COLUMNS.filter((c) => !c.required).map((c) => [
        `  ${c.header}`, c.description,
      ]),
      [""],
      ["Sheet: Account Reference"],
      ["  Full list of your active accounts with all coding dimensions."],
      ["  Use the account_code column value in the Journal Import sheet."],
      ["  Informational columns (department, cost_centre, analysis_code_1/2/3)"],
      ["  are pre-filled from your Chart of Accounts on import."],
      [""],
      ["Date formats accepted: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY"],
      ["Currency: GBP (default), USD, EUR — or any ISO 4217 code"],
    ]
    const wsInstr = XLSX.utils.aoa_to_sheet(instrRows)
    wsInstr["!cols"] = [{ wch: 30 }, { wch: 50 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, wsInstr, "Instructions")

    // Write and download
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    const blob  = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    const url   = URL.createObjectURL(blob)
    const a     = document.createElement("a")
    a.href = url; a.download = "journal_import_template.xlsx"; a.click()
    URL.revokeObjectURL(url)
  }

  function downloadCSVTemplate() {
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

  function reset() {
    setStep("upload"); setFile(null); setFileKind(null)
    setCsvBase64(""); setPreviewData(null); setResult(null); setError(null)
  }

  const hasErrors = (previewData?.errors?.length ?? 0) > 0
  const canImport = previewData && !hasErrors && (previewData?.journals?.length ?? 0) > 0

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        crumbs={[{ label: "Journals", href: "/transactions/journal" }]}
        title="Import Journals from Spreadsheet"
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
              <CardHeader><CardTitle>Upload Spreadsheet</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {/* Drop zone */}
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
                  <p className="text-xs text-muted-foreground">
                    Excel (.xlsx) or CSV (.csv, .txt)
                  </p>
                  {file && (
                    <Badge className="mt-2" variant="outline">
                      {fileKind?.toUpperCase()} · {(file.size / 1024).toFixed(1)} KB
                    </Badge>
                  )}
                </label>
                <input
                  type="file"
                  accept=".csv,.txt,.xlsx,.xls"
                  id="file-upload"
                  className="hidden"
                  onChange={handleFileChange}
                />

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

            {/* Right column — format guide + template downloads */}
            <Card>
              <CardHeader><CardTitle>Download Template</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <p className="text-muted-foreground">
                  Download a pre-formatted template with your live Chart of Accounts
                  pre-filled on a reference sheet. Each row is one journal line; rows
                  sharing the same <strong>reference</strong> become one balanced journal entry.
                </p>

                <div className="flex flex-col gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full justify-start"
                    onClick={downloadExcelTemplate}
                    disabled={!templateData}
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2 text-green-100" />
                    Download Excel Template (.xlsx)
                    {!templateData && <RefreshCw className="h-3 w-3 ml-auto animate-spin opacity-50" />}
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start" onClick={downloadCSVTemplate}>
                    <FileText className="h-4 w-4 mr-2" />
                    Download CSV Template (.csv)
                  </Button>
                </div>

                <div className="border-t pt-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Required columns
                  </p>
                  {JOURNAL_COLUMNS.filter((c) => c.required).map((c) => (
                    <div key={c.key} className="flex gap-2 text-xs">
                      <span className="font-mono w-32 shrink-0">{c.header}</span>
                      <span className="text-muted-foreground">{c.description}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Optional / informational
                  </p>
                  {JOURNAL_COLUMNS.filter((c) => !c.required).map((c) => (
                    <div key={c.key} className="flex gap-2 text-xs">
                      <span className="font-mono w-32 shrink-0 text-muted-foreground">{c.header}</span>
                      <span className="text-muted-foreground">{c.description}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Step 2: Preview ─────────────────────────────────────────────────── */}
        {step === "preview" && previewData && (
          <div className="space-y-4">
            {/* Summary badges */}
            <div className="flex flex-wrap gap-3 items-center">
              <Badge className="bg-blue-100 text-blue-700 text-sm py-1 px-3">
                {previewData.metadata.journalCount} journal{previewData.metadata.journalCount !== 1 ? "s" : ""}
              </Badge>
              <Badge className="bg-green-100 text-green-700 text-sm py-1 px-3">
                {previewData.metadata.parsedRows} rows parsed
              </Badge>
              {hasErrors && (
                <Badge className="bg-red-100 text-red-700 text-sm py-1 px-3">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {previewData.errors.length} error{previewData.errors.length !== 1 ? "s" : ""}
                </Badge>
              )}
              {fileKind && (
                <Badge variant="outline" className="text-xs">
                  {fileKind === "xlsx" ? <FileSpreadsheet className="h-3 w-3 mr-1" /> : <FileText className="h-3 w-3 mr-1" />}
                  {fileKind.toUpperCase()}
                </Badge>
              )}
            </div>

            {/* Errors panel */}
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
                    Fix errors in the file and re-upload before importing.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Per-journal preview */}
            {previewData.journals.map((journal: any, ji: number) => (
              <Card key={ji} className={journal.isBalanced ? "" : "border-red-200"}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      {journal.reference}
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
                  <table className="w-full text-xs min-w-[640px]">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-1.5 pr-2 font-medium">Code</th>
                        <th className="text-left py-1.5 pr-2 font-medium">Account</th>
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
                            {line.accountName ?? (
                              <span className="text-red-600 font-medium">Not found</span>
                            )}
                          </td>
                          <td className="py-1.5 pr-2 text-muted-foreground">{line.department ?? ""}</td>
                          <td className="py-1.5 pr-2 text-muted-foreground">{line.costCentre ?? ""}</td>
                          <td className="py-1.5 pr-2 text-muted-foreground">
                            {[line.analysisCode1, line.analysisCode2, line.analysisCode3].filter(Boolean).join(" · ") || ""}
                          </td>
                          <td className="py-1.5 pr-2 text-muted-foreground">{line.lineDescription ?? ""}</td>
                          <td className="py-1.5 pr-2 text-right font-medium">
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
                        <td colSpan={6} className="py-1.5 text-right pr-2 text-muted-foreground">Total</td>
                        <td className="py-1.5 pr-2 text-right">{journal.totalDebits.toFixed(2)}</td>
                        <td className="py-1.5 text-right">{journal.totalCredits.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </CardContent>
              </Card>
            ))}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => { setStep("upload"); setPreviewData(null) }}>
                Back
              </Button>
              <Button disabled={!canImport || importMutation.isPending} onClick={handleImport}>
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
                <Button variant="outline" onClick={reset}>Import Another</Button>
                <Link href="/transactions/journal">
                  <Button><BookOpen className="h-4 w-4 mr-2" />View Journals</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

      </main>
    </div>
  )
}
