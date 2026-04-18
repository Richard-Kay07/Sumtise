import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { handleError, createRateLimiter, logRequest, addSecurityHeaders } from "@/lib/error-handler"

const notificationSchema = z.object({
  organizationId: z.string(),
  userId: z.string().optional(),
  type: z.enum([
    "invoice_overdue",
    "payment_received", 
    "expense_approved",
    "bank_reconciliation_needed",
    "tax_deadline_approaching",
    "low_balance_alert",
    "system_maintenance",
    "feature_update"
  ]),
  title: z.string(),
  message: z.string(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  metadata: z.record(z.any()).optional(),
  scheduledFor: z.string().optional()
})

const rateLimiter = createRateLimiter(100, 60 * 1000) // 100 requests per minute

export async function POST(request: NextRequest) {
  try {
    // Security and rate limiting
    if (!rateLimiter(request)) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      )
    }

    logRequest(request)
    
    const body = await request.json()
    const notificationData = notificationSchema.parse(body)

    // Create notification
    const notification = await prisma.notification.create({
      data: {
        organizationId: notificationData.organizationId,
        userId: notificationData.userId,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        priority: notificationData.priority,
        metadata: notificationData.metadata ? JSON.stringify(notificationData.metadata) : null,
        scheduledFor: notificationData.scheduledFor ? new Date(notificationData.scheduledFor) : new Date(),
        status: "pending"
      }
    })

    // If scheduled for future, don't send immediately
    if (notificationData.scheduledFor && new Date(notificationData.scheduledFor) > new Date()) {
      return NextResponse.json({
        success: true,
        notificationId: notification.id,
        message: "Notification scheduled successfully"
      })
    }

    // Send notification immediately
    await sendNotification(notification)

    return NextResponse.json({
      success: true,
      notificationId: notification.id,
      message: "Notification sent successfully"
    })
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
    const status = searchParams.get("status") || "unread"
    const limit = parseInt(searchParams.get("limit") || "50")

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID required" },
        { status: 400 }
      )
    }

    const where: any = { organizationId }
    if (userId) where.userId = userId
    if (status !== "all") where.status = status

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

    const response = NextResponse.json({ notifications })
    return addSecurityHeaders(response)
  } catch (error) {
    return handleError(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    logRequest(request)
    
    const body = await request.json()
    const { notificationId, action } = z.object({
      notificationId: z.string(),
      action: z.enum(["mark_read", "mark_unread", "dismiss", "archive"])
    }).parse(body)

    const updateData: any = {}
    
    switch (action) {
      case "mark_read":
        updateData.status = "read"
        updateData.readAt = new Date()
        break
      case "mark_unread":
        updateData.status = "unread"
        updateData.readAt = null
        break
      case "dismiss":
        updateData.status = "dismissed"
        updateData.dismissedAt = new Date()
        break
      case "archive":
        updateData.status = "archived"
        updateData.archivedAt = new Date()
        break
    }

    const notification = await prisma.notification.update({
      where: { id: notificationId },
      data: updateData
    })

    const response = NextResponse.json({
      success: true,
      notification
    })
    return addSecurityHeaders(response)
  } catch (error) {
    return handleError(error)
  }
}

async function sendNotification(notification: any) {
  try {
    // Update status to sent
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: "sent",
        sentAt: new Date()
      }
    })

    // Here you would integrate with your notification providers:
    // - Email (SendGrid, AWS SES, etc.)
    // - SMS (Twilio, etc.)
    // - Push notifications (Firebase, etc.)
    // - In-app notifications (WebSocket, Server-Sent Events)
    
    console.log(`Notification sent: ${notification.title} to ${notification.userId || 'all users'}`)
    
    // For now, just log the notification
    // In production, you would implement actual delivery mechanisms
    
  } catch (error) {
    console.error("Failed to send notification:", error)
    
    // Update status to failed
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error"
      }
    })
  }
}
