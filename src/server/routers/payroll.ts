/**
 * Payroll Router
 * 
 * Provides endpoints for payroll management:
 * - Employee management
 * - Payroll runs (create, approve, process)
 * - Payroll entries (earnings/deductions)
 */

import { z } from "zod"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { TRPCError } from "@trpc/server"
import Decimal from "decimal.js"

export const payrollRouter = createTRPCRouter({
  /**
   * List all employees
   */
  employees: createTRPCRouter({
    getAll: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.PAYROLL_VIEW))
      .input(
        z.object({
          organizationId: z.string(),
          status: z.enum(["ACTIVE", "INACTIVE", "ON_LEAVE", "TERMINATED"]).optional(),
          page: z.number().min(1).default(1),
          limit: z.number().min(1).max(100).default(20),
        })
      )
      .query(async ({ ctx, input }) => {
        const { status, page, limit } = input
        const skip = (page - 1) * limit

        const where: any = {
          organizationId: ctx.organizationId,
        }

        if (status) {
          where.status = status
        }

        const [employees, total] = await Promise.all([
          prisma.employee.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          }),
          prisma.employee.count({ where }),
        ])

        return {
          employees,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        }
      }),

    getById: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.PAYROLL_VIEW))
      .input(
        z.object({
          organizationId: z.string(),
          id: z.string(),
        })
      )
      .query(async ({ ctx, input }) => {
        const employee = await prisma.employee.findFirst({
          where: {
            id: input.id,
            organizationId: ctx.organizationId,
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        })

        if (!employee) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Employee not found",
          })
        }

        return employee
      }),

    create: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.PAYROLL_CREATE))
      .input(
        z.object({
          organizationId: z.string(),
          employeeNumber: z.string().min(1),
          firstName: z.string().min(1),
          lastName: z.string().min(1),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          address: z.any().optional(),
          dateOfBirth: z.date().optional(),
          startDate: z.date(),
          employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACTOR", "TEMPORARY", "INTERN"]).default("FULL_TIME"),
          status: z.enum(["ACTIVE", "INACTIVE", "ON_LEAVE", "TERMINATED"]).default("ACTIVE"),
          salary: z.number().optional(),
          hourlyRate: z.number().optional(),
          taxCode: z.string().optional(),
          nationalInsuranceNumber: z.string().optional(),
          pensionScheme: z.string().optional(),
          bankAccountNumber: z.string().optional(),
          bankSortCode: z.string().optional(),
          notes: z.string().optional(),
          userId: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { organizationId, ...data } = input

        // Check if employee number already exists
        const existing = await prisma.employee.findUnique({
          where: {
            organizationId_employeeNumber: {
              organizationId: ctx.organizationId,
              employeeNumber: data.employeeNumber,
            },
          },
        })

        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Employee number already exists",
          })
        }

        const employee = await prisma.employee.create({
          data: {
            ...data,
            organizationId: ctx.organizationId,
            salary: data.salary ? new Decimal(data.salary) : null,
            hourlyRate: data.hourlyRate ? new Decimal(data.hourlyRate) : null,
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        })

        return employee
      }),
  }),

  /**
   * Payroll runs
   */
  runs: createTRPCRouter({
    getAll: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.PAYROLL_VIEW))
      .input(
        z.object({
          organizationId: z.string(),
          status: z.enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "PROCESSED", "CANCELLED"]).optional(),
          page: z.number().min(1).default(1),
          limit: z.number().min(1).max(100).default(20),
        })
      )
      .query(async ({ ctx, input }) => {
        const { status, page, limit } = input
        const skip = (page - 1) * limit

        const where: any = {
          organizationId: ctx.organizationId,
        }

        if (status) {
          where.status = status
        }

        const [runs, total] = await Promise.all([
          prisma.payrollRun.findMany({
            where,
            skip,
            take: limit,
            orderBy: { payDate: "desc" },
            include: {
              entries: {
                include: {
                  employee: {
                    select: {
                      id: true,
                      employeeNumber: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
          }),
          prisma.payrollRun.count({ where }),
        ])

        return {
          runs,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        }
      }),

    getById: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.PAYROLL_VIEW))
      .input(
        z.object({
          organizationId: z.string(),
          id: z.string(),
        })
      )
      .query(async ({ ctx, input }) => {
        const payrollRun = await prisma.payrollRun.findFirst({
          where: {
            id: input.id,
            organizationId: ctx.organizationId,
          },
          include: {
            entries: {
              include: {
                employee: {
                  select: {
                    id: true,
                    employeeNumber: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        })

        if (!payrollRun) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Payroll run not found",
          })
        }

        return payrollRun
      }),

    create: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.PAYROLL_CREATE))
      .input(
        z.object({
          organizationId: z.string(),
          runNumber: z.string().min(1),
          payPeriodStart: z.date(),
          payPeriodEnd: z.date(),
          payDate: z.date(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { organizationId, ...data } = input

        // Check if run number already exists
        const existing = await prisma.payrollRun.findUnique({
          where: {
            organizationId_runNumber: {
              organizationId: ctx.organizationId,
              runNumber: data.runNumber,
            },
          },
        })

        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Payroll run number already exists",
          })
        }

        const payrollRun = await prisma.payrollRun.create({
          data: {
            ...data,
            organizationId: ctx.organizationId,
            status: "DRAFT",
            totalGross: new Decimal(0),
            totalDeductions: new Decimal(0),
            totalNet: new Decimal(0),
            employeeCount: 0,
          },
        })

        return payrollRun
      }),

    addEntry: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.PAYROLL_CREATE))
      .input(
        z.object({
          organizationId: z.string(),
          payrollRunId: z.string(),
          employeeId: z.string(),
          grossPay: z.number().min(0),
          taxAmount: z.number().min(0).default(0),
          nationalInsurance: z.number().min(0).default(0),
          pensionEmployee: z.number().min(0).default(0),
          pensionEmployer: z.number().min(0).default(0),
          otherDeductions: z.number().min(0).default(0),
          earnings: z.any().optional(), // Breakdown of earnings
          deductionsBreakdown: z.any().optional(), // Breakdown of deductions
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const {
          organizationId,
          payrollRunId,
          employeeId,
          grossPay,
          taxAmount,
          nationalInsurance,
          pensionEmployee,
          pensionEmployer,
          otherDeductions,
          ...rest
        } = input

        // Verify payroll run exists and is in DRAFT status
        const payrollRun = await prisma.payrollRun.findFirst({
          where: {
            id: payrollRunId,
            organizationId: ctx.organizationId,
          },
        })

        if (!payrollRun) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Payroll run not found",
          })
        }

        if (payrollRun.status !== "DRAFT") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Can only add entries to DRAFT payroll runs",
          })
        }

        // Verify employee exists
        const employee = await prisma.employee.findFirst({
          where: {
            id: employeeId,
            organizationId: ctx.organizationId,
          },
        })

        if (!employee) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Employee not found",
          })
        }

        // Check if entry already exists for this employee in this run
        const existingEntry = await prisma.payrollEntry.findFirst({
          where: {
            payrollRunId,
            employeeId,
            organizationId: ctx.organizationId,
          },
        })

        if (existingEntry) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Payroll entry already exists for this employee in this run",
          })
        }

        // Calculate deductions and net pay
        const deductions = new Decimal(taxAmount)
          .plus(nationalInsurance)
          .plus(pensionEmployee)
          .plus(otherDeductions)

        const netPay = new Decimal(grossPay).minus(deductions)

        // Create entry
        const entry = await prisma.payrollEntry.create({
          data: {
            organizationId: ctx.organizationId,
            payrollRunId,
            employeeId,
            grossPay: new Decimal(grossPay),
            deductions,
            netPay,
            taxAmount: new Decimal(taxAmount),
            nationalInsurance: new Decimal(nationalInsurance),
            pensionEmployee: new Decimal(pensionEmployee),
            pensionEmployer: new Decimal(pensionEmployer),
            otherDeductions: new Decimal(otherDeductions),
            ...rest,
          },
        })

        // Update payroll run totals
        const updatedRun = await prisma.payrollRun.update({
          where: { id: payrollRunId },
          data: {
            totalGross: payrollRun.totalGross.plus(grossPay),
            totalDeductions: payrollRun.totalDeductions.plus(deductions),
            totalNet: payrollRun.totalNet.plus(netPay),
            employeeCount: payrollRun.employeeCount + 1,
          },
        })

        return {
          entry,
          payrollRun: updatedRun,
        }
      }),

    approve: orgScopedProcedure
      .use(requirePermissionProcedure(Permission.PAYROLL_APPROVE))
      .input(
        z.object({
          organizationId: z.string(),
          id: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const payrollRun = await prisma.payrollRun.findFirst({
          where: {
            id: input.id,
            organizationId: ctx.organizationId,
          },
        })

        if (!payrollRun) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Payroll run not found",
          })
        }

        if (payrollRun.status !== "DRAFT" && payrollRun.status !== "PENDING_APPROVAL") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot approve payroll run with status: ${payrollRun.status}`,
          })
        }

        // Update status to APPROVED
        const updated = await prisma.payrollRun.update({
          where: { id: input.id },
          data: {
            status: "APPROVED",
            approvedAt: new Date(),
            approvedBy: ctx.userId,
          },
        })

        // Note: Postings to ledger will be implemented in future phase
        // For now, we just change the status

        return updated
      }),
  }),
})




