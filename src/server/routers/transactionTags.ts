import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import {
  validateTagCombination,
  calculateSplitAmounts,
  aggregateByTag,
  buildRelatedPartyDisclosure,
  buildWGASchedule,
  type ProposedTag,
  type OrgModuleSettingsFlags,
  type SplitTag,
  type TaggedLine,
} from "@/lib/coa/tagging"

async function getModuleFlags(orgId: string): Promise<OrgModuleSettingsFlags> {
  const s = await prisma.orgModuleSettings.findUnique({ where: { orgId } })
  return {
    enableProjectTagging:      s?.enableProjectTagging      ?? false,
    enableGrantTagging:        s?.enableGrantTagging        ?? false,
    enableRelatedPartyTagging: s?.enableRelatedPartyTagging ?? false,
    enableWGACPIDCodes:        s?.enableWGACPIDCodes        ?? false,
    enablePayrollCOAPosting:   s?.enablePayrollCOAPosting   ?? false,
    enableIFRS16Leases:        s?.enableIFRS16Leases        ?? false,
  }
}

const tagInputSchema = z.object({
  transactionLineId:  z.string(),
  tagType:            z.string(),
  projectId:          z.string().optional(),
  grantId:            z.string().optional(),
  relatedPartyId:     z.string().optional(),
  wgaCpidId:          z.string().optional(),
  customTagId:        z.string().optional(),
  allocationPercent:  z.string().optional(),
  allocationAmount:   z.string().optional(),
  notes:              z.string().optional(),
})

export const transactionTagsRouter = createTRPCRouter({
  // ── Tag categories ─────────────────────────────────────────────────────────

  getTagCategories: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({ organizationId: z.string(), enabledOnly: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      return prisma.tagCategory.findMany({
        where: {
          orgId:     ctx.organizationId,
          ...(input.enabledOnly ? { isEnabled: true } : {}),
        },
        include:  { customTags: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
        orderBy:  { sortOrder: "asc" },
      })
    }),

  createTagCategory: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(z.object({
      organizationId:    z.string(),
      code:              z.string(),
      name:              z.string(),
      description:       z.string().optional(),
      isMultiSelect:     z.boolean().optional(),
      isMandatoryOnEntry: z.boolean().optional(),
      appliesTo:         z.array(z.string()).optional(),
      sortOrder:         z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return prisma.tagCategory.create({
        data: {
          orgId:              ctx.organizationId,
          code:               input.code,
          name:               input.name,
          description:        input.description,
          isMultiSelect:      input.isMultiSelect      ?? false,
          isMandatoryOnEntry: input.isMandatoryOnEntry ?? false,
          appliesTo:          input.appliesTo          ?? [],
          sortOrder:          input.sortOrder          ?? 0,
          isSystemCategory:   false,
          isEnabled:          true,
        },
      })
    }),

  updateTagCategory: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(z.object({
      organizationId:     z.string(),
      id:                 z.string(),
      name:               z.string().optional(),
      isEnabled:          z.boolean().optional(),
      isMandatoryOnEntry: z.boolean().optional(),
      isMultiSelect:      z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, organizationId: _, ...data } = input
      return prisma.tagCategory.update({ where: { id }, data })
    }),

  // ── Custom tags ────────────────────────────────────────────────────────────

  createCustomTag: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(z.object({
      organizationId: z.string(),
      categoryId:     z.string(),
      code:           z.string(),
      name:           z.string(),
      description:    z.string().optional(),
      colour:         z.string().optional(),
      metadata:       z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return prisma.customTag.create({
        data: {
          orgId:      ctx.organizationId,
          categoryId: input.categoryId,
          code:       input.code,
          name:       input.name,
          description: input.description,
          colour:      input.colour,
          metadata:    input.metadata,
        },
      })
    }),

  updateCustomTag: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(z.object({
      organizationId: z.string(),
      id:             z.string(),
      name:           z.string().optional(),
      description:    z.string().optional(),
      colour:         z.string().optional(),
      isActive:       z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, organizationId: _, ...data } = input
      return prisma.customTag.update({ where: { id }, data })
    }),

  // ── Transaction tag CRUD ───────────────────────────────────────────────────

  getTransactionTags: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({ organizationId: z.string(), transactionLineId: z.string() }))
    .query(async ({ ctx, input }) => {
      return prisma.transactionTag.findMany({
        where:   { orgId: ctx.organizationId, transactionLineId: input.transactionLineId },
        include: {
          project:      { select: { id: true, name: true } },
          grant:        { select: { id: true, name: true } },
          relatedParty: { select: { id: true, name: true, relationship: true } },
          wgaCpid:      { select: { id: true, cpid: true, entityName: true } },
          customTag:    { select: { id: true, name: true, colour: true } },
        },
      })
    }),

  addTag: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(tagInputSchema.extend({ organizationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const flags = await getModuleFlags(ctx.organizationId)

      // Guard: check the module for this tagType is enabled
      const moduleGuards: Record<string, boolean> = {
        PROJECT:       flags.enableProjectTagging,
        GRANT:         flags.enableGrantTagging,
        RELATED_PARTY: flags.enableRelatedPartyTagging,
        WGA_CPID:      flags.enableWGACPIDCodes,
      }
      if (input.tagType in moduleGuards && !moduleGuards[input.tagType]) {
        throw new TRPCError({ code: "FORBIDDEN", message: `Module for tag type "${input.tagType}" is not enabled.` })
      }

      const proposedTag: ProposedTag = {
        tagType:          input.tagType,
        projectId:        input.projectId,
        grantId:          input.grantId,
        relatedPartyId:   input.relatedPartyId,
        wgaCpidId:        input.wgaCpidId,
        customTagId:      input.customTagId,
        allocationPercent: input.allocationPercent ? new Prisma.Decimal(input.allocationPercent) : undefined,
      }

      const existingTags = await prisma.transactionTag.findMany({
        where: { orgId: ctx.organizationId, transactionLineId: input.transactionLineId },
      })
      const allProposed: ProposedTag[] = [
        ...existingTags.map((t): ProposedTag => ({
          tagType:        t.tagType,
          projectId:      t.projectId ?? undefined,
          grantId:        t.grantId   ?? undefined,
          relatedPartyId: t.relatedPartyId ?? undefined,
          wgaCpidId:      t.wgaCpidId     ?? undefined,
          customTagId:    t.customTagId   ?? undefined,
        })),
        proposedTag,
      ]

      const validation = validateTagCombination(allProposed, new Prisma.Decimal(0), flags)
      if (!validation.valid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: validation.errors.join(" | ") })
      }

      let allocationAmount = input.allocationAmount ? new Prisma.Decimal(input.allocationAmount) : undefined

      // Derive £ amount from percent if not provided
      if (input.allocationPercent && !allocationAmount) {
        const splitResult = calculateSplitAmounts(new Prisma.Decimal(0), [
          { dimensionKey: "d", allocationPercent: new Prisma.Decimal(input.allocationPercent) },
        ] satisfies SplitTag[])
        allocationAmount = splitResult[0]?.allocationAmount
      }

      return prisma.transactionTag.create({
        data: {
          orgId:             ctx.organizationId,
          transactionLineId: input.transactionLineId,
          tagType:           input.tagType,
          projectId:         input.projectId,
          grantId:           input.grantId,
          relatedPartyId:    input.relatedPartyId,
          wgaCpidId:         input.wgaCpidId,
          customTagId:       input.customTagId,
          allocationPercent: input.allocationPercent ? new Prisma.Decimal(input.allocationPercent) : undefined,
          allocationAmount,
          notes:             input.notes,
        },
      })
    }),

  removeTag: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(z.object({ organizationId: z.string(), tagId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tag = await prisma.transactionTag.findFirst({
        where: { id: input.tagId, orgId: ctx.organizationId },
      })
      if (!tag) throw new TRPCError({ code: "NOT_FOUND" })
      return prisma.transactionTag.delete({ where: { id: input.tagId } })
    }),

  bulkAddTags: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(z.object({
      organizationId:     z.string(),
      transactionLineIds: z.array(z.string()).max(500),
      tag:                tagInputSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const flags = await getModuleFlags(ctx.organizationId)
      const data  = input.transactionLineIds.map((id) => ({
        orgId:             ctx.organizationId,
        transactionLineId: id,
        tagType:           input.tag.tagType,
        projectId:         input.tag.projectId,
        grantId:           input.tag.grantId,
        relatedPartyId:    input.tag.relatedPartyId,
        wgaCpidId:         input.tag.wgaCpidId,
        customTagId:       input.tag.customTagId,
        allocationPercent: input.tag.allocationPercent ? new Prisma.Decimal(input.tag.allocationPercent) : undefined,
        notes:             input.tag.notes,
      }))

      const result = await prisma.transactionTag.createMany({ data, skipDuplicates: true })
      return { created: result.count }
    }),

  getTaggedTransactions: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({
      organizationId:          z.string(),
      tagType:                 z.string(),
      targetId:                z.string(),
      periodStart:             z.date().optional(),
      periodEnd:               z.date().optional(),
      includeAllocatedAmounts: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = {
        orgId:   ctx.organizationId,
        tagType: input.tagType,
      }
      if (input.tagType === "PROJECT")       where.projectId      = input.targetId
      if (input.tagType === "GRANT")         where.grantId        = input.targetId
      if (input.tagType === "RELATED_PARTY") where.relatedPartyId = input.targetId
      if (input.tagType === "WGA_CPID")      where.wgaCpidId      = input.targetId
      if (input.tagType === "CUSTOM")        where.customTagId    = input.targetId

      if (input.periodStart || input.periodEnd) {
        where.createdAt = {}
        if (input.periodStart) where.createdAt.gte = input.periodStart
        if (input.periodEnd)   where.createdAt.lte = input.periodEnd
      }

      return prisma.transactionTag.findMany({ where, orderBy: { createdAt: "desc" } })
    }),

  // ── Related parties ────────────────────────────────────────────────────────

  getRelatedParties: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({ organizationId: z.string(), isActive: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      return prisma.relatedParty.findMany({
        where: { orgId: ctx.organizationId, ...(input.isActive !== undefined ? { isActive: input.isActive } : {}) },
        orderBy: { name: "asc" },
      })
    }),

  createRelatedParty: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(z.object({
      organizationId:       z.string(),
      name:                 z.string(),
      relationship:         z.string(),
      description:          z.string().optional(),
      companiesHouseNumber: z.string().optional(),
      ownershipPercent:     z.number().min(0).max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return prisma.relatedParty.create({
        data: {
          orgId:                ctx.organizationId,
          name:                 input.name,
          relationship:         input.relationship,
          description:          input.description,
          companiesHouseNumber: input.companiesHouseNumber,
          ownershipPercent:     input.ownershipPercent !== undefined
            ? new Prisma.Decimal(input.ownershipPercent)
            : undefined,
        },
      })
    }),

  updateRelatedParty: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(z.object({
      organizationId:       z.string(),
      id:                   z.string(),
      name:                 z.string().optional(),
      relationship:         z.string().optional(),
      description:          z.string().optional(),
      companiesHouseNumber: z.string().optional(),
      ownershipPercent:     z.number().min(0).max(100).optional(),
      isActive:             z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, organizationId: _, ownershipPercent, ...rest } = input
      return prisma.relatedParty.update({
        where: { id },
        data:  {
          ...rest,
          ...(ownershipPercent !== undefined ? { ownershipPercent: new Prisma.Decimal(ownershipPercent) } : {}),
        },
      })
    }),

  // ── WGA CPID codes ─────────────────────────────────────────────────────────

  getWGACPIDCodes: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({
      organizationId: z.string(),
      entityType:     z.string().optional(),
      search:         z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = { orgId: ctx.organizationId, isActive: true }
      if (input.entityType) where.entityType = input.entityType
      if (input.search) {
        where.OR = [
          { cpid:       { contains: input.search, mode: "insensitive" } },
          { entityName: { contains: input.search, mode: "insensitive" } },
        ]
      }
      return prisma.wGACPIDCode.findMany({ where, orderBy: { cpid: "asc" } })
    }),

  createWGACPIDCode: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(z.object({
      organizationId:   z.string(),
      cpid:             z.string(),
      entityName:       z.string(),
      entityType:       z.string(),
      departmentalGroup: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return prisma.wGACPIDCode.create({
        data: {
          orgId:            ctx.organizationId,
          cpid:             input.cpid,
          entityName:       input.entityName,
          entityType:       input.entityType,
          departmentalGroup: input.departmentalGroup,
        },
      })
    }),

  bulkImportCPIDCodes: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(z.object({ organizationId: z.string(), csvText: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const lines   = input.csvText.trim().split("\n").slice(1) // skip header
      let created = 0, updated = 0
      const errors: string[] = []

      for (const [i, line] of lines.entries()) {
        const [cpid, entityName, entityType, departmentalGroup] = line.split(",").map((s) => s.trim().replace(/^"|"$/g, ""))
        if (!cpid || !entityName || !entityType) {
          errors.push(`Row ${i + 2}: missing required fields`)
          continue
        }
        const existing = await prisma.wGACPIDCode.findUnique({
          where: { orgId_cpid: { orgId: ctx.organizationId, cpid } },
        })
        if (existing) {
          await prisma.wGACPIDCode.update({
            where: { id: existing.id },
            data:  { entityName, entityType, departmentalGroup: departmentalGroup || null },
          })
          updated++
        } else {
          await prisma.wGACPIDCode.create({
            data: { orgId: ctx.organizationId, cpid, entityName, entityType, departmentalGroup: departmentalGroup || null },
          })
          created++
        }
      }

      return { created, updated, errors }
    }),

  // ── Disclosure / schedule reports ─────────────────────────────────────────

  getRelatedPartyDisclosure: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({
      organizationId: z.string(),
      periodStart:    z.date(),
      periodEnd:      z.date(),
    }))
    .query(async ({ ctx, input }) => {
      const [tags, parties] = await Promise.all([
        prisma.transactionTag.findMany({
          where: {
            orgId:         ctx.organizationId,
            relatedPartyId: { not: null },
            createdAt:     { gte: input.periodStart, lte: input.periodEnd },
          },
        }),
        prisma.relatedParty.findMany({ where: { orgId: ctx.organizationId } }),
      ])
      return buildRelatedPartyDisclosure(tags as any, parties, input.periodStart, input.periodEnd)
    }),

  getWGASchedule: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({
      organizationId: z.string(),
      periodStart:    z.date(),
      periodEnd:      z.date(),
    }))
    .query(async ({ ctx, input }) => {
      const [tags, cpids] = await Promise.all([
        prisma.transactionTag.findMany({
          where: {
            orgId:    ctx.organizationId,
            wgaCpidId: { not: null },
            createdAt: { gte: input.periodStart, lte: input.periodEnd },
          },
        }),
        prisma.wGACPIDCode.findMany({ where: { orgId: ctx.organizationId } }),
      ])
      return buildWGASchedule(tags as any, cpids, input.periodStart, input.periodEnd)
    }),
})
