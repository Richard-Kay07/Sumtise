import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { handleError, createRateLimiter, logRequest, addSecurityHeaders } from "@/lib/error-handler"

const auditLogSchema = z.object({
  organizationId: z.string(),
  userId: z.string(),
  action: z.string(),
  resource: z.string(),
  resourceId: z.string().optional(),
  details: z.record(z.any()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional()
})

const rateLimiter = createRateLimiter(1000, 60 * 1000) // 1000 requests per minute

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
    const auditData = auditLogSchema.parse(body)

    // Create audit log entry
    const auditLog = await prisma.auditLog.create({
      data: {
        organizationId: auditData.organizationId,
        userId: auditData.userId,
        action: auditData.action,
        resource: auditData.resource,
        resourceId: auditData.resourceId,
        details: auditData.details ? JSON.stringify(auditData.details) : null,
        ipAddress: auditData.ipAddress || request.ip || request.headers.get("x-forwarded-for") || "unknown",
        userAgent: auditData.userAgent || request.headers.get("user-agent") || "unknown",
        timestamp: new Date()
      }
    })

    const response = NextResponse.json({
      success: true,
      auditLogId: auditLog.id
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
    const userId = searchParams.get("userId")
    const action = searchParams.get("action")
    const resource = searchParams.get("resource")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const limit = parseInt(searchParams.get("limit") || "100")
    const offset = parseInt(searchParams.get("offset") || "0")

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID required" },
        { status: 400 }
      )
    }

    const where: any = { organizationId }
    
    if (userId) where.userId = userId
    if (action) where.action = action
    if (resource) where.resource = resource
    
    if (startDate || endDate) {
      where.timestamp = {}
      if (startDate) where.timestamp.gte = new Date(startDate)
      if (endDate) where.timestamp.lte = new Date(endDate)
    }

    const [auditLogs, totalCount] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: {
              name: true,
              email: true
            }
          }
        }
      }),
      prisma.auditLog.count({ where })
    ])

    const response = NextResponse.json({
      auditLogs,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    })
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
    const olderThan = searchParams.get("olderThan") // ISO date string

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID required" },
        { status: 400 }
      )
    }

    if (!olderThan) {
      return NextResponse.json(
        { error: "olderThan parameter required for safety" },
        { status: 400 }
      )
    }

    const cutoffDate = new Date(olderThan)
    
    // Only allow deletion of logs older than 1 year for safety
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    
    if (cutoffDate > oneYearAgo) {
      return NextResponse.json(
        { error: "Can only delete audit logs older than 1 year" },
        { status: 400 }
      )
    }

    const deletedCount = await prisma.auditLog.deleteMany({
      where: {
        organizationId,
        timestamp: { lt: cutoffDate }
      }
    })

    const response = NextResponse.json({
      success: true,
      deletedCount: deletedCount.count,
      message: `Deleted ${deletedCount.count} audit log entries older than ${cutoffDate.toISOString()}`
    })
    return addSecurityHeaders(response)
  } catch (error) {
    return handleError(error)
  }
}
