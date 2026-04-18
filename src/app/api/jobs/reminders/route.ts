/**
 * Reminder Job Endpoint
 * 
 * API endpoint for triggering reminder processing
 * Can be called by cron jobs, queues, or manually
 * 
 * POST /api/jobs/reminders
 */

import { NextRequest, NextResponse } from "next/server"
import { processAllReminders, processRemindersForOrganization } from "@/lib/jobs/reminder-scheduler"
import { handleError, logRequest, addSecurityHeaders } from "@/lib/error-handler"

/**
 * Process reminders
 * POST /api/jobs/reminders
 */
export async function POST(request: NextRequest) {
  try {
    logRequest(request)

    // Optional: Verify webhook secret or API key
    const authHeader = request.headers.get("authorization")
    const expectedToken = process.env.REMINDER_JOB_TOKEN

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { organizationId, maxReminders = 100, throttleDelay = 1000 } = body

    let results

    if (organizationId) {
      // Process for specific organization
      results = await processRemindersForOrganization(
        organizationId,
        maxReminders,
        throttleDelay
      )
    } else {
      // Process for all organizations
      results = await processAllReminders(maxReminders, throttleDelay)
    }

    const response = NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    })

    return addSecurityHeaders(response)
  } catch (error: any) {
    // Check if it's a lock error
    if (error.message?.includes("already running")) {
      return NextResponse.json(
        {
          success: false,
          error: "Reminder processor is already running",
          code: "LOCKED",
        },
        { status: 409 }
      )
    }

    return handleError(error)
  }
}

/**
 * Get reminder job status
 * GET /api/jobs/reminders
 */
export async function GET(request: NextRequest) {
  try {
    logRequest(request)

    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get("organizationId") || undefined

    const { getSchedulerStatus } = await import("@/lib/jobs/reminder-scheduler")
    const status = await getSchedulerStatus(organizationId || undefined)

    const response = NextResponse.json({
      success: true,
      status,
      timestamp: new Date().toISOString(),
    })

    return addSecurityHeaders(response)
  } catch (error) {
    return handleError(error)
  }
}




