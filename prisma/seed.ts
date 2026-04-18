# Sumtise Database Seed Script
# This script populates the database with initial data for development and testing

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seeding...')

  // Create a test user
  const hashedPassword = await bcrypt.hash('password123', 12)
  
  const user = await prisma.user.upsert({
    where: { email: 'admin@sumtise.com' },
    update: {},
    create: {
      email: 'admin@sumtise.com',
      name: 'Admin User',
      password: hashedPassword,
    },
  })

  console.log('✅ Created user:', user.email)

  // Create a test organization
  const organization = await prisma.organization.upsert({
    where: { slug: 'demo-company' },
    update: {},
    create: {
      name: 'Demo Company Ltd',
      slug: 'demo-company',
      website: 'https://demo-company.com',
      email: 'info@demo-company.com',
      phone: '+44 20 7123 4567',
      address: {
        street: '123 Business Street',
        city: 'London',
        postcode: 'SW1A 1AA',
        country: 'United Kingdom'
      },
      creatorId: user.id,
    },
  })

  console.log('✅ Created organization:', organization.name)

  // Add user as organization owner
  await prisma.organizationMember.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: organization.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      organizationId: organization.id,
      role: 'OWNER',
    },
  })

  // Create chart of accounts
  const chartOfAccounts = [
    // Assets
    { code: '1000', name: 'Current Assets', type: 'ASSET', parentId: null },
    { code: '1100', name: 'Cash and Bank', type: 'ASSET', parentId: null },
    { code: '1200', name: 'Accounts Receivable', type: 'ASSET', parentId: null },
    { code: '1300', name: 'Inventory', type: 'ASSET', parentId: null },
    { code: '1400', name: 'Fixed Assets', type: 'ASSET', parentId: null },
    
    // Liabilities
    { code: '2000', name: 'Current Liabilities', type: 'LIABILITY', parentId: null },
    { code: '2100', name: 'Accounts Payable', type: 'LIABILITY', parentId: null },
    { code: '2200', name: 'Accrued Expenses', type: 'LIABILITY', parentId: null },
    { code: '2300', name: 'Long-term Debt', type: 'LIABILITY', parentId: null },
    
    // Equity
    { code: '3000', name: 'Equity', type: 'EQUITY', parentId: null },
    { code: '3100', name: 'Share Capital', type: 'EQUITY', parentId: null },
    { code: '3200', name: 'Retained Earnings', type: 'EQUITY', parentId: null },
    
    // Revenue
    { code: '4000', name: 'Revenue', type: 'REVENUE', parentId: null },
    { code: '4100', name: 'Sales Revenue', type: 'REVENUE', parentId: null },
    { code: '4200', name: 'Service Revenue', type: 'REVENUE', parentId: null },
    
    // Expenses
    { code: '5000', name: 'Operating Expenses', type: 'EXPENSE', parentId: null },
    { code: '5100', name: 'Office Supplies', type: 'EXPENSE', parentId: null },
    { code: '5200', name: 'Travel & Entertainment', type: 'EXPENSE', parentId: null },
    { code: '5300', name: 'Marketing & Advertising', type: 'EXPENSE', parentId: null },
    { code: '5400', name: 'Professional Services', type: 'EXPENSE', parentId: null },
    { code: '5500', name: 'Utilities', type: 'EXPENSE', parentId: null },
  ]

  for (const account of chartOfAccounts) {
    await prisma.chartOfAccount.upsert({
      where: {
        organizationId_code: {
          organizationId: organization.id,
          code: account.code,
        },
      },
      update: {},
      create: {
        ...account,
        organizationId: organization.id,
      },
    })
  }

  console.log('✅ Created chart of accounts')

  // Create sample customers
  const customers = [
    {
      name: 'ABC Corporation',
      email: 'accounts@abccorp.com',
      phone: '+44 20 7123 4567',
      address: {
        street: '456 Corporate Avenue',
        city: 'Manchester',
        postcode: 'M1 1AA',
        country: 'United Kingdom'
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
        country: 'United Kingdom'
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
        country: 'United Kingdom'
      },
      creditLimit: 75000,
    },
  ]

  for (const customer of customers) {
    await prisma.customer.create({
      data: {
        ...customer,
        organizationId: organization.id,
      },
    })
  }

  console.log('✅ Created sample customers')

  // Create sample bank accounts
  const bankAccounts = [
    {
      name: 'Business Current Account',
      accountNumber: '12345678',
      sortCode: '20-00-00',
      currency: 'GBP',
      openingBalance: 10000,
      currentBalance: 10000,
    },
    {
      name: 'Business Savings Account',
      accountNumber: '87654321',
      sortCode: '20-00-00',
      currency: 'GBP',
      openingBalance: 50000,
      currentBalance: 50000,
    },
  ]

  for (const bankAccount of bankAccounts) {
    await prisma.bankAccount.create({
      data: {
        ...bankAccount,
        organizationId: organization.id,
      },
    })
  }

  console.log('✅ Created sample bank accounts')

  // Create sample transactions
  const cashAccount = await prisma.chartOfAccount.findFirst({
    where: {
      organizationId: organization.id,
      code: '1100',
    },
  })

  const salesAccount = await prisma.chartOfAccount.findFirst({
    where: {
      organizationId: organization.id,
      code: '4100',
    },
  })

  if (cashAccount && salesAccount) {
    const transactions = [
      {
        accountId: salesAccount.id,
        date: new Date('2024-01-15'),
        description: 'Sales Revenue - ABC Corp',
        reference: 'INV-2024001',
        debit: 0,
        credit: 5000,
        currency: 'GBP',
      },
      {
        accountId: cashAccount.id,
        date: new Date('2024-01-15'),
        description: 'Cash Received - ABC Corp',
        reference: 'INV-2024001',
        debit: 5000,
        credit: 0,
        currency: 'GBP',
      },
      {
        accountId: salesAccount.id,
        date: new Date('2024-01-20'),
        description: 'Sales Revenue - XYZ Ltd',
        reference: 'INV-2024002',
        debit: 0,
        credit: 3200,
        currency: 'GBP',
      },
      {
        accountId: cashAccount.id,
        date: new Date('2024-01-20'),
        description: 'Cash Received - XYZ Ltd',
        reference: 'INV-2024002',
        debit: 3200,
        credit: 0,
        currency: 'GBP',
      },
    ]

    for (const transaction of transactions) {
      await prisma.transaction.create({
        data: {
          ...transaction,
          organizationId: organization.id,
        },
      })
    }

    console.log('✅ Created sample transactions')
  }

  console.log('🎉 Database seeding completed successfully!')
  console.log('')
  console.log('Test credentials:')
  console.log('Email: admin@sumtise.com')
  console.log('Password: password123')
  console.log('Organization: Demo Company Ltd')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
