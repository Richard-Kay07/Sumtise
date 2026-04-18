#!/usr/bin/env tsx

/**
 * Smoke Tests for Sumtise Application
 * 
 * Verifies that all key pages and modules load correctly
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface SmokeTest {
  name: string
  test: () => Promise<boolean>
  error?: string
}

async function runPageSmokeTests(): Promise<{ passed: number; failed: number; tests: Array<SmokeTest> }> {
  console.log('🧪 Running page smoke tests...\n')
  
  const tests: Array<SmokeTest> = []
  let passed = 0
  let failed = 0

  // Test: Demo Org accessible
  tests.push({
    name: 'Demo Org accessible',
    test: async () => {
      const org = await prisma.organization.findUnique({
        where: { slug: 'demo-org' },
        include: {
          members: true,
          chartOfAccounts: true,
          customers: true,
          vendors: true,
          invoices: true,
          bills: true,
          bankAccounts: true,
        },
      })
      return !!org && org.members.length > 0
    },
  })

  // Test: Dashboard data available
  tests.push({
    name: 'Dashboard data available',
    test: async () => {
      const org = await prisma.organization.findUnique({ where: { slug: 'demo-org' } })
      if (!org) return false
      
      const stats = {
        invoices: await prisma.invoice.count({ where: { organizationId: org.id } }),
        bills: await prisma.bill.count({ where: { organizationId: org.id } }),
        customers: await prisma.customer.count({ where: { organizationId: org.id } }),
        vendors: await prisma.vendor.count({ where: { organizationId: org.id } }),
        bankAccounts: await prisma.bankAccount.count({ where: { organizationId: org.id } }),
      }
      
      return stats.invoices > 0 && stats.bills > 0 && stats.customers > 0 && stats.vendors > 0
    },
  })

  // Test: Invoices module ready
  tests.push({
    name: 'Invoices module ready',
    test: async () => {
      const org = await prisma.organization.findUnique({ where: { slug: 'demo-org' } })
      if (!org) return false
      
      const invoices = await prisma.invoice.findMany({
        where: { organizationId: org.id },
        include: { items: true, customer: true },
        take: 5,
      })
      
      return invoices.length > 0 && invoices.every(inv => inv.items.length > 0)
    },
  })

  // Test: Expenses module ready
  tests.push({
    name: 'Expenses module ready',
    test: async () => {
      const org = await prisma.organization.findUnique({ where: { slug: 'demo-org' } })
      if (!org) return false
      
      const bills = await prisma.bill.findMany({
        where: { organizationId: org.id },
        include: { items: true, vendor: true },
        take: 5,
      })
      
      return bills.length > 0 && bills.every(bill => bill.items.length > 0)
    },
  })

  // Test: Payment Run data available
  tests.push({
    name: 'Payment Run data available',
    test: async () => {
      const org = await prisma.organization.findUnique({ where: { slug: 'demo-org' } })
      if (!org) return false
      
      const bills = await prisma.bill.findMany({
        where: {
          organizationId: org.id,
          status: { in: ['RECEIVED', 'APPROVED', 'OVERDUE'] },
        },
        include: { vendor: true },
      })
      
      return bills.length > 0 && bills.every(bill => bill.vendor.bankIBAN || bill.vendor.bankAccountNumber)
    },
  })

  // Test: Banking module ready
  tests.push({
    name: 'Banking module ready',
    test: async () => {
      const org = await prisma.organization.findUnique({ where: { slug: 'demo-org' } })
      if (!org) return false
      
      const bankAccounts = await prisma.bankAccount.findMany({
        where: { organizationId: org.id, isActive: true },
      })
      
      return bankAccounts.length > 0
    },
  })

  // Test: Chart of Accounts ready
  tests.push({
    name: 'Chart of Accounts ready',
    test: async () => {
      const org = await prisma.organization.findUnique({ where: { slug: 'demo-org' } })
      if (!org) return false
      
      const accounts = await prisma.chartOfAccount.findMany({
        where: { organizationId: org.id, isActive: true },
      })
      
      return accounts.length >= 10 && accounts.some(a => a.type === 'ASSET') && accounts.some(a => a.type === 'LIABILITY')
    },
  })

  // Test: Transactions exist
  tests.push({
    name: 'Transactions exist',
    test: async () => {
      const org = await prisma.organization.findUnique({ where: { slug: 'demo-org' } })
      if (!org) return false
      
      const transactions = await prisma.transaction.findMany({
        where: { organizationId: org.id },
        take: 5,
      })
      
      return transactions.length > 0
    },
  })

  // Test: Organization Settings configured
  tests.push({
    name: 'Organization Settings configured',
    test: async () => {
      const org = await prisma.organization.findUnique({ where: { slug: 'demo-org' } })
      if (!org) return false
      
      const settings = await prisma.organizationSettings.findMany({
        where: { organizationId: org.id },
      })
      
      return settings.length >= 5 // At least GENERAL, ACCOUNTING, INVOICING, EXPENSES, BANKING
    },
  })

  // Test: Module activation verified
  tests.push({
    name: 'Modules activated',
    test: async () => {
      const org = await prisma.organization.findUnique({ where: { slug: 'demo-org' } })
      if (!org) return false
      
      const settings = await prisma.organizationSettings.findMany({
        where: { organizationId: org.id },
      })
      
      const requiredCategories = ['GENERAL', 'ACCOUNTING', 'INVOICING', 'EXPENSES']
      const foundCategories = settings.map(s => s.category)
      
      return requiredCategories.every(cat => foundCategories.includes(cat as any))
    },
  })

  // Run all tests
  for (const test of tests) {
    try {
      const result = await test.test()
      if (result) {
        test.error = undefined
        passed++
      } else {
        test.error = 'Test returned false'
        failed++
      }
    } catch (error: any) {
      test.error = error.message
      failed++
    }
  }

  return { passed, failed, tests }
}

async function main() {
  try {
    const results = await runPageSmokeTests()

    console.log('\n📋 Smoke Test Results:')
    results.tests.forEach(test => {
      const icon = !test.error ? '✅' : '❌'
      console.log(`   ${icon} ${test.name}`)
      if (test.error) {
        console.log(`      Error: ${test.error}`)
      }
    })

    console.log(`\n✅ Passed: ${results.passed}`)
    if (results.failed > 0) {
      console.log(`❌ Failed: ${results.failed}`)
      process.exit(1)
    } else {
      console.log('\n🎉 All smoke tests passed!')
      process.exit(0)
    }
  } catch (error) {
    console.error('❌ Smoke tests failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

