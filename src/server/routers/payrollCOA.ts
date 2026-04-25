import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import {
  validateAllocationRules,
  resolveEmployeeAllocations,
  type AllocationSplit,
  type EmployeeWithRules,
} from "@/lib/payroll/costAllocation"
import {
  generatePayrollJournal,
  generatePayrollSummaryByDimension,
  generateP32Journal,
  type PayrollCOAMappingRecord,
  type PayrollEntryRecord,
  type PayrollRunRecord,
} from "@/lib/payroll/coaPosting"

// ---------------------------------------------------------------------------
// Guard helper
// ---------------------------------------------------------------------------

async function requirePayrollCOA(orgId: string) {
  const s = await prisma.orgModuleSettings.findUnique({ where: { orgId } })
  if (!s?.enablePayrollCOAPosting) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Payroll COA posting module is not enabled." })
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchMappings(orgId: string): Promise<PayrollCOAMappingRecord[]> {
  const rows = await prisma.payrollCOAMapping.findMany({
    where: { orgId, isActive: true },
  })
  return rows.map((r) => ({
    componentType:       r.componentType,
    debitAccountId:      r.debitAccountId,
    creditAccountId:     r.creditAccountId,
    defaultCostCentreId: r.defaultCostCentreId,
  }))
}

async function fetchPayrollRun(orgId: string, runId: string): Promise<PayrollRunRecord> {
  const run = await prisma.payrollRun.findFirst({
    where:   { id: runId, organizationId: orgId },
    include: { entries: true },
  })
  if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Payroll run not found." })

  return {
    id:         run.id,
    totalGross: run.totalGross,
    totalNet:   run.totalNet,
    entries:    run.entries.map((e): PayrollEntryRecord => ({
      id:                e.id,
      employeeId:        e.employeeId,
      grossPay:          e.grossPay,
      taxAmount:         e.taxAmount,
      nationalInsurance: e.nationalInsurance,
      pensionEmployee:   e.pensionEmployee,
      pensionEmployer:   e.pensionEmployer,
      netPay:            e.netPay,
    })),
  }
}

async function fetchAllocations(orgId: string, employeeIds: string[]) {
  const rules = await prisma.employeeAllocationRule.findMany({
    where:   { orgId, employeeId: { in: employeeIds }, isActive: true },
    include: { splitLines: true },
  })

  const employees: EmployeeWithRules[] = employeeIds.map((id) => ({
    id,
    allocationRules: rules
      .filter((r) => r.employeeId === id)
      .map((r) => ({
        id:            r.id,
        employeeId:    r.employeeId,
        effectiveFrom: r.effectiveFrom,
        effectiveTo:   r.effectiveTo,
        isActive:      r.isActive,
        splitLines:    r.splitLines.map((s) => ({
          id:                s.id,
          allocationPercent: s.allocationPercent,
          costCentreId:      s.costCentreId,
          projectId:         s.projectId,
          grantId:           s.grantId,
          analysisCodeId:    s.analysisCodeId,
          componentTypes:    s.componentTypes,
        })),
      })),
  }))

  return employees
}

// ---------------------------------------------------------------------------
// Shared split input schema
// ---------------------------------------------------------------------------

const splitInputSchema = z.object({
  allocationPercent: z.string(),
  costCentreId:      z.string().optional(),
  projectId:         z.string().optional(),
  grantId:           z.string().optional(),
  analysisCodeId:    z.string().optional(),
  componentTypes:    z.array(z.string()).optional(),
})

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const payrollCOARouter = createTRPCRouter({
  // ── COA Mappings ──────────────────────────────────────────────────────────

  getMappings: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PAYROLL_VIEW))
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      await requirePayrollCOA(ctx.organizationId)
      return prisma.payrollCOAMapping.findMany({
        where:   { orgId: ctx.organizationId },
        include: {
          debitAccount:  { select: { id: true, code: true, name: true, accountType: true } },
          creditAccount: { select: { id: true, code: true, name: true, accountType: true } },
        },
        orderBy: { componentType: "asc" },
      })
    }),

  upsertMapping: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PAYROLL_EDIT))
    .input(z.object({
      organizationId:      z.string(),
      componentType:       z.string(),
      debitAccountId:      z.string(),
      creditAccountId:     z.string(),
      defaultCostCentreId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePayrollCOA(ctx.organizationId)

      const [debit, credit] = await Promise.all([
        prisma.chartOfAccount.findFirst({ where: { id: input.debitAccountId,  organizationId: ctx.organizationId } }),
        prisma.chartOfAccount.findFirst({ where: { id: input.creditAccountId, organizationId: ctx.organizationId } }),
      ])
      if (!debit)  throw new TRPCError({ code: "BAD_REQUEST", message: "Debit account not found." })
      if (!credit) throw new TRPCError({ code: "BAD_REQUEST", message: "Credit account not found." })

      return prisma.payrollCOAMapping.upsert({
        where:  { orgId_componentType: { orgId: ctx.organizationId, componentType: input.componentType } },
        update: { debitAccountId: input.debitAccountId, creditAccountId: input.creditAccountId, defaultCostCentreId: input.defaultCostCentreId },
        create: {
          orgId:               ctx.organizationId,
          componentType:       input.componentType,
          debitAccountId:      input.debitAccountId,
          creditAccountId:     input.creditAccountId,
          defaultCostCentreId: input.defaultCostCentreId,
        },
      })
    }),

  seedDefaultMappings: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(z.object({ organizationId: z.string() }))
    .mutation(async ({ ctx }) => {
      await requirePayrollCOA(ctx.organizationId)
      // Delegate to the same seed logic used by moduleSettings.updateSettings
      const { moduleSettingsRouter } = await import("./moduleSettings")
      // Re-use the seed by calling the settings update via prisma directly
      const accountDefs = [
        { code: "6000", name: "Salaries and Wages",  accountType: "EXPENSE",   normalBalance: "DEBIT" },
        { code: "6010", name: "Employer NI",          accountType: "EXPENSE",   normalBalance: "DEBIT" },
        { code: "6020", name: "Employer Pension",     accountType: "EXPENSE",   normalBalance: "DEBIT" },
        { code: "2300", name: "PAYE / NI Payable",    accountType: "LIABILITY", normalBalance: "CREDIT" },
        { code: "2310", name: "Pension Payable",      accountType: "LIABILITY", normalBalance: "CREDIT" },
        { code: "2320", name: "Net Wages Payable",    accountType: "LIABILITY", normalBalance: "CREDIT" },
      ]
      const accountMap = new Map<string, string>()
      for (const def of accountDefs) {
        const acc = await prisma.chartOfAccount.upsert({
          where:  { organizationId_code: { organizationId: ctx.organizationId, code: def.code } },
          update: {},
          create: { organizationId: ctx.organizationId, code: def.code, name: def.name, accountType: def.accountType as any, normalBalance: def.normalBalance as any, isActive: true },
        })
        accountMap.set(def.code, acc.id)
      }
      const mappingDefs = [
        { componentType: "GROSS_SALARY",     debit: "6000", credit: "2320" },
        { componentType: "PAYE_TAX",         debit: "6000", credit: "2300" },
        { componentType: "EMPLOYEE_NI",      debit: "6000", credit: "2300" },
        { componentType: "EMPLOYER_NI",      debit: "6010", credit: "2300" },
        { componentType: "EMPLOYEE_PENSION", debit: "6000", credit: "2310" },
        { componentType: "EMPLOYER_PENSION", debit: "6020", credit: "2310" },
        { componentType: "NET_PAY",          debit: "2320", credit: "2320" },
      ]
      let created = 0
      for (const m of mappingDefs) {
        const d = accountMap.get(m.debit)
        const c = accountMap.get(m.credit)
        if (!d || !c) continue
        const existing = await prisma.payrollCOAMapping.findUnique({
          where: { orgId_componentType: { orgId: ctx.organizationId, componentType: m.componentType } },
        })
        if (!existing) {
          await prisma.payrollCOAMapping.create({ data: { orgId: ctx.organizationId, componentType: m.componentType, debitAccountId: d, creditAccountId: c } })
          created++
        }
      }
      return { created }
    }),

  // ── Allocation rules ───────────────────────────────────────────────────────

  getAllocationRules: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PAYROLL_VIEW))
    .input(z.object({ organizationId: z.string(), employeeId: z.string().optional(), isActive: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      await requirePayrollCOA(ctx.organizationId)
      return prisma.employeeAllocationRule.findMany({
        where: {
          orgId:      ctx.organizationId,
          ...(input.employeeId ? { employeeId: input.employeeId } : {}),
          ...(input.isActive   !== undefined ? { isActive: input.isActive } : {}),
        },
        include:  { splitLines: true, employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } } },
        orderBy:  { effectiveFrom: "desc" },
      })
    }),

  createAllocationRule: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PAYROLL_EDIT))
    .input(z.object({
      organizationId: z.string(),
      employeeId:     z.string(),
      effectiveFrom:  z.date(),
      splits:         z.array(splitInputSchema).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePayrollCOA(ctx.organizationId)

      const splits: AllocationSplit[] = input.splits.map((s) => ({
        allocationPercent: new Prisma.Decimal(s.allocationPercent),
        costCentreId:      s.costCentreId,
        projectId:         s.projectId,
        grantId:           s.grantId,
        analysisCodeId:    s.analysisCodeId,
        componentTypes:    s.componentTypes,
      }))

      const validation = validateAllocationRules(splits)
      if (!validation.valid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: validation.errors.join(" | ") })
      }

      return prisma.$transaction(async (tx) => {
        // Close any open-ended rule for this employee
        await tx.employeeAllocationRule.updateMany({
          where: { orgId: ctx.organizationId, employeeId: input.employeeId, effectiveTo: null },
          data:  {
            effectiveTo: new Date(input.effectiveFrom.getTime() - 86_400_000),
            isActive:    false,
          },
        })

        return tx.employeeAllocationRule.create({
          data: {
            orgId:         ctx.organizationId,
            employeeId:    input.employeeId,
            effectiveFrom: input.effectiveFrom,
            isActive:      true,
            splitLines:    {
              create: splits.map((s) => ({
                allocationPercent: s.allocationPercent,
                costCentreId:      s.costCentreId,
                projectId:         s.projectId,
                grantId:           s.grantId,
                analysisCodeId:    s.analysisCodeId,
                componentTypes:    s.componentTypes ?? [],
              })),
            },
          },
          include: { splitLines: true },
        })
      })
    }),

  updateAllocationRule: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PAYROLL_EDIT))
    .input(z.object({
      organizationId: z.string(),
      id:             z.string(),
      splits:         z.array(splitInputSchema).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePayrollCOA(ctx.organizationId)

      const rule = await prisma.employeeAllocationRule.findFirst({
        where: { id: input.id, orgId: ctx.organizationId },
      })
      if (!rule) throw new TRPCError({ code: "NOT_FOUND" })

      // Prevent editing if posted journals reference this rule
      const posted = await prisma.payrollJournalEntry.findFirst({
        where: { orgId: ctx.organizationId, status: "POSTED" },
      })
      if (posted) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot edit allocation rule — posted journals exist for this period." })
      }

      const splits: AllocationSplit[] = input.splits.map((s) => ({
        allocationPercent: new Prisma.Decimal(s.allocationPercent),
        costCentreId:      s.costCentreId,
        projectId:         s.projectId,
        grantId:           s.grantId,
        analysisCodeId:    s.analysisCodeId,
        componentTypes:    s.componentTypes,
      }))
      const validation = validateAllocationRules(splits)
      if (!validation.valid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: validation.errors.join(" | ") })
      }

      return prisma.$transaction(async (tx) => {
        await tx.employeeAllocationSplit.deleteMany({ where: { ruleId: input.id } })
        return tx.employeeAllocationRule.update({
          where: { id: input.id },
          data:  {
            splitLines: {
              create: splits.map((s) => ({
                allocationPercent: s.allocationPercent,
                costCentreId:      s.costCentreId,
                projectId:         s.projectId,
                grantId:           s.grantId,
                analysisCodeId:    s.analysisCodeId,
                componentTypes:    s.componentTypes ?? [],
              })),
            },
          },
          include: { splitLines: true },
        })
      })
    }),

  deactivateAllocationRule: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PAYROLL_EDIT))
    .input(z.object({ organizationId: z.string(), id: z.string(), effectiveTo: z.date() }))
    .mutation(async ({ ctx, input }) => {
      await requirePayrollCOA(ctx.organizationId)
      return prisma.employeeAllocationRule.update({
        where: { id: input.id },
        data:  { effectiveTo: input.effectiveTo, isActive: false },
      })
    }),

  bulkSetAllocations: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PAYROLL_EDIT))
    .input(z.object({
      organizationId: z.string(),
      effectiveFrom:  z.date(),
      rules: z.array(z.object({
        employeeId: z.string(),
        splits:     z.array(splitInputSchema).min(1),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePayrollCOA(ctx.organizationId)
      const results = []

      for (const rule of input.rules) {
        const splits: AllocationSplit[] = rule.splits.map((s) => ({
          allocationPercent: new Prisma.Decimal(s.allocationPercent),
          costCentreId:      s.costCentreId,
          projectId:         s.projectId,
          grantId:           s.grantId,
          analysisCodeId:    s.analysisCodeId,
          componentTypes:    s.componentTypes,
        }))
        const v = validateAllocationRules(splits)
        if (!v.valid) {
          results.push({ employeeId: rule.employeeId, success: false, errors: v.errors })
          continue
        }

        await prisma.$transaction(async (tx) => {
          await tx.employeeAllocationRule.updateMany({
            where: { orgId: ctx.organizationId, employeeId: rule.employeeId, effectiveTo: null },
            data:  { effectiveTo: new Date(input.effectiveFrom.getTime() - 86_400_000), isActive: false },
          })
          await tx.employeeAllocationRule.create({
            data: {
              orgId:         ctx.organizationId,
              employeeId:    rule.employeeId,
              effectiveFrom: input.effectiveFrom,
              isActive:      true,
              splitLines:    {
                create: splits.map((s) => ({
                  allocationPercent: s.allocationPercent,
                  costCentreId:      s.costCentreId,
                  projectId:         s.projectId,
                  grantId:           s.grantId,
                  analysisCodeId:    s.analysisCodeId,
                  componentTypes:    s.componentTypes ?? [],
                })),
              },
            },
          })
        })
        results.push({ employeeId: rule.employeeId, success: true, errors: [] })
      }

      return { results, processed: results.length, failed: results.filter((r) => !r.success).length }
    }),

  // ── Journal procedures ─────────────────────────────────────────────────────

  previewJournal: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PAYROLL_VIEW))
    .input(z.object({ organizationId: z.string(), payrollRunId: z.string(), journalDate: z.date() }))
    .query(async ({ ctx, input }) => {
      await requirePayrollCOA(ctx.organizationId)

      const [run, mappings] = await Promise.all([
        fetchPayrollRun(ctx.organizationId, input.payrollRunId),
        fetchMappings(ctx.organizationId),
      ])
      const employees  = await fetchAllocations(ctx.organizationId, run.entries.map((e) => e.employeeId))
      const allocations = resolveEmployeeAllocations(employees, input.journalDate)

      const journal = generatePayrollJournal({
        payrollRun:  run,
        mappings,
        allocations,
        journalDate: input.journalDate,
        reference:   `PAY-${input.payrollRunId}`,
      })

      const summary = generatePayrollSummaryByDimension(journal)
      const unmapped = run.entries
        .flatMap((e) => ["GROSS_SALARY", "PAYE_TAX", "EMPLOYEE_NI", "EMPLOYER_NI", "EMPLOYEE_PENSION", "EMPLOYER_PENSION"])
        .filter((ct) => !mappings.find((m) => m.componentType === ct))

      return {
        ...journal,
        summary: {
          byCostCentre:   [...summary.byCostCentre.entries()].map(([k, v]) => ({ key: k, amount: v })),
          byProject:      [...summary.byProject.entries()].map(([k, v]) => ({ key: k, amount: v })),
          byGrant:        [...summary.byGrant.entries()].map(([k, v]) => ({ key: k, amount: v })),
          byComponent:    [...summary.byComponent.entries()].map(([k, v]) => ({ key: k, amount: v })),
        },
        unmappedComponents: [...new Set(unmapped)],
      }
    }),

  postJournal: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PAYROLL_APPROVE))
    .input(z.object({
      organizationId: z.string(),
      payrollRunId:   z.string(),
      journalDate:    z.date(),
      reference:      z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePayrollCOA(ctx.organizationId)

      const existing = await prisma.payrollJournalEntry.findUnique({
        where: { payrollRunId: input.payrollRunId },
      })
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "A journal already exists for this payroll run." })
      }

      const [run, mappings] = await Promise.all([
        fetchPayrollRun(ctx.organizationId, input.payrollRunId),
        fetchMappings(ctx.organizationId),
      ])
      const employees  = await fetchAllocations(ctx.organizationId, run.entries.map((e) => e.employeeId))
      const allocations = resolveEmployeeAllocations(employees, input.journalDate)

      const journal = generatePayrollJournal({
        payrollRun:  run,
        mappings,
        allocations,
        journalDate: input.journalDate,
        reference:   input.reference ?? `PAY-${input.payrollRunId}`,
      })

      if (!journal.isBalanced) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Journal is not balanced: debits=${journal.totalDebits} credits=${journal.totalCredits}`,
        })
      }

      const ZERO = new Prisma.Decimal(0)
      const employerNI      = run.entries.reduce((s, e) => s.plus(e.nationalInsurance), ZERO)
      const employerPension = run.entries.reduce((s, e) => s.plus(e.pensionEmployer), ZERO)

      return prisma.payrollJournalEntry.create({
        data: {
          orgId:               ctx.organizationId,
          payrollRunId:        input.payrollRunId,
          journalDate:         input.journalDate,
          description:         journal.description,
          reference:           journal.reference,
          status:              "POSTED",
          totalGross:          run.totalGross,
          totalEmployerNI:     employerNI,
          totalEmployerPension: employerPension,
          totalNetPay:         run.totalNet,
          postedAt:            new Date(),
          postedBy:            ctx.userId,
          lines: {
            create: journal.lines.map((l) => ({
              lineNumber:    l.lineNumber,
              accountId:     l.accountId,
              costCentreId:  l.costCentreId,
              projectId:     l.projectId,
              grantId:       l.grantId,
              analysisCodeId: l.analysisCodeId,
              debit:         l.debit,
              credit:        l.credit,
              description:   l.description,
              componentType: l.componentType,
              employeeCount: l.employeeCount,
              employeeIds:   l.employeeIds,
            })),
          },
        },
        include: { lines: true },
      })
    }),

  reverseJournal: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PAYROLL_APPROVE))
    .input(z.object({
      organizationId: z.string(),
      journalId:      z.string(),
      reversalDate:   z.date(),
      reason:         z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePayrollCOA(ctx.organizationId)

      const original = await prisma.payrollJournalEntry.findFirst({
        where:   { id: input.journalId, orgId: ctx.organizationId },
        include: { lines: true },
      })
      if (!original) throw new TRPCError({ code: "NOT_FOUND" })
      if (original.status === "REVERSED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Journal has already been reversed." })
      }

      const reversal = await prisma.$transaction(async (tx) => {
        await tx.payrollJournalEntry.update({
          where: { id: input.journalId },
          data:  { status: "REVERSED" },
        })

        return tx.payrollJournalEntry.create({
          data: {
            orgId:               ctx.organizationId,
            payrollRunId:        `${original.payrollRunId}-REV`,
            journalDate:         input.reversalDate,
            description:         `REVERSAL: ${original.description} — ${input.reason}`,
            reference:           `REV-${original.reference}`,
            status:              "POSTED",
            reversalOf:          original.id,
            totalGross:          original.totalGross.negated(),
            totalEmployerNI:     original.totalEmployerNI.negated(),
            totalEmployerPension: original.totalEmployerPension.negated(),
            totalNetPay:         original.totalNetPay.negated(),
            postedAt:            new Date(),
            postedBy:            ctx.userId,
            lines: {
              create: original.lines.map((l) => ({
                lineNumber:    l.lineNumber,
                accountId:     l.accountId,
                costCentreId:  l.costCentreId,
                projectId:     l.projectId,
                grantId:       l.grantId,
                analysisCodeId: l.analysisCodeId,
                debit:         l.credit,   // flipped
                credit:        l.debit,    // flipped
                description:   `REVERSAL: ${l.description}`,
                componentType: l.componentType,
                employeeCount: l.employeeCount,
                employeeIds:   l.employeeIds,
              })),
            },
          },
          include: { lines: true },
        })
      })
      return reversal
    }),

  getJournalHistory: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PAYROLL_VIEW))
    .input(z.object({
      organizationId: z.string(),
      periodStart:    z.date().optional(),
      periodEnd:      z.date().optional(),
      status:         z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await requirePayrollCOA(ctx.organizationId)
      const where: any = { orgId: ctx.organizationId }
      if (input.status)      where.status      = input.status
      if (input.periodStart) where.journalDate = { ...where.journalDate, gte: input.periodStart }
      if (input.periodEnd)   where.journalDate = { ...where.journalDate, lte: input.periodEnd }

      return prisma.payrollJournalEntry.findMany({
        where,
        include: { _count: { select: { lines: true } } },
        orderBy: { journalDate: "desc" },
      })
    }),

  getPayCostAnalysis: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PAYROLL_VIEW))
    .input(z.object({
      organizationId: z.string(),
      periodStart:    z.date(),
      periodEnd:      z.date(),
      breakdownBy:    z.enum(["COST_CENTRE", "PROJECT", "GRANT", "ANALYSIS_CODE", "COMPONENT"]),
    }))
    .query(async ({ ctx, input }) => {
      await requirePayrollCOA(ctx.organizationId)

      const lines = await prisma.payrollJournalLine.findMany({
        where: {
          journal: {
            orgId:        ctx.organizationId,
            status:       "POSTED",
            journalDate:  { gte: input.periodStart, lte: input.periodEnd },
          },
          debit: { gt: 0 },
        },
      })

      const ZERO = new Prisma.Decimal(0)
      const groups = new Map<string | null, Prisma.Decimal>()

      for (const line of lines) {
        let key: string | null
        switch (input.breakdownBy) {
          case "COST_CENTRE":   key = line.costCentreId;   break
          case "PROJECT":       key = line.projectId;      break
          case "GRANT":         key = line.grantId;        break
          case "ANALYSIS_CODE": key = line.analysisCodeId; break
          case "COMPONENT":     key = line.componentType;  break
        }
        groups.set(key, (groups.get(key) ?? ZERO).plus(line.debit))
      }

      return [...groups.entries()]
        .map(([key, amount]) => ({ key: key ?? "(unallocated)", amount }))
        .sort((a, b) => b.amount.minus(a.amount).toNumber())
    }),

  getPayrollCOAReconciliation: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PAYROLL_VIEW))
    .input(z.object({
      organizationId: z.string(),
      periodStart:    z.date(),
      periodEnd:      z.date(),
    }))
    .query(async ({ ctx, input }) => {
      await requirePayrollCOA(ctx.organizationId)

      const [runs, journals] = await Promise.all([
        prisma.payrollRun.findMany({
          where: {
            organizationId: ctx.organizationId,
            payDate:        { gte: input.periodStart, lte: input.periodEnd },
            status:         { in: ["APPROVED", "PROCESSED"] },
          },
          include: { journalEntry: { select: { id: true, status: true, totalGross: true } } },
        }),
        prisma.payrollJournalEntry.findMany({
          where: {
            orgId:       ctx.organizationId,
            journalDate: { gte: input.periodStart, lte: input.periodEnd },
            status:      "POSTED",
          },
        }),
      ])

      const ZERO = new Prisma.Decimal(0)
      const totalPayrollGross  = runs.reduce((s, r) => s.plus(r.totalGross), ZERO)
      const totalPostedToLedger = journals.reduce((s, j) => s.plus(j.totalGross.abs()), ZERO)

      const unpostedRuns = runs.filter((r) => !r.journalEntry)

      return {
        totalPayrollGross,
        totalPostedToLedger,
        variance: totalPostedToLedger.minus(totalPayrollGross),
        isReconciled: totalPostedToLedger.minus(totalPayrollGross).abs().lessThan("0.01"),
        unpostedRuns: unpostedRuns.map((r) => ({
          id:         r.id,
          runNumber:  r.runNumber,
          payDate:    r.payDate,
          totalGross: r.totalGross,
        })),
        journalCount: journals.length,
        runCount:     runs.length,
      }
    }),
})
