import { prisma } from "@/lib/prisma"

export interface AnalyticsData {
  users: {
    total: number
    active: number
    newThisMonth: number
  }
  organizations: {
    total: number
    active: number
    newThisMonth: number
  }
  transactions: {
    total: number
    thisMonth: number
    totalValue: number
    monthlyValue: number
  }
  invoices: {
    total: number
    paid: number
    overdue: number
    totalValue: number
    outstandingValue: number
  }
  revenue: {
    thisMonth: number
    lastMonth: number
    growth: number
  }
  expenses: {
    thisMonth: number
    lastMonth: number
    growth: number
  }
}

export interface UsageMetrics {
  organizationId: string
  period: string
  apiCalls: number
  dataExports: number
  reportsGenerated: number
  invoicesCreated: number
  transactionsCreated: number
  activeUsers: number
  storageUsed: number
}

export class AnalyticsService {
  static async getSystemAnalytics(): Promise<AnalyticsData> {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

    // Get user metrics
    const [totalUsers, activeUsers, newUsersThisMonth] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          sessions: {
            some: {
              expires: { gt: now }
            }
          }
        }
      }),
      prisma.user.count({
        where: {
          createdAt: { gte: startOfMonth }
        }
      })
    ])

    // Get organization metrics
    const [totalOrgs, activeOrgs, newOrgsThisMonth] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({
        where: {
          members: {
            some: {
              user: {
                sessions: {
                  some: {
                    expires: { gt: now }
                  }
                }
              }
            }
          }
        }
      }),
      prisma.organization.count({
        where: {
          createdAt: { gte: startOfMonth }
        }
      })
    ])

    // Get transaction metrics
    const [totalTransactions, monthlyTransactions, totalTransactionValue, monthlyTransactionValue] = await Promise.all([
      prisma.transaction.count(),
      prisma.transaction.count({
        where: {
          createdAt: { gte: startOfMonth }
        }
      }),
      prisma.transaction.aggregate({
        _sum: {
          debit: true,
          credit: true
        }
      }),
      prisma.transaction.aggregate({
        where: {
          createdAt: { gte: startOfMonth }
        },
        _sum: {
          debit: true,
          credit: true
        }
      })
    ])

    // Get invoice metrics
    const [totalInvoices, paidInvoices, overdueInvoices, totalInvoiceValue, outstandingInvoiceValue] = await Promise.all([
      prisma.invoice.count(),
      prisma.invoice.count({
        where: { status: "PAID" }
      }),
      prisma.invoice.count({
        where: { status: "OVERDUE" }
      }),
      prisma.invoice.aggregate({
        _sum: { total: true }
      }),
      prisma.invoice.aggregate({
        where: {
          status: { in: ["SENT", "OVERDUE"] }
        },
        _sum: { total: true }
      })
    ])

    // Calculate revenue metrics
    const revenueAccounts = await prisma.chartOfAccount.findMany({
      where: { type: "REVENUE" }
    })

    const [thisMonthRevenue, lastMonthRevenue] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          accountId: { in: revenueAccounts.map(acc => acc.id) },
          createdAt: { gte: startOfMonth }
        },
        _sum: { credit: true }
      }),
      prisma.transaction.aggregate({
        where: {
          accountId: { in: revenueAccounts.map(acc => acc.id) },
          createdAt: {
            gte: startOfLastMonth,
            lte: endOfLastMonth
          }
        },
        _sum: { credit: true }
      })
    ])

    // Calculate expense metrics
    const expenseAccounts = await prisma.chartOfAccount.findMany({
      where: { type: "EXPENSE" }
    })

    const [thisMonthExpenses, lastMonthExpenses] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          accountId: { in: expenseAccounts.map(acc => acc.id) },
          createdAt: { gte: startOfMonth }
        },
        _sum: { debit: true }
      }),
      prisma.transaction.aggregate({
        where: {
          accountId: { in: expenseAccounts.map(acc => acc.id) },
          createdAt: {
            gte: startOfLastMonth,
            lte: endOfLastMonth
          }
        },
        _sum: { debit: true }
      })
    ])

    const revenueGrowth = lastMonthRevenue._sum.credit 
      ? ((thisMonthRevenue._sum.credit || 0) - (lastMonthRevenue._sum.credit || 0)) / (lastMonthRevenue._sum.credit || 1) * 100
      : 0

    const expenseGrowth = lastMonthExpenses._sum.debit
      ? ((thisMonthExpenses._sum.debit || 0) - (lastMonthExpenses._sum.debit || 0)) / (lastMonthExpenses._sum.debit || 1) * 100
      : 0

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        newThisMonth: newUsersThisMonth
      },
      organizations: {
        total: totalOrgs,
        active: activeOrgs,
        newThisMonth: newOrgsThisMonth
      },
      transactions: {
        total: totalTransactions,
        thisMonth: monthlyTransactions,
        totalValue: (totalTransactionValue._sum.debit || 0) + (totalTransactionValue._sum.credit || 0),
        monthlyValue: (monthlyTransactionValue._sum.debit || 0) + (monthlyTransactionValue._sum.credit || 0)
      },
      invoices: {
        total: totalInvoices,
        paid: paidInvoices,
        overdue: overdueInvoices,
        totalValue: totalInvoiceValue._sum.total || 0,
        outstandingValue: outstandingInvoiceValue._sum.total || 0
      },
      revenue: {
        thisMonth: thisMonthRevenue._sum.credit || 0,
        lastMonth: lastMonthRevenue._sum.credit || 0,
        growth: revenueGrowth
      },
      expenses: {
        thisMonth: thisMonthExpenses._sum.debit || 0,
        lastMonth: lastMonthExpenses._sum.debit || 0,
        growth: expenseGrowth
      }
    }
  }

  static async getOrganizationAnalytics(organizationId: string): Promise<AnalyticsData> {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

    // Get organization-specific metrics
    const [totalTransactions, monthlyTransactions, totalTransactionValue, monthlyTransactionValue] = await Promise.all([
      prisma.transaction.count({
        where: { organizationId }
      }),
      prisma.transaction.count({
        where: {
          organizationId,
          createdAt: { gte: startOfMonth }
        }
      }),
      prisma.transaction.aggregate({
        where: { organizationId },
        _sum: {
          debit: true,
          credit: true
        }
      }),
      prisma.transaction.aggregate({
        where: {
          organizationId,
          createdAt: { gte: startOfMonth }
        },
        _sum: {
          debit: true,
          credit: true
        }
      })
    ])

    const [totalInvoices, paidInvoices, overdueInvoices, totalInvoiceValue, outstandingInvoiceValue] = await Promise.all([
      prisma.invoice.count({
        where: { organizationId }
      }),
      prisma.invoice.count({
        where: { organizationId, status: "PAID" }
      }),
      prisma.invoice.count({
        where: { organizationId, status: "OVERDUE" }
      }),
      prisma.invoice.aggregate({
        where: { organizationId },
        _sum: { total: true }
      }),
      prisma.invoice.aggregate({
        where: {
          organizationId,
          status: { in: ["SENT", "OVERDUE"] }
        },
        _sum: { total: true }
      })
    ])

    // Calculate revenue and expenses for this organization
    const revenueAccounts = await prisma.chartOfAccount.findMany({
      where: { organizationId, type: "REVENUE" }
    })

    const expenseAccounts = await prisma.chartOfAccount.findMany({
      where: { organizationId, type: "EXPENSE" }
    })

    const [thisMonthRevenue, lastMonthRevenue, thisMonthExpenses, lastMonthExpenses] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          organizationId,
          accountId: { in: revenueAccounts.map(acc => acc.id) },
          createdAt: { gte: startOfMonth }
        },
        _sum: { credit: true }
      }),
      prisma.transaction.aggregate({
        where: {
          organizationId,
          accountId: { in: revenueAccounts.map(acc => acc.id) },
          createdAt: {
            gte: startOfLastMonth,
            lte: endOfLastMonth
          }
        },
        _sum: { credit: true }
      }),
      prisma.transaction.aggregate({
        where: {
          organizationId,
          accountId: { in: expenseAccounts.map(acc => acc.id) },
          createdAt: { gte: startOfMonth }
        },
        _sum: { debit: true }
      }),
      prisma.transaction.aggregate({
        where: {
          organizationId,
          accountId: { in: expenseAccounts.map(acc => acc.id) },
          createdAt: {
            gte: startOfLastMonth,
            lte: endOfLastMonth
          }
        },
        _sum: { debit: true }
      })
    ])

    const revenueGrowth = lastMonthRevenue._sum.credit 
      ? ((thisMonthRevenue._sum.credit || 0) - (lastMonthRevenue._sum.credit || 0)) / (lastMonthRevenue._sum.credit || 1) * 100
      : 0

    const expenseGrowth = lastMonthExpenses._sum.debit
      ? ((thisMonthExpenses._sum.debit || 0) - (lastMonthExpenses._sum.debit || 0)) / (lastMonthExpenses._sum.debit || 1) * 100
      : 0

    return {
      users: {
        total: 0, // Not applicable for organization analytics
        active: 0,
        newThisMonth: 0
      },
      organizations: {
        total: 1, // This organization
        active: 1,
        newThisMonth: 0
      },
      transactions: {
        total: totalTransactions,
        thisMonth: monthlyTransactions,
        totalValue: (totalTransactionValue._sum.debit || 0) + (totalTransactionValue._sum.credit || 0),
        monthlyValue: (monthlyTransactionValue._sum.debit || 0) + (monthlyTransactionValue._sum.credit || 0)
      },
      invoices: {
        total: totalInvoices,
        paid: paidInvoices,
        overdue: overdueInvoices,
        totalValue: totalInvoiceValue._sum.total || 0,
        outstandingValue: outstandingInvoiceValue._sum.total || 0
      },
      revenue: {
        thisMonth: thisMonthRevenue._sum.credit || 0,
        lastMonth: lastMonthRevenue._sum.credit || 0,
        growth: revenueGrowth
      },
      expenses: {
        thisMonth: thisMonthExpenses._sum.debit || 0,
        lastMonth: lastMonthExpenses._sum.debit || 0,
        growth: expenseGrowth
      }
    }
  }

  static async trackUsage(organizationId: string, action: string, metadata?: any): Promise<void> {
    try {
      await prisma.usageLog.create({
        data: {
          organizationId,
          action,
          metadata: metadata ? JSON.stringify(metadata) : null,
          timestamp: new Date()
        }
      })
    } catch (error) {
      console.error("Failed to track usage:", error)
    }
  }

  static async getUsageMetrics(organizationId: string, period: string = "30d"): Promise<UsageMetrics> {
    const now = new Date()
    let startDate: Date

    switch (period) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    const [
      apiCalls,
      dataExports,
      reportsGenerated,
      invoicesCreated,
      transactionsCreated,
      activeUsers
    ] = await Promise.all([
      prisma.usageLog.count({
        where: {
          organizationId,
          action: "api_call",
          timestamp: { gte: startDate }
        }
      }),
      prisma.usageLog.count({
        where: {
          organizationId,
          action: "data_export",
          timestamp: { gte: startDate }
        }
      }),
      prisma.usageLog.count({
        where: {
          organizationId,
          action: "report_generated",
          timestamp: { gte: startDate }
        }
      }),
      prisma.invoice.count({
        where: {
          organizationId,
          createdAt: { gte: startDate }
        }
      }),
      prisma.transaction.count({
        where: {
          organizationId,
          createdAt: { gte: startDate }
        }
      }),
      prisma.organizationMember.count({
        where: {
          organizationId,
          user: {
            sessions: {
              some: {
                expires: { gt: now }
              }
            }
          }
        }
      })
    ])

    // Calculate storage used (simplified)
    const storageUsed = await prisma.usageLog.aggregate({
      where: {
        organizationId,
        action: "file_upload",
        timestamp: { gte: startDate }
      },
      _sum: {
        // This would need to be calculated based on actual file sizes
      }
    })

    return {
      organizationId,
      period,
      apiCalls,
      dataExports,
      reportsGenerated,
      invoicesCreated,
      transactionsCreated,
      activeUsers,
      storageUsed: 0 // Placeholder
    }
  }
}
