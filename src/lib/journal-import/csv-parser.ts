/**
 * Journal CSV Import Parser
 *
 * Expected columns (case-insensitive, underscores or spaces):
 *
 *   REQUIRED
 *   ─────────────────────────────────────────────────────
 *   date            – journal date  (YYYY-MM-DD | DD/MM/YYYY | MM/DD/YYYY)
 *   reference       – groups lines into a single journal entry
 *   description     – journal-level description
 *   account_code    – COA code; resolved to accountId by the caller
 *   debit           – debit amount  (leave blank for credit lines)
 *   credit          – credit amount (leave blank for debit lines)
 *
 *   OPTIONAL
 *   ─────────────────────────────────────────────────────
 *   nominal_code    – informational alias for account_code (if supplied and
 *                     account_code is absent, used as the lookup key)
 *   department      – reference only; displayed in preview
 *   cost_centre     – reference only; displayed in preview
 *   analysis_code_1 – reference only; displayed in preview
 *   analysis_code_2 – reference only; displayed in preview
 *   analysis_code_3 – reference only; displayed in preview
 *   line_description– per-line memo stored on ManualJournalLine
 *   notes           – journal-level notes stored on ManualJournal
 *   currency        – defaults to GBP
 */

// ─── Column descriptor (used for template generation) ────────────────────────

export interface JournalColumn {
  key: string        // normalised header key
  header: string     // display header in template
  required: boolean
  example: string
  description: string
  width: number      // Excel column width in characters
}

export const JOURNAL_COLUMNS: JournalColumn[] = [
  { key: "date",             header: "date",             required: true,  example: "2024-01-31",          description: "Journal date (YYYY-MM-DD)", width: 14 },
  { key: "reference",        header: "reference",        required: true,  example: "JNL-001",             description: "Groups lines into one journal entry", width: 14 },
  { key: "description",      header: "description",      required: true,  example: "Accrued expenses",    description: "Journal-level description", width: 30 },
  { key: "account_code",     header: "account_code",     required: true,  example: "6100",                description: "Account code from COA", width: 14 },
  { key: "nominal_code",     header: "nominal_code",     required: false, example: "6100",                description: "Alias for account_code (informational)", width: 14 },
  { key: "account_name",     header: "account_name",     required: false, example: "Rent Expense",        description: "Informational — filled from COA on import", width: 28 },
  { key: "account_type",     header: "account_type",     required: false, example: "EXPENSE",             description: "Informational — filled from COA", width: 14 },
  { key: "department",       header: "department",       required: false, example: "Operations",          description: "Informational — from COA department code", width: 16 },
  { key: "cost_centre",      header: "cost_centre",      required: false, example: "CC-001",              description: "Informational — from COA cost centre code", width: 14 },
  { key: "analysis_code_1",  header: "analysis_code_1",  required: false, example: "AC1",                 description: "Informational — analysis dimension 1", width: 16 },
  { key: "analysis_code_2",  header: "analysis_code_2",  required: false, example: "AC2",                 description: "Informational — analysis dimension 2", width: 16 },
  { key: "analysis_code_3",  header: "analysis_code_3",  required: false, example: "AC3",                 description: "Informational — analysis dimension 3", width: 16 },
  { key: "debit",            header: "debit",            required: false, example: "500.00",              description: "Leave blank for credit lines", width: 12 },
  { key: "credit",           header: "credit",           required: false, example: "",                    description: "Leave blank for debit lines", width: 12 },
  { key: "line_description", header: "line_description", required: false, example: "Accrued rent Q1",     description: "Per-line memo", width: 30 },
  { key: "notes",            header: "notes",            required: false, example: "",                    description: "Journal-level notes", width: 24 },
  { key: "currency",         header: "currency",         required: false, example: "GBP",                 description: "Defaults to GBP", width: 10 },
]

// ─── Static CSV template (minimal — rich template generated client-side) ──────

export const JOURNAL_CSV_TEMPLATE = [
  JOURNAL_COLUMNS.map((c) => c.header).join(","),
  // Sample balanced journal 1
  `2024-01-31,JNL-001,Accrued expenses,6100,,,,Operations,CC-001,,,, 500.00,,Accrued rent Q1,,GBP`,
  `2024-01-31,JNL-001,Accrued expenses,2100,,,,,,,,,, 500.00,Accruals payable,,GBP`,
  // Sample balanced journal 2
  `2024-01-31,JNL-002,Prepaid insurance,1200,,,,Finance,,,,,250.00,,Prepayment Q1,,GBP`,
  `2024-01-31,JNL-002,Prepaid insurance,6200,,,,,,,,,, 250.00,Insurance expense,,GBP`,
].join("\n") + "\n"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JournalGroup {
  reference: string
  date: string
  description: string
  notes?: string
  currency: string
  lines: Array<{
    accountCode: string
    debit: number
    credit: number
    lineDescription?: string
    // informational fields passed through for preview display
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

// ─── CSV tokeniser (handles quoted fields) ────────────────────────────────────

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
      result.push(current.trim())
      current = ""
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

// ─── Date parser (multi-format) ───────────────────────────────────────────────

function parseDate(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`
  const dmy2 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (dmy2) return `${dmy2[3]}-${dmy2[2].padStart(2,"0")}-${dmy2[1].padStart(2,"0")}`
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0]
  return null
}

// ─── Amount parser ────────────────────────────────────────────────────────────

function parseAmount(raw: string): number {
  if (!raw || !raw.trim()) return 0
  const cleaned = raw.trim().replace(/[£$€,\s]/g, "")
  const n = parseFloat(cleaned)
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
      errors: [{ row: 0, message: "File is empty or has no data rows" }],
      metadata: { totalRows: 0, parsedRows: 0, journalCount: 0 },
    }
  }

  // Detect delimiter
  const firstLine = lines[0]
  const delimiter = firstLine.includes(";") ? ";" : firstLine.includes("\t") ? "\t" : ","

  const headers = parseCSVLine(firstLine, delimiter).map(normaliseHeader)

  // Require these
  const REQUIRED_COLS = ["date", "reference", "description"]
  for (const col of REQUIRED_COLS) {
    if (!headers.includes(col)) {
      errors.push({ row: 0, message: `Missing required column: "${col}"` })
    }
  }
  // Need at least one of account_code / nominal_code
  if (!headers.includes("account_code") && !headers.includes("nominal_code")) {
    errors.push({ row: 0, message: 'Missing required column: "account_code" (or "nominal_code")' })
  }
  if (errors.length) {
    return { journals: [], errors, metadata: { totalRows: 0, parsedRows: 0, journalCount: 0 } }
  }

  const idx = (name: string): number => headers.indexOf(name)
  const cell = (cells: string[], name: string): string =>
    idx(name) >= 0 ? (cells[idx(name)] ?? "").trim() : ""

  let parsedRows = 0
  const rawRows: Array<{
    date: string; reference: string; description: string; accountCode: string
    debit: number; credit: number; lineDescription?: string; notes?: string
    currency: string; department?: string; costCentre?: string
    analysisCode1?: string; analysisCode2?: string; analysisCode3?: string
    rowNumber: number
  }> = []

  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1
    const cells = parseCSVLine(lines[i], delimiter)

    const dateRaw     = cell(cells, "date")
    const reference   = cell(cells, "reference")
    const description = cell(cells, "description")
    // account_code takes priority; fall back to nominal_code
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

    if (!dateRaw && !reference && !accountCode) continue // blank row

    const date = parseDate(dateRaw)
    if (!date)        { errors.push({ row: rowNum, message: `Invalid date: "${dateRaw}"` }); continue }
    if (!reference)   { errors.push({ row: rowNum, message: "Reference is required" }); continue }
    if (!description) { errors.push({ row: rowNum, message: "Description is required" }); continue }
    if (!accountCode) { errors.push({ row: rowNum, message: "account_code is required" }); continue }
    if (debit === 0 && credit === 0) { errors.push({ row: rowNum, message: "Each line must have a non-zero debit or credit" }); continue }
    if (debit > 0 && credit > 0)    { errors.push({ row: rowNum, message: "A line cannot have both debit and credit" }); continue }

    rawRows.push({ date, reference, description, accountCode, debit, credit,
      lineDescription: lineDesc, notes, currency,
      department, costCentre, analysisCode1: ac1, analysisCode2: ac2, analysisCode3: ac3,
      rowNumber: rowNum })
    parsedRows++
  }

  // Group by reference
  const grouped = new Map<string, JournalGroup>()
  for (const row of rawRows) {
    let group = grouped.get(row.reference)
    if (!group) {
      group = {
        reference: row.reference, date: row.date, description: row.description,
        notes: row.notes, currency: row.currency,
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

  return {
    journals,
    errors,
    metadata: { totalRows: lines.length - 1, parsedRows, journalCount: journals.length },
  }
}
