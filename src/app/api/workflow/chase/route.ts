import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * POST /api/workflow/chase
 * Called by an external cron service. Scans all PENDING ApprovalRequests,
 * sends reminders, and escalates overdue ones to delegates.
 *
 * Secure with WORKFLOW_CHASE_SECRET env var: pass as Authorization: Bearer <secret>
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization")
  const secret = process.env.WORKFLOW_CHASE_SECRET
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()

  const pending = await prisma.approvalRequest.findMany({
    where: { status: "PENDING" },
    include: {
      manualJournal: { select: { reference: true, description: true, submittedBy: true, organizationId: true } },
      actions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  })

  const results = { reminders: 0, escalations: 0, skipped: 0 }

  for (const req of pending) {
    const orgId = req.organizationId

    const policy = await prisma.workflowPolicy.findUnique({
      where: { organizationId_entityType: { organizationId: orgId, entityType: req.entityType } },
    })

    if (!policy || !policy.isActive) { results.skipped++; continue }

    const reminderIntervalMs = (policy.reminderHours ?? 24) * 3600 * 1000
    const maxReminders = policy.maxReminders ?? 3
    const lastReminderAt = req.lastReminderAt
    const lastEventAt = lastReminderAt ?? req.submittedAt ?? req.createdAt
    const timeSinceLast = now.getTime() - new Date(lastEventAt).getTime()

    if (timeSinceLast < reminderIntervalMs) { results.skipped++; continue }

    const reminderCount = req.reminderCount ?? 0
    const isOverdue = req.deadline && new Date(req.deadline) < now

    if (isOverdue && policy.delegateUserId && reminderCount >= maxReminders) {
      // Escalate to delegate
      await prisma.$transaction([
        prisma.approvalRequest.update({
          where: { id: req.id },
          data: { assignedTo: policy.delegateUserId, reminderCount: { increment: 1 }, lastReminderAt: now },
        }),
        prisma.approvalAction.create({
          data: {
            approvalRequestId: req.id,
            actionType: "ESCALATED",
            actorId: "system",
            notes: `Escalated to delegate after ${reminderCount} reminders`,
          },
        }),
        prisma.notification.create({
          data: {
            userId: policy.delegateUserId,
            organizationId: orgId,
            type: "APPROVAL_OVERDUE",
            title: "Approval escalated to you",
            message: `Journal ${req.manualJournal?.reference} has been escalated to you for approval (original approver did not respond within the deadline).`,
            priority: "URGENT",
            status: "PENDING",
            scheduledFor: now,
            metadata: JSON.stringify({ approvalRequestId: req.id }),
          },
        }),
      ])
      results.escalations++
    } else if (reminderCount < maxReminders && req.assignedTo) {
      // Send reminder to current approver
      await prisma.$transaction([
        prisma.approvalRequest.update({
          where: { id: req.id },
          data: { reminderCount: { increment: 1 }, lastReminderAt: now },
        }),
        prisma.approvalAction.create({
          data: {
            approvalRequestId: req.id,
            actionType: "REMINDER_SENT",
            actorId: "system",
            notes: `Reminder ${reminderCount + 1} of ${maxReminders}`,
          },
        }),
        prisma.notification.create({
          data: {
            userId: req.assignedTo,
            organizationId: orgId,
            type: "APPROVAL_REMINDER",
            title: "Approval reminder",
            message: `Journal ${req.manualJournal?.reference} is awaiting your approval${isOverdue ? " (overdue)" : ""}.`,
            priority: isOverdue ? "HIGH" : "MEDIUM",
            status: "PENDING",
            scheduledFor: now,
            metadata: JSON.stringify({ approvalRequestId: req.id }),
          },
        }),
      ])
      results.reminders++
    } else {
      results.skipped++
    }
  }

  return NextResponse.json({ ok: true, processed: pending.length, ...results })
}
