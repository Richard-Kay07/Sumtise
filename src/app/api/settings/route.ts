import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { handleError, createRateLimiter, logRequest, addSecurityHeaders } from "@/lib/error-handler"
import { requireOrganizationAccess, createErrorResponse } from "@/lib/guards/rest-api"

const settingsSchema = z.object({
  organizationId: z.string(),
  category: z.enum([
    "general",
    "accounting", 
    "invoicing",
    "expenses",
    "banking",
    "tax",
    "notifications",
    "integrations",
    "security",
    "billing"
  ]),
  settings: z.record(z.any())
})

const rateLimiter = createRateLimiter(100, 60 * 1000) // 100 requests per minute

export async function POST(request: NextRequest) {
  try {
    if (!rateLimiter(request)) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      )
    }

    logRequest(request)
    
    const body = await request.json()
    const { organizationId, category, settings } = settingsSchema.parse(body)

    // Verify organization access (pass organizationId to avoid re-parsing body)
    await requireOrganizationAccess(request, organizationId)

    // Validate settings based on category
    const validatedSettings = await validateSettings(category, settings)

    // Upsert settings
    const organizationSettings = await prisma.organizationSettings.upsert({
      where: {
        organizationId_category: {
          organizationId,
          category
        }
      },
      update: {
        settings: JSON.stringify(validatedSettings),
        updatedAt: new Date()
      },
      create: {
        organizationId,
        category,
        settings: JSON.stringify(validatedSettings)
      }
    })

    const response = NextResponse.json({
      success: true,
      settings: organizationSettings
    })
    return addSecurityHeaders(response)
  } catch (error) {
    return handleError(error)
  }
}

export async function GET(request: NextRequest) {
  try {
    logRequest(request)
    
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get("organizationId")
    const category = searchParams.get("category")

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID required" },
        { status: 400 }
      )
    }

    // Verify organization access
    await requireOrganizationAccess(request, organizationId)

    const where: any = { organizationId }
    if (category) where.category = category

    const settings = await prisma.organizationSettings.findMany({
      where,
      orderBy: { category: "asc" }
    })

    // Parse settings JSON
    const parsedSettings = settings.map(setting => ({
      ...setting,
      settings: JSON.parse(setting.settings)
    }))

    const response = NextResponse.json({ settings: parsedSettings })
    return addSecurityHeaders(response)
  } catch (error) {
    return handleError(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    logRequest(request)
    
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get("organizationId")
    const category = searchParams.get("category")

    if (!organizationId || !category) {
      return NextResponse.json(
        { error: "Organization ID and category required" },
        { status: 400 }
      )
    }

    // Verify organization access
    await requireOrganizationAccess(request, organizationId)

    await prisma.organizationSettings.delete({
      where: {
        organizationId_category: {
          organizationId,
          category
        }
      }
    })

    const response = NextResponse.json({
      success: true,
      message: `Settings for category '${category}' deleted successfully`
    })
    return addSecurityHeaders(response)
  } catch (error) {
    return handleError(error)
  }
}

async function validateSettings(category: string, settings: any): Promise<any> {
  switch (category) {
    case "general":
      return z.object({
        companyName: z.string().min(1),
        companyAddress: z.string().optional(),
        companyPhone: z.string().optional(),
        companyEmail: z.string().email().optional(),
        timezone: z.string().default("UTC"),
        currency: z.string().default("GBP"),
        dateFormat: z.string().default("DD/MM/YYYY"),
        fiscalYearStart: z.string().default("01/04"), // UK fiscal year
        logo: z.string().url().optional()
      }).parse(settings)

    case "accounting":
      return z.object({
        chartOfAccountsTemplate: z.enum(["uk", "south_africa", "kenya", "zambia"]).default("uk"),
        autoNumbering: z.boolean().default(true),
        invoiceNumberPrefix: z.string().default("INV"),
        invoiceNumberStart: z.number().default(1),
        enableDoubleEntry: z.boolean().default(true),
        requireApproval: z.boolean().default(false),
        approvalThreshold: z.number().default(1000),
        enableAuditTrail: z.boolean().default(true)
      }).parse(settings)

    case "invoicing":
      return z.object({
        defaultPaymentTerms: z.number().default(30),
        latePaymentFee: z.number().default(0),
        latePaymentFeePercentage: z.number().default(0),
        enableRecurringInvoices: z.boolean().default(true),
        invoiceTemplate: z.string().default("modern"),
        includePaymentLink: z.boolean().default(true),
        autoSendReminders: z.boolean().default(true),
        reminderDays: z.array(z.number()).default([7, 14, 30]),
        enableCustomerPortal: z.boolean().default(true)
      }).parse(settings)

    case "expenses":
      return z.object({
        enableOCR: z.boolean().default(true),
        autoCategorization: z.boolean().default(true),
        requireReceipts: z.boolean().default(true),
        approvalWorkflow: z.boolean().default(true),
        mileageRate: z.number().default(0.45), // UK HMRC rate
        enablePerDiem: z.boolean().default(false),
        perDiemRates: z.record(z.number()).default({}),
        enableMileageTracking: z.boolean().default(true)
      }).parse(settings)

    case "banking":
      return z.object({
        enableOpenBanking: z.boolean().default(false),
        autoReconciliation: z.boolean().default(true),
        reconciliationThreshold: z.number().default(0.01),
        enableBankRules: z.boolean().default(true),
        enableCashFlowForecasting: z.boolean().default(true),
        forecastDays: z.number().default(90),
        enableLowBalanceAlerts: z.boolean().default(true),
        lowBalanceThreshold: z.number().default(1000)
      }).parse(settings)

    case "tax":
      return z.object({
        country: z.enum(["uk", "south_africa", "kenya", "zambia"]).default("uk"),
        vatNumber: z.string().optional(),
        taxYear: z.string().default("2024-25"),
        enableMTD: z.boolean().default(true), // UK Making Tax Digital
        enableAutoSubmission: z.boolean().default(false),
        taxDeadlineReminders: z.boolean().default(true),
        reminderDays: z.array(z.number()).default([30, 14, 7, 1]),
        enableTaxCalculations: z.boolean().default(true)
      }).parse(settings)

    case "notifications":
      return z.object({
        emailNotifications: z.boolean().default(true),
        smsNotifications: z.boolean().default(false),
        pushNotifications: z.boolean().default(true),
        invoiceOverdue: z.boolean().default(true),
        paymentReceived: z.boolean().default(true),
        expenseApproved: z.boolean().default(true),
        bankReconciliationNeeded: z.boolean().default(true),
        taxDeadlineApproaching: z.boolean().default(true),
        lowBalanceAlert: z.boolean().default(true),
        systemMaintenance: z.boolean().default(true),
        featureUpdates: z.boolean().default(true)
      }).parse(settings)

    case "integrations":
      return z.object({
        stripeEnabled: z.boolean().default(false),
        stripePublishableKey: z.string().optional(),
        stripeSecretKey: z.string().optional(),
        paypalEnabled: z.boolean().default(false),
        paypalClientId: z.string().optional(),
        paypalClientSecret: z.string().optional(),
        mpesaEnabled: z.boolean().default(false),
        mpesaConsumerKey: z.string().optional(),
        mpesaConsumerSecret: z.string().optional(),
        openaiEnabled: z.boolean().default(false),
        openaiApiKey: z.string().optional(),
        sendgridEnabled: z.boolean().default(false),
        sendgridApiKey: z.string().optional()
      }).parse(settings)

    case "security":
      return z.object({
        enable2FA: z.boolean().default(true),
        sessionTimeout: z.number().default(8), // hours
        passwordPolicy: z.object({
          minLength: z.number().default(8),
          requireUppercase: z.boolean().default(true),
          requireLowercase: z.boolean().default(true),
          requireNumbers: z.boolean().default(true),
          requireSymbols: z.boolean().default(true)
        }),
        enableIPWhitelist: z.boolean().default(false),
        allowedIPs: z.array(z.string()).default([]),
        enableAuditLogging: z.boolean().default(true),
        dataRetentionDays: z.number().default(2555) // 7 years
      }).parse(settings)

    case "billing":
      return z.object({
        plan: z.enum(["trial", "starter", "professional", "enterprise"]).default("trial"),
        billingCycle: z.enum(["monthly", "yearly"]).default("monthly"),
        trialEndsAt: z.string().optional(),
        nextBillingDate: z.string().optional(),
        autoRenew: z.boolean().default(true),
        paymentMethod: z.string().optional(),
        billingEmail: z.string().email().optional(),
        enableUsageTracking: z.boolean().default(true)
      }).parse(settings)

    default:
      throw new Error(`Unknown settings category: ${category}`)
  }
}
