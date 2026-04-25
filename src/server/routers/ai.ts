import { z } from "zod"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { AIService } from "@/lib/ai/ai-service"

export const aiRouter = createTRPCRouter({
  processQuery: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(
      z.object({
        organizationId: z.string(),
        query: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return AIService.processQuery(input.query, ctx.organizationId)
    }),

  generateInsights: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(
      z.object({
        organizationId: z.string(),
        period: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return AIService.generateInsights(ctx.organizationId, input.period)
    }),
})
