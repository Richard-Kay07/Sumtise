/**
 * Bank Statement Import Deduplication
 * 
 * Prevents duplicate imports using:
 * - File hash (SHA-256 of file content)
 * - Transaction hash (hash of transaction key fields)
 */

import crypto from 'crypto';
import { Prisma } from '@prisma/client';
type Decimal = Prisma.Decimal;

export interface TransactionHashInput {
  date: Date;
  amount: Decimal;
  description: string;
  reference?: string;
  payee?: string;
}

/**
 * Generate file hash (SHA-256)
 */
export function generateFileHash(fileContent: Buffer | string): string {
  const content = typeof fileContent === 'string' 
    ? Buffer.from(fileContent, 'utf-8')
    : fileContent;
  
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Generate transaction hash
 * 
 * Creates a unique hash based on transaction key fields:
 * - Date (YYYY-MM-DD)
 * - Amount (rounded to 2 decimals)
 * - Description (normalized)
 * - Reference (if available)
 */
export function generateTransactionHash(transaction: TransactionHashInput): string {
  const dateStr = transaction.date.toISOString().split('T')[0]; // YYYY-MM-DD
  const amountStr = transaction.amount.toFixed(2);
  const descriptionStr = normalizeString(transaction.description);
  const referenceStr = transaction.reference ? normalizeString(transaction.reference) : '';
  const payeeStr = transaction.payee ? normalizeString(transaction.payee) : '';

  // Create hash input
  const hashInput = `${dateStr}|${amountStr}|${descriptionStr}|${referenceStr}|${payeeStr}`;

  return crypto.createHash('sha256').update(hashInput, 'utf-8').digest('hex');
}

/**
 * Normalize string for hashing
 * - Convert to lowercase
 * - Remove extra whitespace
 * - Remove special characters (optional)
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[^\w\s]/g, ''); // Remove special characters (optional, can be adjusted)
}

/**
 * Check if file was already imported
 */
export async function checkFileImported(
  fileHash: string,
  organizationId: string,
  bankAccountId: string
): Promise<{ imported: boolean; importId?: string; importedAt?: Date }> {
  const { prisma } = await import('@/lib/prisma');

  const existingImport = await prisma.bankStatementImport.findFirst({
    where: {
      organizationId,
      bankAccountId,
      fileHash,
    },
    orderBy: {
      importedAt: 'desc',
    },
  });

  if (existingImport) {
    return {
      imported: true,
      importId: existingImport.id,
      importedAt: existingImport.importedAt,
    };
  }

  return { imported: false };
}

/**
 * Check if transaction already exists
 */
export async function checkTransactionExists(
  transactionHash: string,
  organizationId: string,
  bankAccountId: string
): Promise<{ exists: boolean; transactionId?: string }> {
  const { prisma } = await import('@/lib/prisma');

  // Check in BankTransaction table
  // We'll store transaction hash in metadata
  const existingTransaction = await prisma.bankTransaction.findFirst({
    where: {
      organizationId,
      bankAccountId,
      metadata: {
        path: ['transactionHash'],
        equals: transactionHash,
      },
    },
  });

  if (existingTransaction) {
    return {
      exists: true,
      transactionId: existingTransaction.id,
    };
  }

  return { exists: false };
}




