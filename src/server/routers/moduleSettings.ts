import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

// ---------------------------------------------------------------------------
// Helper — get or create settings record
// ---------------------------------------------------------------------------

async function getOrCreateSettings(orgId: string) {
  let settings = await prisma.orgModuleSettings.findUnique({ where: { orgId } })
  if (!settings) {
    settings = await prisma.orgModuleSettings.create({ data: { orgId } })
  }
  return settings
}

// ---------------------------------------------------------------------------
// Seed helpers (idempotent)
// ---------------------------------------------------------------------------

async function ensureTagCategory(orgId: string, code: string, name: string) {
  await prisma.tagCategory.upsert({
    where:  { orgId_code: { orgId, code } },
    update: { isEnabled: true },
    create: { orgId, code, name, isSystemCategory: true, isEnabled: true },
  })
}

async function disableTagCategory(orgId: string, code: string) {
  await prisma.tagCategory.updateMany({
    where: { orgId, code },
    data:  { isEnabled: false },
  })
}

async function seedIFRS16Accounts(orgId: string) {
  const accounts = [
    { code: "0700", name: "Right-of-Use Assets",                accountType: "ASSET",   normalBalance: "DEBIT" },
    { code: "2600", name: "Lease Liability",                    accountType: "LIABILITY", normalBalance: "CREDIT" },
    { code: "7700", name: "Depreciation — Right-of-Use Assets", accountType: "EXPENSE",  normalBalance: "DEBIT" },
    { code: "7701", name: "Finance Charge — Lease Interest",    accountType: "EXPENSE",  normalBalance: "DEBIT" },
  ]

  for (const a of accounts) {
    await prisma.chartOfAccount.upsert({
      where:  { organizationId_code: { organizationId: orgId, code: a.code } },
      update: {},
      create: {
        organizationId: orgId,
        code:           a.code,
        name:           a.name,
        accountType:    a.accountType as any,
        normalBalance:  a.normalBalance as any,
        isActive:       true,
      },
    })
  }
}

async function seedPayrollCOAMappings(orgId: string) {
  // Find or seed the required accounts first
  const accountDefs = [
    { code: "6000", name: "Salaries and Wages",     accountType: "EXPENSE",   normalBalance: "DEBIT" },
    { code: "6010", name: "Employer NI",             accountType: "EXPENSE",   normalBalance: "DEBIT" },
    { code: "6020", name: "Employer Pension",        accountType: "EXPENSE",   normalBalance: "DEBIT" },
    { code: "2300", name: "PAYE / NI Payable",       accountType: "LIABILITY", normalBalance: "CREDIT" },
    { code: "2310", name: "Pension Payable",         accountType: "LIABILITY", normalBalance: "CREDIT" },
    { code: "2320", name: "Net Wages Payable",       accountType: "LIABILITY", normalBalance: "CREDIT" },
  ]

  const accountMap = new Map<string, string>()
  for (const def of accountDefs) {
    const acc = await prisma.chartOfAccount.upsert({
      where:  { organizationId_code: { organizationId: orgId, code: def.code } },
      update: {},
      create: {
        organizationId: orgId,
        code:           def.code,
        name:           def.name,
        accountType:    def.accountType as any,
        normalBalance:  def.normalBalance as any,
        isActive:       true,
      },
    })
    accountMap.set(def.code, acc.id)
  }

  const mappings = [
    { componentType: "GROSS_SALARY",     debit: "6000", credit: "2320" },
    { componentType: "PAYE_TAX",         debit: "6000", credit: "2300" },
    { componentType: "EMPLOYEE_NI",      debit: "6000", credit: "2300" },
    { componentType: "EMPLOYER_NI",      debit: "6010", credit: "2300" },
    { componentType: "EMPLOYEE_PENSION", debit: "6000", credit: "2310" },
    { componentType: "EMPLOYER_PENSION", debit: "6020", credit: "2310" },
    { componentType: "NET_PAY",          debit: "2320", credit: "2320" },
  ]

  for (const m of mappings) {
    const debitId  = accountMap.get(m.debit)
    const creditId = accountMap.get(m.credit)
    if (!debitId || !creditId) continue

    await prisma.payrollCOAMapping.upsert({
      where:  { orgId_componentType: { orgId, componentType: m.componentType } },
      update: {},
      create: { orgId, componentType: m.componentType, debitAccountId: debitId, creditAccountId: creditId },
    })
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const updateSettingsSchema = z.object({
  organizationId:                  z.string(),
  enableProjectTagging:            z.boolean().optional(),
  enableGrantTagging:              z.boolean().optional(),
  enableRelatedPartyTagging:       z.boolean().optional(),
  enableWGACPIDCodes:              z.boolean().optional(),
  enableFundAccounting:            z.boolean().optional(),
  enableStatutoryClassCodes:       z.boolean().optional(),
  enableIFRS16Leases:              z.boolean().optional(),
  leaseAccountingStandard:         z.string().optional(),
  enablePayrollCOAPosting:         z.boolean().optional(),
  enablePayrollProjectAllocation:  z.boolean().optional(),
  enablePayrollGrantAllocation:    z.boolean().optional(),
  enablePayrollCostCentreAnalysis: z.boolean().optional(),
  reportingStandard:               z.string().optional(),
  enableWGAReporting:              z.boolean().optional(),
  enableMultiCurrencyFX:           z.boolean().optional(),
  enableIntercompany:              z.boolean().optional(),
})

export const moduleSettingsRouter = createTRPCRouter({
  getSettings: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_VIEW))
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      return getOrCreateSettings(ctx.organizationId)
    }),

  updateSettings: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(updateSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId   = ctx.organizationId
      const current = await getOrCreateSettings(orgId)

      const {
        organizationId: _,
        enableProjectTagging,
        enableGrantTagging,
        enableRelatedPartyTagging,
        enableWGACPIDCodes,
        enableIFRS16Leases,
        enablePayrollCOAPosting,
        ...rest
      } = input

      const updateData: any = { ...rest }
      if (enableProjectTagging      !== undefined) updateData.enableProjectTagging      = enableProjectTagging
      if (enableGrantTagging        !== undefined) updateData.enableGrantTagging        = enableGrantTagging
      if (enableRelatedPartyTagging !== undefined) updateData.enableRelatedPartyTagging = enableRelatedPartyTagging
      if (enableWGACPIDCodes        !== undefined) updateData.enableWGACPIDCodes        = enableWGACPIDCodes
      if (enableIFRS16Leases        !== undefined) updateData.enableIFRS16Leases        = enableIFRS16Leases
      if (enablePayrollCOAPosting   !== undefined) updateData.enablePayrollCOAPosting   = enablePayrollCOAPosting

      // Side effects when enabling for the first time
      if (enableProjectTagging      && !current.enableProjectTagging)      await ensureTagCategory(orgId, "PROJECT",       "Project")
      if (enableGrantTagging        && !current.enableGrantTagging)        await ensureTagCategory(orgId, "GRANT",         "Grant")
      if (enableRelatedPartyTagging && !current.enableRelatedPartyTagging) await ensureTagCategory(orgId, "RELATED_PARTY", "Related Party")
      if (enableWGACPIDCodes        && !current.enableWGACPIDCodes)        await ensureTagCategory(orgId, "WGA_CPID",      "WGA CPID")
      if (enableIFRS16Leases        && !current.enableIFRS16Leases)        await seedIFRS16Accounts(orgId)
      if (enablePayrollCOAPosting   && !current.enablePayrollCOAPosting)   await seedPayrollCOAMappings(orgId)

      // Disable tag categories (does NOT delete data)
      if (enableProjectTagging      === false) await disableTagCategory(orgId, "PROJECT")
      if (enableGrantTagging        === false) await disableTagCategory(orgId, "GRANT")
      if (enableRelatedPartyTagging === false) await disableTagCategory(orgId, "RELATED_PARTY")
      if (enableWGACPIDCodes        === false) await disableTagCategory(orgId, "WGA_CPID")

      return prisma.orgModuleSettings.update({
        where: { orgId },
        data:  updateData,
      })
    }),

  getEnabledFeatures: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_VIEW))
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const s = await getOrCreateSettings(ctx.organizationId)
      return {
        projectTagging:         s.enableProjectTagging,
        grantTagging:           s.enableGrantTagging,
        relatedPartyTagging:    s.enableRelatedPartyTagging,
        wgaCPIDCodes:           s.enableWGACPIDCodes,
        fundAccounting:         s.enableFundAccounting,
        statutoryClassCodes:    s.enableStatutoryClassCodes,
        ifrs16Leases:           s.enableIFRS16Leases,
        payrollCOAPosting:      s.enablePayrollCOAPosting,
        payrollProjectAlloc:    s.enablePayrollProjectAllocation,
        payrollGrantAlloc:      s.enablePayrollGrantAllocation,
        payrollCostCentre:      s.enablePayrollCostCentreAnalysis,
        wgaReporting:           s.enableWGAReporting,
        multiCurrencyFX:        s.enableMultiCurrencyFX,
        intercompany:           s.enableIntercompany,
      }
    }),

  getOnboardingStatus: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_VIEW))
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const orgId = ctx.organizationId
      const s     = await getOrCreateSettings(orgId)

      const [
        bankAccountCount,
        coaCount,
        payrollMappingCount,
        leaseCount,
      ] = await Promise.all([
        prisma.bankAccount.count({ where: { organizationId: orgId } }),
        prisma.chartOfAccount.count({ where: { organizationId: orgId } }),
        prisma.payrollCOAMapping.count({ where: { orgId } }),
        s.enableIFRS16Leases
          ? prisma.lease.count({ where: { orgId } })
          : Promise.resolve(null),
      ])

      return {
        hasBankAccount:          bankAccountCount > 0,
        hasChartOfAccounts:      coaCount > 0,
        hasPayrollCOAMappings:   payrollMappingCount > 0,
        hasFirstLease:           leaseCount !== null ? leaseCount > 0 : null,
        ifrs16Enabled:           s.enableIFRS16Leases,
        payrollCOAEnabled:       s.enablePayrollCOAPosting,
      }
    }),
})
