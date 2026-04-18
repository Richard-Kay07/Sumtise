import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { prisma } from '@/lib/prisma'
import { createTRPCContext } from '@/lib/trpc'
import { appRouter } from '@/server/routers/app'

// Mock NextAuth session
const mockSession = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User'
  }
}

// Mock request/response
const mockReq = {} as any
const mockRes = {} as any

describe('Sumtise API Tests', () => {
  let testOrganizationId: string
  let testUserId: string

  beforeEach(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashed-password'
      }
    })
    testUserId = user.id

    // Create test organization
    const organization = await prisma.organization.create({
      data: {
        name: 'Test Organization',
        slug: 'test-org',
        creatorId: testUserId
      }
    })
    testOrganizationId = organization.id

    // Add user as organization member
    await prisma.organizationMember.create({
      data: {
        userId: testUserId,
        organizationId: testOrganizationId,
        role: 'OWNER'
      }
    })
  })

  afterEach(async () => {
    // Clean up test data
    await prisma.organizationMember.deleteMany({
      where: { organizationId: testOrganizationId }
    })
    await prisma.organization.delete({
      where: { id: testOrganizationId }
    })
    await prisma.user.delete({
      where: { id: testUserId }
    })
  })

  describe('Organization API', () => {
    it('should create a new organization', async () => {
      const caller = appRouter.createCaller({
        session: mockSession,
        prisma
      })

      const result = await caller.organization.create({
        name: 'New Test Organization',
        slug: 'new-test-org',
        website: 'https://newtest.com',
        email: 'info@newtest.com'
      })

      expect(result).toBeDefined()
      expect(result.name).toBe('New Test Organization')
      expect(result.slug).toBe('new-test-org')
    })

    it('should get user organizations', async () => {
      const caller = appRouter.createCaller({
        session: mockSession,
        prisma
      })

      const result = await caller.organization.getUserOrganizations()

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('Chart of Accounts API', () => {
    it('should create a new account', async () => {
      const caller = appRouter.createCaller({
        session: mockSession,
        prisma
      })

      const result = await caller.chartOfAccounts.create({
        organizationId: testOrganizationId,
        code: '1000',
        name: 'Test Asset Account',
        type: 'ASSET'
      })

      expect(result).toBeDefined()
      expect(result.code).toBe('1000')
      expect(result.name).toBe('Test Asset Account')
      expect(result.type).toBe('ASSET')
    })

    it('should get all accounts for organization', async () => {
      // Create test account first
      await prisma.chartOfAccount.create({
        data: {
          organizationId: testOrganizationId,
          code: '1000',
          name: 'Test Asset Account',
          type: 'ASSET'
        }
      })

      const caller = appRouter.createCaller({
        session: mockSession,
        prisma
      })

      const result = await caller.chartOfAccounts.getAll({
        organizationId: testOrganizationId
      })

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('Transaction API', () => {
    let testAccountId: string

    beforeEach(async () => {
      // Create test account
      const account = await prisma.chartOfAccount.create({
        data: {
          organizationId: testOrganizationId,
          code: '1000',
          name: 'Test Asset Account',
          type: 'ASSET'
        }
      })
      testAccountId = account.id
    })

    it('should create a new transaction', async () => {
      const caller = appRouter.createCaller({
        session: mockSession,
        prisma
      })

      const result = await caller.transactions.create({
        organizationId: testOrganizationId,
        accountId: testAccountId,
        date: new Date('2024-01-01'),
        description: 'Test Transaction',
        debit: 1000,
        credit: 0,
        currency: 'GBP'
      })

      expect(result).toBeDefined()
      expect(result.description).toBe('Test Transaction')
      expect(result.debit).toBe(1000)
      expect(result.credit).toBe(0)
    })

    it('should create double entry transaction', async () => {
      // Create second account
      const secondAccount = await prisma.chartOfAccount.create({
        data: {
          organizationId: testOrganizationId,
          code: '2000',
          name: 'Test Liability Account',
          type: 'LIABILITY'
        }
      })

      const caller = appRouter.createCaller({
        session: mockSession,
        prisma
      })

      const result = await caller.transactions.createDoubleEntry({
        organizationId: testOrganizationId,
        date: new Date('2024-01-01'),
        description: 'Double Entry Test',
        entries: [
          {
            accountId: testAccountId,
            debit: 1000,
            credit: 0
          },
          {
            accountId: secondAccount.id,
            debit: 0,
            credit: 1000
          }
        ],
        currency: 'GBP'
      })

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(2)
    })
  })

  describe('Customer API', () => {
    it('should create a new customer', async () => {
      const caller = appRouter.createCaller({
        session: mockSession,
        prisma
      })

      const result = await caller.customers.create({
        organizationId: testOrganizationId,
        name: 'Test Customer',
        email: 'customer@test.com',
        phone: '+44 20 7123 4567',
        creditLimit: 50000
      })

      expect(result).toBeDefined()
      expect(result.name).toBe('Test Customer')
      expect(result.email).toBe('customer@test.com')
      expect(result.creditLimit).toBe(50000)
    })

    it('should get all customers', async () => {
      // Create test customer first
      await prisma.customer.create({
        data: {
          organizationId: testOrganizationId,
          name: 'Test Customer',
          email: 'customer@test.com',
          creditLimit: 50000
        }
      })

      const caller = appRouter.createCaller({
        session: mockSession,
        prisma
      })

      const result = await caller.customers.getAll({
        organizationId: testOrganizationId,
        page: 1,
        limit: 10
      })

      expect(result).toBeDefined()
      expect(result.customers).toBeDefined()
      expect(Array.isArray(result.customers)).toBe(true)
      expect(result.pagination).toBeDefined()
    })
  })

  describe('Invoice API', () => {
    let testCustomerId: string

    beforeEach(async () => {
      // Create test customer
      const customer = await prisma.customer.create({
        data: {
          organizationId: testOrganizationId,
          name: 'Test Customer',
          email: 'customer@test.com',
          creditLimit: 50000
        }
      })
      testCustomerId = customer.id
    })

    it('should create a new invoice', async () => {
      const caller = appRouter.createCaller({
        session: mockSession,
        prisma
      })

      const result = await caller.invoices.create({
        organizationId: testOrganizationId,
        customerId: testCustomerId,
        date: new Date('2024-01-01'),
        dueDate: new Date('2024-01-31'),
        items: [
          {
            description: 'Test Product',
            quantity: 1,
            unitPrice: 1000,
            taxRate: 20
          }
        ]
      })

      expect(result).toBeDefined()
      expect(result.customerId).toBe(testCustomerId)
      expect(result.items).toBeDefined()
      expect(result.items.length).toBe(1)
      expect(result.total).toBe(1200) // 1000 + 20% tax
    })
  })

  describe('Dashboard API', () => {
    it('should get dashboard stats', async () => {
      // Create test data
      const account = await prisma.chartOfAccount.create({
        data: {
          organizationId: testOrganizationId,
          code: '4000',
          name: 'Revenue Account',
          type: 'REVENUE'
        }
      })

      await prisma.transaction.create({
        data: {
          organizationId: testOrganizationId,
          accountId: account.id,
          date: new Date(),
          description: 'Test Revenue',
          debit: 0,
          credit: 5000,
          currency: 'GBP'
        }
      })

      const caller = appRouter.createCaller({
        session: mockSession,
        prisma
      })

      const result = await caller.dashboard.getStats({
        organizationId: testOrganizationId
      })

      expect(result).toBeDefined()
      expect(result.totalRevenue).toBeDefined()
      expect(result.totalExpenses).toBeDefined()
      expect(result.netProfit).toBeDefined()
    })
  })
})
