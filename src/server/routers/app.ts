import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, protectedProcedure, publicProcedure, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { createOrganizationSchema, createChartOfAccountSchema, createTransactionSchema, createCustomerSchema, createInvoiceSchema, createBankAccountSchema, paginationSchema } from "@/types/schemas"
import { generateInvoiceNumber } from "@/lib/utils"
import { verifyResourceOwnership } from "@/lib/guards/organization"
import { recordAudit } from "@/lib/audit"
import Decimal from "decimal.js"
import { helloRouter } from "./hello"
import { vendorsRouter } from "./vendors"
import { billsRouter } from "./bills"
import { paymentsRouter } from "./payments"
import { paymentRunsRouter } from "./paymentRuns"
import { creditNotesRouter } from "./creditNotes"
import { debitNotesRouter } from "./debitNotes"
import { billAmendmentsRouter } from "./billAmendments"
import { invoiceRemindersRouter } from "./invoiceReminders"
import { emailsRouter } from "./emails"
import { bankAccountsRouter } from "./bankAccounts"
import { reportsRouter } from "./reports"
import { settingsRouter } from "./settings"
import { payrollRouter } from "./payroll"
import { aiRouter } from "./ai"

/**
 * Generate and store invoice PDF
 */
async function generateAndStorePDF(invoice: any, organizationId: string): Promise<{ path: string; hash: string; size: number }> {
  // Get organization settings for payment terms
  const orgSettings = await prisma.organizationSettings.findFirst({
    where: {
      organizationId,
      category: "ACCOUNTING",
    },
  })

  // Convert invoice to PDF data format
  const { convertInvoiceToPDFData } = await import("@/lib/pdf/invoice-helpers")
  const pdfData = await convertInvoiceToPDFData(invoice, orgSettings)

  // Generate PDF
  const { generateInvoicePDF, generatePDFHash } = await import("@/lib/pdf/invoice")
  const pdfBuffer = await generateInvoicePDF(pdfData)
  const contentHash = generatePDFHash(pdfBuffer)

  // Store PDF in storage with content hash
  const { createStorageService } = await import("@/lib/storage")
  const storage = createStorageService()

  const pdfPath = `invoices/${organizationId}/${invoice.id}/${contentHash}.pdf`
  
  await storage.put(pdfBuffer, pdfPath, {
    contentType: 'application/pdf',
    size: pdfBuffer.length,
  })

  // Store PDF metadata in invoice metadata
  const metadata = (invoice.metadata as any) || {}
  const pdfMetadata = {
    path: pdfPath,
    hash: contentHash,
    size: pdfBuffer.length,
    generatedAt: new Date().toISOString(),
  }

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      metadata: {
        ...metadata,
        pdf: pdfMetadata,
      },
    },
  })

  return {
    path: pdfPath,
    hash: contentHash,
    size: pdfBuffer.length,
  }
}

/**
 * Calculate invoice balance (total - payments - credit notes)
 */
async function calculateInvoiceBalance(invoiceId: string, organizationId: string): Promise<Decimal> {
  // Get invoice
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  })

  if (!invoice) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Invoice not found",
    })
  }

  const invoiceTotal = new Decimal(invoice.total.toString())

  // Get payments from metadata
  const metadata = (invoice.metadata as any) || {}
  const payments = metadata.payments || []
  const totalPaid = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0)

  // Get credit notes applied to this invoice
  const creditNotes = await prisma.creditNote.findMany({
    where: {
      organizationId,
      status: { in: ["APPLIED", "SENT"] },
    },
  })

  const creditNotesApplied = creditNotes.reduce((sum, cn) => {
    const cnMetadata = cn.metadata as any || {}
    const cnApplications = cnMetadata.applications || []
    const cnAppliedToThisInvoice = cnApplications
      .filter((app: any) => app.invoiceId === invoiceId)
      .reduce((s: number, app: any) => s + (app.amount || 0), 0)
    return sum.plus(new Decimal(cnAppliedToThisInvoice))
  }, new Decimal(0))

  // Balance = total - payments - credit notes
  const balance = invoiceTotal.minus(new Decimal(totalPaid)).minus(creditNotesApplied)

  return balance
}

/**
 * Get AR (Accounts Receivable) control account
 */
async function getARAccount(organizationId: string) {
  // Try to find AR account by code (common codes: 1200, 1300, 12000)
  const arAccount = await prisma.chartOfAccount.findFirst({
    where: {
      organizationId,
      type: "ASSET",
      code: { in: ["1200", "1300", "12000"] },
      isActive: true,
    },
  })

  if (arAccount) {
    return arAccount
  }

  // Fallback: find any ASSET account with "receivable" in name
  const fallbackAccount = await prisma.chartOfAccount.findFirst({
    where: {
      organizationId,
      type: "ASSET",
      name: { contains: "receivable", mode: "insensitive" },
      isActive: true,
    },
  })

  if (!fallbackAccount) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Accounts Receivable control account not found. Please set up chart of accounts.",
    })
  }

  return fallbackAccount
}

export const appRouter = createTRPCRouter({
  // Auth routes
  auth: createTRPCRouter({
    getSession: publicProcedure.query(async ({ ctx }) => {
      return ctx.session
    }),
  }),

  // Organization routes
  organization: createTRPCRouter({
    create: protectedProcedure
      .input(createOrganizationSchema)
      .mutation(async ({ ctx, input }) => {
        const organization = await prisma.organization.create({
          data: {
            ...input,
            creatorId: ctx.session.user.id,
          },
        })

        // Add creator as owner
        await prisma.organizationMember.create({
          data: {
            userId: ctx.session.user.id,
            organizationId: organization.id,
            role: "OWNER",
          },
        })

        return organization
      }),

    getBySlug: protectedProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ ctx, input }) => {
        const organization = await prisma.organization.findUnique({
          where: { slug: input.slug },
          include: {
            members: {
              include: {
                user: true,
              },
            },
          },
        })

        if (!organization) {
          throw new Error("Organization not found")
        }

        // Check if user is member
        const isMember = organization.members.some(
          (member) => member.userId === ctx.session.user.id
        )

        if (!isMember) {
          throw new Error("Unauthorized")
        }

        return organization
      }),

    getUserOrganizations: protectedProcedure.query(async ({ ctx }) => {
      const memberships = await prisma.organizationMember.findMany({
        where: { userId: ctx.session.user.id },
        include: {
          organization: true,
        },
      })

      return memberships.map((membership) => membership.organization)
    }),
  }),

  // Chart of Accounts routes
  chartOfAccounts: createTRPCRouter({
    getAll: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.CHART_OF_ACCOUNTS_VIEW))
      .input(z.object({ organizationId: z.string() }))
      .query(async ({ ctx, input }) => {
        return await prisma.chartOfAccount.findMany({
          where: {
            organizationId: ctx.organizationId,
            isActive: true,
          },
          include: {
            parent: true,
            children: true,
          },
          orderBy: { code: "asc" },
        })
      }),

    create: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.CHART_OF_ACCOUNTS_CREATE))
      .input(createChartOfAccountSchema.extend({ organizationId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        // Ensure organizationId matches the verified one
        return await prisma.chartOfAccount.create({
          data: {
            ...input,
            organizationId: ctx.organizationId,
          },
        })
      }),

    update: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.CHART_OF_ACCOUNTS_EDIT))
      .input(z.object({
        id: z.string(),
        organizationId: z.string(),
        data: createChartOfAccountSchema.partial(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify resource ownership
        await verifyResourceOwnership("chartOfAccount", input.id, ctx.organizationId)
        
        return await prisma.chartOfAccount.update({
          where: { id: input.id },
          data: input.data,
        })
      }),

    delete: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.CHART_OF_ACCOUNTS_DELETE))
      .input(z.object({ id: z.string(), organizationId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        // Verify resource ownership
        await verifyResourceOwnership("chartOfAccount", input.id, ctx.organizationId)
        
        return await prisma.chartOfAccount.update({
          where: { id: input.id },
          data: { isActive: false },
        })
      }),
  }),

  // Transaction routes
  transactions: createTRPCRouter({
    getAll: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.TRANSACTIONS_VIEW))
      .input(z.object({
        organizationId: z.string(),
        ...paginationSchema.shape,
        accountId: z.string().optional(),
        startDate: z.union([z.date(), z.string()]).optional(),
        endDate: z.union([z.date(), z.string()]).optional(),
      }))
      .query(async ({ ctx, input }) => {
        const { page, limit, sortBy, sortOrder, accountId, startDate, endDate } = input

        const where: any = {
          organizationId: ctx.organizationId,
        }

        if (accountId) {
          where.accountId = accountId
        }

        if (startDate || endDate) {
          where.date = {}
          if (startDate) {
            const start = typeof startDate === 'string' ? new Date(startDate) : startDate
            where.date.gte = start
          }
          if (endDate) {
            const end = typeof endDate === 'string' ? new Date(endDate) : endDate
            // Set to end of day for inclusive end date
            end.setHours(23, 59, 59, 999)
            where.date.lte = end
          }
        }

        const [transactions, total] = await Promise.all([
          prisma.transaction.findMany({
            where,
            include: {
              account: true,
            },
            orderBy: sortBy ? { [sortBy]: sortOrder } : { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.transaction.count({ where }),
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

    create: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.TRANSACTIONS_CREATE))
      .input(createTransactionSchema.extend({ organizationId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await prisma.transaction.create({
          data: {
            ...input,
            organizationId: ctx.organizationId,
          },
        })
      }),

    getById: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.TRANSACTIONS_VIEW))
      .input(z.object({
        id: z.string(),
        organizationId: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        const transaction = await prisma.transaction.findUnique({
          where: {
            id: input.id,
            organizationId: ctx.organizationId,
          },
          include: {
            account: true,
          },
        })

        if (!transaction) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Transaction not found",
          })
        }

        // Get related transactions (same reference/description/date for journal entries)
        const relatedTransactions = await prisma.transaction.findMany({
          where: {
            organizationId: ctx.organizationId,
            reference: transaction.reference || undefined,
            description: transaction.description,
            date: transaction.date,
            id: { not: transaction.id },
          },
          include: {
            account: true,
          },
          orderBy: { createdAt: "asc" },
        })

        return {
          transaction,
          relatedTransactions,
        }
      }),

    getJournalEntries: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.TRANSACTIONS_VIEW))
      .input(z.object({
        organizationId: z.string(),
        ...paginationSchema.shape,
        startDate: z.union([z.date(), z.string()]).optional(),
        endDate: z.union([z.date(), z.string()]).optional(),
        accountId: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const { page, limit, sortBy, sortOrder, startDate, endDate, accountId } = input

        const where: any = {
          organizationId: ctx.organizationId,
          reference: { not: null }, // Journal entries typically have a reference
        }

        if (accountId) {
          where.accountId = accountId
        }

        if (startDate || endDate) {
          where.date = {}
          if (startDate) {
            const start = typeof startDate === 'string' ? new Date(startDate) : startDate
            where.date.gte = start
          }
          if (endDate) {
            const end = typeof endDate === 'string' ? new Date(endDate) : endDate
            end.setHours(23, 59, 59, 999)
            where.date.lte = end
          }
        }

        const transactions = await prisma.transaction.findMany({
          where,
          include: {
            account: true,
          },
          orderBy: sortBy ? { [sortBy]: sortOrder } : { date: "desc", createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        })

        // Group transactions by journal (same reference/description/date)
        const journalMap = new Map<string, typeof transactions>()
        transactions.forEach((tx) => {
          const journalKey = `${tx.reference || tx.description}-${tx.date.toISOString()}`
          if (!journalMap.has(journalKey)) {
            journalMap.set(journalKey, [])
          }
          journalMap.get(journalKey)!.push(tx)
        })

        const journals = Array.from(journalMap.entries()).map(([key, txs]) => ({
          id: key,
          reference: txs[0]?.reference || null,
          description: txs[0]?.description || "",
          date: txs[0]?.date,
          transactions: txs,
          totalDebits: txs.reduce((sum, tx) => sum + Number(tx.debit), 0),
          totalCredits: txs.reduce((sum, tx) => sum + Number(tx.credit), 0),
        }))

        // Get total count of unique journals
        const totalJournals = await prisma.transaction.groupBy({
          by: ['reference', 'description', 'date'],
          where: {
            organizationId: ctx.organizationId,
            reference: { not: null },
            ...(startDate || endDate ? {
              date: {
                ...(startDate ? { gte: typeof startDate === 'string' ? new Date(startDate) : startDate } : {}),
                ...(endDate ? { lte: (() => {
                  const end = typeof endDate === 'string' ? new Date(endDate) : endDate
                  end.setHours(23, 59, 59, 999)
                  return end
                })() } : {}),
              }
            } : {}),
          },
          _count: true,
        })

        return {
          journals,
          pagination: {
            page,
            limit,
            total: totalJournals.length,
            pages: Math.ceil(totalJournals.length / limit),
          },
        }
      }),

    createDoubleEntry: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.TRANSACTIONS_CREATE))
      .input(z.object({
        organizationId: z.string(),
        date: z.union([z.date(), z.string()]),
        description: z.string().min(1, "Description is required"),
        reference: z.string().optional(),
        entries: z.array(z.object({
          accountId: z.string(),
          debit: z.number().min(0),
          credit: z.number().min(0),
          description: z.string().optional(),
          tracking: z.any().optional(), // Tracking/dimension data
        })).min(2, "At least 2 entries required for double-entry"),
        currency: z.string().default("GBP"),
        exchangeRate: z.number().default(1),
        metadata: z.any().optional(), // For file attachments, etc.
      }))
      .mutation(async ({ ctx, input }) => {
        const { entries, date, ...transactionData } = input
        const transactionDate = typeof date === 'string' ? new Date(date) : date

        // Validate double-entry (total debits = total credits)
        const totalDebits = entries.reduce((sum, entry) => sum + entry.debit, 0)
        const totalCredits = entries.reduce((sum, entry) => sum + entry.credit, 0)

        if (Math.abs(totalDebits - totalCredits) > 0.01) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Total debits (${totalDebits.toFixed(2)}) must equal total credits (${totalCredits.toFixed(2)})`,
          })
        }

        // Validate each entry has either debit or credit, not both
        for (const entry of entries) {
          if (entry.debit > 0 && entry.credit > 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Each entry must have either a debit or credit, not both",
            })
          }
          if (entry.debit === 0 && entry.credit === 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Each entry must have either a debit or credit amount",
            })
          }
        }

        // Create transactions with verified organizationId
        const transactions = await Promise.all(
          entries.map((entry) => {
            const { tracking, ...entryData } = entry
            return prisma.transaction.create({
              data: {
                ...transactionData,
                date: transactionDate,
                ...entryData,
                organizationId: ctx.organizationId,
                metadata: {
                  ...(transactionData.metadata || {}),
                  ...(entry.description ? { lineDescription: entry.description } : {}),
                  ...(tracking ? { tracking } : {}),
                },
              },
              include: {
                account: true,
              },
            })
          })
        )

        // Record audit
        await recordAudit({
          entity: "transaction",
          entityId: transactions[0]?.id || "unknown",
          action: "create",
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          details: `Created journal entry with ${transactions.length} lines`,
        })

        return transactions
      }),
  }),

  // Customer routes
  customers: createTRPCRouter({
    getAll: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.CUSTOMERS_VIEW))
      .input(z.object({
        organizationId: z.string(),
        search: z.string().optional(),
        isActive: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
        ...paginationSchema.shape,
      }))
      .query(async ({ ctx, input }) => {
        const { page, limit, sortBy, sortOrder, search, isActive, tags } = input

        const where: any = {
          organizationId: ctx.organizationId,
          deletedAt: null, // Exclude soft-deleted
        }

        if (isActive !== undefined) {
          where.isActive = isActive
        }

        if (search) {
          where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
            { taxId: { contains: search, mode: "insensitive" } },
          ]
        }

        if (tags && tags.length > 0) {
          where.tags = { hasEvery: tags }
        }

        const [customers, total] = await Promise.all([
          prisma.customer.findMany({
            where,
            orderBy: sortBy ? { [sortBy]: sortOrder } : { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
            include: {
              _count: {
                select: { invoices: true },
              },
            },
          }),
          prisma.customer.count({ where }),
        ])

        return {
          customers,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        }
      }),

    getById: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.CUSTOMERS_VIEW))
      .input(z.object({
        id: z.string(),
        organizationId: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        const customer = await prisma.customer.findUnique({
          where: {
            id: input.id,
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
          include: {
            _count: {
              select: { invoices: true },
            },
          },
        })

        if (!customer) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Customer not found",
          })
        }

        return customer
      }),

    getInvoices: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.CUSTOMERS_VIEW))
      .input(z.object({
        customerId: z.string(),
        organizationId: z.string(),
        ...paginationSchema.shape,
      }))
      .query(async ({ ctx, input }) => {
        const { customerId, page, limit, sortBy, sortOrder } = input

        // Verify customer belongs to organization
        const customer = await prisma.customer.findUnique({
          where: {
            id: customerId,
            organizationId: ctx.organizationId,
          },
        })

        if (!customer) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Customer not found",
          })
        }

        const [invoices, total] = await Promise.all([
          prisma.invoice.findMany({
            where: {
              customerId,
              organizationId: ctx.organizationId,
            },
            orderBy: sortBy ? { [sortBy]: sortOrder } : { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
            include: {
              customer: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          }),
          prisma.invoice.count({
            where: {
              customerId,
              organizationId: ctx.organizationId,
            },
          }),
        ])

        return {
          invoices,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        }
      }),

    create: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.CUSTOMERS_CREATE))
      .input(createCustomerSchema.extend({ organizationId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await prisma.customer.create({
          data: {
            ...input,
            organizationId: ctx.organizationId,
          },
        })
      }),

    update: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.CUSTOMERS_EDIT))
      .input(z.object({
        id: z.string(),
        organizationId: z.string(),
        data: createCustomerSchema.partial(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify resource ownership
        await verifyResourceOwnership("customer", input.id, ctx.organizationId)
        
        return await prisma.customer.update({
          where: { id: input.id },
          data: input.data,
        })
      }),

    delete: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.CUSTOMERS_DELETE))
      .input(z.object({ id: z.string(), organizationId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        // Verify resource ownership
        await verifyResourceOwnership("customer", input.id, ctx.organizationId)
        
        return await prisma.customer.update({
          where: { id: input.id },
          data: { isActive: false },
        })
      }),
  }),

  // Invoice routes
  invoices: createTRPCRouter({
    getAll: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.INVOICES_VIEW))
      .input(z.object({
        organizationId: z.string(),
        ...paginationSchema.shape,
        status: z.enum(["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"]).optional(),
      }))
      .query(async ({ ctx, input }) => {
        const { page, limit, sortBy, sortOrder, status } = input

        const where: any = { organizationId: ctx.organizationId }
        if (status) where.status = status

        const [invoices, total] = await Promise.all([
          prisma.invoice.findMany({
            where,
            include: {
              customer: true,
              items: true,
            },
            orderBy: sortBy ? { [sortBy]: sortOrder } : { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.invoice.count({ where }),
        ])

        return {
          invoices,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        }
      }),

    create: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.INVOICES_CREATE))
      .input(createInvoiceSchema.extend({ organizationId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const { items, ...invoiceData } = input

        // Generate invoice number
        const lastInvoice = await prisma.invoice.findFirst({
          where: { organizationId: ctx.organizationId },
          orderBy: { createdAt: "desc" },
        })

        const sequence = lastInvoice ? parseInt(lastInvoice.invoiceNumber.split("-").pop() || "0") + 1 : 1
        const invoiceNumber = generateInvoiceNumber("INV", sequence)

        // Calculate totals
        const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
        const taxAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice * item.taxRate / 100), 0)
        const total = subtotal + taxAmount

        const invoice = await prisma.invoice.create({
          data: {
            ...invoiceData,
            organizationId: ctx.organizationId,
            invoiceNumber,
            subtotal,
            taxAmount,
            total,
            attachments: invoiceData.attachments
              ? JSON.parse(JSON.stringify(invoiceData.attachments))
              : null,
            items: {
              create: items.map((item) => ({
                ...item,
                total: item.quantity * item.unitPrice,
              })),
            },
          },
          include: {
            items: true,
            customer: true,
          },
        })

        return invoice
      }),

    update: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.INVOICES_EDIT))
      .input(z.object({
        id: z.string(),
        organizationId: z.string(),
        data: createInvoiceSchema.partial().extend({
          items: z.array(z.object({
            description: z.string(),
            quantity: z.number(),
            unitPrice: z.number(),
            taxRate: z.number(),
          })).optional(),
        }),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, data } = input
        
        // Verify resource ownership
        await verifyResourceOwnership("invoice", id, ctx.organizationId)

        if (data.items) {
          // Delete existing items and create new ones
          await prisma.invoiceItem.deleteMany({
            where: { invoiceId: id },
          })

          const subtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
          const taxAmount = data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice * item.taxRate / 100), 0)
          const total = subtotal + taxAmount

          // Handle attachments if provided
          const updateDataWithItems: any = {
            ...data,
            subtotal,
            taxAmount,
            total,
            items: {
              create: data.items.map((item) => ({
                ...item,
                total: item.quantity * item.unitPrice,
              })),
            },
          }
          if (data.attachments !== undefined) {
            updateDataWithItems.attachments = data.attachments
              ? JSON.parse(JSON.stringify(data.attachments))
              : null
          }

          const invoice = await prisma.invoice.update({
            where: { id },
            data: updateDataWithItems,
            include: {
              items: true,
              customer: true,
            },
          })

          return invoice
        }

        // Handle attachments if provided
        const updateData: any = { ...data }
        if (data.attachments !== undefined) {
          updateData.attachments = data.attachments
            ? JSON.parse(JSON.stringify(data.attachments))
            : null
        }

        return await prisma.invoice.update({
          where: { id },
          data: updateData,
          include: {
            items: true,
            customer: true,
          },
        })
      }),

    delete: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.INVOICES_DELETE))
      .input(z.object({ id: z.string(), organizationId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        // Verify resource ownership
        await verifyResourceOwnership("invoice", input.id, ctx.organizationId)
        
        return await prisma.invoice.update({
          where: { id: input.id },
          data: { status: "CANCELLED" },
        })
      }),

    /**
     * Get outstanding invoices (unpaid or partially paid)
     */
    getOutstanding: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.INVOICES_VIEW))
      .input(z.object({
        organizationId: z.string(),
        ...paginationSchema.shape,
        customerId: z.string().optional(),
        daysOverdue: z.number().optional(), // Filter by days overdue
      }))
      .query(async ({ ctx, input }) => {
        const { page, limit, sortBy, sortOrder, customerId, daysOverdue } = input

        const where: any = {
          organizationId: ctx.organizationId,
          status: {
            notIn: ["PAID", "CANCELLED"],
          },
        }

        if (customerId) {
          where.customerId = customerId
        }

        if (daysOverdue !== undefined) {
          const thresholdDate = new Date()
          thresholdDate.setDate(thresholdDate.getDate() - daysOverdue)
          where.dueDate = { lte: thresholdDate }
        }

        const [invoices, total] = await Promise.all([
          prisma.invoice.findMany({
            where,
            include: {
              customer: true,
              items: true,
            },
            orderBy: sortBy ? { [sortBy]: sortOrder } : { dueDate: "asc" },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.invoice.count({ where }),
        ])

        // Calculate balances for each invoice
        const invoicesWithBalance = await Promise.all(
          invoices.map(async (invoice) => {
            const balance = await calculateInvoiceBalance(invoice.id, ctx.organizationId)
            return {
              ...invoice,
              balance: balance.toNumber(),
              isFullyPaid: balance.lessThanOrEqualTo(0),
            }
          })
        )

        return {
          invoices: invoicesWithBalance,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        }
      }),

    /**
     * Record payment against invoice
     * Creates transaction (DR Bank, CR AR) and updates invoice balance
     */
    recordPayment: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.INVOICES_EDIT))
      .input(z.object({
        id: z.string().min(1, "Invoice ID is required"),
        organizationId: z.string().min(1),
        amount: z.number().min(0.01, "Amount must be greater than 0"),
        paymentDate: z.date(),
        bankAccountId: z.string().min(1, "Bank account ID is required"),
        reference: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, amount, paymentDate, bankAccountId, reference, notes } = input

        // Verify resource ownership
        await verifyResourceOwnership("invoice", id, ctx.organizationId)

        // Get invoice
        const invoice = await prisma.invoice.findUnique({
          where: { id },
          include: { customer: true },
        })

        if (!invoice) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Invoice not found",
          })
        }

        // Cannot record payment for cancelled invoice
        if (invoice.status === "CANCELLED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot record payment for cancelled invoice",
          })
        }

        // Calculate current balance
        const currentBalance = await calculateInvoiceBalance(id, ctx.organizationId)

        // Check if payment exceeds balance (allow overpayment for on-account credit)
        const paymentAmount = new Decimal(amount)
        const newBalance = currentBalance.minus(paymentAmount)

        // Get accounts for posting
        const arAccount = await getARAccount(ctx.organizationId)
        
        // Find bank account in chart of accounts
        let bankAccountForPosting = await prisma.chartOfAccount.findFirst({
          where: {
            organizationId: ctx.organizationId,
            type: "ASSET",
            code: { in: ["1000", "1010", "1100", "10000", "10100"] },
            isActive: true,
          },
        })

        if (!bankAccountForPosting) {
          bankAccountForPosting = await prisma.chartOfAccount.findFirst({
            where: {
              organizationId: ctx.organizationId,
              type: "ASSET",
              OR: [
                { name: { contains: "bank", mode: "insensitive" } },
                { name: { contains: "cash", mode: "insensitive" } },
              ],
              isActive: true,
            },
          })
        }

        if (!bankAccountForPosting) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Bank account (chart of accounts) not found",
          })
        }

        // Create transaction and update invoice in one transaction
        const result = await prisma.$transaction(async (tx) => {
          // Post double-entry: DR Bank, CR AR
          const { postDoubleEntry } = await import("@/lib/posting")
          const postingResult = await postDoubleEntry({
            date: typeof paymentDate === "string" ? new Date(paymentDate) : paymentDate,
            lines: [
              {
                accountId: bankAccountForPosting.id,
                debit: paymentAmount.toNumber(),
                credit: 0,
                description: `Payment received for invoice ${invoice.invoiceNumber}`,
                reference: reference || invoice.invoiceNumber,
              },
              {
                accountId: arAccount.id,
                debit: 0,
                credit: paymentAmount.toNumber(),
                description: `Payment received for invoice ${invoice.invoiceNumber}`,
                reference: reference || invoice.invoiceNumber,
              },
            ],
            docRef: invoice.invoiceNumber,
            currency: invoice.currency,
            rate: 1.0,
            orgId: ctx.organizationId,
            userId: ctx.session.user.id,
            description: `Invoice payment: ${invoice.invoiceNumber}`,
            metadata: {
              invoiceId: id,
              customerId: invoice.customerId,
              paymentAmount: paymentAmount.toNumber(),
              bankAccountId,
            },
          })

          // Update invoice metadata with payment record
          const metadata = (invoice.metadata as any) || {}
          const payments = metadata.payments || []
          payments.push({
            amount: paymentAmount.toNumber(),
            date: (typeof paymentDate === "string" ? new Date(paymentDate) : paymentDate).toISOString(),
            reference: reference || undefined,
            notes: notes || undefined,
            transactionId: postingResult.transactionIds?.[0] || postingResult.journalId || "",
            createdAt: new Date().toISOString(),
          })

          // Update invoice status based on new balance
          let newStatus = invoice.status
          if (newBalance.lessThanOrEqualTo(0)) {
            newStatus = "PAID"
          } else if (newBalance.lessThan(currentBalance) && currentBalance.greaterThan(0)) {
            // Partial payment - keep as SENT (since PART_PAID doesn't exist)
            newStatus = "SENT"
          }

          const updatedInvoice = await tx.invoice.update({
            where: { id },
            data: {
              status: newStatus,
              metadata: {
                ...metadata,
                payments,
                lastPaymentDate: (typeof paymentDate === "string" ? new Date(paymentDate) : paymentDate).toISOString(),
                totalPaid: (metadata.totalPaid || 0) + paymentAmount.toNumber(),
                balance: newBalance.toNumber(),
                onAccountCredit: newBalance.lessThan(0) ? Math.abs(newBalance.toNumber()) : 0,
              },
            },
            include: {
              customer: true,
              items: true,
            },
          })

          return {
            invoice: updatedInvoice,
            payment: {
              amount: paymentAmount.toNumber(),
              date: typeof paymentDate === "string" ? new Date(paymentDate) : paymentDate,
              reference,
              balance: newBalance.toNumber(),
            },
            transaction: postingResult,
          }
        })

        // Record audit
        await recordAudit({
          entity: "invoice",
          entityId: id,
          action: "recordPayment",
          before: invoice,
          after: result.invoice,
          organizationId: ctx.organizationId,
          userId: ctx.session.user.id,
          meta: {
            paymentAmount: amount,
            reference,
          },
        }).catch((error) => {
          console.warn("Audit recording failed", { error, invoiceId: id })
        })

        return result
      }),

    /**
     * Mark invoice as paid
     * Only allowed if balance is zero
     */
    markAsPaid: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.INVOICES_EDIT))
      .input(z.object({
        id: z.string().min(1),
        organizationId: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify resource ownership
        await verifyResourceOwnership("invoice", input.id, ctx.organizationId)

        // Get invoice
        const invoice = await prisma.invoice.findUnique({
          where: { id: input.id },
        })

        if (!invoice) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Invoice not found",
          })
        }

        // Calculate balance
        const balance = await calculateInvoiceBalance(input.id, ctx.organizationId)

        // Prevent marking paid with non-zero balance
        if (balance.greaterThan(0)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Cannot mark invoice as paid. Outstanding balance: ${balance.toFixed(2)} ${invoice.currency}`,
          })
        }

        // Update status
        const updatedInvoice = await prisma.invoice.update({
          where: { id: input.id },
          data: { status: "PAID" },
          include: {
            customer: true,
            items: true,
          },
        })

        // Record audit
        await recordAudit({
          entity: "invoice",
          entityId: input.id,
          action: "markAsPaid",
          before: invoice,
          after: updatedInvoice,
          organizationId: ctx.organizationId,
          userId: ctx.session.user.id,
        }).catch((error) => {
          console.warn("Audit recording failed", { error, invoiceId: input.id })
        })

        return updatedInvoice
      }),

    /**
     * Get payment history for an invoice
     */
    getPayments: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.INVOICES_VIEW))
      .input(z.object({
        id: z.string().min(1),
        organizationId: z.string().min(1),
      }))
      .query(async ({ ctx, input }) => {
        // Verify resource ownership
        await verifyResourceOwnership("invoice", input.id, ctx.organizationId)

        // Get invoice
        const invoice = await prisma.invoice.findUnique({
          where: { id: input.id },
        })

        if (!invoice) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Invoice not found",
          })
        }

        // Get payments from metadata
        const metadata = (invoice.metadata as any) || {}
        const payments = metadata.payments || []

        // Also get transactions linked to this invoice
        const transactions = await prisma.transaction.findMany({
          where: {
            organizationId: ctx.organizationId,
            metadata: {
              path: ["invoiceId"],
              equals: input.id,
            },
          },
          include: {
            account: true,
          },
          orderBy: {
            date: "desc",
          },
        })

        // Calculate totals
        const totalPaid = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0)
        const balance = await calculateInvoiceBalance(input.id, ctx.organizationId)

        return {
          payments,
          transactions,
          totalPaid,
          invoiceTotal: invoice.total.toNumber(),
          balance: balance.toNumber(),
          currency: invoice.currency,
        }
      }),

    /**
     * Duplicate an invoice
     * Copies header and lines, generates new number, sets status to DRAFT
     */
    duplicate: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.INVOICES_CREATE))
      .input(z.object({
        id: z.string().min(1),
        organizationId: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify resource ownership
        await verifyResourceOwnership("invoice", input.id, ctx.organizationId)

        // Get original invoice
        const originalInvoice = await prisma.invoice.findUnique({
          where: { id: input.id },
          include: {
            items: true,
            customer: true,
          },
        })

        if (!originalInvoice) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Invoice not found",
          })
        }

        // Generate new invoice number
        const lastInvoice = await prisma.invoice.findFirst({
          where: { organizationId: ctx.organizationId },
          orderBy: { createdAt: "desc" },
        })

        const sequence = lastInvoice ? parseInt(lastInvoice.invoiceNumber.split("-").pop() || "0") + 1 : 1
        const invoiceNumber = generateInvoiceNumber("INV", sequence)

        // Create duplicate invoice (without ledger postings)
        const duplicatedInvoice = await prisma.invoice.create({
          data: {
            organizationId: ctx.organizationId,
            customerId: originalInvoice.customerId,
            invoiceNumber,
            date: new Date(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            status: "DRAFT",
            subtotal: originalInvoice.subtotal,
            taxAmount: originalInvoice.taxAmount,
            total: originalInvoice.total,
            currency: originalInvoice.currency,
            notes: originalInvoice.notes,
            // Don't copy metadata (payments, etc.)
            items: {
              create: originalInvoice.items.map((item) => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: item.total,
                taxRate: item.taxRate,
              })),
            },
          },
          include: {
            items: true,
            customer: true,
          },
        })

        // Record audit
        await recordAudit({
          entity: "invoice",
          entityId: duplicatedInvoice.id,
          action: "duplicate",
          after: duplicatedInvoice,
          organizationId: ctx.organizationId,
          userId: ctx.session.user.id,
          meta: {
            originalInvoiceId: input.id,
            originalInvoiceNumber: originalInvoice.invoiceNumber,
          },
        }).catch((error) => {
          console.warn("Audit recording failed", { error, invoiceId: duplicatedInvoice.id })
        })

        return duplicatedInvoice
      }),

    /**
     * Export invoice as PDF
     * Generates PDF, stores it, and returns download URL
     */
    exportPDF: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.INVOICES_VIEW))
      .input(z.object({
        id: z.string().min(1),
        organizationId: z.string().min(1),
      }))
      .query(async ({ ctx, input }) => {
        // Verify resource ownership
        await verifyResourceOwnership("invoice", input.id, ctx.organizationId)

        // Get invoice with all related data
        const invoice = await prisma.invoice.findUnique({
          where: { id: input.id },
          include: {
            customer: true,
            items: true,
            organization: true,
          },
        })

        if (!invoice) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Invoice not found",
          })
        }

        // Check if PDF already exists in metadata
        const metadata = (invoice.metadata as any) || {}
        const existingPdf = metadata.pdf

        let pdfPath: string
        let contentHash: string
        let pdfSize: number

        if (existingPdf?.path && existingPdf?.hash) {
          // Check if PDF exists in storage
          const { createStorageService } = await import("@/lib/storage")
          const storage = createStorageService()
          
          try {
            const exists = await storage.exists(existingPdf.path)
            if (exists) {
              // Reuse existing PDF
              pdfPath = existingPdf.path
              contentHash = existingPdf.hash
              pdfSize = existingPdf.size || 0
            } else {
              // PDF metadata exists but file is missing, regenerate
              const result = await generateAndStorePDF(invoice, ctx.organizationId)
              pdfPath = result.path
              contentHash = result.hash
              pdfSize = result.size
            }
          } catch (error) {
            // Error checking storage, regenerate
            const result = await generateAndStorePDF(invoice, ctx.organizationId)
            pdfPath = result.path
            contentHash = result.hash
            pdfSize = result.size
          }
        } else {
          // Generate new PDF
          const result = await generateAndStorePDF(invoice, ctx.organizationId)
          pdfPath = result.path
          contentHash = result.hash
          pdfSize = result.size
        }

        // Generate signed URL for download
        const { createStorageService } = await import("@/lib/storage")
        const storage = createStorageService()
        const signedUrl = await storage.getSignedUrl(pdfPath, 3600) // 1 hour expiry

        return {
          pdfUrl: signedUrl,
          pdfPath,
          contentHash,
          size: pdfSize,
        }
      }),
  }),

  // Bank Account routes
  bankAccounts: bankAccountsRouter,

  // Hello router (sample implementation demonstrating all DoD criteria)
  hello: helloRouter,

  // Vendors routes
  vendors: vendorsRouter,

  // Bills routes
  bills: billsRouter,

  // Payments routes
  payments: paymentsRouter,

  // Payment Runs routes
  paymentRuns: paymentRunsRouter,

  // Credit Notes routes
  creditNotes: creditNotesRouter,

  // Debit Notes routes
  debitNotes: debitNotesRouter,

  // Bill Amendments routes
  billAmendments: billAmendmentsRouter,

  // Invoice Reminders routes
  invoiceReminders: invoiceRemindersRouter,

  // Email routes
  emails: emailsRouter,

  // Reports routes
  reports: reportsRouter,

  // Settings routes
  settings: settingsRouter,

  // Payroll routes
  payroll: payrollRouter,

  // AI routes
  ai: aiRouter,

  // Dashboard routes
  dashboard: createTRPCRouter({
    getStats: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.ORGANIZATION_VIEW))
      .input(z.object({ organizationId: z.string() }))
      .query(async ({ ctx, input }) => {
        const organizationId = ctx.organizationId

        // Get date range for current month
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

        // Get revenue accounts
        const revenueAccounts = await prisma.chartOfAccount.findMany({
          where: {
            organizationId: ctx.organizationId,
            type: "REVENUE",
            isActive: true,
          },
        })

        // Get expense accounts
        const expenseAccounts = await prisma.chartOfAccount.findMany({
          where: {
            organizationId: ctx.organizationId,
            type: "EXPENSE",
            isActive: true,
          },
        })

        // Calculate totals
        const [totalRevenue, totalExpenses, bankBalances, outstandingInvoices, overdueInvoices] = await Promise.all([
          // Total revenue for current month
          prisma.transaction.aggregate({
            where: {
              organizationId: ctx.organizationId,
              accountId: { in: revenueAccounts.map(acc => acc.id) },
              date: { gte: startOfMonth, lte: endOfMonth },
            },
            _sum: { credit: true },
          }),

          // Total expenses for current month
          prisma.transaction.aggregate({
            where: {
              organizationId: ctx.organizationId,
              accountId: { in: expenseAccounts.map(acc => acc.id) },
              date: { gte: startOfMonth, lte: endOfMonth },
            },
            _sum: { debit: true },
          }),

          // Bank balances
          prisma.bankAccount.findMany({
            where: {
              organizationId: ctx.organizationId,
              isActive: true,
            },
            select: {
              name: true,
              currentBalance: true,
              currency: true,
            },
          }),

          // Outstanding invoices
          prisma.invoice.count({
            where: {
              organizationId: ctx.organizationId,
              status: { in: ["SENT", "OVERDUE"] },
            },
          }),

          // Overdue invoices
          prisma.invoice.count({
            where: {
              organizationId: ctx.organizationId,
              status: "OVERDUE",
              dueDate: { lt: now },
            },
          }),
        ])

        const netProfit = (totalRevenue._sum.credit || 0) - (totalExpenses._sum.debit || 0)
        const cashPosition = bankBalances.reduce((sum, account) => sum + account.currentBalance, 0)

        return {
          totalRevenue: totalRevenue._sum.credit || 0,
          totalExpenses: totalExpenses._sum.debit || 0,
          netProfit,
          cashPosition,
          outstandingInvoices,
          overdueInvoices,
          bankBalances,
        }
      }),
  }),
})

export type AppRouter = typeof appRouter
