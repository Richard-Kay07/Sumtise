/**
 * Bank Accounts Router
 * 
 * Enhanced with reconciliation features:
 * - Reconcile bank transactions
 * - Get transactions for account
 * - Get unreconciled transactions
 * - Update balance
 * - Matching logic
 */

import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { paginationSchema } from "@/types/schemas"
import { prisma } from "@/lib/prisma"
import { recordAudit } from "@/lib/audit"
import { verifyResourceOwnership } from "@/lib/guards/organization"
import { matchBankTransaction, suggestMatches, calculateReconciledBalance } from "@/lib/reconciliation/matching"
import Decimal from "decimal.js"
import { ReconciliationStatus, MatchType } from "@prisma/client"

/**
 * Bank account list query schema
 */
const bankAccountListSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  ...paginationSchema.shape,
  isActive: z.boolean().optional(),
})

/**
 * Get transactions for bank account
 */
const getTransactionsSchema = z.object({
  organizationId: z.string().min(1),
  bankAccountId: z.string().min(1),
  startDate: z.union([z.date(), z.string()]).optional(),
  endDate: z.union([z.date(), z.string()]).optional(),
  reconciled: z.boolean().optional(),
  ...paginationSchema.shape,
})

/**
 * Reconcile schema
 */
const reconcileSchema = z.object({
  organizationId: z.string().min(1),
  bankAccountId: z.string().min(1),
  statementDate: z.date(),
  statementBalance: z.number(),
  matches: z.array(z.object({
    bankTransactionId: z.string(),
    transactionId: z.string().optional(),
    amount: z.number(),
    matchType: z.enum(["AUTO", "MANUAL", "PARTIAL", "SUGGESTED"]),
    notes: z.string().optional(),
  })),
  notes: z.string().optional(),
})

export const bankAccountsRouter = createTRPCRouter({
  /**
   * Get all bank accounts
   */
  getAll: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BANK_ACCOUNTS_VIEW))
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await prisma.bankAccount.findMany({
        where: {
          organizationId: ctx.organizationId,
          isActive: true,
        },
        orderBy: { name: "asc" },
      })
    }),

  /**
   * Create bank account
   */
  create: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BANK_ACCOUNTS_CREATE))
    .input(z.object({
      organizationId: z.string().min(1),
      name: z.string().min(1),
      accountNumber: z.string().optional(),
      sortCode: z.string().optional(),
      iban: z.string().optional(),
      swift: z.string().optional(),
      currency: z.string().default("GBP"),
      openingBalance: z.number().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      return await prisma.bankAccount.create({
        data: {
          ...input,
          organizationId: ctx.organizationId,
          openingBalance: new Decimal(input.openingBalance),
          currentBalance: new Decimal(input.openingBalance),
        },
      })
    }),

  /**
   * Update bank account
   */
  update: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BANK_ACCOUNTS_EDIT))
    .input(z.object({
      id: z.string().min(1),
      organizationId: z.string().min(1),
      data: z.object({
        name: z.string().min(1).optional(),
        accountNumber: z.string().optional(),
        sortCode: z.string().optional(),
        iban: z.string().optional(),
        swift: z.string().optional(),
        currency: z.string().optional(),
        isActive: z.boolean().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifyResourceOwnership("bankAccount", input.id, ctx.organizationId)
      
      return await prisma.bankAccount.update({
        where: { id: input.id },
        data: input.data,
      })
    }),

  /**
   * Delete bank account (soft delete)
   */
  delete: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BANK_ACCOUNTS_DELETE))
    .input(z.object({ id: z.string().min(1), organizationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await verifyResourceOwnership("bankAccount", input.id, ctx.organizationId)
      
      return await prisma.bankAccount.update({
        where: { id: input.id },
        data: { isActive: false },
      })
    }),

  /**
   * Get all bank accounts (with pagination)
   */
  getAllPaginated: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BANK_ACCOUNTS_VIEW))
    .input(bankAccountListSchema)
    .query(async ({ ctx, input }) => {
      const { page, limit, isActive } = input

      const where: any = {
        organizationId: ctx.organizationId,
      }

      if (isActive !== undefined) {
        where.isActive = isActive
      }

      const [accounts, total] = await Promise.all([
        prisma.bankAccount.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { name: "asc" },
        }),
        prisma.bankAccount.count({ where }),
      ])

      return {
        accounts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    }),

  /**
   * Get bank account by ID
   */
  getById: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BANK_ACCOUNTS_VIEW))
    .input(z.object({
      id: z.string().min(1),
      organizationId: z.string().min(1),
    }))
    .query(async ({ ctx, input }) => {
      const account = await prisma.bankAccount.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: {
          bankTransactions: {
            where: {
              reconciledAt: null,
            },
            orderBy: {
              date: "desc",
            },
            take: 10,
          },
        },
      })

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bank account not found",
        })
      }

      return account
    }),

  /**
   * Get transactions for bank account
   */
  getTransactions: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BANK_ACCOUNTS_VIEW))
    .input(getTransactionsSchema)
    .query(async ({ ctx, input }) => {
      const { bankAccountId, startDate, endDate, reconciled, page, limit } = input

      // Verify bank account ownership
      await verifyResourceOwnership("bankAccount", bankAccountId, ctx.organizationId)

      const where: any = {
        organizationId: ctx.organizationId,
        bankAccountId,
      }

      if (reconciled !== undefined) {
        where.reconciledAt = reconciled ? { not: null } : null
      }

      if (startDate || endDate) {
        where.date = {}
        if (startDate) {
          const start = typeof startDate === "string" ? new Date(startDate) : startDate
          where.date.gte = start
        }
        if (endDate) {
          const end = typeof endDate === "string" ? new Date(endDate) : endDate
          end.setHours(23, 59, 59, 999)
          where.date.lte = end
        }
      }

      const [transactions, total] = await Promise.all([
        prisma.bankTransaction.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { date: "desc" },
          include: {
            reconciliations: {
              include: {
                transaction: true,
              },
            },
          },
        }),
        prisma.bankTransaction.count({ where }),
      ])

      return {
        transactions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    }),

  /**
   * Get unreconciled transactions
   */
  getUnreconciled: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BANK_ACCOUNTS_VIEW))
    .input(z.object({
      organizationId: z.string().min(1),
      bankAccountId: z.string().min(1),
      startDate: z.union([z.date(), z.string()]).optional(),
      endDate: z.union([z.date(), z.string()]).optional(),
      ...paginationSchema.shape,
    }))
    .query(async ({ ctx, input }) => {
      const { bankAccountId, startDate, endDate, page, limit } = input

      // Verify bank account ownership
      await verifyResourceOwnership("bankAccount", bankAccountId, ctx.organizationId)

      const where: any = {
        organizationId: ctx.organizationId,
        bankAccountId,
        reconciledAt: null, // Unreconciled only
      }

      if (startDate || endDate) {
        where.date = {}
        if (startDate) {
          const start = typeof startDate === "string" ? new Date(startDate) : startDate
          where.date.gte = start
        }
        if (endDate) {
          const end = typeof endDate === "string" ? new Date(endDate) : endDate
          end.setHours(23, 59, 59, 999)
          where.date.lte = end
        }
      }

      const [transactions, total] = await Promise.all([
        prisma.bankTransaction.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { date: "desc" },
        }),
        prisma.bankTransaction.count({ where }),
      ])

      return {
        transactions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    }),

  /**
   * Suggest matches for unreconciled transactions
   */
  suggestMatches: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BANK_ACCOUNTS_VIEW))
    .input(z.object({
      organizationId: z.string().min(1),
      bankAccountId: z.string().min(1),
      amountTolerance: z.number().default(0.01).optional(),
      dateToleranceDays: z.number().default(7).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { bankAccountId, amountTolerance, dateToleranceDays } = input

      // Verify bank account ownership
      await verifyResourceOwnership("bankAccount", bankAccountId, ctx.organizationId)

      // Get bank account to find associated GL account
      const bankAccount = await prisma.bankAccount.findUnique({
        where: {
          id: bankAccountId,
          organizationId: ctx.organizationId,
        },
      })

      if (!bankAccount) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bank account not found",
        })
      }

      // Get unreconciled bank transactions
      const bankTransactions = await prisma.bankTransaction.findMany({
        where: {
          organizationId: ctx.organizationId,
          bankAccountId,
          reconciledAt: null,
        },
        orderBy: { date: "desc" },
        take: 100, // Limit for performance
      })

      // Find associated GL account (bank account in chart of accounts)
      const glAccount = await prisma.chartOfAccount.findFirst({
        where: {
          organizationId: ctx.organizationId,
          type: "ASSET",
          OR: [
            { name: { contains: bankAccount.name, mode: "insensitive" } },
            { code: { contains: "100", mode: "insensitive" } },
          ],
          isActive: true,
        },
      })

      // Get ledger transactions for matching
      const ledgerTransactions = await prisma.transaction.findMany({
        where: {
          organizationId: ctx.organizationId,
          accountId: glAccount?.id || undefined,
          date: {
            gte: bankTransactions.length > 0
              ? new Date(Math.min(...bankTransactions.map((t) => t.date.getTime())) - 30 * 24 * 60 * 60 * 1000)
              : new Date(),
            lte: new Date(),
          },
        },
        orderBy: { date: "desc" },
        take: 1000, // Limit for performance
      })

      // Convert to matching format
      const bankTxsForMatching = bankTransactions.map((tx) => ({
        id: tx.id,
        date: tx.date,
        amount: new Decimal(tx.amount.toString()),
        description: tx.description,
        payee: tx.payee || undefined,
        memo: tx.memo || undefined,
        reference: tx.reference || undefined,
      }))

      const ledgerTxsForMatching = ledgerTransactions.map((tx) => ({
        id: tx.id,
        date: tx.date,
        debit: new Decimal(tx.debit.toString()),
        credit: new Decimal(tx.credit.toString()),
        description: tx.description,
        reference: tx.reference || undefined,
        accountId: tx.accountId,
      }))

      // Get suggestions
      const suggestions = suggestMatches(
        bankTxsForMatching,
        ledgerTxsForMatching,
        {
          amountTolerance,
          dateToleranceDays,
        }
      )

      return suggestions
    }),

  /**
   * Reconcile bank transactions
   */
  reconcile: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BANK_ACCOUNTS_EDIT))
    .input(reconcileSchema)
    .mutation(async ({ ctx, input }) => {
      const { bankAccountId, statementDate, statementBalance, matches, notes } = input

      // Verify bank account ownership
      await verifyResourceOwnership("bankAccount", bankAccountId, ctx.organizationId)

      // Get bank account
      const bankAccount = await prisma.bankAccount.findUnique({
        where: {
          id: bankAccountId,
          organizationId: ctx.organizationId,
        },
      })

      if (!bankAccount) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bank account not found",
        })
      }

      // Create reconciliation
      const reconciliation = await prisma.reconciliation.create({
        data: {
          organizationId: ctx.organizationId,
          bankAccountId,
          statementDate,
          statementBalance: new Decimal(statementBalance),
          status: ReconciliationStatus.IN_PROGRESS,
          notes,
        },
      })

      // Create reconciliation lines and mark transactions as reconciled
      const reconciliationLines = []
      let reconciledBalance = new Decimal(0)

      for (const match of matches) {
        // Update bank transaction
        await prisma.bankTransaction.update({
          where: { id: match.bankTransactionId },
          data: {
            reconciledAt: new Date(),
            reconciledBy: ctx.session.user.id,
          },
        })

        // Create reconciliation line
        const line = await prisma.reconciliationLine.create({
          data: {
            organizationId: ctx.organizationId,
            reconciliationId: reconciliation.id,
            bankTransactionId: match.bankTransactionId,
            transactionId: match.transactionId || null,
            amount: new Decimal(match.amount),
            matchType: match.matchType as MatchType,
            notes: match.notes || null,
          },
        })

        reconciliationLines.push(line)
        reconciledBalance = reconciledBalance.plus(new Decimal(match.amount))
      }

      // Calculate difference
      const difference = new Decimal(statementBalance).minus(reconciledBalance)

      // Update reconciliation
      const updatedReconciliation = await prisma.reconciliation.update({
        where: { id: reconciliation.id },
        data: {
          reconciledBalance,
          difference,
          status: difference.equals(0) ? ReconciliationStatus.COMPLETED : ReconciliationStatus.IN_PROGRESS,
          reconciledAt: difference.equals(0) ? new Date() : null,
          reconciledBy: difference.equals(0) ? ctx.session.user.id : null,
        },
        include: {
          lines: {
            include: {
              bankTransaction: true,
              transaction: true,
            },
          },
        },
      })

      // Record audit
      await recordAudit({
        entity: "reconciliation",
        entityId: reconciliation.id,
        action: "create",
        after: updatedReconciliation,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          bankAccountId,
          statementDate,
          statementBalance: statementBalance.toString(),
          reconciledBalance: reconciledBalance.toString(),
          difference: difference.toString(),
          matchCount: matches.length,
        },
      }).catch((error) => {
        ctx.logger?.warn("Audit recording failed", { error, reconciliationId: reconciliation.id })
      })

      return updatedReconciliation
    }),

  /**
   * Update bank account balance
   */
  updateBalance: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BANK_ACCOUNTS_EDIT))
    .input(z.object({
      id: z.string().min(1),
      organizationId: z.string().min(1),
      balance: z.number(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify bank account ownership
      await verifyResourceOwnership("bankAccount", input.id, ctx.organizationId)

      // Get before state
      const before = await prisma.bankAccount.findUnique({
        where: { id: input.id },
      })

      if (!before) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bank account not found",
        })
      }

      // Update balance
      const after = await prisma.bankAccount.update({
        where: { id: input.id },
        data: {
          currentBalance: new Decimal(input.balance),
          metadata: {
            ...((before.metadata as any) || {}),
            balanceUpdatedAt: new Date().toISOString(),
            balanceUpdatedBy: ctx.session.user.id,
            balanceUpdateNotes: input.notes,
            previousBalance: before.currentBalance.toString(),
          },
        },
      })

      // Record audit
      await recordAudit({
        entity: "bankAccount",
        entityId: input.id,
        action: "updateBalance",
        before,
        after,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          previousBalance: before.currentBalance.toString(),
          newBalance: input.balance.toString(),
          notes: input.notes,
        },
      }).catch((error) => {
        ctx.logger?.warn("Audit recording failed", { error, bankAccountId: input.id })
      })

      return after
    }),

  /**
   * Get reconciliation report (bank balance vs GL)
   */
  getReconciliationReport: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BANK_ACCOUNTS_VIEW))
    .input(z.object({
      organizationId: z.string().min(1),
      bankAccountId: z.string().min(1),
      asOfDate: z.union([z.date(), z.string()]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { bankAccountId, asOfDate } = input
      const reportDate = asOfDate 
        ? (typeof asOfDate === "string" ? new Date(asOfDate) : asOfDate)
        : new Date()

      // Verify bank account ownership
      await verifyResourceOwnership("bankAccount", bankAccountId, ctx.organizationId)

      // Get bank account
      const bankAccount = await prisma.bankAccount.findUnique({
        where: {
          id: bankAccountId,
          organizationId: ctx.organizationId,
        },
      })

      if (!bankAccount) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bank account not found",
        })
      }

      // Get bank balance (from bank account)
      const bankBalance = bankAccount.currentBalance

      // Find associated GL account
      const glAccount = await prisma.chartOfAccount.findFirst({
        where: {
          organizationId: ctx.organizationId,
          type: "ASSET",
          OR: [
            { name: { contains: bankAccount.name, mode: "insensitive" } },
            { code: { contains: "100", mode: "insensitive" } },
          ],
          isActive: true,
        },
      })

      // Get GL balance (sum of transactions)
      let glBalance = new Decimal(0)
      if (glAccount) {
        const transactions = await prisma.transaction.findMany({
          where: {
            organizationId: ctx.organizationId,
            accountId: glAccount.id,
            date: { lte: reportDate },
          },
        })

        glBalance = transactions.reduce(
          (sum, tx) => sum.plus(new Decimal(tx.debit.toString())).minus(new Decimal(tx.credit.toString())),
          new Decimal(glAccount.openingBalance?.toString() || 0)
        )
      }

      // Get unreconciled transactions
      const unreconciled = await prisma.bankTransaction.findMany({
        where: {
          organizationId: ctx.organizationId,
          bankAccountId,
          reconciledAt: null,
          date: { lte: reportDate },
        },
        orderBy: { date: "desc" },
      })

      const unreconciledAmount = unreconciled.reduce(
        (sum, tx) => sum.plus(new Decimal(tx.amount.toString())),
        new Decimal(0)
      )

      // Calculate difference
      const difference = bankBalance.minus(glBalance).plus(unreconciledAmount)

      return {
        bankAccount: {
          id: bankAccount.id,
          name: bankAccount.name,
        },
        reportDate,
        bankBalance: bankBalance.toNumber(),
        glBalance: glBalance.toNumber(),
        unreconciledCount: unreconciled.length,
        unreconciledAmount: unreconciledAmount.toNumber(),
        difference: difference.toNumber(),
        isBalanced: difference.abs().lessThan(0.01),
      }
    }),

  /**
   * Import bank statement (CSV/OFX)
   */
  importStatement: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BANK_ACCOUNTS_EDIT))
    .input(z.object({
      organizationId: z.string().min(1),
      bankAccountId: z.string().min(1),
      fileContent: z.string(), // Base64 encoded file content
      fileName: z.string(),
      fileType: z.enum(['CSV', 'OFX']),
      mapping: z.object({
        date: z.string().optional(),
        amount: z.string().optional(),
        description: z.string().optional(),
        payee: z.string().optional(),
        memo: z.string().optional(),
        reference: z.string().optional(),
        balance: z.string().optional(),
      }).optional(), // For CSV
      parseOptions: z.object({
        dateFormat: z.string().optional(),
        amountLocale: z.string().optional(),
        delimiter: z.string().optional(),
        hasHeader: z.boolean().optional(),
        negativeAmountIndicator: z.string().optional(),
      }).optional(), // For CSV
      skipDuplicates: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const {
        bankAccountId,
        fileContent,
        fileName,
        fileType,
        mapping,
        parseOptions,
        skipDuplicates,
      } = input

      // Verify bank account ownership
      await verifyResourceOwnership("bankAccount", bankAccountId, ctx.organizationId)

      // Decode file content
      const fileBuffer = Buffer.from(fileContent, 'base64')
      const fileText = fileBuffer.toString('utf-8')

      // Generate file hash
      const { generateFileHash, generateTransactionHash, checkFileImported, checkTransactionExists } = await import('@/lib/bank-import/deduplication')
      const fileHash = generateFileHash(fileBuffer)

      // Check if file was already imported
      const fileCheck = await checkFileImported(fileHash, ctx.organizationId, bankAccountId)
      if (fileCheck.imported && skipDuplicates) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `This file has already been imported on ${fileCheck.importedAt?.toISOString()}`,
        })
      }

      // Create import record
      const importRecord = await prisma.bankStatementImport.create({
        data: {
          organizationId: ctx.organizationId,
          bankAccountId,
          fileName,
          fileHash,
          fileSize: fileBuffer.length,
          fileType,
          importStatus: 'PROCESSING',
          metadata: {
            mapping,
            parseOptions,
          },
          importedBy: ctx.session.user.id,
        },
      })

      let transactions: Array<{
        date: Date
        amount: Decimal
        description: string
        payee?: string
        memo?: string
        reference?: string
        balance?: Decimal
        transactionHash: string
      }> = []
      let errors: Array<{ row: number; message: string }> = []
      let totalRows = 0
      let parsedRows = 0

      try {
        // Parse based on file type
        if (fileType === 'CSV') {
          const { parseCSVStatement } = await import('@/lib/bank-import/csv-parser')
          
          if (!mapping || !mapping.date || !mapping.amount || !mapping.description) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "CSV mapping must include date, amount, and description columns",
            })
          }

          const result = parseCSVStatement(fileText, {
            mapping: {
              date: mapping.date,
              amount: mapping.amount,
              description: mapping.description,
              payee: mapping.payee,
              memo: mapping.memo,
              reference: mapping.reference,
              balance: mapping.balance,
            },
            dateFormat: parseOptions?.dateFormat || 'auto',
            amountLocale: parseOptions?.amountLocale || 'en-US',
            delimiter: parseOptions?.delimiter || ',',
            hasHeader: parseOptions?.hasHeader ?? true,
            negativeAmountIndicator: parseOptions?.negativeAmountIndicator || '-',
          })

          totalRows = result.metadata.totalRows
          parsedRows = result.metadata.parsedRows
          errors = result.errors

          // Generate transaction hashes
          transactions = result.transactions.map((tx) => ({
            ...tx,
            transactionHash: generateTransactionHash({
              date: tx.date,
              amount: tx.amount,
              description: tx.description,
              reference: tx.reference,
              payee: tx.payee,
            }),
          }))
        } else if (fileType === 'OFX') {
          const { parseOFXStatement } = await import('@/lib/bank-import/ofx-parser')
          
          const result = parseOFXStatement(fileText)

          totalRows = result.transactions.length
          parsedRows = result.transactions.length
          errors = result.errors

          // Generate transaction hashes
          transactions = result.transactions.map((tx) => ({
            date: tx.date,
            amount: tx.amount,
            description: tx.description,
            payee: tx.payee,
            memo: tx.memo,
            reference: tx.reference,
            balance: tx.balance,
            transactionHash: generateTransactionHash({
              date: tx.date,
              amount: tx.amount,
              description: tx.description,
              reference: tx.reference,
              payee: tx.payee,
            }),
          }))
        } else {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Unsupported file type: ${fileType}`,
          })
        }

        // Check for duplicates and import transactions
        let importedCount = 0
        let duplicateCount = 0
        let errorCount = errors.length

        for (const tx of transactions) {
          try {
            // Check if transaction already exists
            const txCheck = await checkTransactionExists(
              tx.transactionHash,
              ctx.organizationId,
              bankAccountId
            )

            if (txCheck.exists && skipDuplicates) {
              duplicateCount++
              continue
            }

            // Create bank transaction
            await prisma.bankTransaction.create({
              data: {
                organizationId: ctx.organizationId,
                bankAccountId,
                date: tx.date,
                amount: tx.amount,
                description: tx.description,
                payee: tx.payee,
                memo: tx.memo,
                reference: tx.reference,
                balance: tx.balance,
                metadata: {
                  transactionHash: tx.transactionHash,
                  importId: importRecord.id,
                  importedAt: new Date().toISOString(),
                },
              },
            })

            importedCount++
          } catch (error) {
            errorCount++
            errors.push({
              row: (tx as any).rowNumber || 0,
              message: error instanceof Error ? error.message : 'Failed to import transaction',
            })
          }
        }

        // Update import record
        const finalStatus = errorCount > 0 && importedCount > 0 
          ? 'PARTIAL' 
          : errorCount === 0 
          ? 'COMPLETED' 
          : 'FAILED'

        await prisma.bankStatementImport.update({
          where: { id: importRecord.id },
          data: {
            importStatus: finalStatus,
            totalRows,
            importedRows: importedCount,
            skippedRows: totalRows - importedCount - duplicateCount - errorCount,
            errorRows: errorCount,
            duplicateRows: duplicateCount,
          },
        })

        // Record audit
        await recordAudit({
          entity: "bankStatementImport",
          entityId: importRecord.id,
          action: "create",
          after: {
            id: importRecord.id,
            fileName,
            fileType,
            importStatus: finalStatus,
            importedRows: importedCount,
            duplicateRows: duplicateCount,
            errorRows: errorCount,
          },
          organizationId: ctx.organizationId,
          userId: ctx.session.user.id,
          meta: {
            bankAccountId,
            fileHash,
            totalRows,
          },
        }).catch((error) => {
          ctx.logger?.warn("Audit recording failed", { error, importId: importRecord.id })
        })

        return {
          importId: importRecord.id,
          status: finalStatus,
          totalRows,
          importedRows: importedCount,
          duplicateRows: duplicateCount,
          errorRows: errorCount,
          skippedRows: totalRows - importedCount - duplicateCount - errorCount,
          errors: errors.slice(0, 100), // Limit errors returned
        }
      } catch (error) {
        // Update import record with error
        await prisma.bankStatementImport.update({
          where: { id: importRecord.id },
          data: {
            importStatus: 'FAILED',
            errorRows: totalRows,
          },
        })

        throw error
      }
    }),

  /**
   * Preview statement import (parse without importing)
   */
  previewStatement: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BANK_ACCOUNTS_VIEW))
    .input(z.object({
      organizationId: z.string().min(1),
      fileContent: z.string(), // Base64 encoded file content
      fileType: z.enum(['CSV', 'OFX']),
      mapping: z.object({
        date: z.string().optional(),
        amount: z.string().optional(),
        description: z.string().optional(),
        payee: z.string().optional(),
        memo: z.string().optional(),
        reference: z.string().optional(),
        balance: z.string().optional(),
      }).optional(), // For CSV
      parseOptions: z.object({
        dateFormat: z.string().optional(),
        amountLocale: z.string().optional(),
        delimiter: z.string().optional(),
        hasHeader: z.boolean().optional(),
        negativeAmountIndicator: z.string().optional(),
      }).optional(), // For CSV
    }))
    .mutation(async ({ ctx, input }) => {
      const { fileContent, fileType, mapping, parseOptions } = input

      // Decode file content
      const fileBuffer = Buffer.from(fileContent, 'base64')
      const fileText = fileBuffer.toString('utf-8')

      if (fileType === 'CSV') {
        const { parseCSVStatement } = await import('@/lib/bank-import/csv-parser')
        
        if (!mapping || !mapping.date || !mapping.amount || !mapping.description) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "CSV mapping must include date, amount, and description columns",
          })
        }

        const result = parseCSVStatement(fileText, {
          mapping: {
            date: mapping.date,
            amount: mapping.amount,
            description: mapping.description,
            payee: mapping.payee,
            memo: mapping.memo,
            reference: mapping.reference,
            balance: mapping.balance,
          },
          dateFormat: parseOptions?.dateFormat || 'auto',
          amountLocale: parseOptions?.amountLocale || 'en-US',
          delimiter: parseOptions?.delimiter || ',',
          hasHeader: parseOptions?.hasHeader ?? true,
          negativeAmountIndicator: parseOptions?.negativeAmountIndicator || '-',
        })

        return {
          transactions: result.transactions.slice(0, 100).map((tx) => ({
            date: tx.date.toISOString(),
            amount: tx.amount.toNumber(),
            description: tx.description,
            payee: tx.payee,
            memo: tx.memo,
            reference: tx.reference,
            balance: tx.balance?.toNumber(),
            rowNumber: tx.rowNumber,
          })),
          errors: result.errors.slice(0, 50),
          metadata: result.metadata,
        }
      } else if (fileType === 'OFX') {
        const { parseOFXStatement } = await import('@/lib/bank-import/ofx-parser')
        
        const result = parseOFXStatement(fileText)

        return {
          transactions: result.transactions.slice(0, 100).map((tx) => ({
            date: tx.date.toISOString(),
            amount: tx.amount.toNumber(),
            description: tx.description,
            payee: tx.payee,
            memo: tx.memo,
            reference: tx.reference,
            balance: tx.balance?.toNumber(),
          })),
          errors: result.errors.slice(0, 50),
          metadata: result.metadata,
        }
      } else {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unsupported file type: ${fileType}`,
        })
      }
    }),
})

