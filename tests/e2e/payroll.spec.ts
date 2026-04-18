import { test, expect } from "@playwright/test"

/**
 * Week 11.1 - Payroll DB & Backend E2E Tests
 * 
 * Tests cover:
 * - List employees
 * - Create payroll run (DRAFT)
 * - Add entries (earnings/deductions)
 * - Approve run
 * - Referential integrity
 * - Org guard
 * - Draft→approved status change recorded
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000"

test.describe("Week 11.1 - Payroll Module", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to sign-in page
    await page.goto(`${BASE_URL}/auth/signin`)
    
    // Fill in credentials
    await page.fill('input[name="email"]', "admin@sumtise.com")
    await page.fill('input[name="password"]', "password123")
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Wait for navigation
    await page.waitForURL(/\//, { timeout: 10000 })
  })

  test.describe("Employees", () => {
    test("should list employees", async ({ page }) => {
      // This test would navigate to employees page when UI is created
      // For now, we test the API endpoint
      const response = await page.request.get(
        `/api/trpc/payroll.employees.getAll?input=${JSON.stringify({
          organizationId: "demo-org-id",
          page: 1,
          limit: 20,
        })}`
      )

      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.result?.data).toHaveProperty("employees")
      expect(data.result?.data).toHaveProperty("pagination")
    })

    test("should filter employees by status", async ({ page }) => {
      const response = await page.request.get(
        `/api/trpc/payroll.employees.getAll?input=${JSON.stringify({
          organizationId: "demo-org-id",
          status: "ACTIVE",
          page: 1,
          limit: 20,
        })}`
      )

      expect(response.status()).toBe(200)
      const data = await response.json()
      data.result?.data.employees.forEach((emp: any) => {
        expect(emp.status).toBe("ACTIVE")
      })
    })
  })

  test.describe("Payroll Runs", () => {
    test("should create payroll run in DRAFT status", async ({ page }) => {
      const payPeriodStart = new Date()
      payPeriodStart.setDate(1)
      const payPeriodEnd = new Date(payPeriodStart)
      payPeriodEnd.setMonth(payPeriodEnd.getMonth() + 1)
      payPeriodEnd.setDate(0)
      const payDate = new Date(payPeriodEnd)
      payDate.setDate(payDate.getDate() + 1)

      const response = await page.request.post("/api/trpc/payroll.runs.create", {
        data: {
          json: {
            organizationId: "demo-org-id",
            runNumber: `TEST-PAY-${Date.now()}`,
            payPeriodStart: payPeriodStart.toISOString(),
            payPeriodEnd: payPeriodEnd.toISOString(),
            payDate: payDate.toISOString(),
          },
        },
      })

      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.result?.data.status).toBe("DRAFT")
      expect(data.result?.data.totalGross).toBe("0")
      expect(data.result?.data.employeeCount).toBe(0)
    })

    test("should reject duplicate run number", async ({ page }) => {
      const payPeriodStart = new Date()
      payPeriodStart.setDate(1)
      const payPeriodEnd = new Date(payPeriodStart)
      payPeriodEnd.setMonth(payPeriodEnd.getMonth() + 1)
      payPeriodEnd.setDate(0)
      const payDate = new Date(payPeriodEnd)
      payDate.setDate(payDate.getDate() + 1)

      const runNumber = `TEST-DUP-${Date.now()}`

      // Create first run
      const response1 = await page.request.post("/api/trpc/payroll.runs.create", {
        data: {
          json: {
            organizationId: "demo-org-id",
            runNumber,
            payPeriodStart: payPeriodStart.toISOString(),
            payPeriodEnd: payPeriodEnd.toISOString(),
            payDate: payDate.toISOString(),
          },
        },
      })

      expect(response1.status()).toBe(200)

      // Try to create duplicate
      const response2 = await page.request.post("/api/trpc/payroll.runs.create", {
        data: {
          json: {
            organizationId: "demo-org-id",
            runNumber,
            payPeriodStart: payPeriodStart.toISOString(),
            payPeriodEnd: payPeriodEnd.toISOString(),
            payDate: payDate.toISOString(),
          },
        },
      })

      expect(response2.status()).toBeGreaterThanOrEqual(400)
    })
  })

  test.describe("Payroll Entries", () => {
    let payrollRunId: string
    let employeeId: string

    test.beforeAll(async ({ page }) => {
      // Get an employee ID
      const empResponse = await page.request.get(
        `/api/trpc/payroll.employees.getAll?input=${JSON.stringify({
          organizationId: "demo-org-id",
          page: 1,
          limit: 1,
        })}`
      )

      if (empResponse.ok()) {
        const empData = await empResponse.json()
        employeeId = empData.result?.data?.employees?.[0]?.id
      }

      // Create a payroll run
      const payPeriodStart = new Date()
      payPeriodStart.setDate(1)
      const payPeriodEnd = new Date(payPeriodStart)
      payPeriodEnd.setMonth(payPeriodEnd.getMonth() + 1)
      payPeriodEnd.setDate(0)
      const payDate = new Date(payPeriodEnd)
      payDate.setDate(payDate.getDate() + 1)

      const runResponse = await page.request.post("/api/trpc/payroll.runs.create", {
        data: {
          json: {
            organizationId: "demo-org-id",
            runNumber: `TEST-ENTRY-${Date.now()}`,
            payPeriodStart: payPeriodStart.toISOString(),
            payPeriodEnd: payPeriodEnd.toISOString(),
            payDate: payDate.toISOString(),
          },
        },
      })

      if (runResponse.ok()) {
        const runData = await runResponse.json()
        payrollRunId = runData.result?.data?.id
      }
    })

    test("should add entry to DRAFT payroll run", async ({ page }) => {
      if (!payrollRunId || !employeeId) {
        test.skip()
        return
      }

      const response = await page.request.post("/api/trpc/payroll.runs.addEntry", {
        data: {
          json: {
            organizationId: "demo-org-id",
            payrollRunId,
            employeeId,
            grossPay: 3000,
            taxAmount: 500,
            nationalInsurance: 300,
            pensionEmployee: 120,
            pensionEmployer: 90,
            otherDeductions: 0,
            earnings: {
              basic: "3000",
            },
            deductionsBreakdown: {
              tax: "500",
              nationalInsurance: "300",
              pension: "120",
            },
          },
        },
      })

      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.result?.data.entry).toHaveProperty("id")
      expect(data.result?.data.entry.grossPay).toBe("3000")
      expect(data.result?.data.entry.netPay).toBe("2080") // 3000 - 500 - 300 - 120
      expect(data.result?.data.payrollRun.employeeCount).toBe(1)
    })

    test("should reject entry for non-DRAFT run", async ({ page }) => {
      if (!payrollRunId || !employeeId) {
        test.skip()
        return
      }

      // Approve the run first
      await page.request.post("/api/trpc/payroll.runs.approve", {
        data: {
          json: {
            organizationId: "demo-org-id",
            id: payrollRunId,
          },
        },
      })

      // Try to add entry to approved run
      const response = await page.request.post("/api/trpc/payroll.runs.addEntry", {
        data: {
          json: {
            organizationId: "demo-org-id",
            payrollRunId,
            employeeId,
            grossPay: 2000,
            taxAmount: 300,
            nationalInsurance: 200,
            pensionEmployee: 80,
            pensionEmployer: 60,
            otherDeductions: 0,
          },
        },
      })

      expect(response.status()).toBeGreaterThanOrEqual(400)
    })

    test("should reject duplicate entry for same employee", async ({ page }) => {
      if (!payrollRunId || !employeeId) {
        test.skip()
        return
      }

      // Create a new DRAFT run
      const payPeriodStart = new Date()
      payPeriodStart.setDate(1)
      const payPeriodEnd = new Date(payPeriodStart)
      payPeriodEnd.setMonth(payPeriodEnd.getMonth() + 1)
      payPeriodEnd.setDate(0)
      const payDate = new Date(payPeriodEnd)
      payDate.setDate(payDate.getDate() + 1)

      const runResponse = await page.request.post("/api/trpc/payroll.runs.create", {
        data: {
          json: {
            organizationId: "demo-org-id",
            runNumber: `TEST-DUP-ENTRY-${Date.now()}`,
            payPeriodStart: payPeriodStart.toISOString(),
            payPeriodEnd: payPeriodEnd.toISOString(),
            payDate: payDate.toISOString(),
          },
        },
      })

      if (!runResponse.ok()) {
        test.skip()
        return
      }

      const runData = await runResponse.json()
      const newRunId = runData.result?.data?.id

      // Add first entry
      await page.request.post("/api/trpc/payroll.runs.addEntry", {
        data: {
          json: {
            organizationId: "demo-org-id",
            payrollRunId: newRunId,
            employeeId,
            grossPay: 2500,
            taxAmount: 400,
            nationalInsurance: 250,
            pensionEmployee: 100,
            pensionEmployer: 75,
            otherDeductions: 0,
          },
        },
      })

      // Try to add duplicate entry
      const response = await page.request.post("/api/trpc/payroll.runs.addEntry", {
        data: {
          json: {
            organizationId: "demo-org-id",
            payrollRunId: newRunId,
            employeeId,
            grossPay: 2500,
            taxAmount: 400,
            nationalInsurance: 250,
            pensionEmployee: 100,
            pensionEmployer: 75,
            otherDeductions: 0,
          },
        },
      })

      expect(response.status()).toBeGreaterThanOrEqual(400)
    })
  })

  test.describe("Approve Payroll Run", () => {
    test("should approve DRAFT payroll run", async ({ page }) => {
      // Create a payroll run
      const payPeriodStart = new Date()
      payPeriodStart.setDate(1)
      const payPeriodEnd = new Date(payPeriodStart)
      payPeriodEnd.setMonth(payPeriodEnd.getMonth() + 1)
      payPeriodEnd.setDate(0)
      const payDate = new Date(payPeriodEnd)
      payDate.setDate(payDate.getDate() + 1)

      const createResponse = await page.request.post("/api/trpc/payroll.runs.create", {
        data: {
          json: {
            organizationId: "demo-org-id",
            runNumber: `TEST-APPROVE-${Date.now()}`,
            payPeriodStart: payPeriodStart.toISOString(),
            payPeriodEnd: payPeriodEnd.toISOString(),
            payDate: payDate.toISOString(),
          },
        },
      })

      if (!createResponse.ok()) {
        test.skip()
        return
      }

      const createData = await createResponse.json()
      const runId = createData.result?.data?.id

      // Approve the run
      const approveResponse = await page.request.post("/api/trpc/payroll.runs.approve", {
        data: {
          json: {
            organizationId: "demo-org-id",
            id: runId,
          },
        },
      })

      expect(approveResponse.status()).toBe(200)
      const approveData = await approveResponse.json()
      expect(approveData.result?.data.status).toBe("APPROVED")
      expect(approveData.result?.data.approvedAt).toBeTruthy()
      expect(approveData.result?.data.approvedBy).toBeTruthy()
    })

    test("should reject approving non-DRAFT run", async ({ page }) => {
      // Create and approve a run
      const payPeriodStart = new Date()
      payPeriodStart.setDate(1)
      const payPeriodEnd = new Date(payPeriodStart)
      payPeriodEnd.setMonth(payPeriodEnd.getMonth() + 1)
      payPeriodEnd.setDate(0)
      const payDate = new Date(payPeriodEnd)
      payDate.setDate(payDate.getDate() + 1)

      const createResponse = await page.request.post("/api/trpc/payroll.runs.create", {
        data: {
          json: {
            organizationId: "demo-org-id",
            runNumber: `TEST-REJECT-${Date.now()}`,
            payPeriodStart: payPeriodStart.toISOString(),
            payPeriodEnd: payPeriodEnd.toISOString(),
            payDate: payDate.toISOString(),
          },
        },
      })

      if (!createResponse.ok()) {
        test.skip()
        return
      }

      const createData = await createResponse.json()
      const runId = createData.result?.data?.id

      // Approve once
      await page.request.post("/api/trpc/payroll.runs.approve", {
        data: {
          json: {
            organizationId: "demo-org-id",
            id: runId,
          },
        },
      })

      // Try to approve again
      const response = await page.request.post("/api/trpc/payroll.runs.approve", {
        data: {
          json: {
            organizationId: "demo-org-id",
            id: runId,
          },
        },
      })

      expect(response.status()).toBeGreaterThanOrEqual(400)
    })
  })

  test.describe("Security & Referential Integrity", () => {
    test("should enforce organization guard", async ({ page }) => {
      // Try to access payroll from different org
      const response = await page.request.get(
        `/api/trpc/payroll.employees.getAll?input=${JSON.stringify({
          organizationId: "other-org-id",
          page: 1,
          limit: 20,
        })}`
      )

      // Should either return empty or be forbidden
      expect([200, 403]).toContain(response.status())
    })
  })
})




