/**
 * Settings Router
 * 
 * Provides endpoints for organization and user settings management
 */

import { z } from "zod"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { TRPCError } from "@trpc/server"

export const settingsRouter = createTRPCRouter({
  /**
   * Get organization settings by category
   */
  getOrganizationSettings: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_VIEW))
    .input(
      z.object({
        organizationId: z.string(),
        category: z.enum([
          "GENERAL",
          "ACCOUNTING",
          "INVOICING",
          "EXPENSES",
          "BANKING",
          "TAX",
          "NOTIFICATIONS",
          "INTEGRATIONS",
          "SECURITY",
          "BILLING",
        ]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { category } = input

      const where: any = {
        organizationId: ctx.organizationId,
      }

      if (category) {
        where.category = category
      }

      const settings = await prisma.organizationSettings.findMany({
        where,
        orderBy: { category: "asc" },
      })

      // Parse settings JSON
      const parsedSettings = settings.map((setting) => ({
        ...setting,
        settings: JSON.parse(setting.settings),
      }))

      return {
        settings: parsedSettings,
      }
    }),

  /**
   * Update organization settings
   */
  updateOrganizationSettings: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(
      z.object({
        organizationId: z.string(),
        category: z.enum([
          "GENERAL",
          "ACCOUNTING",
          "INVOICING",
          "EXPENSES",
          "BANKING",
          "TAX",
          "NOTIFICATIONS",
          "INTEGRATIONS",
          "SECURITY",
          "BILLING",
        ]),
        settings: z.record(z.any()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { category, settings } = input

      // Validate settings based on category
      const validatedSettings = await validateSettings(category, settings)

      // Upsert settings
      const organizationSettings = await prisma.organizationSettings.upsert({
        where: {
          organizationId_category: {
            organizationId: ctx.organizationId,
            category,
          },
        },
        update: {
          settings: JSON.stringify(validatedSettings),
          updatedAt: new Date(),
        },
        create: {
          organizationId: ctx.organizationId,
          category,
          settings: JSON.stringify(validatedSettings),
        },
      })

      return {
        ...organizationSettings,
        settings: JSON.parse(organizationSettings.settings),
      }
    }),

  /**
   * Get user profile
   */
  getProfile: orgScopedProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      })
    }

    return user
  }),

  /**
   * Update user profile
   */
  updateProfile: orgScopedProcedure
    .input(
      z.object({
        name: z.string().min(1).optional(),
        image: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await prisma.user.update({
        where: { id: ctx.userId },
        data: input,
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      return user
    }),

  /**
   * Get organization details
   */
  getOrganization: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.ORGANIZATION_VIEW))
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const organization = await prisma.organization.findUnique({
        where: { id: ctx.organizationId },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      })

      if (!organization) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        })
      }

      return organization
    }),

  /**
   * Update organization details
   */
  updateOrganization: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.ORGANIZATION_EDIT))
    .input(
      z.object({
        organizationId: z.string(),
        name: z.string().min(1).optional(),
        logo: z.string().url().optional(),
        website: z.string().url().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        address: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { organizationId, ...data } = input

      const organization = await prisma.organization.update({
        where: { id: ctx.organizationId },
        data,
      })

      return organization
    }),
})

/**
 * Validate settings based on category
 */
async function validateSettings(category: string, settings: any): Promise<any> {
  switch (category) {
    case "GENERAL":
      return z
        .object({
          companyName: z.string().min(1),
          companyAddress: z.string().optional(),
          companyPhone: z.string().optional(),
          companyEmail: z.string().email().optional(),
          timezone: z.string().default("UTC"),
          currency: z.string().default("GBP"),
          dateFormat: z.string().default("DD/MM/YYYY"),
          fiscalYearStart: z.string().default("01/04"), // UK fiscal year
          logo: z.string().url().optional(),
        })
        .parse(settings)

    case "ACCOUNTING":
      return z
        .object({
          chartOfAccountsTemplate: z
            .enum(["uk", "south_africa", "kenya", "zambia"])
            .default("uk"),
          autoNumbering: z.boolean().default(true),
          invoiceNumberPrefix: z.string().default("INV"),
          invoiceNumberStart: z.number().default(1),
          billNumberPrefix: z.string().default("BILL"),
          billNumberStart: z.number().default(1),
          enableDoubleEntry: z.boolean().default(true),
          requireApproval: z.boolean().default(false),
          approvalThreshold: z.number().default(1000),
          enableAuditTrail: z.boolean().default(true),
          lockDate: z.string().optional(), // Date string in ISO format
          lockPeriodEnd: z.string().optional(), // Date string in ISO format
        })
        .parse(settings)

    case "INVOICING":
      return z
        .object({
          defaultPaymentTerms: z.number().default(30),
          latePaymentFee: z.number().default(0),
          latePaymentFeePercentage: z.number().default(0),
          enableRecurringInvoices: z.boolean().default(true),
          invoiceTemplate: z.string().default("modern"),
          includePaymentLink: z.boolean().default(true),
          autoSendReminders: z.boolean().default(true),
          reminderDays: z.array(z.number()).default([7, 14, 30]),
          enableCustomerPortal: z.boolean().default(true),
        })
        .parse(settings)

    case "EXPENSES":
      return z
        .object({
          defaultPaymentTerms: z.number().default(30),
          requireApproval: z.boolean().default(false),
          approvalThreshold: z.number().default(1000),
          enableReceiptCapture: z.boolean().default(true),
          enableMileageTracking: z.boolean().default(false),
          defaultExpenseAccount: z.string().optional(),
        })
        .parse(settings)

    case "BANKING":
      return z
        .object({
          enableAutoReconciliation: z.boolean().default(false),
          reconciliationFrequency: z.enum(["daily", "weekly", "monthly"]).default("weekly"),
          enableBankFeeds: z.boolean().default(false),
          bankFeedProvider: z.string().optional(),
        })
        .parse(settings)

    case "TAX":
      return z
        .object({
          taxRegistrationNumber: z.string().optional(),
          taxScheme: z.enum(["VAT", "GST", "SALES_TAX", "NONE"]).default("VAT"),
          defaultTaxRate: z.number().default(20),
          enableTaxInclusive: z.boolean().default(false),
          taxReportingPeriod: z.enum(["monthly", "quarterly", "annually"]).default("quarterly"),
        })
        .parse(settings)

    case "NOTIFICATIONS":
      return z
        .object({
          emailNotifications: z.boolean().default(true),
          invoiceNotifications: z.boolean().default(true),
          paymentNotifications: z.boolean().default(true),
          expenseNotifications: z.boolean().default(true),
          reportNotifications: z.boolean().default(false),
        })
        .parse(settings)

    case "INTEGRATIONS":
      return z
        .object({
          stripeEnabled: z.boolean().default(false),
          stripeApiKey: z.string().optional(),
          sendgridEnabled: z.boolean().default(false),
          sendgridApiKey: z.string().optional(),
          xeroEnabled: z.boolean().default(false),
          xeroApiKey: z.string().optional(),
        })
        .parse(settings)

    case "SECURITY":
      return z
        .object({
          enable2FA: z.boolean().default(true),
          sessionTimeout: z.number().default(8), // hours
          passwordPolicy: z
            .object({
              minLength: z.number().default(8),
              requireUppercase: z.boolean().default(true),
              requireLowercase: z.boolean().default(true),
              requireNumbers: z.boolean().default(true),
              requireSymbols: z.boolean().default(true),
            })
            .default({}),
          enableIPWhitelist: z.boolean().default(false),
          allowedIPs: z.array(z.string()).default([]),
          enableAuditLogging: z.boolean().default(true),
          dataRetentionDays: z.number().default(2555), // 7 years
        })
        .parse(settings)

    case "BILLING":
      return z
        .object({
          plan: z.enum(["trial", "starter", "professional", "enterprise"]).default("trial"),
          billingCycle: z.enum(["monthly", "yearly"]).default("monthly"),
          trialEndsAt: z.string().optional(),
          nextBillingDate: z.string().optional(),
          autoRenew: z.boolean().default(true),
          paymentMethod: z.string().optional(),
          billingEmail: z.string().email().optional(),
          enableUsageTracking: z.boolean().default(true),
        })
        .parse(settings)

    default:
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Unknown settings category: ${category}`,
      })
  }
}




