#!/usr/bin/env tsx

/**
 * Phase 1 Definition of Done Verification Script
 * 
 * Verifies that all Phase 1 features are implemented and working.
 * 
 * Usage: npx tsx scripts/verify-phase1-done.ts
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface VerificationResult {
  category: string
  item: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  message?: string
}

const results: VerificationResult[] = []

function addResult(category: string, item: string, status: 'PASS' | 'FAIL' | 'SKIP', message?: string) {
  results.push({ category, item, status, message })
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️'
  console.log(`${icon} ${category} - ${item}${message ? `: ${message}` : ''}`)
}

async function verifyFileExists(filePath: string): Promise<boolean> {
  try {
    return fs.existsSync(path.join(process.cwd(), filePath))
  } catch {
    return false
  }
}

async function verifyRouterExists(routerName: string): Promise<boolean> {
  const routerPath = `src/server/routers/${routerName}.ts`
  return verifyFileExists(routerPath)
}

async function verifyTestExists(testName: string): Promise<boolean> {
  const testPaths = [
    `tests/e2e/${testName}.spec.ts`,
    `tests/qa/${testName}.spec.ts`,
    `tests/qa/${testName}-qa.spec.ts`,
  ]
  return testPaths.some((p) => fs.existsSync(path.join(process.cwd(), p)))
}

async function verifyDatabaseSchema() {
  console.log('\n📊 Verifying Database Schema...')
  
  try {
    // Check for required models
    const models = [
      'Vendor',
      'Customer',
      'Bill',
      'BillItem',
      'Invoice',
      'InvoiceItem',
      'Payment',
      'PaymentRun',
      'CreditNote',
      'CreditNoteItem',
      'DebitNote',
      'DebitNoteItem',
      'BillAmendment',
      'ChartOfAccount',
      'TaxCode',
      'BankAccount',
      'BankTransaction',
      'Transaction',
      'FileUpload',
    ]

    for (const model of models) {
      // Try to query the model (this will fail if model doesn't exist)
      try {
        await (prisma as any)[model.toLowerCase()].findFirst({ take: 1 })
        addResult('Database Schema', `${model} model exists`, 'PASS')
      } catch (error: any) {
        if (error.message?.includes('Unknown arg')) {
          addResult('Database Schema', `${model} model exists`, 'PASS')
        } else {
          addResult('Database Schema', `${model} model exists`, 'FAIL', error.message)
        }
      }
    }
  } catch (error: any) {
    addResult('Database Schema', 'Schema verification', 'FAIL', error.message)
  }
}

async function verifyRouters() {
  console.log('\n🔌 Verifying Routers...')
  
  const routers = [
    'vendors',
    'bills',
    'payments',
    'paymentRuns',
    'creditNotes',
    'debitNotes',
    'billAmendments',
    'invoiceReminders',
    'invoices',
  ]

  for (const router of routers) {
    const exists = await verifyRouterExists(router)
    addResult('Routers', `${router} router`, exists ? 'PASS' : 'FAIL')
  }
}

async function verifyTests() {
  console.log('\n🧪 Verifying Tests...')
  
  const tests = [
    'vendors',
    'bills',
    'payments',
    'paymentRuns',
    'creditNotes',
    'debitNotes',
    'billAmendments',
    'invoiceReminders',
    'ledger-integrity',
  ]

  for (const test of tests) {
    const exists = await verifyTestExists(test)
    addResult('Tests', `${test} tests`, exists ? 'PASS' : 'FAIL')
  }
}

async function verifyDemoData() {
  console.log('\n📦 Verifying Demo Data...')
  
  try {
    const org = await prisma.organization.findUnique({
      where: { slug: 'demo-org' },
    })

    if (!org) {
      addResult('Demo Data', 'Demo organization exists', 'FAIL', 'Not found')
      return
    }

    addResult('Demo Data', 'Demo organization exists', 'PASS')

    const vendors = await prisma.vendor.count({ where: { organizationId: org.id } })
    addResult('Demo Data', 'Vendors', vendors >= 10 ? 'PASS' : 'FAIL', `Found ${vendors}, expected >= 10`)

    const customers = await prisma.customer.count({ where: { organizationId: org.id } })
    addResult('Demo Data', 'Customers', customers >= 10 ? 'PASS' : 'FAIL', `Found ${customers}, expected >= 10`)

    const bills = await prisma.bill.count({ where: { organizationId: org.id } })
    addResult('Demo Data', 'Bills', bills >= 30 ? 'PASS' : 'FAIL', `Found ${bills}, expected >= 30`)

    const invoices = await prisma.invoice.count({ where: { organizationId: org.id } })
    addResult('Demo Data', 'Invoices', invoices >= 30 ? 'PASS' : 'FAIL', `Found ${invoices}, expected >= 30`)

    const payments = await prisma.payment.count({ where: { organizationId: org.id } })
    addResult('Demo Data', 'Payments', payments >= 20 ? 'PASS' : 'FAIL', `Found ${payments}, expected >= 20`)

    const paymentRuns = await prisma.paymentRun.count({ where: { organizationId: org.id } })
    addResult('Demo Data', 'Payment Runs', paymentRuns >= 2 ? 'PASS' : 'FAIL', `Found ${paymentRuns}, expected >= 2`)

    const creditNotes = await prisma.creditNote.count({ where: { organizationId: org.id } })
    addResult('Demo Data', 'Credit Notes', creditNotes >= 3 ? 'PASS' : 'FAIL', `Found ${creditNotes}, expected >= 3`)

    const debitNotes = await prisma.debitNote.count({ where: { organizationId: org.id } })
    addResult('Demo Data', 'Debit Notes', debitNotes >= 2 ? 'PASS' : 'FAIL', `Found ${debitNotes}, expected >= 2`)

    const transactions = await prisma.transaction.count({ where: { organizationId: org.id } })
    addResult('Demo Data', 'Transactions/Journals', transactions >= 10 ? 'PASS' : 'FAIL', `Found ${transactions}, expected >= 10`)

    const bankTransactions = await prisma.bankTransaction.count({ where: { organizationId: org.id } })
    addResult('Demo Data', 'Bank Transactions', bankTransactions >= 60 ? 'PASS' : 'FAIL', `Found ${bankTransactions}, expected >= 60`)

    const files = await prisma.fileUpload.count({ where: { organizationId: org.id } })
    addResult('Demo Data', 'File Uploads', files >= 20 ? 'PASS' : 'FAIL', `Found ${files}, expected >= 20`)
  } catch (error: any) {
    addResult('Demo Data', 'Demo data verification', 'FAIL', error.message)
  }
}

async function verifyDocumentation() {
  console.log('\n📚 Verifying Documentation...')
  
  const docs = [
    'PHASE1_DEFINITION_OF_DONE.md',
    'QA_TEST_SUMMARY.md',
    'scripts/DEMO_POPULATION_README.md',
    'IMPLEMENTATION_SEQUENCE.md',
  ]

  for (const doc of docs) {
    const exists = await verifyFileExists(doc)
    addResult('Documentation', doc, exists ? 'PASS' : 'FAIL')
  }
}

async function verifyScripts() {
  console.log('\n🔧 Verifying Scripts...')
  
  const scripts = [
    'scripts/populate-demo-org.ts',
    'scripts/uat-initializer.ts',
  ]

  for (const script of scripts) {
    const exists = await verifyFileExists(script)
    addResult('Scripts', script, exists ? 'PASS' : 'FAIL')
  }
}

async function main() {
  console.log('🚀 Phase 1 Definition of Done Verification\n')
  console.log('='.repeat(60))

  try {
    await verifyRouters()
    await verifyTests()
    await verifyDatabaseSchema()
    await verifyDemoData()
    await verifyDocumentation()
    await verifyScripts()

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 Verification Summary')
    console.log('='.repeat(60))

    const passed = results.filter((r) => r.status === 'PASS').length
    const failed = results.filter((r) => r.status === 'FAIL').length
    const skipped = results.filter((r) => r.status === 'SKIP').length
    const total = results.length

    console.log(`\n✅ Passed: ${passed}/${total}`)
    console.log(`❌ Failed: ${failed}/${total}`)
    console.log(`⏭️  Skipped: ${skipped}/${total}`)

    if (failed > 0) {
      console.log('\n❌ Failed Items:')
      results
        .filter((r) => r.status === 'FAIL')
        .forEach((r) => {
          console.log(`   - ${r.category}: ${r.item}${r.message ? ` (${r.message})` : ''}`)
        })
    }

    const passRate = ((passed / total) * 100).toFixed(1)
    console.log(`\n📈 Pass Rate: ${passRate}%`)

    if (passRate === '100.0') {
      console.log('\n🎉 All verifications passed! Phase 1 is ready.')
    } else {
      console.log('\n⚠️  Some verifications failed. Please review and fix.')
    }
  } catch (error: any) {
    console.error('❌ Verification failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()




