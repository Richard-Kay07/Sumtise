#!/usr/bin/env tsx

/**
 * Populate Demo Organisation
 * 
 * Resets and re-seeds demo organization with comprehensive test data:
 * - 10 Vendors
 * - 10 Customers
 * - Standard Chart of Accounts
 * - Standard VAT taxes
 * - 30 Invoices
 * - 30 Bills
 * - 20 Payments
 * - 2 Payment Runs
 * - 3 Credit Notes
 * - 2 Debit Notes
 * - 10 Journals
 * - 2 months of bank transactions
 * - Files attached to 20 documents
 * 
 * Usage: npx tsx scripts/populate-demo-org.ts
 */

import { PrismaClient } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const DEMO_ORG_SLUG = 'demo-org'
const ADMIN_EMAIL = 'admin@sumtise.com'
const ADMIN_PASSWORD = 'password123'

interface SeedResult {
  organizationId: string
  adminUserId: string
  vendorIds: string[]
  customerIds: string[]
  invoiceIds: string[]
  billIds: string[]
  paymentIds: string[]
  paymentRunIds: string[]
  creditNoteIds: string[]
  debitNoteIds: string[]
  journalIds: string[]
  bankAccountIds: string[]
  fileUploadIds: string[]
}

/**
 * Reset demo organization data (deterministic)
 */
async function resetDemoOrg() {
  console.log('🔄 Resetting demo organization...')

  const org = await prisma.organization.findUnique({
    where: { slug: DEMO_ORG_SLUG },
  })

  if (!org) {
    console.log('⚠️  Demo organization not found, will create it')
    return null
  }

  // Delete in order to respect foreign keys
  // Payroll data (Phase 4)
  await prisma.payrollEntry.deleteMany({ where: { organizationId: org.id } })
  await prisma.payrollRun.deleteMany({ where: { organizationId: org.id } })
  await prisma.timesheet.deleteMany({ where: { organizationId: org.id } })
  await prisma.leaveRequest.deleteMany({ where: { organizationId: org.id } })
  await prisma.pensionContribution.deleteMany({ where: { organizationId: org.id } })
  await prisma.taxSubmission.deleteMany({ where: { organizationId: org.id } })
  await prisma.employee.deleteMany({ where: { organizationId: org.id } })
  // Banking data (Week 7)
  await prisma.reconciliationLine.deleteMany({ where: { organizationId: org.id } })
  await prisma.reconciliation.deleteMany({ where: { organizationId: org.id } })
  await prisma.bankStatementImport.deleteMany({ where: { organizationId: org.id } })
  // Payment data
  await prisma.paymentRun.deleteMany({ where: { organizationId: org.id } })
  await prisma.payment.deleteMany({ where: { organizationId: org.id } })
  // Debit notes
  await prisma.debitNoteItem.deleteMany({ where: { debitNote: { organizationId: org.id } } })
  await prisma.debitNote.deleteMany({ where: { organizationId: org.id } })
  // Credit notes
  await prisma.creditNoteItem.deleteMany({ where: { creditNote: { organizationId: org.id } } })
  await prisma.creditNote.deleteMany({ where: { organizationId: org.id } })
  // Bills
  await prisma.billAmendment.deleteMany({ where: { organizationId: org.id } })
  await prisma.billItem.deleteMany({ where: { bill: { organizationId: org.id } } })
  await prisma.bill.deleteMany({ where: { organizationId: org.id } })
  // Invoices
  await prisma.invoiceItem.deleteMany({ where: { invoice: { organizationId: org.id } } })
  await prisma.invoice.deleteMany({ where: { organizationId: org.id } })
  // Banking
  await prisma.bankTransaction.deleteMany({ where: { organizationId: org.id } })
  await prisma.transaction.deleteMany({ where: { organizationId: org.id } })
  // Files
  await prisma.fileUpload.deleteMany({ where: { organizationId: org.id } })
  // Entities
  await prisma.vendor.deleteMany({ where: { organizationId: org.id } })
  await prisma.customer.deleteMany({ where: { organizationId: org.id } })
  await prisma.bankAccount.deleteMany({ where: { organizationId: org.id } })
  await prisma.chartOfAccount.deleteMany({ where: { organizationId: org.id } })
  await prisma.taxCode.deleteMany({ where: { organizationId: org.id } })

  console.log('✅ Demo organization reset complete')
  return org
}

/**
 * Ensure demo organization and admin user exist
 */
async function ensureDemoOrg(): Promise<{ organizationId: string; adminUserId: string }> {
  console.log('🔍 Ensuring demo organization exists...')

  // Create or get admin user
  let adminUser = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  })

  if (!adminUser) {
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12)
    adminUser = await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        name: 'Admin User',
        password: hashedPassword,
      },
    })
    console.log('✅ Created admin user')
  }

  // Create or get organization
  let organization = await prisma.organization.findUnique({
    where: { slug: DEMO_ORG_SLUG },
  })

  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        name: 'Demo Organisation',
        slug: DEMO_ORG_SLUG,
        website: 'https://demo.sumtise.com',
        email: 'info@demo.sumtise.com',
        phone: '+44 20 7123 4567',
        address: {
          street: '123 Business Street',
          city: 'London',
          postcode: 'SW1A 1AA',
          country: 'United Kingdom',
        },
        creatorId: adminUser.id,
      },
    })
    console.log('✅ Created demo organization')

    // Add user as owner
    await prisma.organizationMember.upsert({
      where: {
        userId_organizationId: {
          userId: adminUser.id,
          organizationId: organization.id,
        },
      },
      update: {},
      create: {
        userId: adminUser.id,
        organizationId: organization.id,
        role: 'OWNER',
      },
    })
  }

  return {
    organizationId: organization.id,
    adminUserId: adminUser.id,
  }
}

/**
 * Seed standard Chart of Accounts
 */
async function seedChartOfAccounts(organizationId: string): Promise<string[]> {
  console.log('📊 Seeding Chart of Accounts...')

  const accounts = [
    // Assets
    { code: '1000', name: 'Current Assets', type: 'ASSET' as const },
    { code: '1100', name: 'Cash and Bank', type: 'ASSET' as const },
    { code: '1200', name: 'Accounts Receivable', type: 'ASSET' as const },
    { code: '1300', name: 'Inventory', type: 'ASSET' as const },
    { code: '1400', name: 'Fixed Assets', type: 'ASSET' as const },
    
    // Liabilities
    { code: '2000', name: 'Current Liabilities', type: 'LIABILITY' as const },
    { code: '2100', name: 'Accounts Payable', type: 'LIABILITY' as const },
    { code: '2200', name: 'Accrued Expenses', type: 'LIABILITY' as const },
    { code: '2300', name: 'Long-term Debt', type: 'LIABILITY' as const },
    
    // Equity
    { code: '3000', name: 'Equity', type: 'EQUITY' as const },
    { code: '3100', name: 'Share Capital', type: 'EQUITY' as const },
    { code: '3200', name: 'Retained Earnings', type: 'EQUITY' as const },
    
    // Revenue
    { code: '4000', name: 'Revenue', type: 'REVENUE' as const },
    { code: '4100', name: 'Sales Revenue', type: 'REVENUE' as const },
    { code: '4200', name: 'Service Revenue', type: 'REVENUE' as const },
    { code: '4300', name: 'Revenue Returns', type: 'REVENUE' as const },
    
    // Expenses
    { code: '5000', name: 'Operating Expenses', type: 'EXPENSE' as const },
    { code: '5100', name: 'Office Supplies', type: 'EXPENSE' as const },
    { code: '5200', name: 'Travel & Entertainment', type: 'EXPENSE' as const },
    { code: '5300', name: 'Marketing & Advertising', type: 'EXPENSE' as const },
    { code: '5400', name: 'Professional Services', type: 'EXPENSE' as const },
    { code: '5500', name: 'Utilities', type: 'EXPENSE' as const },
    { code: '5600', name: 'Expense Returns', type: 'EXPENSE' as const },
  ]

  const accountIds: string[] = []
  for (const account of accounts) {
    const created = await prisma.chartOfAccount.upsert({
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
        isActive: true,
      },
    })
    accountIds.push(created.id)
  }

  console.log(`✅ Created ${accountIds.length} chart of accounts`)
  return accountIds
}

/**
 * Seed standard VAT taxes
 */
async function seedTaxes(organizationId: string): Promise<string[]> {
  console.log('💰 Seeding VAT taxes...')

  const taxes = [
    { code: 'VAT-STD', name: 'Standard VAT', rate: 20.0, type: 'VAT' as const },
    { code: 'VAT-RED', name: 'Reduced VAT', rate: 5.0, type: 'VAT' as const },
    { code: 'VAT-ZERO', name: 'Zero VAT', rate: 0.0, type: 'VAT' as const },
    { code: 'VAT-EXEMPT', name: 'VAT Exempt', rate: 0.0, type: 'VAT' as const },
  ]

  const taxIds: string[] = []
  for (const tax of taxes) {
    const created = await prisma.taxCode.upsert({
      where: {
        organizationId_code: {
          organizationId,
          code: tax.code,
        },
      },
      update: {},
      create: {
        ...tax,
        organizationId,
        isActive: true,
      },
    })
    taxIds.push(created.id)
  }

  console.log(`✅ Created ${taxIds.length} tax codes`)
  return taxIds
}

/**
 * Seed 10 vendors
 */
async function seedVendors(organizationId: string, expenseAccountIds: string[]): Promise<string[]> {
  console.log('🏢 Seeding 10 vendors...')

  const vendorNames = [
    'Office Supplies Ltd',
    'Tech Solutions Inc',
    'Professional Services Co',
    'Marketing Agency Ltd',
    'Utilities Provider UK',
    'Transport Services Ltd',
    'Legal Advisors LLP',
    'IT Support Services',
    'Cleaning Services Co',
    'Equipment Rental Ltd',
  ]

  const vendorIds: string[] = []
  for (let i = 0; i < vendorNames.length; i++) {
    const vendor = await prisma.vendor.create({
      data: {
        organizationId,
        name: vendorNames[i],
        alias: vendorNames[i].replace(/\s+/g, '').substring(0, 20),
        email: `vendor${i + 1}@example.com`,
        phone: `+44 20 ${7000 + i} ${1000 + i}`,
        address: {
          street: `${100 + i} Business Street`,
          city: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Bristol'][i % 5],
          postcode: `SW${i + 1}A ${i + 1}AA`,
          country: 'United Kingdom',
        },
        taxId: `GB${String(i + 1).padStart(9, '0')}`,
        paymentTerms: [14, 30, 30, 30, 14][i % 5],
        defaultExpenseAccountId: expenseAccountIds[i % expenseAccountIds.length],
        taxScheme: 'VAT_STANDARD',
        currency: 'GBP',
      },
    })
    vendorIds.push(vendor.id)
  }

  console.log(`✅ Created ${vendorIds.length} vendors`)
  return vendorIds
}

/**
 * Seed 10 customers
 */
async function seedCustomers(organizationId: string): Promise<string[]> {
  console.log('👥 Seeding 10 customers...')

  const customerNames = [
    'ABC Corporation',
    'XYZ Limited',
    'DEF Industries',
    'Global Tech Solutions',
    'Premier Services Ltd',
    'Enterprise Solutions Inc',
    'Innovation Partners',
    'Strategic Ventures Ltd',
    'Digital Dynamics Co',
    'Future Systems Ltd',
  ]

  const customerIds: string[] = []
  for (let i = 0; i < customerNames.length; i++) {
    const customer = await prisma.customer.create({
      data: {
        organizationId,
        name: customerNames[i],
        email: `customer${i + 1}@example.com`,
        phone: `+44 20 ${8000 + i} ${2000 + i}`,
        address: {
          street: `${200 + i} Corporate Avenue`,
          city: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Bristol'][i % 5],
          postcode: `M${i + 1} ${i + 1}AA`,
          country: 'United Kingdom',
        },
        creditLimit: [50000, 25000, 75000, 100000, 50000][i % 5],
      },
    })
    customerIds.push(customer.id)
  }

  console.log(`✅ Created ${customerIds.length} customers`)
  return customerIds
}

/**
 * Seed bank accounts
 */
async function seedBankAccounts(organizationId: string, cashAccountId: string): Promise<string[]> {
  console.log('🏦 Seeding bank accounts...')

  const bankAccounts = [
    {
      name: 'Main Business Account',
      accountNumber: '12345678',
      sortCode: '20-00-00',
      currency: 'GBP',
      openingBalance: new Decimal(50000),
      currentBalance: new Decimal(50000),
    },
    {
      name: 'Operating Account',
      accountNumber: '87654321',
      sortCode: '40-12-34',
      currency: 'GBP',
      openingBalance: new Decimal(25000),
      currentBalance: new Decimal(25000),
    },
  ]

  const bankAccountIds: string[] = []
  for (const bankAccount of bankAccounts) {
    const created = await prisma.bankAccount.create({
      data: {
        ...bankAccount,
        organizationId,
        isActive: true,
      },
    })
    bankAccountIds.push(created.id)
  }

  console.log(`✅ Created ${bankAccountIds.length} bank accounts`)
  return bankAccountIds
}

/**
 * Seed 30 invoices
 */
async function seedInvoices(
  organizationId: string,
  customerIds: string[],
  revenueAccountId: string,
  arAccountId: string
): Promise<string[]> {
  console.log('📄 Seeding 30 invoices...')

  const invoiceIds: string[] = []
  const baseDate = new Date()
  baseDate.setMonth(baseDate.getMonth() - 2)

  for (let i = 0; i < 30; i++) {
    const invoiceDate = new Date(baseDate)
    invoiceDate.setDate(invoiceDate.getDate() + i * 2)
    const dueDate = new Date(invoiceDate)
    dueDate.setDate(dueDate.getDate() + 30)

    // Use deterministic value instead of Math.random() for consistent seeding
    const randomFactor = 1 + ((i * 7) % 10) / 10 // Deterministic: 1.0 to 1.9
    const subtotal = new Decimal((100 + i * 10) * randomFactor)
    const taxAmount = subtotal.times(0.20)
    const total = subtotal.plus(taxAmount)

    const statuses: Array<'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE'> = ['DRAFT', 'SENT', 'PAID', 'OVERDUE']
    const status = statuses[i % statuses.length]

    const invoice = await prisma.invoice.create({
      data: {
        organizationId,
        customerId: customerIds[i % customerIds.length],
        invoiceNumber: `INV-${String(2024).padStart(4, '0')}-${String(i + 1).padStart(4, '0')}`,
        date: invoiceDate,
        dueDate,
        status,
        subtotal,
        taxAmount,
        total,
        currency: 'GBP',
        items: {
          create: [
            {
              description: `Service ${i + 1}`,
              quantity: new Decimal(1 + (i % 3)),
              unitPrice: new Decimal(100 + i * 5),
              total: new Decimal((1 + (i % 3)) * (100 + i * 5)),
              taxRate: new Decimal(20),
            },
          ],
        },
      },
    })
    invoiceIds.push(invoice.id)
  }

  console.log(`✅ Created ${invoiceIds.length} invoices`)
  return invoiceIds
}

/**
 * Seed 30 bills
 */
async function seedBills(
  organizationId: string,
  vendorIds: string[],
  expenseAccountIds: string[],
  adminUserId: string
): Promise<string[]> {
  console.log('🧾 Seeding 30 bills...')

  const billIds: string[] = []
  const baseDate = new Date()
  baseDate.setMonth(baseDate.getMonth() - 2)

  for (let i = 0; i < 30; i++) {
    const billDate = new Date(baseDate)
    billDate.setDate(billDate.getDate() + i * 2)
    const dueDate = new Date(billDate)
    dueDate.setDate(dueDate.getDate() + 30)

    // Use deterministic value instead of Math.random() for consistent seeding
    const randomFactor = 1 + ((i * 11) % 10) / 10 // Deterministic: 1.0 to 1.9
    const subtotal = new Decimal((50 + i * 5) * randomFactor)
    const taxAmount = subtotal.times(0.20)
    const total = subtotal.plus(taxAmount)

    const statuses: Array<'DRAFT' | 'RECEIVED' | 'APPROVED' | 'PART_PAID' | 'PAID'> = [
      'DRAFT',
      'RECEIVED',
      'APPROVED',
      'PART_PAID',
      'PAID',
    ]
    const status = statuses[i % statuses.length]

    const bill = await prisma.bill.create({
      data: {
        organizationId,
        vendorId: vendorIds[i % vendorIds.length],
        billNumber: `BILL-${String(2024).padStart(4, '0')}-${String(i + 1).padStart(4, '0')}`,
        date: billDate,
        dueDate,
        status,
        subtotal,
        taxAmount,
        total,
        currency: 'GBP',
        approvedAt: status === 'APPROVED' || status === 'PART_PAID' || status === 'PAID' ? new Date() : null,
        approvedBy: status === 'APPROVED' || status === 'PART_PAID' || status === 'PAID' ? adminUserId : null,
        items: {
          create: [
            {
              description: `Expense Item ${i + 1}`,
              quantity: new Decimal(1 + (i % 3)),
              unitPrice: new Decimal(50 + i * 3),
              total: new Decimal((1 + (i % 3)) * (50 + i * 3) * 1.2),
              taxRate: new Decimal(20),
              accountId: expenseAccountIds[i % expenseAccountIds.length],
            },
          ],
        },
      },
    })
    billIds.push(bill.id)
  }

  console.log(`✅ Created ${billIds.length} bills`)
  return billIds
}

/**
 * Seed 20 payments
 */
async function seedPayments(
  organizationId: string,
  billIds: string[],
  vendorIds: string[],
  bankAccountIds: string[]
): Promise<string[]> {
  console.log('💳 Seeding 20 payments...')

  const paymentIds: string[] = []
  const baseDate = new Date()
  baseDate.setMonth(baseDate.getMonth() - 1)

  for (let i = 0; i < 20; i++) {
    const paymentDate = new Date(baseDate)
    paymentDate.setDate(paymentDate.getDate() + i)

    const amount = new Decimal(100 + i * 10)
    const billId = i < billIds.length ? billIds[i] : null

    const payment = await prisma.payment.create({
      data: {
        organizationId,
        vendorId: vendorIds[i % vendorIds.length],
        billId,
        bankAccountId: bankAccountIds[i % bankAccountIds.length],
        amount,
        paymentDate,
        currency: 'GBP',
        method: ['BANK_TRANSFER', 'CHEQUE', 'CARD', 'CASH'][i % 4] as any,
        status: 'COMPLETED',
        memo: `Payment ${i + 1}`,
      },
    })
    paymentIds.push(payment.id)
  }

  console.log(`✅ Created ${paymentIds.length} payments`)
  return paymentIds
}

/**
 * Seed 2 payment runs
 */
async function seedPaymentRuns(
  organizationId: string,
  billIds: string[],
  bankAccountIds: string[]
): Promise<string[]> {
  console.log('📦 Seeding 2 payment runs...')

  const paymentRunIds: string[] = []
  const baseDate = new Date()
  baseDate.setMonth(baseDate.getMonth() - 1)

  for (let i = 0; i < 2; i++) {
    const runDate = new Date(baseDate)
    runDate.setDate(runDate.getDate() + i * 7)

    const selectedBills = billIds.slice(i * 10, (i + 1) * 10)

    const paymentRun = await prisma.paymentRun.create({
      data: {
        organizationId,
        bankAccountId: bankAccountIds[i % bankAccountIds.length],
        runDate,
        status: i === 0 ? 'PROCESSED' : 'DRAFT',
        totalAmount: new Decimal(selectedBills.length * 100),
        billCount: selectedBills.length,
        metadata: {
          billIds: selectedBills,
        },
      },
    })
    paymentRunIds.push(paymentRun.id)
  }

  console.log(`✅ Created ${paymentRunIds.length} payment runs`)
  return paymentRunIds
}

/**
 * Seed 3 credit notes
 */
async function seedCreditNotes(
  organizationId: string,
  invoiceIds: string[],
  customerIds: string[]
): Promise<string[]> {
  console.log('📝 Seeding 3 credit notes...')

  const creditNoteIds: string[] = []
  const baseDate = new Date()
  baseDate.setMonth(baseDate.getMonth() - 1)

  for (let i = 0; i < 3; i++) {
    const creditNoteDate = new Date(baseDate)
    creditNoteDate.setDate(creditNoteDate.getDate() + i * 5)

    const subtotal = new Decimal(50 + i * 10)
    const taxAmount = subtotal.times(0.20)
    const total = subtotal.plus(taxAmount)

    const creditNote = await prisma.creditNote.create({
      data: {
        organizationId,
        invoiceId: invoiceIds[i],
        customerId: customerIds[i % customerIds.length],
        creditNoteNumber: `CN-${String(2024).padStart(4, '0')}-${String(i + 1).padStart(4, '0')}`,
        date: creditNoteDate,
        reason: `Credit note ${i + 1}`,
        subtotal,
        taxAmount,
        total,
        currency: 'GBP',
        status: i === 0 ? 'APPLIED' : 'SENT',
        items: {
          create: [
            {
              description: `Credit Item ${i + 1}`,
              quantity: new Decimal(1),
              unitPrice: subtotal,
              total,
              taxRate: new Decimal(20),
            },
          ],
        },
      },
    })
    creditNoteIds.push(creditNote.id)
  }

  console.log(`✅ Created ${creditNoteIds.length} credit notes`)
  return creditNoteIds
}

/**
 * Seed 2 debit notes
 */
async function seedDebitNotes(
  organizationId: string,
  billIds: string[],
  vendorIds: string[]
): Promise<string[]> {
  console.log('📋 Seeding 2 debit notes...')

  const debitNoteIds: string[] = []
  const baseDate = new Date()
  baseDate.setMonth(baseDate.getMonth() - 1)

  for (let i = 0; i < 2; i++) {
    const debitNoteDate = new Date(baseDate)
    debitNoteDate.setDate(debitNoteDate.getDate() + i * 5)

    const subtotal = new Decimal(30 + i * 10)
    const taxAmount = subtotal.times(0.20)
    const total = subtotal.plus(taxAmount)

    const debitNote = await prisma.debitNote.create({
      data: {
        organizationId,
        billId: billIds[i],
        vendorId: vendorIds[i % vendorIds.length],
        debitNoteNumber: `DN-${String(2024).padStart(4, '0')}-${String(i + 1).padStart(4, '0')}`,
        date: debitNoteDate,
        reason: `Debit note ${i + 1}`,
        subtotal,
        taxAmount,
        total,
        currency: 'GBP',
        status: i === 0 ? 'APPLIED' : 'SENT',
        items: {
          create: [
            {
              description: `Debit Item ${i + 1}`,
              quantity: new Decimal(1),
              unitPrice: subtotal,
              total,
              taxRate: new Decimal(20),
            },
          ],
        },
      },
    })
    debitNoteIds.push(debitNote.id)
  }

  console.log(`✅ Created ${debitNoteIds.length} debit notes`)
  return debitNoteIds
}

/**
 * Seed 10 journals
 */
async function seedJournals(
  organizationId: string,
  accountIds: string[],
  adminUserId: string
): Promise<string[]> {
  console.log('📚 Seeding 10 journals...')

  const journalIds: string[] = []
  const baseDate = new Date()
  baseDate.setMonth(baseDate.getMonth() - 1)

  for (let i = 0; i < 10; i++) {
    const journalDate = new Date(baseDate)
    journalDate.setDate(journalDate.getDate() + i * 2)

    const debitAccount = accountIds[i % accountIds.length]
    const creditAccount = accountIds[(i + 1) % accountIds.length]
    const amount = new Decimal(100 + i * 10)

    // Create journal entry (using transaction model)
    const transaction1 = await prisma.transaction.create({
      data: {
        organizationId,
        accountId: debitAccount,
        date: journalDate,
        description: `Journal Entry ${i + 1} - Debit`,
        reference: `JRN-${String(2024).padStart(4, '0')}-${String(i + 1).padStart(4, '0')}`,
        debit: amount,
        credit: new Decimal(0),
        currency: 'GBP',
      },
    })

    const transaction2 = await prisma.transaction.create({
      data: {
        organizationId,
        accountId: creditAccount,
        date: journalDate,
        description: `Journal Entry ${i + 1} - Credit`,
        reference: `JRN-${String(2024).padStart(4, '0')}-${String(i + 1).padStart(4, '0')}`,
        debit: new Decimal(0),
        credit: amount,
        currency: 'GBP',
      },
    })

    journalIds.push(transaction1.id) // Use first transaction ID as journal ID
  }

  console.log(`✅ Created ${journalIds.length} journal entries`)
  return journalIds
}

/**
 * Seed 2 months of bank transactions
 */
async function seedBankTransactions(
  organizationId: string,
  bankAccountIds: string[]
): Promise<string[]> {
  console.log('🏦 Seeding 2 months of bank transactions...')

  const transactionIds: string[] = []
  const baseDate = new Date()
  baseDate.setMonth(baseDate.getMonth() - 2)
  baseDate.setDate(1) // Start from first of month

  // 60 days of transactions (2 months)
  // Mix of reconciled and unreconciled for testing
  const descriptions = [
    'Payment from Customer ABC',
    'Office Supplies Purchase',
    'Invoice Payment',
    'Vendor Payment',
    'Bank Transfer',
    'Direct Debit',
    'Standing Order',
    'Cash Deposit',
    'ATM Withdrawal',
    'Card Payment',
  ]

  const payees = [
    'Customer ABC Ltd',
    'Office Supplies Co',
    'Vendor XYZ Ltd',
    'Utility Company',
    'Bank Transfer',
    null,
    null,
    'Cash Deposit',
    'ATM',
    'Card Payment',
  ]

  for (let i = 0; i < 60; i++) {
    const transactionDate = new Date(baseDate)
    transactionDate.setDate(transactionDate.getDate() + i)

    // Mix of positive (deposits) and negative (withdrawals)
    const isDeposit = i % 3 !== 0 // 2/3 deposits, 1/3 withdrawals
    const baseAmount = 50 + (i % 20) * 25 // Varying amounts
    const amount = new Decimal(isDeposit ? baseAmount : -baseAmount)

    // Some transactions are reconciled, some are not (for Week 7 testing)
    const isReconciled = i < 40 // First 40 are reconciled, last 20 are unreconciled
    const reconciledAt = isReconciled ? transactionDate : null
    const reconciledBy = isReconciled ? 'system' : null

    const descIndex = i % descriptions.length
    const description = descriptions[descIndex]
    const payee = payees[descIndex]

    // Calculate running balance (simplified - use opening balance + accumulated)
    const accountIndex = i % bankAccountIds.length
    const openingBalance = accountIndex === 0 ? new Decimal(50000) : new Decimal(25000)
    
    // Get all previous transactions for this account up to this date
    const previousTransactions = await prisma.bankTransaction.findMany({
      where: {
        organizationId,
        bankAccountId: bankAccountIds[accountIndex],
        date: { lt: transactionDate },
      },
      select: { amount: true },
    })
    
    const previousTotal = previousTransactions.reduce(
      (sum, tx) => sum.plus(new Decimal(tx.amount.toString())),
      new Decimal(0)
    )
    
    const balance = openingBalance.plus(previousTotal).plus(amount)

    const transaction = await prisma.bankTransaction.create({
      data: {
        organizationId,
        bankAccountId: bankAccountIds[i % bankAccountIds.length],
        date: transactionDate,
        amount,
        balance,
        description,
        payee: payee || null,
        memo: i % 5 === 0 ? `Memo for transaction ${i + 1}` : null,
        reference: `TXN-${String(transactionDate.getFullYear()).padStart(4, '0')}-${String(i + 1).padStart(4, '0')}`,
        type: isDeposit ? 'CREDIT' : 'DEBIT',
        category: i % 3 === 0 ? 'SALES' : i % 3 === 1 ? 'EXPENSES' : 'TRANSFER',
        reconciledAt,
        reconciledBy,
      },
    })
    transactionIds.push(transaction.id)
  }

  console.log(`✅ Created ${transactionIds.length} bank transactions (40 reconciled, 20 unreconciled)`)
  return transactionIds
}

/**
 * Seed files attached to 20 documents
 */
async function seedFiles(
  organizationId: string,
  adminUserId: string,
  invoiceIds: string[],
  billIds: string[]
): Promise<string[]> {
  console.log('📎 Seeding files attached to 20 documents...')

  const fileUploadIds: string[] = []
  const uploadedAt = new Date()

  // Attach files to 10 invoices
  for (let i = 0; i < 10; i++) {
    const invoiceId = invoiceIds[i]
    const fileUpload = await prisma.fileUpload.create({
      data: {
        organizationId,
        userId: adminUserId,
        originalName: `invoice-${i + 1}.pdf`,
        fileName: `file-inv-${i + 1}.pdf`,
        filePath: `/uploads/${organizationId}/invoice-${i + 1}.pdf`,
        fileType: 'application/pdf',
        fileSize: 1024 * (100 + i * 10), // 100KB to 190KB
        category: 'INVOICES',
        metadata: JSON.stringify({
          documentType: 'invoice',
          documentId: invoiceId,
          uploadedAt: uploadedAt.toISOString(),
        }),
        uploadedAt,
      },
    })
    fileUploadIds.push(fileUpload.id)

    // Update invoice with attachment
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        attachments: [
          {
            fileId: fileUpload.id,
            fileName: fileUpload.originalName,
            fileSize: fileUpload.fileSize,
            contentType: fileUpload.fileType,
            uploadedAt: uploadedAt.toISOString(),
            uploaderId: adminUserId,
          },
        ],
      },
    })
  }

  // Attach files to 10 bills
  for (let i = 0; i < 10; i++) {
    const billId = billIds[i]
    const fileUpload = await prisma.fileUpload.create({
      data: {
        organizationId,
        userId: adminUserId,
        originalName: `bill-${i + 1}.pdf`,
        fileName: `file-bill-${i + 1}.pdf`,
        filePath: `/uploads/${organizationId}/bill-${i + 1}.pdf`,
        fileType: 'application/pdf',
        fileSize: 1024 * (100 + i * 10), // 100KB to 190KB
        category: 'RECEIPTS',
        metadata: JSON.stringify({
          documentType: 'bill',
          documentId: billId,
          uploadedAt: uploadedAt.toISOString(),
        }),
        uploadedAt,
      },
    })
    fileUploadIds.push(fileUpload.id)

    // Update bill with attachment
    await prisma.bill.update({
      where: { id: billId },
      data: {
        attachments: [
          {
            fileId: fileUpload.id,
            fileName: fileUpload.originalName,
            fileSize: fileUpload.fileSize,
            contentType: fileUpload.fileType,
            uploadedAt: uploadedAt.toISOString(),
            uploaderId: adminUserId,
          },
        ],
      },
    })
  }

  console.log(`✅ Created ${fileUploadIds.length} file uploads and attached to 20 documents`)
  return fileUploadIds
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting Demo Organisation Population...\n')

  try {
    // Step 1: Reset existing data
    await resetDemoOrg()

    // Step 2: Ensure demo org exists
    const { organizationId, adminUserId } = await ensureDemoOrg()

    // Step 3: Seed Chart of Accounts
    const accountIds = await seedChartOfAccounts(organizationId)
    // Get specific accounts by code
    const cashAccount = await prisma.chartOfAccount.findUnique({
      where: { organizationId_code: { organizationId, code: '1100' } },
    })
    const arAccount = await prisma.chartOfAccount.findUnique({
      where: { organizationId_code: { organizationId, code: '1200' } },
    })
    const apAccount = await prisma.chartOfAccount.findUnique({
      where: { organizationId_code: { organizationId, code: '2100' } },
    })
    const revenueAccount = await prisma.chartOfAccount.findUnique({
      where: { organizationId_code: { organizationId, code: '4100' } },
    })
    const expenseAccounts = await prisma.chartOfAccount.findMany({
      where: {
        organizationId,
        code: { in: ['5100', '5200', '5300', '5400', '5500', '5600'] },
      },
    })

    const cashAccountId = cashAccount?.id || accountIds[1]
    const arAccountId = arAccount?.id || accountIds[2]
    const apAccountId = apAccount?.id || accountIds[7]
    const revenueAccountId = revenueAccount?.id || accountIds[14]
    const expenseAccountIds = expenseAccounts.map((a) => a.id).length > 0
      ? expenseAccounts.map((a) => a.id)
      : accountIds.slice(17, 23)

    // Step 4: Seed Taxes
    await seedTaxes(organizationId)

    // Step 5: Seed Vendors
    const vendorIds = await seedVendors(organizationId, expenseAccountIds)

    // Step 6: Seed Customers
    const customerIds = await seedCustomers(organizationId)

    // Step 7: Seed Bank Accounts
    const bankAccountIds = await seedBankAccounts(organizationId, cashAccountId)

    // Step 8: Seed Invoices
    const invoiceIds = await seedInvoices(organizationId, customerIds, revenueAccountId, arAccountId)

    // Step 9: Seed Bills
    const billIds = await seedBills(organizationId, vendorIds, expenseAccountIds, adminUserId)

    // Step 10: Seed Payments
    const paymentIds = await seedPayments(organizationId, billIds, vendorIds, bankAccountIds)

    // Step 11: Seed Payment Runs
    const paymentRunIds = await seedPaymentRuns(organizationId, billIds, bankAccountIds)

    // Step 12: Seed Credit Notes
    const creditNoteIds = await seedCreditNotes(organizationId, invoiceIds, customerIds)

    // Step 13: Seed Debit Notes
    const debitNoteIds = await seedDebitNotes(organizationId, billIds, vendorIds)

    // Step 14: Seed Journals
    const journalIds = await seedJournals(organizationId, accountIds, adminUserId)

    // Step 15: Seed Bank Transactions
    const bankTransactionIds = await seedBankTransactions(organizationId, bankAccountIds)

    // Step 16: Seed Files
    const fileUploadIds = await seedFiles(organizationId, adminUserId, invoiceIds, billIds)

    // Print summary
    console.log('\n' + '='.repeat(60))
    console.log('✅ Demo Organisation Population Complete!')
    console.log('='.repeat(60))
    console.log('\n📊 Data Summary:')
    console.log(`   Organization ID: ${organizationId}`)
    console.log(`   Admin User ID: ${adminUserId}`)
    console.log(`   Vendors: ${vendorIds.length}`)
    console.log(`   Customers: ${customerIds.length}`)
    console.log(`   Chart of Accounts: ${accountIds.length}`)
    console.log(`   Invoices: ${invoiceIds.length}`)
    console.log(`   Bills: ${billIds.length}`)
    console.log(`   Payments: ${paymentIds.length}`)
    console.log(`   Payment Runs: ${paymentRunIds.length}`)
    console.log(`   Credit Notes: ${creditNoteIds.length}`)
    console.log(`   Debit Notes: ${debitNoteIds.length}`)
    console.log(`   Journals: ${journalIds.length}`)
    console.log(`   Bank Transactions: ${bankTransactionIds.length}`)
    console.log(`   File Uploads: ${fileUploadIds.length}`)

    console.log('\n🔑 Admin Login:')
    console.log(`   Email: ${ADMIN_EMAIL}`)
    console.log(`   Password: ${ADMIN_PASSWORD}`)
    console.log(`   Organization: Demo Organisation (slug: ${DEMO_ORG_SLUG})`)

    console.log('\n📋 Important IDs:')
    console.log(`   Organization: ${organizationId}`)
    console.log(`   Admin User: ${adminUserId}`)
    console.log(`   First Vendor: ${vendorIds[0]}`)
    console.log(`   First Customer: ${customerIds[0]}`)
    console.log(`   First Invoice: ${invoiceIds[0]}`)
    console.log(`   First Bill: ${billIds[0]}`)
    console.log(`   First Payment: ${paymentIds[0]}`)
    console.log(`   First Payment Run: ${paymentRunIds[0]}`)
    console.log(`   First Credit Note: ${creditNoteIds[0]}`)
    console.log(`   First Debit Note: ${debitNoteIds[0]}`)
    console.log(`   First Journal: ${journalIds[0]}`)
    console.log(`   First Bank Account: ${bankAccountIds[0]}`)
    if (bankTransactionIds.length > 0) {
      console.log(`   First Bank Transaction: ${bankTransactionIds[0]}`)
      console.log(`   Unreconciled Transactions: 20 (for testing reconciliation)`)
    }
    console.log(`   First File Upload: ${fileUploadIds[0]}`)
    console.log(`   Files Attached: 20 documents (10 invoices, 10 bills)`)

    console.log('\n✨ All data seeded deterministically!')
  } catch (error) {
    console.error('❌ Error populating demo organization:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

