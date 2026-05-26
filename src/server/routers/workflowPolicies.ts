import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, orgScopedProcedure } from "@/lib/trpc"
import { prisma } from "@/lib/prisma"

const policyBodySchema = z.object({
  entityType: z.enum(["MANUAL_JOURNAL"]),
  approverUserId: z.string().min(1, "Approver is required"),
  deadlineHours: z.number().int().min(1).max(720).default(48),
  reminderHours: z.number().int().min(1).max(168).default(24),
  maxReminders: z.number().int().min(0).max(10).default(3),
  delegateUserId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
})

export const workflowPoliciesRouter = createTRPCRouter({
  upsert: orgScopedProcedure
    .input(policyBodySchema.extend({ organizationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { organizationId: _org, ...data } = input
      return prisma.workflowPolicy.upsert({
        where: {
          organizationId_entityType: {
            organizationId: ctx.organizationId,
            entityType: data.entityType,
          },
        },
        create: { organizationId: ctx.organizationId, ...data },
        update: data,
      })
    }),

  get: orgScopedProcedure
    .input(z.object({
      organizationId: z.string(),
      entityType: z.enum(["MANUAL_JOURNAL"]),
    }))
    .query(async ({ ctx, input }) => {
      return prisma.workflowPolicy.findUnique({
        where: {
          organizationId_entityType: {
            organizationId: ctx.organizationId,
            entityType: input.entityType,
          },
        },
      })
    }),

  list: orgScopedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      return prisma.workflowPolicy.findMany({
        where: { organizationId: ctx.organizationId },
        orderBy: { entityType: "asc" },
      })
    }),

  toggle: orgScopedProcedure
    .input(z.object({
      organizationId: z.string(),
      entityType: z.enum(["MANUAL_JOURNAL"]),
      isActive: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const policy = await prisma.workflowPolicy.findUnique({
        where: {
          organizationId_entityType: {
            organizationId: ctx.organizationId,
            entityType: input.entityType,
          },
        },
      })
      if (!policy) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Workflow policy not found" })
      }
      return prisma.workflowPolicy.update({
        where: { id: policy.id },
        data: { isActive: input.isActive },
      })
    }),
})
