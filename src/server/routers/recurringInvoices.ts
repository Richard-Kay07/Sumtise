import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { generateInvoiceNumber } from "@/lib/utils"

const frequencyEnum = z.enum(["WEEKLY", "FORTNIGHTLY", "MONTHLY", "QUARTERLY", "ANNUALLY"])
const statusEnum    = z.enum(["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"])

const itemSchema = z.object({
  description: z.string().min(1),
  quantity:    z.string(),
  unitPrice:   z.string(),
  taxRate:     z.string().default("0"),
})

// ---------------------------------------------------------------------------
// Helper — compute next run date from a base date + frequency
// ---------------------------------------------------------------------------

function advanceDate(date: Date, frequency: string): Date {
  const d = new Date(date)
  switch (frequency) {
    case "WEEKLY":      d.setDate(d.getDate() + 7);    break
    case "FORTNIGHTLY": d.setDate(d.getDate() + 14);   break
    case "MONTHLY":     d.setMonth(d.getMonth() + 1);  break
    case "QUARTERLY":   d.setMonth(d.getMonth() + 3);  break
    case "ANNUALLY":    d.setFullYear(d.getFullYear() + 1); break
  }
  return d
}

// ---------------------------------------------------------------------------
// Helper — generate a single invoice from a template
// ---------------------------------------------------------------------------

async function generateInvoiceFromTemplate(
  templateId: string,
  orgId:       string,
  runDate:     Date
) {
  const template = await prisma.recurringInvoice.findFirst({
    where:   { id: templateId, organizationId: orgId },
    include: { items: true },
  })
  if (!template) throw new TRPCError({ code: "NOT_FOUND" })

  // maxRuns check
  if (template.maxRuns != null && template.runCount >= template.maxRuns) {
    await prisma.recurringInvoice.update({
      where: { id: templateId },
      data:  { status: "COMPLETED" },
    })
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Maximum runs reached." })
  }

  const lastInvoice = await prisma.invoice.findFirst({
    where:   { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    select:  { invoiceNumber: true },
  })
  const seq = lastInvoice
    ? parseInt(lastInvoice.invoiceNumber.split("-").pop() || "0") + 1
    : 1
  const invoiceNumber = generateInvoiceNumber("INV", seq)

  const dueDate = new Date(runDate)
  dueDate.setDate(dueDate.getDate() + (template.paymentTerms ?? 30))

  const invoice = await prisma.invoice.create({
    data: {
      organizationId:    orgId,
      customerId:        template.customerId,
      invoiceNumber,
      date:              runDate,
      dueDate,
      status:            template.autoSend ? "SENT" : "DRAFT",
      subtotal:          template.subtotal,
      taxAmount:         template.taxAmount,
      total:             template.total,
      currency:          template.currency,
      notes:             template.notes,
      recurringInvoiceId: templateId,
      items: {
        create: template.items.map((item) => ({
          description: item.description,
          quantity:    item.quantity.toNumber(),
          unitPrice:   item.unitPrice.toNumber(),
          total:       item.total.toNumber(),
          taxRate:     item.taxRate.toNumber(),
        })),
      },
    },
    include: { items: true, customer: true },
  })

  const nextRun = advanceDate(runDate, template.frequency)
  const isComplete =
    (template.endDate && nextRun > template.endDate) ||
    (template.maxRuns != null && template.runCount + 1 >= template.maxRuns)

  await prisma.recurringInvoice.update({
    where: { id: templateId },
    data: {
      lastRunDate: runDate,
      nextRunDate: nextRun,
      runCount:    { increment: 1 },
      status:      isComplete ? "COMPLETED" : undefined,
    },
  })

  return invoice
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const recurringInvoicesRouter = createTRPCRouter({
  list: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_VIEW))
    .input(z.object({
      organizationId: z.string(),
      status:         statusEnum.optional(),
      customerId:     z.string().optional(),
      page:           z.number().min(1).default(1),
      limit:          z.number().min(1).max(100).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const { status, customerId, page, limit } = input
      const skip  = (page - 1) * limit
      const where: any = { organizationId: ctx.organizationId }
      if (status)     where.status     = status
      if (customerId) where.customerId = customerId

      const [templates, total] = await Promise.all([
        prisma.recurringInvoice.findMany({
          where,
          skip,
          take:    limit,
          orderBy: { nextRunDate: "asc" },
          include: {
            customer:  { select: { id: true, name: true, email: true } },
            _count:    { select: { generatedInvoices: true } },
          },
        }),
        prisma.recurringInvoice.count({ where }),
      ])

      return {
        templates,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }
    }),

  getById: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_VIEW))
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .query(async ({ ctx, input }) => {
      const template = await prisma.recurringInvoice.findFirst({
        where:   { id: input.id, organizationId: ctx.organizationId },
        include: {
          items:             true,
          customer:          { select: { id: true, name: true, email: true } },
          generatedInvoices: {
            orderBy: { date: "desc" },
            take:    10,
            select:  { id: true, invoiceNumber: true, date: true, status: true, total: true },
          },
        },
      })
      if (!template) throw new TRPCError({ code: "NOT_FOUND" })
      return template
    }),

  create: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_CREATE))
    .input(z.object({
      organizationId: z.string(),
      customerId:     z.string(),
      templateName:   z.string().min(1),
      frequency:      frequencyEnum,
      startDate:      z.date(),
      endDate:        z.date().optional(),
      dayOfMonth:     z.number().min(1).max(31).optional(),
      currency:       z.string().default("GBP"),
      notes:          z.string().optional(),
      paymentTerms:   z.number().default(30),
      autoSend:       z.boolean().default(false),
      maxRuns:        z.number().optional(),
      items:          z.array(itemSchema).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const ZERO = new Prisma.Decimal(0)
      const items = input.items.map((i) => {
        const qty   = new Prisma.Decimal(i.quantity)
        const price = new Prisma.Decimal(i.unitPrice)
        const tax   = new Prisma.Decimal(i.taxRate)
        const net   = qty.mul(price)
        const vatAmt = net.mul(tax).div(100)
        return { description: i.description, quantity: qty, unitPrice: price, taxRate: tax, total: net.plus(vatAmt) }
      })
      const subtotal  = items.reduce((s, i) => s.plus(i.quantity.mul(i.unitPrice)), ZERO)
      const taxAmount = items.reduce((s, i) => s.plus(i.quantity.mul(i.unitPrice).mul(i.taxRate).div(100)), ZERO)
      const total     = subtotal.plus(taxAmount)

      return prisma.recurringInvoice.create({
        data: {
          organizationId: ctx.organizationId,
          customerId:     input.customerId,
          templateName:   input.templateName,
          frequency:      input.frequency,
          startDate:      input.startDate,
          endDate:        input.endDate,
          nextRunDate:    input.startDate,
          dayOfMonth:     input.dayOfMonth,
          currency:       input.currency,
          notes:          input.notes,
          paymentTerms:   input.paymentTerms,
          autoSend:       input.autoSend,
          maxRuns:        input.maxRuns,
          subtotal,
          taxAmount,
          total,
          items: {
            create: items.map((i) => ({
              description: i.description,
              quantity:    i.quantity,
              unitPrice:   i.unitPrice,
              taxRate:     i.taxRate,
              total:       i.total,
            })),
          },
        },
        include: { items: true },
      })
    }),

  update: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_EDIT))
    .input(z.object({
      organizationId: z.string(),
      id:             z.string(),
      templateName:   z.string().optional(),
      status:         statusEnum.optional(),
      endDate:        z.date().optional(),
      nextRunDate:    z.date().optional(),
      autoSend:       z.boolean().optional(),
      maxRuns:        z.number().optional(),
      notes:          z.string().optional(),
      paymentTerms:   z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, organizationId: _, ...data } = input
      const template = await prisma.recurringInvoice.findFirst({
        where: { id, organizationId: ctx.organizationId },
      })
      if (!template) throw new TRPCError({ code: "NOT_FOUND" })
      return prisma.recurringInvoice.update({ where: { id }, data })
    }),

  delete: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_DELETE))
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const template = await prisma.recurringInvoice.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
      })
      if (!template) throw new TRPCError({ code: "NOT_FOUND" })
      return prisma.recurringInvoice.update({
        where: { id: input.id },
        data:  { status: "CANCELLED" },
      })
    }),

  // ── Manual trigger / bulk run ─────────────────────────────────────────────

  runNow: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_CREATE))
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return generateInvoiceFromTemplate(input.id, ctx.organizationId, new Date())
    }),

  runDue: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_CREATE))
    .input(z.object({
      organizationId: z.string(),
      asOfDate:       z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const asOf = input.asOfDate ?? new Date()
      const due  = await prisma.recurringInvoice.findMany({
        where: {
          organizationId: ctx.organizationId,
          status:         "ACTIVE",
          nextRunDate:    { lte: asOf },
        },
      })

      const results: { templateId: string; invoiceId: string; invoiceNumber: string }[] = []
      const errors:  { templateId: string; error: string }[] = []

      for (const t of due) {
        try {
          const inv = await generateInvoiceFromTemplate(t.id, ctx.organizationId, t.nextRunDate)
          results.push({ templateId: t.id, invoiceId: inv.id, invoiceNumber: inv.invoiceNumber })
        } catch (err: any) {
          errors.push({ templateId: t.id, error: err.message ?? "Unknown error" })
        }
      }

      return { generated: results.length, results, errors }
    }),

  // ── Preview next invoice ──────────────────────────────────────────────────

  previewNext: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_VIEW))
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .query(async ({ ctx, input }) => {
      const template = await prisma.recurringInvoice.findFirst({
        where:   { id: input.id, organizationId: ctx.organizationId },
        include: { items: true, customer: { select: { id: true, name: true, email: true } } },
      })
      if (!template) throw new TRPCError({ code: "NOT_FOUND" })

      const dueDate = new Date(template.nextRunDate)
      dueDate.setDate(dueDate.getDate() + (template.paymentTerms ?? 30))

      return {
        templateId:   template.id,
        templateName: template.templateName,
        customer:     template.customer,
        nextRunDate:  template.nextRunDate,
        dueDate,
        subtotal:     template.subtotal,
        taxAmount:    template.taxAmount,
        total:        template.total,
        currency:     template.currency,
        items:        template.items,
        autoSend:     template.autoSend,
        runsRemaining: template.maxRuns != null ? template.maxRuns - template.runCount : null,
      }
    }),
})
