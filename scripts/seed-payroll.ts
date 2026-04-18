#!/usr/bin/env tsx

/**
 * Seed Payroll Sample Data
 * 
 * Creates sample employee and payroll run with 2 entries for testing
 * 
 * Usage: npx tsx scripts/seed-payroll.ts
 */

import { PrismaClient } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

const prisma = new PrismaClient()

const DEMO_ORG_SLUG = 'demo-org'

async function main() {
  console.log('🌱 Seeding payroll sample data...\n')

  // Get demo organization
  const org = await prisma.organization.findUnique({
    where: { slug: DEMO_ORG_SLUG },
  })

  if (!org) {
    console.error('❌ Demo organization not found. Please run populate-demo-org.ts first.')
    process.exit(1)
  }

  // Get admin user
  const adminUser = await prisma.user.findUnique({
    where: { email: 'admin@sumtise.com' },
  })

  if (!adminUser) {
    console.error('❌ Admin user not found. Please run populate-demo-org.ts first.')
    process.exit(1)
  }

  // Create sample employee
  console.log('👤 Creating sample employee...')
  const employee = await prisma.employee.upsert({
    where: {
      organizationId_employeeNumber: {
        organizationId: org.id,
        employeeNumber: 'EMP001',
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      userId: adminUser.id,
      employeeNumber: 'EMP001',
      firstName: 'John',
      lastName: 'Smith',
      email: 'john.smith@example.com',
      phone: '+44 20 7123 4567',
      address: {
        street: '123 Employee Street',
        city: 'London',
        postcode: 'SW1A 1AA',
        country: 'United Kingdom',
      },
      dateOfBirth: new Date('1985-05-15'),
      startDate: new Date('2023-01-01'),
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      salary: new Decimal(50000), // £50,000 per year
      taxCode: '1257L',
      nationalInsuranceNumber: 'AB123456C',
      pensionScheme: 'AUTO_ENROLMENT',
      bankAccountNumber: '12345678',
      bankSortCode: '20-00-00',
    },
  })

  console.log(`✅ Created employee: ${employee.firstName} ${employee.lastName} (${employee.employeeNumber})`)

  // Create payroll run
  console.log('\n📋 Creating payroll run...')
  const payPeriodStart = new Date()
  payPeriodStart.setDate(1) // First of current month
  const payPeriodEnd = new Date(payPeriodStart)
  payPeriodEnd.setMonth(payPeriodEnd.getMonth() + 1)
  payPeriodEnd.setDate(0) // Last day of current month
  const payDate = new Date(payPeriodEnd)
  payDate.setDate(payDate.getDate() + 1) // Day after period ends

  const payrollRun = await prisma.payrollRun.upsert({
    where: {
      organizationId_runNumber: {
        organizationId: org.id,
        runNumber: `PAY-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      runNumber: `PAY-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
      payPeriodStart,
      payPeriodEnd,
      payDate,
      status: 'DRAFT',
      totalGross: new Decimal(0),
      totalDeductions: new Decimal(0),
      totalNet: new Decimal(0),
      employeeCount: 0,
    },
  })

  console.log(`✅ Created payroll run: ${payrollRun.runNumber}`)

  // Create 2 payroll entries
  console.log('\n💰 Creating payroll entries...')

  // Entry 1: Full-time employee
  const grossPay1 = new Decimal(4166.67) // Monthly salary (£50,000 / 12)
  const taxAmount1 = new Decimal(666.67) // Approximate tax
  const nationalInsurance1 = new Decimal(400.00) // Approximate NI
  const pensionEmployee1 = new Decimal(166.67) // 4% of qualifying earnings
  const pensionEmployer1 = new Decimal(125.00) // 3% employer contribution
  const deductions1 = taxAmount1.plus(nationalInsurance1).plus(pensionEmployee1)
  const netPay1 = grossPay1.minus(deductions1)

  const entry1 = await prisma.payrollEntry.create({
    data: {
      organizationId: org.id,
      payrollRunId: payrollRun.id,
      employeeId: employee.id,
      grossPay: grossPay1,
      deductions: deductions1,
      netPay: netPay1,
      taxAmount: taxAmount1,
      nationalInsurance: nationalInsurance1,
      pensionEmployee: pensionEmployee1,
      pensionEmployer: pensionEmployer1,
      otherDeductions: new Decimal(0),
      earnings: {
        basic: grossPay1.toString(),
      },
      deductionsBreakdown: {
        tax: taxAmount1.toString(),
        nationalInsurance: nationalInsurance1.toString(),
        pension: pensionEmployee1.toString(),
      },
    },
  })

  console.log(`✅ Created entry 1: Employee ${employee.employeeNumber} - Net: £${netPay1.toString()}`)

  // Entry 2: Create another employee for second entry
  const employee2 = await prisma.employee.upsert({
    where: {
      organizationId_employeeNumber: {
        organizationId: org.id,
        employeeNumber: 'EMP002',
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      employeeNumber: 'EMP002',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane.doe@example.com',
      phone: '+44 20 7123 4568',
      address: {
        street: '456 Employee Avenue',
        city: 'London',
        postcode: 'SW1A 1BB',
        country: 'United Kingdom',
      },
      dateOfBirth: new Date('1990-08-20'),
      startDate: new Date('2023-06-01'),
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      salary: new Decimal(40000), // £40,000 per year
      taxCode: '1257L',
      nationalInsuranceNumber: 'CD789012D',
      pensionScheme: 'AUTO_ENROLMENT',
      bankAccountNumber: '87654321',
      bankSortCode: '40-12-34',
    },
  })

  const grossPay2 = new Decimal(3333.33) // Monthly salary (£40,000 / 12)
  const taxAmount2 = new Decimal(500.00)
  const nationalInsurance2 = new Decimal(320.00)
  const pensionEmployee2 = new Decimal(133.33)
  const pensionEmployer2 = new Decimal(100.00)
  const deductions2 = taxAmount2.plus(nationalInsurance2).plus(pensionEmployee2)
  const netPay2 = grossPay2.minus(deductions2)

  const entry2 = await prisma.payrollEntry.create({
    data: {
      organizationId: org.id,
      payrollRunId: payrollRun.id,
      employeeId: employee2.id,
      grossPay: grossPay2,
      deductions: deductions2,
      netPay: netPay2,
      taxAmount: taxAmount2,
      nationalInsurance: nationalInsurance2,
      pensionEmployee: pensionEmployee2,
      pensionEmployer: pensionEmployer2,
      otherDeductions: new Decimal(0),
      earnings: {
        basic: grossPay2.toString(),
      },
      deductionsBreakdown: {
        tax: taxAmount2.toString(),
        nationalInsurance: nationalInsurance2.toString(),
        pension: pensionEmployee2.toString(),
      },
    },
  })

  console.log(`✅ Created entry 2: Employee ${employee2.employeeNumber} - Net: £${netPay2.toString()}`)

  // Update payroll run totals
  const totalGross = grossPay1.plus(grossPay2)
  const totalDeductions = deductions1.plus(deductions2)
  const totalNet = netPay1.plus(netPay2)

  await prisma.payrollRun.update({
    where: { id: payrollRun.id },
    data: {
      totalGross,
      totalDeductions,
      totalNet,
      employeeCount: 2,
    },
  })

  console.log('\n' + '='.repeat(60))
  console.log('✅ Payroll seed data created successfully!')
  console.log('='.repeat(60))
  console.log('\n📊 Summary:')
  console.log(`   Organization: ${org.name} (${org.id})`)
  console.log(`   Employees: 2`)
  console.log(`   Payroll Run: ${payrollRun.runNumber} (${payrollRun.id})`)
  console.log(`   Entries: 2`)
  console.log(`   Total Gross: £${totalGross.toString()}`)
  console.log(`   Total Deductions: £${totalDeductions.toString()}`)
  console.log(`   Total Net: £${totalNet.toString()}`)
  console.log('\n📋 Employee IDs:')
  console.log(`   Employee 1: ${employee.id} (${employee.employeeNumber})`)
  console.log(`   Employee 2: ${employee2.id} (${employee2.employeeNumber})`)
  console.log('\n📋 Payroll Entry IDs:')
  console.log(`   Entry 1: ${entry1.id}`)
  console.log(`   Entry 2: ${entry2.id}`)
}

main()
  .catch((error) => {
    console.error('❌ Error seeding payroll data:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })




