export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { AnalyticsService } from "@/lib/analytics"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get("organizationId")
    const period = searchParams.get("period") || "30d"

    let analyticsData

    if (organizationId) {
      analyticsData = await AnalyticsService.getOrganizationAnalytics(organizationId)
    } else {
      analyticsData = await AnalyticsService.getSystemAnalytics()
    }

    const usageMetrics = organizationId 
      ? await AnalyticsService.getUsageMetrics(organizationId, period)
      : null

    // Get performance metrics
    const performanceMetrics = await getPerformanceMetrics(organizationId)

    return NextResponse.json({
      analytics: analyticsData,
      usage: usageMetrics,
      performance: performanceMetrics,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Analytics API error:", error)
    return NextResponse.json(
      { error: "Failed to retrieve analytics" },
      { status: 500 }
    )
  }
}

async function getPerformanceMetrics(organizationId?: string) {
  const now = new Date()
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const where = organizationId ? { organizationId } : {}

  // Database performance metrics
  const [totalQueries, slowQueries, avgResponseTime] = await Promise.all([
    prisma.usageLog.count({
      where: {
        ...where,
        action: "database_query",
        timestamp: { gte: last24Hours }
      }
    }),
    prisma.usageLog.count({
      where: {
        ...where,
        action: "slow_query",
        timestamp: { gte: last24Hours }
      }
    }),
    // This would be calculated from actual query logs
    150 // Placeholder for average response time in ms
  ])

  // API performance metrics
  const [totalApiCalls, errorRate, avgApiResponseTime] = await Promise.all([
    prisma.usageLog.count({
      where: {
        ...where,
        action: "api_call",
        timestamp: { gte: last24Hours }
      }
    }),
    prisma.usageLog.count({
      where: {
        ...where,
        action: "api_error",
        timestamp: { gte: last24Hours }
      }
    }),
    200 // Placeholder for average API response time in ms
  ])

  // System resource usage (simplified)
  const systemMetrics = {
    cpuUsage: 45, // Placeholder
    memoryUsage: 60, // Placeholder
    diskUsage: 30, // Placeholder
    networkLatency: 25 // Placeholder
  }

  return {
    database: {
      totalQueries,
      slowQueries,
      avgResponseTime,
      errorRate: totalQueries > 0 ? (slowQueries / totalQueries) * 100 : 0
    },
    api: {
      totalCalls: totalApiCalls,
      errorRate: totalApiCalls > 0 ? (errorRate / totalApiCalls) * 100 : 0,
      avgResponseTime
    },
    system: systemMetrics,
    uptime: 99.9, // Placeholder
    lastUpdated: now.toISOString()
  }
}
