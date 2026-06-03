/**
 * Journal CSV / Excel Import Parser
 *
 * REQUIRED columns (case-insensitive, spaces or underscores ok):
 *   date          – journal date (YYYY-MM-DD | DD/MM/YYYY | MM/DD/YYYY)
 *   reference     – groups lines into one journal entry
 *   description   – journal-level description
 *   account_code  – COA code (or "nominal_code" accepted as alias)
 *   debit         – debit amount  (leave blank for credit lines)
 *   credit        – credit amount (leave blank for debit lines)
 *
 * OPTIONAL columns:
 *   period          – accounting period number (1-12)
 *   nominal_code    – accepted alias for account_code (parser fallback)
 *   account_name    – informational; shown in preview, ignored on import
 *   account_type    – informational; shown in preview, ignored on import
 *   department      – forwarded to preview; merged from COA default
 *   cost_centre     – forwarded to preview; merged from COA default
 *   analysis_code_1 – forwarded to preview; merged from COA default
 *   analysis_code_2 – forwarded to preview; merged from COA default
 *   analysis_code_3 – forwarded to preview; merged from COA default
 *   line_description– per-line memo stored on ManualJournalLine
 *   notes           – journal-level notes stored on ManualJournal
 *   currency        – defaults to GBP
 */

// ─── Column descriptor (drives template generation & format docs) ─────────────

export interface JournalColumn {
  key: string
  header: string
  required: boolean
  example: string
  description: string
  width: number // Excel column width (chars)
}

export const JOURNAL_COLUMNS: JournalColumn[] = [
  { key: "date",             header: "date",             required: true,  example: "2024-01-31",       description: "Journal date (YYYY-MM-DD)",                        width: 14 },
  { key: "period",           header: "period",           required: false, example: "1",                description: "Accounting period number (1-12)",                  width: 10 },
  { key: "reference",        header: "reference",        required: true,  example: "JNL-001",          description: "Groups lines into one journal entry",               width: 14 },
  { key: "description",      header: "description",      required: true,  example: "Accrued expenses", description: "Journal-level description",                        width: 30 },
  { key: "account_code",     header: "account_code",     required: true,  example: "6100",             description: "Account / nominal code from Chart of Accounts",    width: 14 },
  { key: "account_name",     header: "account_name",     required: false, example: "Rent Expense",     description: "Informational — auto-populated from COA",          width: 28 },
  { key: "account_type",     header: "account_type",     required: false, example: "EXPENSE",          description: "Informational — auto-populated from COA",          width: 14 },
  { key: "department",       header: "department",       required: false, example: "Operations",       description: "Dept code — auto-populated from COA if blank",     width: 16 },
  { key: "cost_centre",      header: "cost_centre",      required: false, example: "CC-001",           description: "Cost centre — auto-populated from COA if blank",   width: 14 },
  { key: "analysis_code_1",  header: "analysis_code_1",  required: false, example: "",                 description: "Analysis dimension 1 — auto-populated from COA",  width: 16 },
  { key: "analysis_code_2",  header: "analysis_code_2",  required: false, example: "",                 description: "Analysis dimension 2 — auto-populated from COA",  width: 16 },
  { key: "analysis_code_3",  header: "analysis_code_3",  required: false, example: "",                 description: "Analysis dimension 3 — auto-populated from COA",  width: 16 },
  { key: "debit",            header: "debit",            required: false, example: "500.00",           description: "Debit amount — leave blank for credit lines",      width: 12 },
  { key: "credit",           header: "credit",           required: false, example: "",                 description: "Credit amount — leave blank for debit lines",      width: 12 },
  { key: "line_description", header: "line_description", required: false, example: "Accrued rent Q1",  description: "Per-line memo saved on journal line",              width: 30 },
  { key: "notes",            header: "notes",            required: false, example: "",                 description: "Journal-level notes",                              width: 24 },
  { key: "currency",         header: "currency",         required: false, example: "GBP",              description: "ISO currency code — defaults to GBP",              width: 10 },
]

// ─── Static CSV fallback template ────────────────────────────────────────────
// Kept for the CSV download button; the server generates the richer Excel version.

export const JOURNAL_CSV_TEMPLATE = [
  JOURNAL_COLUMNS.map((c) => c.header).join(","),
  // Balanced sample journal 1
  `2024-01-31,1,JNL-001,Accrued expenses,6100,Rent Expense,EXPENSE,Operations,CC-001,,,, 500.00,,Accrued rent Q1,,GBP`,
  `2024-01-31,1,JNL-001,Accrued expenses,2100,Accruals Payable,LIABILITY,,,,,,, 500.00,Accruals payable,,GBP`,
  // Balanced sample journal 2
  `2024-01-31,1,JNL-002,Prepaid insurance,1200,Prepayments,ASSET,Finance,,,,,250.00,,Prepayment Q1,,GBP`,
  `2024-01-31,1,JNL-002,Prepaid insurance,6200,Insurance Expense,EXPENSE,,,,,,, 250.00,Insurance expense,,GBP`,
].join("\n") + "\n"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JournalGroup {
  reference: string
  date: string
  period?: number
  description: string
  notes?: string
  currency: string
  lines: Array<{
    accountCode: string
    debit: number
    credit: number
    lineDescription?: string
    department?: string
    costCentre?: string
    analysisCode1?: string
    analysisCode2?: string
    analysisCode3?: string
  }>
  totalDebits: number
  totalCredits: number
  isBalanced: boolean
  rowNumbers: number[]
}

export interface JournalParseResult {
  journals: JournalGroup[]
  errors: Array<{ row: number; message: string }>
  metadata: { totalRows: number; parsedRows: number; journalCount: number }
}

// ─── CSV line tokeniser (quoted-field aware) ──────────────────────────────────

export function parseCSVLine(line: string, delimiter = ","): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim()); current = ""
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

// ─── Date parser (multi-format) ───────────────────────────────────────────────

export function parseDateStr(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`
  const dmy2 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (dmy2) return `${dmy2[3]}-${dmy2[2].padStart(2, "0")}-${dmy2[1].padStart(2, "0")}`
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0]
  return null
}

// ─── Amount parser ────────────────────────────────────────────────────────────

function parseAmount(raw: string): number {
  if (!raw || !raw.trim()) return 0
  const n = parseFloat(raw.trim().replace(/[£$€,\s]/g, ""))
  return isNaN(n) ? 0 : Math.abs(n)
}

// ─── Header normaliser ────────────────────────────────────────────────────────

function normaliseHeader(h: string): string {
  return h.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseJournalCSV(csvText: string): JournalParseResult {
  const errors: JournalParseResult["errors"] = []

  const lines = csvText.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) {
    return {
      journals: [],
      errors: [{ row: 0, message: "File is empty or contains no data rows" }],
      metadata: { totalRows: 0, parsedRows: 0, journalCount: 0 },
    }
  }

  const firstLine = lines[0]
  const delimiter = firstLine.includes(";") ? ";" : firstLine.includes("\t") ? "\t" : ","
  const headers = parseCSVLine(firstLine, delimiter).map(normaliseHeader)

  // Required column check
  const REQUIRED = ["date", "reference", "description"]
  for (const col of REQUIRED) {
    if (!headers.includes(col)) {
      errors.push({ row: 0, message: `Missing required column: "${col}"` })
    }
  }
  if (!headers.includes("account_code") && !headers.includes("nominal_code")) {
    errors.push({ row: 0, message: 'Missing required column: "account_code"' })
  }
  if (errors.length) {
    return { journals: [], errors, metadata: { totalRows: 0, parsedRows: 0, journalCount: 0 } }
  }

  const idx = (name: string) => headers.indexOf(name)
  const cell = (cells: string[], name: string) => idx(name) >= 0 ? (cells[idx(name)] ?? "").trim() : ""

  let parsedRows = 0
  const rawRows: Array<{
    date: string; period?: number; reference: string; description: string
    accountCode: string; debit: number; credit: number
    lineDescription?: string; notes?: string; currency: string
    department?: string; costCentre?: string
    analysisCode1?: string; analysisCode2?: string; analysisCode3?: string
    rowNumber: number
  }> = []

  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1
    const cells = parseCSVLine(lines[i], delimiter)

    const dateRaw     = cell(cells, "date")
    const periodRaw   = cell(cells, "period")
    const reference   = cell(cells, "reference")
    const description = cell(cells, "description")
    const accountCode = cell(cells, "account_code") || cell(cells, "nominal_code")
    const debit       = parseAmount(cell(cells, "debit"))
    const credit      = parseAmount(cell(cells, "credit"))
    const lineDesc    = cell(cells, "line_description") || undefined
    const notes       = cell(cells, "notes") || undefined
    const currency    = (cell(cells, "currency") || "GBP").toUpperCase()
    const department  = cell(cells, "department") || undefined
    const costCentre  = cell(cells, "cost_centre") || undefined
    const ac1         = cell(cells, "analysis_code_1") || undefined
    const ac2         = cell(cells, "analysis_code_2") || undefined
    const ac3         = cell(cells, "analysis_code_3") || undefined

    // Skip entirely blank rows
    if (!dateRaw && !reference && !accountCode) continue

    const date = parseDateStr(dateRaw)
    if (!date)        { errors.push({ row: rowNum, message: `Invalid date: "${dateRaw}"` }); continue }
    if (!reference)   { errors.push({ row: rowNum, message: "Reference is required" }); continue }
    if (!description) { errors.push({ row: rowNum, message: "Description is required" }); continue }
    if (!accountCode) { errors.push({ row: rowNum, message: "account_code is required" }); continue }
    if (debit === 0 && credit === 0) { errors.push({ row: rowNum, message: "Each line must have a non-zero debit or credit" }); continue }
    if (debit > 0 && credit > 0)    { errors.push({ row: rowNum, message: "A line cannot have both a debit and a credit" }); continue }

    const period = periodRaw ? parseInt(periodRaw, 10) : undefined

    rawRows.push({
      date, period, reference, description, accountCode, debit, credit,
      lineDescription: lineDesc, notes, currency,
      department, costCentre, analysisCode1: ac1, analysisCode2: ac2, analysisCode3: ac3,
      rowNumber: rowNum,
    })
    parsedRows++
  }

  // Group by reference
  const grouped = new Map<string, JournalGroup>()
  for (const row of rawRows) {
    let group = grouped.get(row.reference)
    if (!group) {
      group = {
        reference: row.reference, date: row.date, period: row.period,
        description: row.description, notes: row.notes, currency: row.currency,
        lines: [], totalDebits: 0, totalCredits: 0, isBalanced: false, rowNumbers: [],
      }
      grouped.set(row.reference, group)
    }
    group.lines.push({
      accountCode: row.accountCode, debit: row.debit, credit: row.credit,
      lineDescription: row.lineDescription,
      department: row.department, costCentre: row.costCentre,
      analysisCode1: row.analysisCode1, analysisCode2: row.analysisCode2, analysisCode3: row.analysisCode3,
    })
    group.totalDebits  = +(group.totalDebits  + row.debit).toFixed(2)
    group.totalCredits = +(group.totalCredits + row.credit).toFixed(2)
    group.rowNumbers.push(row.rowNumber)
  }

  const journals: JournalGroup[] = []
  for (const group of grouped.values()) {
    group.isBalanced = Math.abs(group.totalDebits - group.totalCredits) < 0.005
    if (!group.isBalanced) {
      errors.push({
        row: group.rowNumbers[0],
        message: `Journal "${group.reference}" is not balanced: debits ${group.totalDebits.toFixed(2)} ≠ credits ${group.totalCredits.toFixed(2)}`,
      })
    }
    if (group.lines.length < 2) {
      errors.push({
        row: group.rowNumbers[0],
        message: `Journal "${group.reference}" has only ${group.lines.length} line — minimum 2 required`,
      })
    }
    journals.push(group)
  }

  return { journals, errors, metadata: { totalRows: lines.length - 1, parsedRows, journalCount: journals.length } }
}
