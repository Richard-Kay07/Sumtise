/**
 * CSV Bank Statement Parser
 * 
 * Parses CSV bank statements with support for:
 * - Custom column mapping
 * - Date/amount locale support
 * - Multiple date formats
 * - Negative amount detection
 */

import { Prisma } from '@prisma/client';
const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

export interface CSVColumnMapping {
  date?: string; // Column name for date
  amount?: string; // Column name for amount
  description?: string; // Column name for description
  payee?: string; // Column name for payee
  memo?: string; // Column name for memo
  reference?: string; // Column name for reference
  balance?: string; // Column name for balance
}

export interface CSVParseOptions {
  mapping: CSVColumnMapping;
  dateFormat?: string; // 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'auto'
  amountLocale?: string; // 'en-US', 'en-GB', 'de-DE', etc.
  delimiter?: string; // ',', ';', '\t'
  hasHeader?: boolean; // Default: true
  skipEmptyRows?: boolean; // Default: true
  negativeAmountIndicator?: string; // '-', 'DR', 'Debit', etc.
}

export interface ParsedTransaction {
  date: Date;
  amount: Decimal;
  description: string;
  payee?: string;
  memo?: string;
  reference?: string;
  balance?: Decimal;
  rawRow: Record<string, string>; // Original row data
  rowNumber: number;
}

export interface CSVParseResult {
  transactions: ParsedTransaction[];
  errors: Array<{
    row: number;
    message: string;
    data?: Record<string, string>;
  }>;
  metadata: {
    totalRows: number;
    parsedRows: number;
    skippedRows: number;
    columns: string[];
  };
}

/**
 * Parse CSV bank statement
 */
export function parseCSVStatement(
  csvContent: string,
  options: CSVParseOptions
): CSVParseResult {
  const {
    mapping,
    dateFormat = 'auto',
    amountLocale = 'en-US',
    delimiter = ',',
    hasHeader = true,
    skipEmptyRows = true,
    negativeAmountIndicator = '-',
  } = options;

  const transactions: ParsedTransaction[] = [];
  const errors: CSVParseResult['errors'] = [];
  let columns: string[] = [];
  let totalRows = 0;
  let parsedRows = 0;
  let skippedRows = 0;

  try {
    // Split into lines
    const lines = csvContent.split(/\r?\n/).filter((line) => line.trim());

    if (lines.length === 0) {
      return {
        transactions: [],
        errors: [{ row: 0, message: 'CSV file is empty' }],
        metadata: {
          totalRows: 0,
          parsedRows: 0,
          skippedRows: 0,
          columns: [],
        },
      };
    }

    // Parse header
    let startRow = 0;
    if (hasHeader && lines.length > 0) {
      const headerLine = lines[0];
      columns = parseCSVLine(headerLine, delimiter);
      startRow = 1;
    } else {
      // Auto-detect columns if no header
      const firstLine = lines[0];
      columns = parseCSVLine(firstLine, delimiter);
      columns = columns.map((_, index) => `Column${index + 1}`);
    }

    // Normalize column names (trim, lowercase)
    const normalizedColumns = columns.map((col) => col.trim().toLowerCase());
    const columnMap = new Map<string, number>();
    normalizedColumns.forEach((col, index) => {
      columnMap.set(col, index);
    });

    // Find column indices
    const getColumnIndex = (columnName?: string): number | null => {
      if (!columnName) return null;
      const normalized = columnName.trim().toLowerCase();
      return columnMap.get(normalized) ?? null;
    };

    const dateIndex = getColumnIndex(mapping.date);
    const amountIndex = getColumnIndex(mapping.amount);
    const descriptionIndex = getColumnIndex(mapping.description);
    const payeeIndex = getColumnIndex(mapping.payee);
    const memoIndex = getColumnIndex(mapping.memo);
    const referenceIndex = getColumnIndex(mapping.reference);
    const balanceIndex = getColumnIndex(mapping.balance);

    // Validate required columns
    if (dateIndex === null) {
      errors.push({ row: 0, message: 'Date column not found in mapping' });
    }
    if (amountIndex === null) {
      errors.push({ row: 0, message: 'Amount column not found in mapping' });
    }
    if (descriptionIndex === null) {
      errors.push({ row: 0, message: 'Description column not found in mapping' });
    }

    if (errors.length > 0 && errors[0].row === 0) {
      return {
        transactions: [],
        errors,
        metadata: {
          totalRows: 0,
          parsedRows: 0,
          skippedRows: 0,
          columns,
        },
      };
    }

    // Parse data rows
    for (let i = startRow; i < lines.length; i++) {
      totalRows++;
      const line = lines[i];
      const row = parseCSVLine(line, delimiter);

      // Skip empty rows
      if (skipEmptyRows && row.every((cell) => !cell.trim())) {
        skippedRows++;
        continue;
      }

      // Build raw row object
      const rawRow: Record<string, string> = {};
      columns.forEach((col, index) => {
        rawRow[col] = row[index] || '';
      });

      try {
        // Parse date
        const dateStr = row[dateIndex!];
        const date = parseDate(dateStr, dateFormat);
        if (!date) {
          errors.push({
            row: i + 1,
            message: `Invalid date format: ${dateStr}`,
            data: rawRow,
          });
          continue;
        }

        // Parse amount
        const amountStr = row[amountIndex!];
        const amount = parseAmount(amountStr, amountLocale, negativeAmountIndicator);
        if (amount === null) {
          errors.push({
            row: i + 1,
            message: `Invalid amount format: ${amountStr}`,
            data: rawRow,
          });
          continue;
        }

        // Parse description
        const description = (row[descriptionIndex!] || '').trim();
        if (!description) {
          errors.push({
            row: i + 1,
            message: 'Description is required',
            data: rawRow,
          });
          continue;
        }

        // Parse optional fields
        const payee = payeeIndex !== null ? (row[payeeIndex] || '').trim() : undefined;
        const memo = memoIndex !== null ? (row[memoIndex] || '').trim() : undefined;
        const reference = referenceIndex !== null ? (row[referenceIndex] || '').trim() : undefined;
        const balance =
          balanceIndex !== null
            ? parseAmount(row[balanceIndex], amountLocale, negativeAmountIndicator)
            : undefined;

        transactions.push({
          date,
          amount,
          description,
          payee: payee || undefined,
          memo: memo || undefined,
          reference: reference || undefined,
          balance: balance || undefined,
          rawRow,
          rowNumber: i + 1,
        });

        parsedRows++;
      } catch (error) {
        errors.push({
          row: i + 1,
          message: error instanceof Error ? error.message : 'Unknown error',
          data: rawRow,
        });
      }
    }
  } catch (error) {
    errors.push({
      row: 0,
      message: error instanceof Error ? error.message : 'Failed to parse CSV',
    });
  }

  return {
    transactions,
    errors,
    metadata: {
      totalRows,
      parsedRows,
      skippedRows,
      columns,
    },
  };
}

/**
 * Parse CSV line (handles quoted fields)
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Parse date with multiple format support
 */
function parseDate(dateStr: string, format: string): Date | null {
  if (!dateStr || !dateStr.trim()) return null;

  const trimmed = dateStr.trim();

  // Auto-detect format
  if (format === 'auto') {
    // Try common formats
    const formats = [
      'YYYY-MM-DD',
      'DD/MM/YYYY',
      'MM/DD/YYYY',
      'DD-MM-YYYY',
      'MM-DD-YYYY',
      'DD.MM.YYYY',
      'MM.DD.YYYY',
    ];

    for (const fmt of formats) {
      const date = parseDateWithFormat(trimmed, fmt);
      if (date) return date;
    }

    // Try ISO format
    const isoDate = new Date(trimmed);
    if (!isNaN(isoDate.getTime())) return isoDate;

    return null;
  }

  return parseDateWithFormat(trimmed, format);
}

/**
 * Parse date with specific format
 */
function parseDateWithFormat(dateStr: string, format: string): Date | null {
  try {
    const formatPattern = format
      .replace(/YYYY/g, '(\\d{4})')
      .replace(/MM/g, '(\\d{2})')
      .replace(/DD/g, '(\\d{2})');

    const regex = new RegExp(`^${formatPattern}$`);
    const match = dateStr.match(regex);

    if (!match) return null;

    const parts = match.slice(1).map(Number);

    if (format.includes('YYYY')) {
      const yearIndex = format.indexOf('YYYY');
      const monthIndex = format.indexOf('MM');
      const dayIndex = format.indexOf('DD');

      const year = parts[yearIndex / 4];
      const month = parts[monthIndex / 2] - 1; // Month is 0-indexed
      const day = parts[dayIndex / 2];

      const date = new Date(year, month, day);
      if (
        date.getFullYear() === year &&
        date.getMonth() === month &&
        date.getDate() === day
      ) {
        return date;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Parse amount with locale support
 */
function parseAmount(
  amountStr: string,
  locale: string,
  negativeIndicator: string
): Decimal | null {
  if (!amountStr || !amountStr.trim()) return null;

  let trimmed = amountStr.trim();

  // Remove currency symbols
  trimmed = trimmed.replace(/[£$€¥₹]/g, '');

  // Detect negative amounts
  let isNegative = false;
  if (trimmed.startsWith(negativeIndicator)) {
    isNegative = true;
    trimmed = trimmed.substring(negativeIndicator.length).trim();
  } else if (trimmed.startsWith('-')) {
    isNegative = true;
    trimmed = trimmed.substring(1).trim();
  } else if (trimmed.endsWith(negativeIndicator)) {
    isNegative = true;
    trimmed = trimmed.substring(0, trimmed.length - negativeIndicator.length).trim();
  } else if (trimmed.includes('DR') || trimmed.includes('Debit')) {
    isNegative = true;
    trimmed = trimmed.replace(/DR|Debit/gi, '').trim();
  }

  // Handle locale-specific decimal separators
  // en-US: 1,234.56
  // en-GB: 1,234.56 or 1234.56
  // de-DE: 1.234,56
  // fr-FR: 1 234,56

  let normalized = trimmed;

  // Remove thousand separators (common patterns)
  if (locale === 'de-DE' || locale === 'fr-FR') {
    // European format: 1.234,56 or 1 234,56
    normalized = normalized.replace(/\./g, ''); // Remove thousand separator
    normalized = normalized.replace(/,/g, '.'); // Convert comma to decimal point
  } else {
    // US/UK format: 1,234.56
    normalized = normalized.replace(/,/g, ''); // Remove thousand separator
  }

  // Parse as number
  const num = parseFloat(normalized);
  if (isNaN(num)) return null;

  const decimal = new Decimal(num);
  return isNegative ? decimal.neg() : decimal;
}




