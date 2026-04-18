import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { handleError, logRequest, addSecurityHeaders } from "@/lib/error-handler"
import { EmailStatus } from "@prisma/client"

/**
 * Email Bounce Webhook
 * 
 * Receives bounce notifications from email providers
 * POST /api/emails/bounce
 * 
 * This is a stub implementation. In production, you would:
 * 1. Verify webhook signature from provider
 * 2. Parse provider-specific bounce format
 * 3. Update email outbox status
 * 4. Handle different bounce types (hard/soft)
 */
export async function POST(request: NextRequest) {
  try {
    logRequest(request)
    
    const body = await request.json()
    
    // Extract message ID from webhook payload
    // Format depends on provider (SendGrid, SES, Mailgun, etc.)
    const messageId = body.messageId || body['message-id'] || body.message_id || body.MessageId
    
    if (!messageId) {
      return NextResponse.json(
        { error: "Message ID not found in webhook payload" },
        { status: 400 }
      )
    }

    // Find email outbox entry by message ID
    const emailOutbox = await prisma.emailOutbox.findFirst({
      where: {
        messageId,
      },
    })

    if (!emailOutbox) {
      // Log but don't fail - message might be from another system
      console.warn(`Bounce webhook received for unknown message ID: ${messageId}`)
      return NextResponse.json({
        success: true,
        message: "Message ID not found in outbox",
      })
    }

    // Extract bounce reason
    const bounceReason = body.reason || body.bounceReason || body.error || body.description || "Unknown bounce reason"
    const bounceType = body.bounceType || body.type || "hard" // hard or soft

    // Update email outbox status
    await prisma.emailOutbox.update({
      where: { id: emailOutbox.id },
      data: {
        status: EmailStatus.BOUNCED,
        bouncedAt: new Date(),
        bounceReason: bounceReason,
        metadata: {
          ...((emailOutbox.metadata as any) || {}),
          bounceType,
          bounceDetails: body,
        },
      },
    })

    // In production, you might want to:
    // - Notify user about bounce
    // - Update customer/vendor email status
    // - Trigger retry for soft bounces
    // - Mark email as invalid for hard bounces

    const response = NextResponse.json({
      success: true,
      message: "Bounce processed",
      emailId: emailOutbox.id,
    })

    return addSecurityHeaders(response)
  } catch (error) {
    return handleError(error)
  }
}

/**
 * Email Delivery Webhook
 * 
 * Receives delivery status updates from email providers
 * POST /api/emails/delivery
 */
export async function PUT(request: NextRequest) {
  try {
    logRequest(request)
    
    const body = await request.json()
    const messageId = body.messageId || body['message-id'] || body.message_id || body.MessageId
    
    if (!messageId) {
      return NextResponse.json(
        { error: "Message ID not found" },
        { status: 400 }
      )
    }

    const emailOutbox = await prisma.emailOutbox.findFirst({
      where: { messageId },
    })

    if (!emailOutbox) {
      return NextResponse.json({
        success: true,
        message: "Message ID not found",
      })
    }

    // Determine status from webhook event
    const event = body.event || body.Event || body.type || body.Type
    let status = emailOutbox.status

    switch (event?.toLowerCase()) {
      case 'delivered':
      case 'delivery':
        status = EmailStatus.DELIVERED
        break
      case 'opened':
      case 'open':
        status = EmailStatus.OPENED
        break
      case 'clicked':
      case 'click':
        status = EmailStatus.CLICKED
        break
    }

    // Update email outbox
    const updateData: any = {
      status,
    }

    if (status === EmailStatus.DELIVERED && !emailOutbox.deliveredAt) {
      updateData.deliveredAt = new Date()
    }
    if (status === EmailStatus.OPENED && !emailOutbox.openedAt) {
      updateData.openedAt = new Date()
    }
    if (status === EmailStatus.CLICKED && !emailOutbox.clickedAt) {
      updateData.clickedAt = new Date()
    }

    await prisma.emailOutbox.update({
      where: { id: emailOutbox.id },
      data: updateData,
    })

    const response = NextResponse.json({
      success: true,
      message: "Delivery status updated",
      emailId: emailOutbox.id,
      status,
    })

    return addSecurityHeaders(response)
  } catch (error) {
    return handleError(error)
  }
}




