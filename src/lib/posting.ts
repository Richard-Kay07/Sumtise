/**
 * Posting Engine - Double-Entry Bookkeeping
 * 
 * Handles double-entry bookkeeping transactions with validation.
 * Ensures that total debits equal total credits (DR = CR).
 * 
 * Follows Sumtise core standards for organization scoping and validation.
 */

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { TRPCError } from "@trpc/server"
import { recordAudit } from "./audit"

/**
 * Journal line entry for double-entry posting
 */
export interface JournalLine {
  /**
   * Chart of Account ID
   */
  accountId: string

  /**
   * Debit amount (must be >= 0)
   */
  debit: number

  /**
   * Credit amount (must be >= 0)
   */
  credit: number

  /**
   * Description for this line
   */
  description?: string

  /**
   * Reference number for this line (optional)
   */
  reference?: string

  /**
   * Additional metadata (optional)
   */
  metadata?: Record<string, any>
}

/**
 * Posting options
 */
export interface PostDoubleEntryOptions {
  /**
   * Transaction date
   */
  date: Date | string

  /**
   * Journal lines (must have at least 2 lines)
   */
  lines: JournalLine[]

  /**
   * Document reference (e.g., invoice number, payment reference)
   */
  docRef?: string

  /**
   * Currency code (default: GBP)
   */
  currency?: string

  /**
   * Exchange rate (default: 1.0)
   */
  rate?: number

  /**
   * Organization ID
   */
  orgId: string

  /**
   * User ID performing the posting
   */
  userId: string

  /**
   * Description for the transaction
   */
  description?: string

  /**
   * Additional metadata
   */
  metadata?: Record<string, any>
}

/**
 * Posting result
 */
export interface PostingResult {
  /**
   * Transaction IDs created
   */
  transactionIds: string[]

  /**
   * Total debit amount
   */
  totalDebit: number

  /**
   * Total credit amount
   */
  totalCredit: number

  /**
   * Whether the posting was balanced
   */
  balanced: boolean
}

/**
 * Validation result
 */
export interface ValidationResult {
  /**
   * Whether validation passed
   */
  valid: boolean

  /**
   * Validation errors (if any)
   */
  errors: string[]

  /**
   * Total debit amount
   */
  totalDebit: number

  /**
   * Total credit amount
   */
  totalCredit: number

  /**
   * Difference (should be 0 if valid)
   */
  difference: number
}

/**
 * Validate double-entry posting
 * 
 * Ensures:
 * - At least 2 lines
 * - All debits >= 0
 * - All credits >= 0
 * - Total debits = Total credits
 * - All account IDs are valid
 * 
 * @param options - Posting options
 * @returns Validation result
 */
export async function validateDoubleEntry(
  options: PostDoubleEntryOptions
): Promise<ValidationResult> {
  const errors: string[] = []
  let totalDebit = 0
  let totalCredit = 0

  // Validate lines exist
  if (!options.lines || options.lines.length < 2) {
    errors.push("At least 2 journal lines are required for double-entry")
    return {
      valid: false,
      errors,
      totalDebit: 0,
      totalCredit: 0,
      difference: 0,
    }
  }

  // Validate each line
  for (let i = 0; i < options.lines.length; i++) {
    const line = options.lines[i]
    const lineNum = i + 1

    // Validate account ID
    if (!line.accountId || line.accountId.trim() === "") {
      errors.push(`Line ${lineNum}: Account ID is required`)
      continue
    }

    // Validate debit >= 0
    if (line.debit < 0) {
      errors.push(`Line ${lineNum}: Debit amount must be >= 0`)
    }

    // Validate credit >= 0
    if (line.credit < 0) {
      errors.push(`Line ${lineNum}: Credit amount must be >= 0`)
    }

    // Validate at least one of debit or credit is > 0
    if (line.debit === 0 && line.credit === 0) {
      errors.push(`Line ${lineNum}: Either debit or credit must be > 0`)
    }

    // Validate not both debit and credit are > 0
    if (line.debit > 0 && line.credit > 0) {
      errors.push(`Line ${lineNum}: Cannot have both debit and credit > 0`)
    }

    // Accumulate totals
    totalDebit += line.debit
    totalCredit += line.credit
  }

  // Validate accounts exist and belong to organization
  const accountIds = options.lines.map((line) => line.accountId)
  const uniqueAccountIds = [...new Set(accountIds)]

  const accounts = await prisma.chartOfAccount.findMany({
    where: {
      id: { in: uniqueAccountIds },
      organizationId: options.orgId,
      isActive: true,
    },
    select: { id: true },
  })

  const foundAccountIds = new Set(accounts.map((acc) => acc.id))
  const missingAccountIds = uniqueAccountIds.filter(
    (id) => !foundAccountIds.has(id)
  )

  if (missingAccountIds.length > 0) {
    errors.push(
      `Invalid account IDs: ${missingAccountIds.join(", ")}`
    )
  }

  // Validate debits = credits (with tolerance for floating point)
  const difference = Math.abs(totalDebit - totalCredit)
  const tolerance = 0.01 // Allow 1 cent difference for floating point

  if (difference > tolerance) {
    errors.push(
      `Debits (${totalDebit.toFixed(2)}) do not equal credits (${totalCredit.toFixed(2)}). Difference: ${difference.toFixed(2)}`
    )
  }

  return {
    valid: errors.length === 0,
    errors,
    totalDebit,
    totalCredit,
    difference,
  }
}

/**
 * Post double-entry transaction
 * 
 * Creates transactions for each journal line, ensuring double-entry
 * bookkeeping principles are maintained (DR = CR).
 * 
 * @param options - Posting options
 * @returns Posting result with transaction IDs
 * 
 * @throws TRPCError if validation fails
 * 
 * @example
 * ```typescript
 * const result = await postDoubleEntry({
 *   date: new Date(),
 *   lines: [
 *     { accountId: "acc1", debit: 1000, credit: 0, description: "Cash received" },
 *     { accountId: "acc2", debit: 0, credit: 1000, description: "Revenue" },
 *   ],
 *   docRef: "INV-001",
 *   currency: "GBP",
 *   rate: 1.0,
 *   orgId: "org123",
 *   userId: "user123",
 *   description: "Invoice payment",
 * })
 * ```
 */
export async function postDoubleEntry(
  options: PostDoubleEntryOptions
): Promise<PostingResult> {
  // Normalize date
  const date = typeof options.date === "string" 
    ? new Date(options.date) 
    : options.date

  // Normalize currency and rate
  const currency = options.currency || "GBP"
  const rate = options.rate || 1.0

  // Validate double-entry
  const validation = await validateDoubleEntry(options)

  if (!validation.valid) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Double-entry validation failed: ${validation.errors.join("; ")}`,
    })
  }

  // Create transactions for each line
  const transactionIds: string[] = []

  try {
    // Use transaction to ensure all-or-nothing
    await prisma.$transaction(async (tx) => {
      for (const line of options.lines) {
        const transaction = await tx.transaction.create({
          data: {
            organizationId: options.orgId,
            accountId: line.accountId,
            date,
            description: line.description || options.description || "Journal entry",
            reference: line.reference || options.docRef || undefined,
            debit: validation.totalDebit > 0 ? line.debit : 0,
            credit: validation.totalCredit > 0 ? line.credit : 0,
            currency,
            exchangeRate: rate,
            metadata: {
              ...line.metadata,
              ...options.metadata,
              docRef: options.docRef,
              postingType: "double-entry",
            },
          },
        })

        transactionIds.push(transaction.id)
      }
    })

    // Record audit trail
    await recordAudit({
      entity: "transaction",
      entityId: transactionIds[0] || "unknown",
      action: "create",
      after: {
        transactionCount: transactionIds.length,
        totalDebit: validation.totalDebit,
        totalCredit: validation.totalCredit,
        docRef: options.docRef,
        date: date.toISOString(),
      },
      organizationId: options.orgId,
      userId: options.userId,
      meta: {
        transactionIds,
        currency,
        rate,
        lineCount: options.lines.length,
      },
      details: `Posted ${transactionIds.length} transactions for ${options.docRef || "journal entry"}`,
    })

    return {
      transactionIds,
      totalDebit: validation.totalDebit,
      totalCredit: validation.totalCredit,
      balanced: validation.difference < 0.01,
    }
  } catch (error) {
    // Log error and re-throw
    console.error("Error posting double-entry transaction:", error)
    
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to post double-entry transaction",
      cause: error,
    })
  }
}

/**
 * Zod schema for journal line validation
 */
export const journalLineSchema = z.object({
  accountId: z.string().min(1, "Account ID is required"),
  debit: z.number().min(0, "Debit must be >= 0"),
  credit: z.number().min(0, "Credit must be >= 0"),
  description: z.string().optional(),
  reference: z.string().optional(),
  metadata: z.record(z.any()).optional(),
}).refine(
  (data) => data.debit > 0 || data.credit > 0,
  { message: "Either debit or credit must be > 0" }
).refine(
  (data) => !(data.debit > 0 && data.credit > 0),
  { message: "Cannot have both debit and credit > 0" }
)

/**
 * Zod schema for posting options validation
 */
export const postDoubleEntrySchema = z.object({
  date: z.union([z.date(), z.string()]).transform((val) => {
    return typeof val === "string" ? new Date(val) : val
  }),
  lines: z.array(journalLineSchema).min(2, "At least 2 lines required"),
  docRef: z.string().optional(),
  currency: z.string().default("GBP"),
  rate: z.number().positive().default(1.0),
  orgId: z.string().min(1, "Organization ID is required"),
  userId: z.string().min(1, "User ID is required"),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
}).refine(
  async (data) => {
    // Validate that total debits = total credits
    const totalDebit = data.lines.reduce((sum, line) => sum + line.debit, 0)
    const totalCredit = data.lines.reduce((sum, line) => sum + line.credit, 0)
    const difference = Math.abs(totalDebit - totalCredit)
    return difference < 0.01 // Allow 1 cent tolerance
  },
  {
    message: "Total debits must equal total credits",
    path: ["lines"],
  }
)

/**
 * Reverse a posted transaction
 * 
 * Creates reversing entries for all transactions in a posting.
 * 
 * @param transactionIds - IDs of transactions to reverse
 * @param options - Reversal options
 * @returns Posting result with new transaction IDs
 */
export async function reversePosting(
  transactionIds: string[],
  options: {
    orgId: string
    userId: string
    date?: Date | string
    description?: string
  }
): Promise<PostingResult> {
  // Get original transactions
  const originalTransactions = await prisma.transaction.findMany({
    where: {
      id: { in: transactionIds },
      organizationId: options.orgId,
    },
    include: {
      account: true,
    },
  })

  if (originalTransactions.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No transactions found to reverse",
    })
  }

  // Build reversing lines (swap debits and credits)
  const reversingLines: JournalLine[] = originalTransactions.map((tx) => ({
    accountId: tx.accountId,
    debit: tx.credit.toNumber(), // Swap: original credit becomes debit
    credit: tx.debit.toNumber(), // Swap: original debit becomes credit
    description: `Reversal: ${tx.description}`,
    reference: tx.reference || undefined,
  }))

  // Post reversing entries
  const reversalDate = options.date || new Date()
  
  return await postDoubleEntry({
    date: reversalDate,
    lines: reversingLines,
    docRef: `REV-${originalTransactions[0].reference || "UNKNOWN"}`,
    currency: originalTransactions[0].currency,
    rate: originalTransactions[0].exchangeRate.toNumber(),
    orgId: options.orgId,
    userId: options.userId,
    description: options.description || `Reversal of ${originalTransactions.length} transactions`,
    metadata: {
      reversalOf: transactionIds,
      originalDate: originalTransactions[0].date.toISOString(),
    },
  })
}

