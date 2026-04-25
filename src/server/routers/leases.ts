import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import {
  generateLeaseSchedule,
  calculatePresentValue,
  calculateInitialRouAsset,
  generateRouDepreciationSchedule,
  calculateLeaseModification,
  classifyCurrentVsNonCurrent,
  calculateDisclosureNote,
  type LeaseParams,
  type LeasePayment,
} from "@/lib/leases/ifrs16"

// ---------------------------------------------------------------------------
// Guard helper
// ---------------------------------------------------------------------------

async function requireIFRS16(orgId: string) {
  const s = await prisma.orgModuleSettings.findUnique({ where: { orgId } })
  if (!s?.enableIFRS16Leases) {
    throw new TRPCError({ code: "FORBIDDEN", message: "IFRS 16 module is not enabled for this organisation." })
  }
  return s
}

// ---------------------------------------------------------------------------
// Common lease input shape
// ---------------------------------------------------------------------------

const leaseCreateSchema = z.object({
  organizationId:               z.string(),
  leaseReference:               z.string(),
  description:                  z.string(),
  assetClass:                   z.string(),
  treatment:                    z.enum(["IFRS16_FULL", "FRS102_FINANCE", "SHORT_TERM_EXEMPT", "LOW_VALUE_EXEMPT"]),
  commencementDate:             z.date(),
  originalEndDate:              z.date(),
  revisedEndDate:               z.date().optional(),
  reviewDate:                   z.date().optional(),
  annualRentAmount:             z.string(),
  paymentFrequency:             z.enum(["MONTHLY", "QUARTERLY", "ANNUAL"]),
  paymentDayOfMonth:            z.number().min(1).max(28).default(1),
  rentFreeMonths:               z.number().min(0).default(0),
  incrementalBorrowingRate:     z.string(),
  currency:                     z.string().default("GBP"),
  rouAssetAccountId:            z.string().optional(),
  leaseLiabilityAccountId:      z.string().optional(),
  depreciationAccountId:        z.string().optional(),
  interestAccountId:            z.string().optional(),
  rentExpenseAccountId:         z.string().optional(),
  projectId:                    z.string().optional(),
  costCentreId:                 z.string().optional(),
  initialDirectCosts:           z.string().optional(),
  leaseIncentivesReceived:      z.string().optional(),
  restorationProvision:         z.string().optional(),
  landlordName:                 z.string().optional(),
  propertyAddress:              z.string().optional(),
  notes:                        z.string().optional(),
})

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const leasesRouter = createTRPCRouter({
  list: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({ organizationId: z.string(), status: z.string().optional(), assetClass: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      await requireIFRS16(ctx.organizationId)

      const leases = await prisma.lease.findMany({
        where: {
          orgId:      ctx.organizationId,
          ...(input.status    ? { status:     input.status }    : {}),
          ...(input.assetClass ? { assetClass: input.assetClass } : {}),
        },
        include: {
          rouAsset:       true,
          scheduleEntries: { orderBy: { periodNumber: "asc" }, take: 1 },
        },
        orderBy: { commencementDate: "asc" },
      })

      const now = new Date()
      return leases.map((lease) => {
        const classification = classifyCurrentVsNonCurrent(
          (lease.scheduleEntries as any[]),
          now
        )
        const nextEntry = lease.scheduleEntries.find((e) => !e.isPosted)
        return {
          ...lease,
          rouAssetNBV:      lease.rouAsset?.currentCarryingAmount ?? new Prisma.Decimal(0),
          currentLiability: classification.currentLiability,
          nonCurrentLiability: classification.nonCurrentLiability,
          nextPaymentDate:  nextEntry?.paymentDate ?? null,
          nextPaymentAmount: nextEntry?.leasePayment ?? null,
        }
      })
    }),

  getById: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireIFRS16(ctx.organizationId)

      const lease = await prisma.lease.findFirst({
        where:   { id: input.id, orgId: ctx.organizationId },
        include: {
          rouAsset: {
            include: { depreciationEntries: { orderBy: { periodStart: "asc" } } },
          },
          scheduleEntries: { orderBy: { periodNumber: "asc" } },
        },
      })
      if (!lease) throw new TRPCError({ code: "NOT_FOUND" })

      const classification = classifyCurrentVsNonCurrent(
        lease.scheduleEntries as any[],
        new Date()
      )

      return { ...lease, ...classification }
    }),

  create: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(leaseCreateSchema)
    .mutation(async ({ ctx, input }) => {
      await requireIFRS16(ctx.organizationId)

      if (input.originalEndDate <= input.commencementDate) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "End date must be after commencement date." })
      }
      const ibr = new Prisma.Decimal(input.incrementalBorrowingRate)
      if (ibr.lessThanOrEqualTo(0)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Incremental borrowing rate must be greater than zero." })
      }

      const lease = await prisma.lease.create({
        data: {
          orgId:                    ctx.organizationId,
          leaseReference:           input.leaseReference,
          description:              input.description,
          assetClass:               input.assetClass,
          treatment:                input.treatment,
          commencementDate:         input.commencementDate,
          originalEndDate:          input.originalEndDate,
          revisedEndDate:           input.revisedEndDate,
          reviewDate:               input.reviewDate,
          annualRentAmount:         new Prisma.Decimal(input.annualRentAmount),
          paymentFrequency:         input.paymentFrequency,
          paymentDayOfMonth:        input.paymentDayOfMonth,
          rentFreeMonths:           input.rentFreeMonths,
          incrementalBorrowingRate: ibr,
          currency:                 input.currency,
          rouAssetAccountId:        input.rouAssetAccountId,
          leaseLiabilityAccountId:  input.leaseLiabilityAccountId,
          depreciationAccountId:    input.depreciationAccountId,
          interestAccountId:        input.interestAccountId,
          rentExpenseAccountId:     input.rentExpenseAccountId,
          projectId:                input.projectId,
          costCentreId:             input.costCentreId,
          landlordName:             input.landlordName,
          propertyAddress:          input.propertyAddress,
          notes:                    input.notes,
        },
      })

      if (input.treatment === "IFRS16_FULL" || input.treatment === "FRS102_FINANCE") {
        const params: LeaseParams = {
          commencementDate: input.commencementDate,
          endDate:          input.originalEndDate,
          annualRent:       new Prisma.Decimal(input.annualRentAmount),
          paymentFrequency: input.paymentFrequency as any,
          paymentDay:       input.paymentDayOfMonth,
          ibrPercent:       ibr,
          rentFreeMonths:   input.rentFreeMonths,
          currency:         input.currency,
        }

        const schedule = generateLeaseSchedule(params)

        // Bulk insert schedule
        await prisma.leaseScheduleEntry.createMany({
          data: schedule.map((r) => ({
            leaseId:           lease.id,
            periodNumber:      r.periodNumber,
            periodStart:       r.periodStart,
            periodEnd:         r.periodEnd,
            paymentDate:       r.paymentDate,
            openingLiability:  r.openingLiability,
            leasePayment:      r.leasePayment,
            interestCharge:    r.interestCharge,
            principalRepayment: r.principalRepayment,
            closingLiability:  r.closingLiability,
          })),
        })

        const pvPayments         = schedule.length > 0 ? schedule[0].openingLiability : new Prisma.Decimal(0)
        const initialDirectCosts = new Prisma.Decimal(input.initialDirectCosts      ?? 0)
        const incentives         = new Prisma.Decimal(input.leaseIncentivesReceived ?? 0)
        const restoration        = new Prisma.Decimal(input.restorationProvision    ?? 0)

        const { initialCarryingAmount } = calculateInitialRouAsset({
          pvLeasePayments:         pvPayments,
          initialDirectCosts,
          leaseIncentivesReceived: incentives,
          restorationProvision:    restoration,
        })

        // Lease term in months
        const termMonths = Math.round(
          (input.originalEndDate.getTime() - input.commencementDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
        )

        const rouAsset = await prisma.rouAsset.create({
          data: {
            leaseId:                   lease.id,
            orgId:                     ctx.organizationId,
            recognitionDate:           input.commencementDate,
            presentValueLeasePayments: pvPayments,
            initialDirectCosts,
            leaseIncentivesReceived:   incentives,
            restorationProvision:      restoration,
            initialCarryingAmount,
            currentCarryingAmount:     initialCarryingAmount,
            depreciationTermMonths:    termMonths,
            depreciationMethod:        "STRAIGHT_LINE",
          },
        })

        const depSchedule = generateRouDepreciationSchedule({
          recognitionDate:        input.commencementDate,
          initialCarryingAmount,
          depreciationTermMonths: termMonths,
          residualValue:          new Prisma.Decimal(0),
          method:                 "STRAIGHT_LINE",
        })

        await prisma.rouDepreciationEntry.createMany({
          data: depSchedule.map((r) => ({
            rouAssetId:        rouAsset.id,
            periodStart:       r.periodStart,
            periodEnd:         r.periodEnd,
            openingNBV:        r.openingNBV,
            depreciationCharge: r.depreciationCharge,
            closingNBV:        r.closingNBV,
          })),
        })
      }

      return prisma.lease.findFirst({
        where:   { id: lease.id },
        include: { rouAsset: true, scheduleEntries: { orderBy: { periodNumber: "asc" } } },
      })
    }),

  modify: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(z.object({
      organizationId: z.string(),
      id:             z.string(),
      modification: z.object({
        type:                          z.enum(["EXTENSION", "EARLY_TERMINATION", "SCOPE_CHANGE"]),
        effectiveDate:                 z.date(),
        newEndDate:                    z.date().optional(),
        newAnnualRent:                 z.string().optional(),
        newIbrPercent:                 z.string().optional(),
        currentLiabilityCarryingAmount: z.string(),
        currentRouCarryingAmount:      z.string(),
        penalty:                       z.string().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireIFRS16(ctx.organizationId)

      const lease = await prisma.lease.findFirst({
        where:   { id: input.id, orgId: ctx.organizationId },
        include: { scheduleEntries: { orderBy: { periodNumber: "asc" } } },
      })
      if (!lease) throw new TRPCError({ code: "NOT_FOUND" })

      const mod = input.modification
      const originalParams: LeaseParams = {
        commencementDate: lease.commencementDate,
        endDate:          lease.revisedEndDate ?? lease.originalEndDate,
        annualRent:       lease.annualRentAmount,
        paymentFrequency: lease.paymentFrequency as any,
        paymentDay:       lease.paymentDayOfMonth,
        ibrPercent:       lease.incrementalBorrowingRate,
        rentFreeMonths:   lease.rentFreeMonths,
        currency:         lease.currency,
      }

      const result = calculateLeaseModification(originalParams, {
        type:            mod.type,
        effectiveDate:   mod.effectiveDate,
        newEndDate:      mod.newEndDate,
        newAnnualRent:   mod.newAnnualRent   ? new Prisma.Decimal(mod.newAnnualRent)   : undefined,
        newIbrPercent:   mod.newIbrPercent   ? new Prisma.Decimal(mod.newIbrPercent)   : undefined,
        currentLiabilityCarryingAmount: new Prisma.Decimal(mod.currentLiabilityCarryingAmount),
        currentRouCarryingAmount:       new Prisma.Decimal(mod.currentRouCarryingAmount),
        penalty:         mod.penalty ? new Prisma.Decimal(mod.penalty) : undefined,
      })

      // Delete future unposted schedule entries from effectiveDate
      await prisma.leaseScheduleEntry.deleteMany({
        where: { leaseId: input.id, periodStart: { gte: mod.effectiveDate }, isPosted: false },
      })

      if (mod.type !== "EARLY_TERMINATION" && result.newLiability.greaterThan(0)) {
        // Regenerate schedule
        const newParams: LeaseParams = {
          ...originalParams,
          commencementDate: mod.effectiveDate,
          endDate:          mod.newEndDate ?? originalParams.endDate,
          annualRent:       mod.newAnnualRent ? new Prisma.Decimal(mod.newAnnualRent) : originalParams.annualRent,
          ibrPercent:       mod.newIbrPercent ? new Prisma.Decimal(mod.newIbrPercent) : originalParams.ibrPercent,
        }
        const newSchedule = generateLeaseSchedule(newParams)
        const lastPeriod  = await prisma.leaseScheduleEntry.findFirst({
          where:   { leaseId: input.id },
          orderBy: { periodNumber: "desc" },
        })
        const startPeriod = (lastPeriod?.periodNumber ?? 0) + 1

        await prisma.leaseScheduleEntry.createMany({
          data: newSchedule.map((r, i) => ({
            leaseId:           input.id,
            periodNumber:      startPeriod + i,
            periodStart:       r.periodStart,
            periodEnd:         r.periodEnd,
            paymentDate:       r.paymentDate,
            openingLiability:  r.openingLiability,
            leasePayment:      r.leasePayment,
            interestCharge:    r.interestCharge,
            principalRepayment: r.principalRepayment,
            closingLiability:  r.closingLiability,
          })),
        })

        // Update lease end date if extended
        if (mod.newEndDate) {
          await prisma.lease.update({
            where: { id: input.id },
            data:  { revisedEndDate: mod.newEndDate },
          })
        }
      } else if (mod.type === "EARLY_TERMINATION") {
        await prisma.lease.update({
          where: { id: input.id },
          data:  { status: "TERMINATED", terminationDate: mod.effectiveDate, terminationPenalty: mod.penalty ? new Prisma.Decimal(mod.penalty) : undefined },
        })
      }

      // Update ROU asset carrying amount
      if (lease.rouAsset) {
        await prisma.rouAsset.update({
          where: { id: (lease.rouAsset as any).id },
          data:  { currentCarryingAmount: result.newRouCarryingAmount },
        })
      }

      return { ...result, journalEntries: result.journalEntries }
    }),

  terminate: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(z.object({
      organizationId:  z.string(),
      id:              z.string(),
      terminationDate: z.date(),
      penalty:         z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireIFRS16(ctx.organizationId)
      const lease = await prisma.lease.findFirst({ where: { id: input.id, orgId: ctx.organizationId } })
      if (!lease) throw new TRPCError({ code: "NOT_FOUND" })

      return prisma.lease.update({
        where: { id: input.id },
        data:  {
          status:            "TERMINATED",
          terminationDate:   input.terminationDate,
          terminationPenalty: input.penalty ? new Prisma.Decimal(input.penalty) : undefined,
        },
      })
    }),

  runPeriodPosting: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(z.object({ organizationId: z.string(), periodEnd: z.date() }))
    .mutation(async ({ ctx, input }) => {
      await requireIFRS16(ctx.organizationId)

      const [unpostedSchedule, unpostedDep] = await Promise.all([
        prisma.leaseScheduleEntry.findMany({
          where: { lease: { orgId: ctx.organizationId }, isPosted: false, periodEnd: { lte: input.periodEnd } },
        }),
        prisma.rouDepreciationEntry.findMany({
          where: { rouAsset: { orgId: ctx.organizationId }, isPosted: false, periodEnd: { lte: input.periodEnd } },
        }),
      ])

      const ZERO = new Prisma.Decimal(0)
      let totalInterest     = ZERO
      let totalDepreciation = ZERO

      // Mark schedule entries as posted
      if (unpostedSchedule.length > 0) {
        await prisma.leaseScheduleEntry.updateMany({
          where: { id: { in: unpostedSchedule.map((e) => e.id) } },
          data:  { isPosted: true, postedAt: new Date() },
        })
        totalInterest = unpostedSchedule.reduce((s, e) => s.plus(e.interestCharge), ZERO)
      }

      // Mark depreciation entries as posted and update ROU carrying amount
      if (unpostedDep.length > 0) {
        await prisma.rouDepreciationEntry.updateMany({
          where: { id: { in: unpostedDep.map((e) => e.id) } },
          data:  { isPosted: true, postedAt: new Date() },
        })
        totalDepreciation = unpostedDep.reduce((s, e) => s.plus(e.depreciationCharge), ZERO)

        // Update ROU carrying amounts
        const byAsset = new Map<string, Prisma.Decimal>()
        for (const e of unpostedDep) {
          byAsset.set(e.rouAssetId, (byAsset.get(e.rouAssetId) ?? ZERO).plus(e.depreciationCharge))
        }
        for (const [assetId, totalDep] of byAsset) {
          await prisma.rouAsset.update({
            where: { id: assetId },
            data: {
              accumulatedDepreciation: { increment: totalDep as any },
              currentCarryingAmount:   { decrement: totalDep as any },
              lastPostedDate:          input.periodEnd,
            },
          })
        }
      }

      return {
        leasesProcessed:  new Set(unpostedSchedule.map((e) => e.leaseId)).size,
        journalsCreated:  unpostedSchedule.length + unpostedDep.length,
        totalInterest,
        totalDepreciation,
      }
    }),

  getBalanceSheetAmounts: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({ organizationId: z.string(), asAtDate: z.date() }))
    .query(async ({ ctx, input }) => {
      await requireIFRS16(ctx.organizationId)

      const leases = await prisma.lease.findMany({
        where:   { orgId: ctx.organizationId, status: "ACTIVE" },
        include: {
          rouAsset:        true,
          scheduleEntries: { where: { isPosted: false }, orderBy: { periodNumber: "asc" } },
        },
      })

      return leases.map((lease) => {
        const classification = classifyCurrentVsNonCurrent(
          lease.scheduleEntries as any[],
          input.asAtDate
        )
        return {
          leaseId:         lease.id,
          leaseReference:  lease.leaseReference,
          description:     lease.description,
          assetClass:      lease.assetClass,
          rouAssetNBV:     (lease.rouAsset as any)?.currentCarryingAmount ?? new Prisma.Decimal(0),
          currentLiability:    classification.currentLiability,
          nonCurrentLiability: classification.nonCurrentLiability,
          totalLiability:  classification.currentLiability.plus(classification.nonCurrentLiability),
        }
      })
    }),

  getDisclosure: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({ organizationId: z.string(), periodEnd: z.date() }))
    .query(async ({ ctx, input }) => {
      await requireIFRS16(ctx.organizationId)

      const leases = await prisma.lease.findMany({
        where:   { orgId: ctx.organizationId, status: "ACTIVE" },
        include: { scheduleEntries: { orderBy: { periodNumber: "asc" } } },
      })

      const disclosures = leases.map((lease) =>
        calculateDisclosureNote(lease as any, input.periodEnd)
      )

      const ZERO = new Prisma.Decimal(0)
      return {
        leaseDisclosures: disclosures,
        consolidated: {
          maturityAnalysis: {
            lessThan1Year:     disclosures.reduce((s, d) => s.plus(d.maturityAnalysis.lessThan1Year),    ZERO),
            between1And2Years: disclosures.reduce((s, d) => s.plus(d.maturityAnalysis.between1And2Years), ZERO),
            between2And5Years: disclosures.reduce((s, d) => s.plus(d.maturityAnalysis.between2And5Years), ZERO),
            moreThan5Years:    disclosures.reduce((s, d) => s.plus(d.maturityAnalysis.moreThan5Years),    ZERO),
          },
          totalUndiscounted:   disclosures.reduce((s, d) => s.plus(d.totalUndiscounted),  ZERO),
          totalPresentValue:   disclosures.reduce((s, d) => s.plus(d.totalPresentValue),  ZERO),
          totalFinanceCharges: disclosures.reduce((s, d) => s.plus(d.totalFinanceCharges), ZERO),
        },
      }
    }),

  getMappingSuggestions: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      await requireIFRS16(ctx.organizationId)
      return prisma.chartOfAccount.findMany({
        where: {
          organizationId: ctx.organizationId,
          code:           { in: ["0700", "2600", "7700", "7701"] },
        },
        select: { id: true, code: true, name: true, accountType: true },
      })
    }),
})
