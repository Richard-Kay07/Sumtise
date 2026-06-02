/**
 * Journal CSV Import Parser
 *
 * Expected columns (case-insensitive):
 *   date        – journal date (YYYY-MM-DD or DD/MM/YYYY or MM/DD/YYYY)
 *   reference   – groups lines into a single journal entry
 *   description – journal-level description (can repeat for all rows in the group)
 *   account_code – COA code; resolved to accountId by the caller
 *   debit       – debit amount (empty or 0 for a credit line)
 *   credit      – credit amount (empty or 0 for a debit line)
 *   line_description – optional per-line memo
 *   notes       – optional journal-level notes
 *   currency    – optional, defaults to GBP
 */

export interface RawJournalRow {
  date: string
  reference: string
  description: string
  accountCode: string
  debit: number
  credit: number
  lineDescription?: string
  notes?: string
  currency?: string
  rowNumber: number
}

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

function parseCSVLine(line: string, delimiter = ","): string[] {
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

  // ISO: 2024-01-31
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // DD/MM/YYYY
  const dmy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`

  // MM/DD/YYYY
  const mdy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (mdy) return `${mdy[3]}-${mdy[1]}-${mdy[2]}`

  // DD-MM-YYYY
  const dmy2 = s.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (dmy2) return `${dmy2[3]}-${dmy2[2]}-${dmy2[1]}`

  // Try native parse as last resort
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0]

  return null
}

// ─── Amount parser ────────────────────────────────────────────────────────────

function parseAmount(raw: string): number {
  if (!raw || !raw.trim()) return 0
  const cleaned = raw.trim().replace(/[£$€,\s]/g, "")
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : Math.abs(n) // always positive; debit/credit column determines sign
}

// ─── Main parser ─────────────────────────────────────────────────────────────

export function parseJournalCSV(csvText: string): JournalParseResult {
  const errors: JournalParseResult["errors"] = []
  const rawRows: RawJournalRow[] = []

  const lines = csvText.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) {
    return {
      journals: [],
      errors: [{ row: 0, message: "File is empty or has no data rows" }],
      metadata: { totalRows: 0, parsedRows: 0, journalCount: 0 },
    }
  }

  // Detect delimiter: try comma, then semicolon, then tab
  const firstLine = lines[0]
  const delimiter = firstLine.includes(";") ? ";" : firstLine.includes("\t") ? "\t" : ","

  const headers = parseCSVLine(firstLine, delimiter).map((h) =>
    h.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
  )

  // Require these columns
  const REQUIRED = ["date", "reference", "description", "account_code"]
  for (const col of REQUIRED) {
    if (!headers.includes(col)) {
      errors.push({ row: 0, message: `Missing required column: "${col}"` })
    }
  }
  if (errors.length) {
    return { journals: [], errors, metadata: { totalRows: 0, parsedRows: 0, journalCount: 0 } }
  }

  const idx = (name: string) => headers.indexOf(name)

  let parsedRows = 0
  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1
    const cells = parseCSVLine(lines[i], delimiter)

    const dateRaw = cells[idx("date")] ?? ""
    const reference = (cells[idx("reference")] ?? "").trim()
    const description = (cells[idx("description")] ?? "").trim()
    const accountCode = (cells[idx("account_code")] ?? "").trim()
    const debit = parseAmount(cells[idx("debit")] ?? "")
    const credit = parseAmount(cells[idx("credit")] ?? "")
    const lineDescription = idx("line_description") >= 0 ? (cells[idx("line_description")] ?? "").trim() : undefined
    const notes = idx("notes") >= 0 ? (cells[idx("notes")] ?? "").trim() : undefined
    const currency = idx("currency") >= 0 ? (cells[idx("currency")] ?? "").trim().toUpperCase() : "GBP"

    if (!dateRaw && !reference && !accountCode) continue // blank row

    const date = parseDate(dateRaw)
    if (!date) { errors.push({ row: rowNum, message: `Invalid date: "${dateRaw}"` }); continue }
    if (!reference) { errors.push({ row: rowNum, message: "Reference is required" }); continue }
    if (!description) { errors.push({ row: rowNum, message: "Description is required" }); continue }
    if (!accountCode) { errors.push({ row: rowNum, message: "Account code is required" }); continue }
    if (debit === 0 && credit === 0) { errors.push({ row: rowNum, message: "Each line must have a non-zero debit or credit" }); continue }
    if (debit > 0 && credit > 0) { errors.push({ row: rowNum, message: "A line cannot have both debit and credit" }); continue }

    rawRows.push({
      date,
      reference,
      description,
      accountCode,
      debit,
      credit,
      lineDescription: lineDescription || undefined,
      notes: notes || undefined,
      currency: currency || "GBP",
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
        reference: row.reference,
        date: row.date,
        description: row.description,
        notes: row.notes,
        currency: row.currency ?? "GBP",
        lines: [],
        totalDebits: 0,
        totalCredits: 0,
        isBalanced: false,
        rowNumbers: [],
      }
      grouped.set(row.reference, group)
    }
    group.lines.push({
      accountCode: row.accountCode,
      debit: row.debit,
      credit: row.credit,
      lineDescription: row.lineDescription,
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

// ─── Template CSV ─────────────────────────────────────────────────────────────

export const JOURNAL_CSV_TEMPLATE = `date,reference,description,account_code,debit,credit,line_description,notes,currency
2024-01-31,JNL-001,Accrued expenses,6100,500.00,,Accrued rent,,GBP
2024-01-31,JNL-001,Accrued expenses,2100,,500.00,Accruals payable,,GBP
2024-01-31,JNL-002,Prepaid insurance,1200,250.00,,Prepayment,,GBP
2024-01-31,JNL-002,Prepaid insurance,6200,,250.00,Insurance expense,,GBP
`
