import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

const costingMethodEnum   = z.enum(["FIFO", "LIFO", "WEIGHTED_AVG", "STANDARD"])
const movementTypeEnum    = z.enum(["PURCHASE", "SALE", "ADJUSTMENT", "TRANSFER", "WRITE_OFF", "RETURN_IN", "RETURN_OUT"])

// ---------------------------------------------------------------------------
// Weighted-average unit cost recalculation helper
// ---------------------------------------------------------------------------

async function recalcWeightedAvgCost(orgId: string, itemId: string): Promise<Prisma.Decimal> {
  const item = await prisma.inventoryItem.findFirst({ where: { id: itemId, organizationId: orgId } })
  if (!item) return new Prisma.Decimal(0)

  if (item.costingMethod !== "WEIGHTED_AVG") return item.unitCost

  const purchases = await prisma.stockMovement.findMany({
    where: { itemId, movementType: { in: ["PURCHASE", "RETURN_IN"] } },
    select: { quantity: true, unitCost: true },
  })

  const ZERO = new Prisma.Decimal(0)
  const totalQty   = purchases.reduce((s, p) => s.plus(p.quantity), ZERO)
  const totalValue = purchases.reduce((s, p) => s.plus(p.quantity.mul(p.unitCost)), ZERO)

  return totalQty.greaterThan(0) ? totalValue.div(totalQty) : item.unitCost
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const inventoryRouter = createTRPCRouter({
  list: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({
      organizationId: z.string(),
      isActive:       z.boolean().optional(),
      category:       z.string().optional(),
      search:         z.string().optional(),
      lowStock:       z.boolean().optional(),
      page:           z.number().min(1).default(1),
      limit:          z.number().min(1).max(100).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const { isActive, category, search, lowStock, page, limit } = input
      const skip  = (page - 1) * limit
      const where: any = {
        organizationId: ctx.organizationId,
        deletedAt:      null,
        ...(isActive !== undefined ? { isActive } : {}),
        ...(category ? { category } : {}),
      }
      if (search) where.OR = [
        { name:    { contains: search, mode: "insensitive" } },
        { sku:     { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
      ]
      if (lowStock) {
        const lowStockIds = await prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM inventory_items
          WHERE organization_id = ${ctx.organizationId}
          AND deleted_at IS NULL
          AND quantity_on_hand <= reorder_level
        `
        where.id = { in: lowStockIds.map((r) => r.id) }
      }

      const [items, total] = await Promise.all([
        prisma.inventoryItem.findMany({
          where,
          skip,
          take:    limit,
          orderBy: { name: "asc" },
        }),
        prisma.inventoryItem.count({ where }),
      ])

      // Flag low-stock items
      const itemsWithFlags = items.map((i) => ({
        ...i,
        isLowStock: i.quantityOnHand.lessThanOrEqualTo(i.reorderLevel),
        stockValue: i.quantityOnHand.mul(i.unitCost),
      }))

      return {
        items: itemsWithFlags,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }
    }),

  getById: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .query(async ({ ctx, input }) => {
      const item = await prisma.inventoryItem.findFirst({
        where:   { id: input.id, organizationId: ctx.organizationId, deletedAt: null },
        include: {
          movements:        { orderBy: { date: "desc" }, take: 50 },
          inventoryAccount: { select: { id: true, code: true, name: true } },
          cogsAccount:      { select: { id: true, code: true, name: true } },
          supplier:         { select: { id: true, name: true } },
        },
      })
      if (!item) throw new TRPCError({ code: "NOT_FOUND" })
      return { ...item, stockValue: item.quantityOnHand.mul(item.unitCost) }
    }),

  create: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_CREATE))
    .input(z.object({
      organizationId:    z.string(),
      sku:               z.string(),
      name:              z.string().min(1),
      description:       z.string().optional(),
      category:          z.string().optional(),
      unitOfMeasure:     z.string().default("EACH"),
      costingMethod:     costingMethodEnum.default("FIFO"),
      unitCost:          z.string().default("0"),
      sellingPrice:      z.string().optional(),
      reorderLevel:      z.string().default("0"),
      reorderQuantity:   z.string().default("0"),
      inventoryAccountId: z.string().optional(),
      cogsAccountId:     z.string().optional(),
      supplierId:        z.string().optional(),
      isSaleable:        z.boolean().default(true),
      isPurchaseable:    z.boolean().default(true),
      taxRate:           z.string().default("0"),
      barcode:           z.string().optional(),
      notes:             z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return prisma.inventoryItem.create({
        data: {
          organizationId:    ctx.organizationId,
          sku:               input.sku,
          name:              input.name,
          description:       input.description,
          category:          input.category,
          unitOfMeasure:     input.unitOfMeasure,
          costingMethod:     input.costingMethod,
          unitCost:          new Prisma.Decimal(input.unitCost),
          sellingPrice:      input.sellingPrice ? new Prisma.Decimal(input.sellingPrice) : undefined,
          reorderLevel:      new Prisma.Decimal(input.reorderLevel),
          reorderQuantity:   new Prisma.Decimal(input.reorderQuantity),
          inventoryAccountId: input.inventoryAccountId,
          cogsAccountId:     input.cogsAccountId,
          supplierId:        input.supplierId,
          isSaleable:        input.isSaleable,
          isPurchaseable:    input.isPurchaseable,
          taxRate:           new Prisma.Decimal(input.taxRate),
          barcode:           input.barcode,
          notes:             input.notes,
        },
      })
    }),

  update: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_EDIT))
    .input(z.object({
      organizationId:    z.string(),
      id:                z.string(),
      name:              z.string().optional(),
      description:       z.string().optional(),
      category:          z.string().optional(),
      unitCost:          z.string().optional(),
      sellingPrice:      z.string().optional(),
      reorderLevel:      z.string().optional(),
      reorderQuantity:   z.string().optional(),
      inventoryAccountId: z.string().optional(),
      cogsAccountId:     z.string().optional(),
      supplierId:        z.string().optional(),
      isActive:          z.boolean().optional(),
      taxRate:           z.string().optional(),
      barcode:           z.string().optional(),
      notes:             z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, organizationId: _, unitCost, sellingPrice, reorderLevel, reorderQuantity, taxRate, ...rest } = input
      const item = await prisma.inventoryItem.findFirst({ where: { id, organizationId: ctx.organizationId, deletedAt: null } })
      if (!item) throw new TRPCError({ code: "NOT_FOUND" })
      return prisma.inventoryItem.update({
        where: { id },
        data:  {
          ...rest,
          ...(unitCost        ? { unitCost:        new Prisma.Decimal(unitCost) }        : {}),
          ...(sellingPrice    ? { sellingPrice:    new Prisma.Decimal(sellingPrice) }    : {}),
          ...(reorderLevel    ? { reorderLevel:    new Prisma.Decimal(reorderLevel) }    : {}),
          ...(reorderQuantity ? { reorderQuantity: new Prisma.Decimal(reorderQuantity) } : {}),
          ...(taxRate         ? { taxRate:         new Prisma.Decimal(taxRate) }         : {}),
        },
      })
    }),

  delete: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_DELETE))
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await prisma.inventoryItem.findFirst({ where: { id: input.id, organizationId: ctx.organizationId, deletedAt: null } })
      if (!item) throw new TRPCError({ code: "NOT_FOUND" })
      return prisma.inventoryItem.update({ where: { id: input.id }, data: { deletedAt: new Date() } })
    }),

  // ── Stock movements ───────────────────────────────────────────────────────

  recordMovement: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_CREATE))
    .input(z.object({
      organizationId: z.string(),
      itemId:         z.string(),
      date:           z.date(),
      movementType:   movementTypeEnum,
      quantity:       z.string(),
      unitCost:       z.string().optional(),
      reference:      z.string().optional(),
      sourceType:     z.string().optional(),
      sourceId:       z.string().optional(),
      transactionId:  z.string().optional(),
      notes:          z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const item = await prisma.inventoryItem.findFirst({
        where: { id: input.itemId, organizationId: ctx.organizationId, deletedAt: null },
      })
      if (!item) throw new TRPCError({ code: "NOT_FOUND" })

      const qty      = new Prisma.Decimal(input.quantity)
      const cost     = input.unitCost ? new Prisma.Decimal(input.unitCost) : item.unitCost
      const total    = qty.mul(cost)

      // Update quantity on hand
      const isInbound  = ["PURCHASE", "RETURN_IN", "ADJUSTMENT"].includes(input.movementType) && qty.greaterThan(0)
      const isOutbound = ["SALE", "RETURN_OUT", "WRITE_OFF"].includes(input.movementType) ||
                         (input.movementType === "ADJUSTMENT" && qty.lessThan(0))

      const qtyDelta = isInbound ? qty.abs() : isOutbound ? qty.abs().negated() : qty

      await prisma.inventoryItem.update({
        where: { id: input.itemId },
        data:  { quantityOnHand: { increment: qtyDelta as any } },
      })

      // Recalculate weighted average cost after purchase
      let newUnitCost = cost
      if (input.movementType === "PURCHASE" && item.costingMethod === "WEIGHTED_AVG") {
        newUnitCost = await recalcWeightedAvgCost(ctx.organizationId, input.itemId)
        await prisma.inventoryItem.update({ where: { id: input.itemId }, data: { unitCost: newUnitCost } })
      }

      return prisma.stockMovement.create({
        data: {
          organizationId: ctx.organizationId,
          itemId:         input.itemId,
          date:           input.date,
          movementType:   input.movementType,
          quantity:       qty,
          unitCost:       cost,
          totalCost:      total,
          reference:      input.reference,
          sourceType:     input.sourceType,
          sourceId:       input.sourceId,
          transactionId:  input.transactionId,
          createdBy:      ctx.userId ?? undefined,
          notes:          input.notes,
        },
      })
    }),

  getMovements: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({
      organizationId: z.string(),
      itemId:         z.string(),
      movementType:   movementTypeEnum.optional(),
      page:           z.number().min(1).default(1),
      limit:          z.number().min(1).max(200).default(50),
    }))
    .query(async ({ ctx, input }) => {
      const skip  = (input.page - 1) * input.limit
      const where: any = { organizationId: ctx.organizationId, itemId: input.itemId }
      if (input.movementType) where.movementType = input.movementType

      const [movements, total] = await Promise.all([
        prisma.stockMovement.findMany({ where, skip, take: input.limit, orderBy: { date: "desc" } }),
        prisma.stockMovement.count({ where }),
      ])
      return { movements, pagination: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) } }
    }),

  // ── Stock valuation ───────────────────────────────────────────────────────

  getStockValuation: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({ organizationId: z.string(), category: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { organizationId: ctx.organizationId, deletedAt: null, isActive: true }
      if (input.category) where.category = input.category

      const items = await prisma.inventoryItem.findMany({ where })

      const ZERO = new Prisma.Decimal(0)
      const byCategory = new Map<string | null, { qty: Prisma.Decimal; value: Prisma.Decimal; count: number }>()

      for (const item of items) {
        const value = item.quantityOnHand.mul(item.unitCost)
        const row   = byCategory.get(item.category ?? null) ?? { qty: ZERO, value: ZERO, count: 0 }
        row.qty   = row.qty.plus(item.quantityOnHand)
        row.value = row.value.plus(value)
        row.count++
        byCategory.set(item.category ?? null, row)
      }

      const totalValue = items.reduce((s, i) => s.plus(i.quantityOnHand.mul(i.unitCost)), ZERO)

      return {
        totalValue,
        itemCount: items.length,
        byCategory: [...byCategory.entries()].map(([cat, v]) => ({
          category:  cat ?? "Uncategorised",
          quantity:  v.qty,
          value:     v.value,
          itemCount: v.count,
        })),
        lowStockItems: items
          .filter((i) => i.quantityOnHand.lessThanOrEqualTo(i.reorderLevel))
          .map((i) => ({ id: i.id, sku: i.sku, name: i.name, quantityOnHand: i.quantityOnHand, reorderLevel: i.reorderLevel })),
      }
    }),
})
