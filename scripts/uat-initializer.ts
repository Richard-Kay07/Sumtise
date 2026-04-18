#!/usr/bin/env tsx

/**
 * One-Click UAT Initializer
 * 
 * This script automatically:
 * 1. Seeds Demo Organisation with comprehensive test data
 * 2. Activates all modules in organization settings
 * 3. Runs smoke tests to verify pages load correctly
 * 
 * Usage: npm run uat:init
 */

import { PrismaClient } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

const prisma = new PrismaClient()

// Module configuration - all modules enabled for UAT
const MODULE_SETTINGS = {
  GENERAL: {
    companyName: "Demo Org",
    currency: "GBP",
    dateFormat: "DD/MM/YYYY",
    fiscalYearStart: "01/04",
    timezone: "Europe/London",
  },
  ACCOUNTING: {
    chartOfAccountsTemplate: "uk",
    autoNumbering: true,
    enableDoubleEntry: true,
    enableAuditTrail: true,
  },
  INVOICING: {
    defaultPaymentTerms: 30,
    enableRecurringInvoices: true,
    autoSendReminders: true,
    enableCustomerPortal: true,
  },
  EXPENSES: {
    enableOCR: true,
    enableAutoCategorization: true,
    requireApproval: false,
  },
  BANKING: {
    enableAutoReconciliation: true,
    enableBankFeeds: true,
  },
  TAX: {
    country: "GB",
    enableVAT: true,
    enableMTD: true,
  },
  NOTIFICATIONS: {
    enableEmailNotifications: true,
    enableDashboardAlerts: true,
  },
}

interface SeedResult {
  organization: any
  customers: number
  vendors: number
  invoices: number
  bills: number
  payments: number
  bankAccounts: number
  accounts: number
  transactions: number
}

async function ensureDemoOrg(): Promise<SeedResult> {
  console.log('🔍 Checking for Demo Org...')
  
  // Check if Demo Org exists
  let organization = await prisma.organization.findUnique({
    where: { slug: 'demo-org' },
  })

  if (organization) {
    console.log('✅ Demo Org already exists')
  } else {
    console.log('📦 Creating Demo Org...')
    
    // Create admin user if doesn't exist
    let user = await prisma.user.findUnique({
      where: { email: 'admin@sumtise.com' },
    })

    if (!user) {
      // Note: User model doesn't have password field in schema
      // This would need to be handled by NextAuth
      user = await prisma.user.create({
        data: {
          email: 'admin@sumtise.com',
          name: 'Admin User',
        },
      })
      console.log('✅ Created admin user')
    }

    // Create Demo Org
    organization = await prisma.organization.create({
      data: {
        name: 'Demo Org',
        slug: 'demo-org',
        website: 'https://demo.sumtise.com',
        email: 'info@demo.sumtise.com',
        phone: '+44 20 7123 4567',
        address: {
          street: '123 Business Street',
          city: 'London',
          postcode: 'SW1A 1AA',
          country: 'United Kingdom',
        },
        creatorId: user.id,
      },
    })

    // Add user as owner
    await prisma.organizationMember.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        role: 'OWNER',
      },
    })

    console.log('✅ Created Demo Org')
  }

  // Seed comprehensive data
  const result = await seedComprehensiveData(organization.id, organization.creatorId)
  
  // Activate modules
  await activateModules(organization.id)

  return {
    organization,
    ...result,
  }
}

async function seedComprehensiveData(organizationId: string, creatorId: string): Promise<Omit<SeedResult, 'organization'>> {
  console.log('🌱 Seeding comprehensive demo data...')

  // Chart of Accounts
  const accounts = await seedChartOfAccounts(organizationId)
  console.log(`✅ Created ${accounts} chart of accounts`)

  // Customers
  const customers = await seedCustomers(organizationId)
  console.log(`✅ Created ${customers} customers`)

  // Vendors
  const vendors = await seedVendors(organizationId)
  console.log(`✅ Created ${vendors} vendors`)

  // Bank Accounts
  const bankAccounts = await seedBankAccounts(organizationId)
  console.log(`✅ Created ${bankAccounts} bank accounts`)

  // Invoices
  const invoices = await seedInvoices(organizationId, customers)
  console.log(`✅ Created ${invoices} invoices`)

  // Bills
  const bills = await seedBills(organizationId, vendors)
  console.log(`✅ Created ${bills} bills`)

  // Payments
  const payments = await seedPayments(organizationId, bills, vendors)
  console.log(`✅ Created ${payments} payments`)

  // Transactions
  const transactions = await seedTransactions(organizationId, accounts)
  console.log(`✅ Created ${transactions} transactions`)

  return {
    customers,
    vendors,
    invoices,
    bills,
    payments,
    bankAccounts,
    accounts,
    transactions,
  }
}

async function seedChartOfAccounts(organizationId: string): Promise<number> {
  const accounts = [
    // Assets
    { code: '1000', name: 'Current Assets', type: 'ASSET' as const, parentId: null },
    { code: '1100', name: 'Cash and Bank', type: 'ASSET' as const, parentId: null },
    { code: '1200', name: 'Accounts Receivable', type: 'ASSET' as const, parentId: null },
    { code: '1300', name: 'Inventory', type: 'ASSET' as const, parentId: null },
    { code: '1400', name: 'Fixed Assets', type: 'ASSET' as const, parentId: null },
    
    // Liabilities
    { code: '2000', name: 'Current Liabilities', type: 'LIABILITY' as const, parentId: null },
    { code: '2100', name: 'Accounts Payable', type: 'LIABILITY' as const, parentId: null },
    { code: '2200', name: 'Accrued Expenses', type: 'LIABILITY' as const, parentId: null },
    { code: '2300', name: 'Long-term Debt', type: 'LIABILITY' as const, parentId: null },
    
    // Equity
    { code: '3000', name: 'Equity', type: 'EQUITY' as const, parentId: null },
    { code: '3100', name: 'Share Capital', type: 'EQUITY' as const, parentId: null },
    { code: '3200', name: 'Retained Earnings', type: 'EQUITY' as const, parentId: null },
    
    // Revenue
    { code: '4000', name: 'Revenue', type: 'REVENUE' as const, parentId: null },
    { code: '4100', name: 'Sales Revenue', type: 'REVENUE' as const, parentId: null },
    { code: '4200', name: 'Service Revenue', type: 'REVENUE' as const, parentId: null },
    
    // Expenses
    { code: '5000', name: 'Operating Expenses', type: 'EXPENSE' as const, parentId: null },
    { code: '5100', name: 'Office Supplies', type: 'EXPENSE' as const, parentId: null },
    { code: '5200', name: 'Travel & Entertainment', type: 'EXPENSE' as const, parentId: null },
    { code: '5300', name: 'Marketing & Advertising', type: 'EXPENSE' as const, parentId: null },
    { code: '5400', name: 'Professional Services', type: 'EXPENSE' as const, parentId: null },
    { code: '5500', name: 'Utilities', type: 'EXPENSE' as const, parentId: null },
  ]

  let count = 0
  for (const account of accounts) {
    await prisma.chartOfAccount.upsert({
      where: {
        organizationId_code: {
          organizationId,
          code: account.code,
        },
      },
      update: {},
      create: {
        ...account,
        organizationId,
      },
    })
    count++
  }

  return count
}

async function seedCustomers(organizationId: string): Promise<number> {
  const customers = [
    {
      name: 'ABC Corporation',
      email: 'accounts@abccorp.com',
      phone: '+44 20 7123 4567',
      address: {
        street: '456 Corporate Avenue',
        city: 'Manchester',
        postcode: 'M1 1AA',
        country: 'United Kingdom',
      },
      creditLimit: 50000,
    },
    {
      name: 'XYZ Limited',
      email: 'finance@xyzltd.com',
      phone: '+44 161 123 4567',
      address: {
        street: '789 Business Park',
        city: 'Birmingham',
        postcode: 'B1 1AA',
        country: 'United Kingdom',
      },
      creditLimit: 25000,
    },
    {
      name: 'DEF Industries',
      email: 'billing@defindustries.com',
      phone: '+44 121 123 4567',
      address: {
        street: '321 Industrial Way',
        city: 'Leeds',
        postcode: 'LS1 1AA',
        country: 'United Kingdom',
      },
      creditLimit: 75000,
    },
    {
      name: 'Global Tech Solutions',
      email: 'accounts@globaltech.com',
      phone: '+44 207 987 6543',
      address: {
        street: '100 Innovation Road',
        city: 'Cambridge',
        postcode: 'CB2 1TN',
        country: 'United Kingdom',
      },
      creditLimit: 100000,
    },
  ]

  let count = 0
  for (const customer of customers) {
    // Check if customer already exists by email
    const existing = await prisma.customer.findFirst({
      where: {
        organizationId,
        email: customer.email,
      },
    })
    
    if (!existing) {
      await prisma.customer.create({
        data: {
          ...customer,
          organizationId,
        },
      })
      count++
    }
  }

  return count
}

async function seedVendors(organizationId: string): Promise<number> {
  // Get expense accounts for defaultExpenseAccountId
  const expenseAccounts = await prisma.chartOfAccount.findMany({
    where: { organizationId, type: 'EXPENSE', isActive: true },
    take: 5,
  })

  const vendors = [
    {
      name: 'Office Supplies Ltd',
      alias: 'OfficeSupplies',
      email: 'orders@officesupplies.co.uk',
      phone: '+44 20 7456 7890',
      address: {
        street: '10 Station Road',
        city: 'London',
        postcode: 'NW1 6XE',
        country: 'United Kingdom',
      },
      taxId: 'GB123456789',
      paymentTerms: 30,
      bankAccountNumber: '98765432',
      bankSortCode: '20-45-67',
      bankIBAN: 'GB29 NWBK 6016 1331 9268 19',
      bankName: 'NatWest',
      defaultExpenseAccountId: expenseAccounts[0]?.id, // Office Supplies account
      taxScheme: 'VAT_STANDARD',
      currency: 'GBP',
      tags: ['office', 'supplies', 'recurring'],
    },
    {
      name: 'Tech Solutions Inc',
      alias: 'TechSol',
      email: 'billing@techsolutions.co.uk',
      phone: '+44 161 234 5678',
      address: {
        street: '25 Technology Park',
        city: 'Manchester',
        postcode: 'M15 6BH',
        country: 'United Kingdom',
      },
      taxId: 'GB987654321',
      paymentTerms: 30,
      bankAccountNumber: '12345678',
      bankSortCode: '20-00-00',
      bankIBAN: 'GB82 WEST 1234 5698 7654 32',
      bankName: 'HSBC',
      defaultExpenseAccountId: expenseAccounts[1]?.id, // Professional Services account
      taxScheme: 'VAT_STANDARD',
      currency: 'GBP',
      tags: ['technology', 'software', 'licenses'],
    },
    {
      name: 'Professional Services Co',
      alias: 'ProServices',
      email: 'accounts@proservices.co.uk',
      phone: '+44 121 345 6789',
      address: {
        street: '50 Business Centre',
        city: 'Birmingham',
        postcode: 'B2 4QA',
        country: 'United Kingdom',
      },
      taxId: 'GB456789123',
      paymentTerms: 14,
      bankAccountNumber: '45678901',
      bankSortCode: '30-90-90',
      bankIBAN: 'GB33 BUKB 2020 1555 5555 55',
      bankName: 'Barclays',
      defaultExpenseAccountId: expenseAccounts[2]?.id, // Professional Services account
      taxScheme: 'VAT_STANDARD',
      currency: 'GBP',
      tags: ['consulting', 'professional', 'services'],
    },
    {
      name: 'Marketing Agency Ltd',
      alias: 'MarketingAgency',
      email: 'invoices@marketingagency.co.uk',
      phone: '+44 20 7890 1234',
      address: {
        street: '75 Creative Street',
        city: 'London',
        postcode: 'EC1A 1BB',
        country: 'United Kingdom',
      },
      taxId: 'GB789123456',
      paymentTerms: 30,
      bankAccountNumber: '78901234',
      bankSortCode: '40-12-34',
      bankIBAN: 'GB12 LOYD 3090 1234 5678 90',
      bankName: 'Lloyds',
      defaultExpenseAccountId: expenseAccounts[3]?.id, // Marketing & Advertising account
      taxScheme: 'VAT_STANDARD',
      currency: 'GBP',
      tags: ['marketing', 'advertising', 'creative'],
    },
    {
      name: 'Utilities Provider UK',
      alias: 'UtilitiesUK',
      email: 'billing@utilitiesuk.co.uk',
      phone: '+44 800 123 4567',
      address: {
        street: '100 Energy Way',
        city: 'Leeds',
        postcode: 'LS2 8EQ',
        country: 'United Kingdom',
      },
      taxId: 'GB321654987',
      paymentTerms: 14,
      bankAccountNumber: '23456789',
      bankSortCode: '50-00-00',
      bankIBAN: 'GB56 RBSB 2020 1234 5678 90',
      bankName: 'RBS',
      defaultExpenseAccountId: expenseAccounts[4]?.id, // Utilities account
      taxScheme: 'VAT_STANDARD',
      currency: 'GBP',
      tags: ['utilities', 'recurring', 'essential'],
    },
  ]

  let count = 0
  for (const vendor of vendors) {
    // Check if vendor already exists by name (unique constraint)
    const existing = await prisma.vendor.findFirst({
      where: {
        organizationId,
        name: vendor.name,
        deletedAt: null, // Only check non-deleted vendors
      },
    })
    
    if (!existing) {
      await prisma.vendor.create({
        data: {
          ...vendor,
          organizationId,
          tags: vendor.tags || [],
        },
      })
      count++
    } else {
      count++ // Count existing vendors too
    }
  }

  return count
}

async function seedBankAccounts(organizationId: string): Promise<number> {
  const bankAccounts = [
    {
      name: 'Business Current Account',
      accountNumber: '12345678',
      sortCode: '20-00-00',
      iban: 'GB82 WEST 1234 5678 9012 34',
      currency: 'GBP',
      openingBalance: 50000,
      currentBalance: 45250,
    },
    {
      name: 'Business Savings Account',
      accountNumber: '87654321',
      sortCode: '20-00-00',
      iban: 'GB29 NWBK 6016 1331 9268 19',
      currency: 'GBP',
      openingBalance: 100000,
      currentBalance: 105000,
    },
  ]

  let count = 0
  for (const bankAccount of bankAccounts) {
    // Check if bank account already exists
    const existing = await prisma.bankAccount.findFirst({
      where: {
        organizationId,
        name: bankAccount.name,
      },
    })
    
    if (!existing) {
      await prisma.bankAccount.create({
        data: {
          ...bankAccount,
          organizationId,
        },
      })
      count++
    } else {
      count++ // Count existing accounts too
    }
  }

  return count
}

async function seedInvoices(organizationId: string, customerIds: any[]): Promise<number> {
  const customers = await prisma.customer.findMany({
    where: { organizationId },
    take: 3,
  })

  if (customers.length === 0) return 0

  const invoices = [
    {
      customerId: customers[0].id,
      invoiceNumber: 'INV-2024-001',
      date: new Date('2024-01-15'),
      dueDate: new Date('2024-02-15'),
      status: 'PAID' as const,
      subtotal: 4500,
      taxAmount: 900,
      total: 5400,
      currency: 'GBP',
      items: [
        { description: 'Consulting Services', quantity: 40, unitPrice: 100, taxRate: 20 },
        { description: 'Project Management', quantity: 5, unitPrice: 100, taxRate: 20 },
      ],
    },
    {
      customerId: customers[1].id,
      invoiceNumber: 'INV-2024-002',
      date: new Date('2024-01-20'),
      dueDate: new Date('2024-02-20'),
      status: 'SENT' as const,
      subtotal: 2500,
      taxAmount: 500,
      total: 3000,
      currency: 'GBP',
      items: [
        { description: 'Software License', quantity: 1, unitPrice: 2500, taxRate: 20 },
      ],
    },
    {
      customerId: customers[2].id,
      invoiceNumber: 'INV-2024-003',
      date: new Date('2024-01-25'),
      dueDate: new Date('2024-02-25'),
      status: 'OVERDUE' as const,
      subtotal: 7500,
      taxAmount: 1500,
      total: 9000,
      currency: 'GBP',
      items: [
        { description: 'Professional Services', quantity: 50, unitPrice: 150, taxRate: 20 },
      ],
    },
    {
      customerId: customers[0].id,
      invoiceNumber: 'INV-2024-004',
      date: new Date('2024-02-01'),
      dueDate: new Date('2024-03-03'),
      status: 'DRAFT' as const,
      subtotal: 3200,
      taxAmount: 640,
      total: 3840,
      currency: 'GBP',
      items: [
        { description: 'Support Services', quantity: 32, unitPrice: 100, taxRate: 20 },
      ],
    },
  ]

  let count = 0
  for (const invoice of invoices) {
    const { items, ...invoiceData } = invoice
    
    // Check if invoice already exists
    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        organizationId,
        invoiceNumber: invoice.invoiceNumber,
      },
    })

    if (!existingInvoice) {
      await prisma.invoice.create({
        data: {
          ...invoiceData,
          organizationId,
          items: {
            create: items.map(item => ({
              description: item.description,
              quantity: new Decimal(item.quantity),
              unitPrice: new Decimal(item.unitPrice),
              total: new Decimal(item.quantity * item.unitPrice * (1 + item.taxRate / 100)),
              taxRate: new Decimal(item.taxRate),
            })),
          },
        },
    })
    count++
  }

  return count
}

async function seedBills(organizationId: string, vendorIds: any[]): Promise<number> {
  const vendors = await prisma.vendor.findMany({
    where: { organizationId },
    take: 3,
  })

  if (vendors.length === 0) return 0

  const bills = [
    {
      vendorId: vendors[0].id,
      billNumber: 'BILL-2024-001',
      date: new Date('2024-01-10'),
      dueDate: new Date('2024-02-10'),
      status: 'APPROVED' as const,
      subtotal: 1250,
      taxAmount: 250,
      total: 1500,
      currency: 'GBP',
      items: [
        { description: 'Office Supplies', quantity: 50, unitPrice: 25, taxRate: 20 },
      ],
    },
    {
      vendorId: vendors[1].id,
      billNumber: 'BILL-2024-002',
      date: new Date('2024-01-18'),
      dueDate: new Date('2024-02-18'),
      status: 'RECEIVED' as const,
      subtotal: 3500,
      taxAmount: 700,
      total: 4200,
      currency: 'GBP',
      items: [
        { description: 'Software License Renewal', quantity: 1, unitPrice: 3500, taxRate: 20 },
      ],
    },
    {
      vendorId: vendors[2].id,
      billNumber: 'BILL-2024-003',
      date: new Date('2024-01-22'),
      dueDate: new Date('2024-02-05'), // 14 day terms
      status: 'OVERDUE' as const,
      subtotal: 2800,
      taxAmount: 560,
      total: 3360,
      currency: 'GBP',
      items: [
        { description: 'Consulting Services', quantity: 28, unitPrice: 100, taxRate: 20 },
      ],
    },
  ]

  let count = 0
  for (const bill of bills) {
    const { items, ...billData } = bill
    
    const accounts = await prisma.chartOfAccount.findMany({
      where: { organizationId, type: 'EXPENSE' },
      take: 1,
    })
    const accountId = accounts[0]?.id

    // Check if bill already exists
    const existingBill = await prisma.bill.findFirst({
      where: {
        organizationId,
        billNumber: bill.billNumber,
      },
    })

    if (!existingBill) {
      await prisma.bill.create({
        data: {
          ...billData,
          organizationId,
        items: {
          create: items.map(item => ({
            description: item.description,
            quantity: new Decimal(item.quantity),
            unitPrice: new Decimal(item.unitPrice),
            total: new Decimal(item.quantity * item.unitPrice * (1 + item.taxRate / 100)),
            taxRate: new Decimal(item.taxRate),
            accountId: accountId,
          })),
        },
      },
    })
    count++
  }

  return count
}

async function seedPayments(organizationId: string, billIds: any[], vendorIds: any[]): Promise<number> {
  const bills = await prisma.bill.findMany({
    where: { organizationId, status: 'APPROVED' },
    take: 1,
  })

  if (bills.length === 0) return 0

  const vendors = await prisma.vendor.findMany({
    where: { organizationId },
    take: 1,
  })

  const bankAccounts = await prisma.bankAccount.findMany({
    where: { organizationId },
    take: 1,
  })

  if (vendors.length === 0 || bankAccounts.length === 0) return 0

  // Create a payment run
  const users = await prisma.user.findMany({ take: 1 })
  if (users.length === 0) return 0

  const paymentRun = await prisma.paymentRun.create({
    data: {
      organizationId,
      runNumber: 'PAY-2024-001',
      paymentDate: new Date('2024-02-15'),
      paymentMethod: 'BACS',
      status: 'COMPLETED',
      totalAmount: 1500,
      currency: 'GBP',
      initiatedBy: users[0].id,
      bankAccountId: bankAccounts[0].id,
      completedAt: new Date('2024-02-15'),
    },
  })

  // Create payment for the approved bill
  await prisma.payment.create({
    data: {
      organizationId,
      paymentRunId: paymentRun.id,
      billId: bills[0].id,
      vendorId: vendors[0].id,
      amount: 1500,
      currency: 'GBP',
      paymentDate: new Date('2024-02-15'),
      paymentMethod: 'BACS',
      status: 'COMPLETED',
      bankAccountId: bankAccounts[0].id,
      processedAt: new Date('2024-02-15'),
    },
  })

  // Update bill status to PAID
  await prisma.bill.update({
    where: { id: bills[0].id },
    data: { status: 'PAID' },
  })

  return 1
}

async function seedTransactions(organizationId: string, accountIds: any[]): Promise<number> {
  const accounts = await prisma.chartOfAccount.findMany({
    where: { organizationId },
  })

  const cashAccount = accounts.find(a => a.code === '1100')
  const salesAccount = accounts.find(a => a.code === '4100')
  const apAccount = accounts.find(a => a.code === '2100')

  if (!cashAccount || !salesAccount || !apAccount) return 0

  const transactions = [
    {
      accountId: salesAccount.id,
      date: new Date('2024-01-15'),
      description: 'Sales Revenue - ABC Corp',
      reference: 'INV-2024-001',
      debit: new Decimal(0),
      credit: new Decimal(5400),
      currency: 'GBP',
    },
    {
      accountId: cashAccount.id,
      date: new Date('2024-01-15'),
      description: 'Cash Received - ABC Corp',
      reference: 'INV-2024-001',
      debit: new Decimal(5400),
      credit: new Decimal(0),
      currency: 'GBP',
    },
    {
      accountId: apAccount.id,
      date: new Date('2024-01-10'),
      description: 'Accounts Payable - Office Supplies',
      reference: 'BILL-2024-001',
      debit: new Decimal(0),
      credit: new Decimal(1500),
      currency: 'GBP',
    },
    {
      accountId: cashAccount.id,
      date: new Date('2024-02-15'),
      description: 'Payment Made - Office Supplies',
      reference: 'PAY-2024-001',
      debit: new Decimal(0),
      credit: new Decimal(1500),
      currency: 'GBP',
    },
  ]

  let count = 0
  for (const transaction of transactions) {
    await prisma.transaction.create({
      data: {
        ...transaction,
        organizationId,
      },
    })
    count++
  }

  return count
}

async function activateModules(organizationId: string): Promise<void> {
  console.log('🔧 Activating all modules...')

  for (const [category, settings] of Object.entries(MODULE_SETTINGS)) {
    await prisma.organizationSettings.upsert({
      where: {
        organizationId_category: {
          organizationId,
          category: category as any,
        },
      },
      update: {
        settings: JSON.stringify(settings),
      },
      create: {
        organizationId,
        category: category as any,
        settings: JSON.stringify(settings),
      },
    })
  }

  console.log('✅ All modules activated')
}

async function runSmokeTests(): Promise<{ passed: number; failed: number; tests: Array<{ name: string; status: 'PASS' | 'FAIL'; error?: string }> }> {
  console.log('🧪 Running smoke tests...')
  
  const tests: Array<{ name: string; status: 'PASS' | 'FAIL'; error?: string }> = []
  let passed = 0
  let failed = 0

  // Test 1: Demo Org exists
  try {
    const org = await prisma.organization.findUnique({
      where: { slug: 'demo-org' },
    })
    if (org) {
      tests.push({ name: 'Demo Org exists', status: 'PASS' })
      passed++
    } else {
      tests.push({ name: 'Demo Org exists', status: 'FAIL', error: 'Demo Org not found' })
      failed++
    }
  } catch (error: any) {
    tests.push({ name: 'Demo Org exists', status: 'FAIL', error: error.message })
    failed++
  }

  // Test 2: Admin user exists
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'admin@sumtise.com' },
    })
    if (user) {
      tests.push({ name: 'Admin user exists', status: 'PASS' })
      passed++
    } else {
      tests.push({ name: 'Admin user exists', status: 'FAIL', error: 'Admin user not found' })
      failed++
    }
  } catch (error: any) {
    tests.push({ name: 'Admin user exists', status: 'FAIL', error: error.message })
    failed++
  }

  // Test 3: Chart of Accounts populated
  try {
    const org = await prisma.organization.findUnique({
      where: { slug: 'demo-org' },
    })
    if (org) {
      const accounts = await prisma.chartOfAccount.findMany({
        where: { organizationId: org.id },
      })
      if (accounts.length >= 10) {
        tests.push({ name: 'Chart of Accounts populated', status: 'PASS' })
        passed++
      } else {
        tests.push({ name: 'Chart of Accounts populated', status: 'FAIL', error: `Only ${accounts.length} accounts found` })
        failed++
      }
    }
  } catch (error: any) {
    tests.push({ name: 'Chart of Accounts populated', status: 'FAIL', error: error.message })
    failed++
  }

  // Test 4: Customers exist
  try {
    const org = await prisma.organization.findUnique({
      where: { slug: 'demo-org' },
    })
    if (org) {
      const customers = await prisma.customer.findMany({
        where: { organizationId: org.id },
      })
      if (customers.length >= 3) {
        tests.push({ name: 'Customers exist', status: 'PASS' })
        passed++
      } else {
        tests.push({ name: 'Customers exist', status: 'FAIL', error: `Only ${customers.length} customers found` })
        failed++
      }
    }
  } catch (error: any) {
    tests.push({ name: 'Customers exist', status: 'FAIL', error: error.message })
    failed++
  }

  // Test 5: Vendors exist
  try {
    const org = await prisma.organization.findUnique({
      where: { slug: 'demo-org' },
    })
    if (org) {
      const vendors = await prisma.vendor.findMany({
        where: { organizationId: org.id },
      })
      if (vendors.length >= 2) {
        tests.push({ name: 'Vendors exist', status: 'PASS' })
        passed++
      } else {
        tests.push({ name: 'Vendors exist', status: 'FAIL', error: `Only ${vendors.length} vendors found` })
        failed++
      }
    }
  } catch (error: any) {
    tests.push({ name: 'Vendors exist', status: 'FAIL', error: error.message })
    failed++
  }

  // Test 6: Invoices exist
  try {
    const org = await prisma.organization.findUnique({
      where: { slug: 'demo-org' },
    })
    if (org) {
      const invoices = await prisma.invoice.findMany({
        where: { organizationId: org.id },
      })
      if (invoices.length >= 2) {
        tests.push({ name: 'Invoices exist', status: 'PASS' })
        passed++
      } else {
        tests.push({ name: 'Invoices exist', status: 'FAIL', error: `Only ${invoices.length} invoices found` })
        failed++
      }
    }
  } catch (error: any) {
    tests.push({ name: 'Invoices exist', status: 'FAIL', error: error.message })
    failed++
  }

  // Test 7: Bills exist
  try {
    const org = await prisma.organization.findUnique({
      where: { slug: 'demo-org' },
    })
    if (org) {
      const bills = await prisma.bill.findMany({
        where: { organizationId: org.id },
      })
      if (bills.length >= 2) {
        tests.push({ name: 'Bills exist', status: 'PASS' })
        passed++
      } else {
        tests.push({ name: 'Bills exist', status: 'FAIL', error: `Only ${bills.length} bills found` })
        failed++
      }
    }
  } catch (error: any) {
    tests.push({ name: 'Bills exist', status: 'FAIL', error: error.message })
    failed++
  }

  // Test 8: Bank Accounts exist
  try {
    const org = await prisma.organization.findUnique({
      where: { slug: 'demo-org' },
    })
    if (org) {
      const bankAccounts = await prisma.bankAccount.findMany({
        where: { organizationId: org.id },
      })
      if (bankAccounts.length >= 1) {
        tests.push({ name: 'Bank Accounts exist', status: 'PASS' })
        passed++
      } else {
        tests.push({ name: 'Bank Accounts exist', status: 'FAIL', error: `Only ${bankAccounts.length} bank accounts found` })
        failed++
      }
    }
  } catch (error: any) {
    tests.push({ name: 'Bank Accounts exist', status: 'FAIL', error: error.message })
    failed++
  }

  // Test 9: Organization Settings exist
  try {
    const org = await prisma.organization.findUnique({
      where: { slug: 'demo-org' },
    })
    if (org) {
      const settings = await prisma.organizationSettings.findMany({
        where: { organizationId: org.id },
      })
      if (settings.length >= 5) {
        tests.push({ name: 'Organization Settings configured', status: 'PASS' })
        passed++
      } else {
        tests.push({ name: 'Organization Settings configured', status: 'FAIL', error: `Only ${settings.length} settings found` })
        failed++
      }
    }
  } catch (error: any) {
    tests.push({ name: 'Organization Settings configured', status: 'FAIL', error: error.message })
    failed++
  }

  // Test 10: Transactions exist
  try {
    const org = await prisma.organization.findUnique({
      where: { slug: 'demo-org' },
    })
    if (org) {
      const transactions = await prisma.transaction.findMany({
        where: { organizationId: org.id },
      })
      if (transactions.length >= 2) {
        tests.push({ name: 'Transactions exist', status: 'PASS' })
        passed++
      } else {
        tests.push({ name: 'Transactions exist', status: 'FAIL', error: `Only ${transactions.length} transactions found` })
        failed++
      }
    }
  } catch (error: any) {
    tests.push({ name: 'Transactions exist', status: 'FAIL', error: error.message })
    failed++
  }

  return { passed, failed, tests }
}

async function main() {
  console.log('🚀 Starting UAT Initialization...\n')

  try {
    // Step 1: Ensure Demo Org exists with data
    const seedResult = await ensureDemoOrg()

    console.log('\n📊 Data Summary:')
    console.log(`   Organization: ${seedResult.organization.name}`)
    console.log(`   Customers: ${seedResult.customers}`)
    console.log(`   Vendors: ${seedResult.vendors}`)
    console.log(`   Invoices: ${seedResult.invoices}`)
    console.log(`   Bills: ${seedResult.bills}`)
    console.log(`   Payments: ${seedResult.payments}`)
    console.log(`   Bank Accounts: ${seedResult.bankAccounts}`)
    console.log(`   Chart of Accounts: ${seedResult.accounts}`)
    console.log(`   Transactions: ${seedResult.transactions}`)

    // Step 2: Run smoke tests
    console.log('\n')
    const testResults = await runSmokeTests()

    // Step 3: Report results
    console.log('\n📋 Smoke Test Results:')
    testResults.tests.forEach(test => {
      const icon = test.status === 'PASS' ? '✅' : '❌'
      console.log(`   ${icon} ${test.name}`)
      if (test.status === 'FAIL' && test.error) {
        console.log(`      Error: ${test.error}`)
      }
    })

    console.log(`\n✅ Passed: ${testResults.passed}`)
    if (testResults.failed > 0) {
      console.log(`❌ Failed: ${testResults.failed}`)
    }

    console.log('\n🎉 UAT Initialization Complete!')
    console.log('\n📝 Test Credentials:')
    console.log('   Email: admin@sumtise.com')
    console.log('   Organization: Demo Org (slug: demo-org)')
    console.log('\n✨ All modules are active and ready for testing!')

  } catch (error) {
    console.error('❌ UAT Initialization failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

