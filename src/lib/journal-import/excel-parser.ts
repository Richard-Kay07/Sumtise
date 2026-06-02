/**
 * Excel → CSV bridge for journal import.
 *
 * Reads the first sheet of an .xlsx workbook and returns its content
 * as a CSV string that the existing parseJournalCSV() can consume.
 *
 * Only imported on the server (tRPC route) — never bundled into the client.
 */

import * as XLSX from "xlsx"

/**
 * Convert an Excel workbook buffer to CSV text.
 * The first worksheet is used; expected column headers are the same
 * as for the CSV template.
 */
export function excelToCSV(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true })

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error("Excel file has no sheets")

  const worksheet = workbook.Sheets[sheetName]
  // Use CSV conversion — preserves headers and handles merged cells etc.
  const csv = XLSX.utils.sheet_to_csv(worksheet, { blankrows: false })
  return csv
}

/**
 * Detect if a buffer contains an xlsx/zip file by checking the PK magic bytes.
 */
export function isExcelBuffer(buffer: Buffer): boolean {
  return (
    buffer.length > 4 &&
    buffer[0] === 0x50 && // P
    buffer[1] === 0x4b && // K
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  )
}
