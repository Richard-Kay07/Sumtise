import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const backupSchema = z.object({
  organizationId: z.string(),
  type: z.enum(["full", "incremental"]).default("full"),
  includeFiles: z.boolean().default(false)
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { organizationId, type, includeFiles } = backupSchema.parse(body)

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const backupId = `backup_${organizationId}_${timestamp}`

    // Create backup record
    const backup = await prisma.backup.create({
      data: {
        id: backupId,
        organizationId,
        type,
        status: "in_progress",
        includeFiles,
        createdAt: new Date()
      }
    })

    try {
      // Export organization data
      const data = await exportOrganizationData(organizationId, type)
      
      // Store backup data
      await prisma.backupData.create({
        data: {
          backupId,
          data: JSON.stringify(data),
          size: JSON.stringify(data).length
        }
      })

      // If including files, copy file references
      if (includeFiles) {
        await exportFileReferences(organizationId, backupId)
      }

      // Update backup status
      await prisma.backup.update({
        where: { id: backupId },
        data: {
          status: "completed",
          completedAt: new Date()
        }
      })

      return NextResponse.json({
        success: true,
        backupId,
        message: "Backup completed successfully"
      })
    } catch (error) {
      // Update backup status to failed
      await prisma.backup.update({
        where: { id: backupId },
        data: {
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error"
        }
      })

      throw error
    }
  } catch (error) {
    console.error("Backup error:", error)
    return NextResponse.json(
      { error: "Backup failed" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get("organizationId")

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID required" },
        { status: 400 }
      )
    }

    const backups = await prisma.backup.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 10
    })

    return NextResponse.json({ backups })
  } catch (error) {
    console.error("Get backups error:", error)
    return NextResponse.json(
      { error: "Failed to retrieve backups" },
      { status: 500 }
    )
  }
}

async function exportOrganizationData(organizationId: string, type: string) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      members: {
        include: {
          user: true
        }
      }
    }
  })

  if (!organization) {
    throw new Error("Organization not found")
  }

  const data: any = {
    organization,
    timestamp: new Date().toISOString(),
    type
  }

  // Export chart of accounts
  data.chartOfAccounts = await prisma.chartOfAccount.findMany({
    where: { organizationId }
  })

  // Export transactions
  if (type === "full") {
    data.transactions = await prisma.transaction.findMany({
      where: { organizationId },
      include: {
        account: true
      }
    })
  } else {
    // Incremental backup - only last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    data.transactions = await prisma.transaction.findMany({
      where: {
        organizationId,
        createdAt: { gte: thirtyDaysAgo }
      },
      include: {
        account: true
      }
    })
  }

  // Export customers
  data.customers = await prisma.customer.findMany({
    where: { organizationId }
  })

  // Export invoices
  data.invoices = await prisma.invoice.findMany({
    where: { organizationId },
    include: {
      customer: true,
      items: true
    }
  })

  // Export bank accounts
  data.bankAccounts = await prisma.bankAccount.findMany({
    where: { organizationId }
  })

  // Export reports
  data.reports = await prisma.report.findMany({
    where: { organizationId }
  })

  return data
}

async function exportFileReferences(organizationId: string, backupId: string) {
  // This would export file references and metadata
  // For now, create a placeholder
  await prisma.backupFile.create({
    data: {
      backupId,
      filePath: "uploads/organization_files",
      fileSize: 0,
      fileType: "directory"
    }
  })
}
