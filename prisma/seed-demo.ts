/**
 * prisma/seed-demo.ts
 *
 * Maple & Stone Consulting Ltd — Six-Month Demo Dataset
 * Period: 1 January 2025 – 30 June 2025
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-demo.ts
 *
 * Or via package.json:
 *   "seed:demo": "ts-node --compiler-options '{\"module\":\"CommonJS\"}' prisma/seed-demo.ts"
 *
 * Requires seed.ts to have been run first (creates the admin user).
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ─── Date / number helpers ────────────────────────────────────────────────────

const d  = (y: number, m: number, day: number) => new Date(y, m - 1, day)
const eom = (y: number, m: number) => new Date(y, m, 0)
const addDays = (date: Date, n: number) => { const r = new Date(date); r.setDate(r.getDate() + n); return r }
const r2 = (n: number) => Math.round(n * 100) / 100
const pad = (n: number, w = 3) => String(n).padStart(w, '0')
const vat = (net: number) => r2(net * 0.2)

// ─── Sequence counters ────────────────────────────────────────────────────────

let siSeq = 0; const nextSI  = () => `INV-${pad(++siSeq)}`
let piSeq = 0; const nextPI  = () => `BILL-${pad(++piSeq)}`
let jnlSeq= 0; const nextJNL = () => `JNL-2025-${pad(++jnlSeq)}`
let prSeq = 0; const nextPR  = () => `PR-2025-${pad(++prSeq)}`

// ─── COA lookup cache ─────────────────────────────────────────────────────────

const coaCache = new Map<string, string>()

async function aid(orgId: string, code: string): Promise<string> {
  const k = `${orgId}:${code}`
  if (coaCache.has(k)) return coaCache.get(k)!
  const a = await prisma.chartOfAccount.findUnique({
    where: { organizationId_code: { organizationId: orgId, code } },
  })
  if (!a) throw new Error(`Account code ${code} not found — run seed-demo again or check COA creation`)
  coaCache.set(k, a.id)
  return a.id
}

// ─── Ledger journal helper ────────────────────────────────────────────────────

interface LLine { code: string; debit?: number; credit?: number; memo?: string }

async function ledger(orgId: string, date: Date, ref: string, desc: string, lines: LLine[]) {
  const totalDR = lines.reduce((s, l) => s + (l.debit  ?? 0), 0)
  const totalCR = lines.reduce((s, l) => s + (l.credit ?? 0), 0)
  if (Math.abs(totalDR - totalCR) > 0.02)
    throw new Error(`Unbalanced journal ${ref}: DR ${totalDR.toFixed(2)} ≠ CR ${totalCR.toFixed(2)}`)
  for (const l of lines) {
    await prisma.transaction.create({
      data: {
        organizationId: orgId,
        accountId: await aid(orgId, l.code),
        date, description: l.memo ?? desc, reference: ref,
        debit: l.debit ?? 0, credit: l.credit ?? 0, currency: 'GBP',
      },
    })
  }
}

// ─── ManualJournal helper (populates journal list UI) ─────────────────────────

async function manualJournal(
  orgId: string, date: Date, ref: string, desc: string,
  userId: string, lines: LLine[]
) {
  const linesData = await Promise.all(lines.map(async (l, i) => ({
    accountId: await aid(orgId, l.code),
    description: l.memo ?? desc,
    debit:  l.debit  ?? 0,
    credit: l.credit ?? 0,
    sortOrder: i,
  })))
  await prisma.manualJournal.create({
    data: {
      organizationId: orgId, reference: ref, date, description: desc,
      status: 'POSTED', preparedBy: userId, postedAt: date, postedBy: userId,
      lines: { create: linesData },
    },
  })
}

// ─── Chart of Accounts ────────────────────────────────────────────────────────

const COA = [
  // Assets
  { code: '1100', name: 'Trade Debtors',                    type: 'ASSET',     normalBalance: 'DR' },
  { code: '1200', name: 'Barclays Business Current Account', type: 'ASSET',     normalBalance: 'DR' },
  { code: '1210', name: 'Barclays Business Savings Account', type: 'ASSET',     normalBalance: 'DR' },
  // Liabilities
  { code: '2100', name: 'Trade Creditors',                  type: 'LIABILITY', normalBalance: 'CR' },
  { code: '2200', name: 'VAT Control Account',              type: 'LIABILITY', normalBalance: 'CR' },
  { code: '2210', name: 'PAYE & NI Payable',                type: 'LIABILITY', normalBalance: 'CR' },
  { code: '2300', name: 'Accruals & Deferred Income',        type: 'LIABILITY', normalBalance: 'CR' },
  // Equity
  { code: '3000', name: 'Share Capital',                    type: 'EQUITY',    normalBalance: 'CR' },
  { code: '3100', name: 'Retained Earnings',                type: 'EQUITY',    normalBalance: 'CR' },
  // Revenue
  { code: '4000', name: 'Consulting Retainer Revenue',      type: 'REVENUE',   normalBalance: 'CR', vatTreatment: 'STANDARD_RATE' },
  { code: '4100', name: 'Project Revenue',                  type: 'REVENUE',   normalBalance: 'CR', vatTreatment: 'STANDARD_RATE' },
  { code: '4200', name: 'Grant Income',                     type: 'REVENUE',   normalBalance: 'CR', vatTreatment: 'EXEMPT' },
  // Expenses
  { code: '5000', name: 'Salaries & Wages',                 type: 'EXPENSE',   normalBalance: 'DR' },
  { code: '5010', name: 'Employer National Insurance',      type: 'EXPENSE',   normalBalance: 'DR' },
  { code: '5020', name: 'Employer Pension Contributions',   type: 'EXPENSE',   normalBalance: 'DR' },
  { code: '6000', name: 'Office Rent & Service Charge',     type: 'EXPENSE',   normalBalance: 'DR' },
  { code: '6010', name: 'IT & Software Subscriptions',      type: 'EXPENSE',   normalBalance: 'DR' },
  { code: '6020', name: 'Travel & Subsistence',             type: 'EXPENSE',   normalBalance: 'DR' },
  { code: '6030', name: 'Utilities',                        type: 'EXPENSE',   normalBalance: 'DR' },
  { code: '6040', name: 'Telecommunications',               type: 'EXPENSE',   normalBalance: 'DR' },
  { code: '6050', name: 'Professional & Legal Fees',        type: 'EXPENSE',   normalBalance: 'DR' },
  { code: '6060', name: 'Marketing & Business Development', type: 'EXPENSE',   normalBalance: 'DR' },
  { code: '6070', name: 'Bank Charges & Interest',          type: 'EXPENSE',   normalBalance: 'DR' },
] as const

// ─── Customers ────────────────────────────────────────────────────────────────

const CUSTOMERS = [
  { name: 'Hargreaves Manufacturing Ltd',  email: 'accounts@hargreaves-mfg.co.uk',  paymentTerms: 28, retainer: 15000,
    address: { street: '12 Tyseley Industrial Estate', city: 'Birmingham', postcode: 'B11 2AB', country: 'UK' } },
  { name: 'Whitmore Group plc',            email: 'finance@whitmore-group.co.uk',    paymentTerms: 42, retainer: 0,
    address: { street: '1 Canada Square', city: 'London', postcode: 'E14 5AB', country: 'UK' } },
  { name: 'Pemberton & Associates LLP',    email: 'billing@pemberton-llp.co.uk',     paymentTerms: 20, retainer: 6500,
    address: { street: '45 King Street', city: 'Manchester', postcode: 'M2 4WG', country: 'UK' } },
  { name: 'Kestrel Logistics Ltd',         email: 'ap@kestrellogistics.com',         paymentTerms: 35, retainer: 0,
    address: { street: '8 Docklands Road', city: 'Liverpool', postcode: 'L3 4DP', country: 'UK' } },
  { name: 'Thornton Capital Partners',     email: 'finance@thorntoncapital.co.uk',   paymentTerms: 14, retainer: 0,
    address: { street: '22 Berkeley Square', city: 'London', postcode: 'W1J 6EW', country: 'UK' } },
  { name: 'Aldgate Retail Solutions Ltd',  email: 'accounts@aldgate-retail.co.uk',   paymentTerms: 30, retainer: 4200,
    address: { street: '66 Briggate', city: 'Leeds', postcode: 'LS1 4BR', country: 'UK' } },
  { name: 'Northfield Housing Association',email: 'finance@northfieldha.org.uk',     paymentTerms: 45, retainer: 0,
    address: { street: 'Civic Centre, Shakespeare Street', city: 'Nottingham', postcode: 'NG1 5AW', country: 'UK' } },
  { name: 'Beaumont Food Group plc',       email: 'payables@beaumontfood.co.uk',     paymentTerms: 30, retainer: 0,
    address: { street: '3 Enterprise Way, Avonmouth', city: 'Bristol', postcode: 'BS11 9NT', country: 'UK' } },
]

// ─── Vendors ──────────────────────────────────────────────────────────────────

const VENDORS = [
  { name: '88 Bishopsgate Office Solutions Ltd', email: 'billing@88bishopsgate.co.uk',  code: '6000', net: 8500,  vatRate: 0.20, dueDays: 7,  day: 1 },
  { name: 'Microsoft Ltd',                       email: 'invoices@microsoft.com',        code: '6010', net: 847,   vatRate: 0.20, dueDays: 30, day: 1 },
  { name: 'Amazon Web Services EMEA SARL',       email: 'aws-invoices@amazon.co.uk',     code: '6010', net: 1240,  vatRate: 0.20, dueDays: 30, day: 3 },
  { name: 'British Gas Business',                email: 'business@britishgas.co.uk',     code: '6030', net: 310,   vatRate: 0.20, dueDays: 21, day: 5 },
  { name: 'BT Business',                         email: 'business.billing@bt.com',       code: '6040', net: 445,   vatRate: 0.20, dueDays: 14, day: 2 },
  { name: 'Barclays Bank PLC',                   email: 'businessbanking@barclays.co.uk',code: '6070', net: 45,    vatRate: 0,    dueDays: 0,  day: 28 },
  { name: 'KPMG LLP',                            email: 'invoices@kpmg.co.uk',           code: '6050', net: 0,     vatRate: 0.20, dueDays: 30, day: 0 },
]

// Project invoices by month
const PROJECT_INV: Record<number, Array<{ customer: string; day: number; desc: string; net: number }>> = {
  1: [{ customer: 'Whitmore Group plc',             day: 10, net: 25000, desc: 'Q1 Strategy Review — Phase 1: Discovery & Stakeholder Assessment' }],
  2: [{ customer: 'Kestrel Logistics Ltd',          day:  7, net: 18500, desc: 'Supply Chain Optimisation Programme — Discovery Phase' },
      { customer: 'Northfield Housing Association', day: 14, net:  8500, desc: 'Digital Transformation Programme — Inception & Scoping' }],
  3: [{ customer: 'Thornton Capital Partners',      day:  5, net: 12000, desc: 'Portfolio Due Diligence — Target A: Sector & Commercial Analysis' },
      { customer: 'Whitmore Group plc',             day: 21, net: 15000, desc: 'Q1 Strategy Review — Final Deliverable & Board Presentation' }],
  4: [{ customer: 'Kestrel Logistics Ltd',          day:  8, net: 22000, desc: 'Supply Chain Optimisation — Design & Process Mapping' },
      { customer: 'Beaumont Food Group plc',        day: 15, net: 18000, desc: 'Operational Excellence Programme — Mobilisation & Baseline' }],
  5: [{ customer: 'Thornton Capital Partners',      day:  6, net: 14000, desc: 'Portfolio Due Diligence — Targets B & C: Full Commercial DD' },
      { customer: 'Northfield Housing Association', day: 12, net:  9500, desc: 'Digital Transformation — Solution Design & Architecture' },
      { customer: 'Beaumont Food Group plc',        day: 20, net: 22000, desc: 'Operational Excellence Programme — Phase 1: Quick Wins' }],
  6: [{ customer: 'Kestrel Logistics Ltd',          day:  9, net: 28000, desc: 'Supply Chain Optimisation — Implementation Support (Month 1)' },
      { customer: 'Beaumont Food Group plc',        day: 17, net: 35000, desc: 'Operational Excellence Programme — Phase 2: Transformation' }],
}

// KPMG quarterly invoices
const KPMG_Q: Record<number, number> = { 3: 9500, 6: 11000 }

// Travel expense reimbursements (net, no VAT)
const TRAVEL_NET: Record<number, number> = { 1: 1420, 2: 2180, 3: 1650, 4: 1890, 5: 2340, 6: 2780 }

// ─── Employees ────────────────────────────────────────────────────────────────

const EMPLOYEES = [
  { num: 'EMP001', first: 'Sarah',     last: 'Mitchell',  role: 'Managing Director',   salary: 95000, taxCode: '1257L',
    m: { gross: 7917, tax: 2119, empNI:  326, emplrNI:  988, net: 5472 } },
  { num: 'EMP002', first: 'James',     last: 'Thornton',  role: 'Senior Consultant',   salary: 72000, taxCode: '1257L',
    m: { gross: 6000, tax: 1353, empNI:  281, emplrNI:  727, net: 4366 } },
  { num: 'EMP003', first: 'Emma',      last: 'Clarke',    role: 'Senior Consultant',   salary: 68000, taxCode: '1257L',
    m: { gross: 5667, tax: 1219, empNI:  265, emplrNI:  684, net: 4183 } },
  { num: 'EMP004', first: 'David',     last: 'Okafor',    role: 'Consultant',          salary: 52000, taxCode: '1257L',
    m: { gross: 4333, tax:  767, empNI:  200, emplrNI:  494, net: 3366 } },
  { num: 'EMP005', first: 'Priya',     last: 'Sharma',    role: 'Consultant',          salary: 48000, taxCode: '1257L',
    m: { gross: 4000, tax:  638, empNI:  183, emplrNI:  454, net: 3179 } },
  { num: 'EMP006', first: 'Michael',   last: 'Brennan',   role: 'Finance Manager',     salary: 58000, taxCode: '1257L',
    m: { gross: 4833, tax:  921, empNI:  225, emplrNI:  559, net: 3687 } },
  { num: 'EMP007', first: 'Charlotte', last: 'Webb',      role: 'Marketing Manager',   salary: 45000, taxCode: '1257L',
    m: { gross: 3750, tax:  539, empNI:  170, emplrNI:  413, net: 3041 } },
  { num: 'EMP008', first: 'Tom',       last: 'Fletcher',  role: 'Operations Analyst',  salary: 38000, taxCode: '1257L',
    m: { gross: 3167, tax:  370, empNI:  140, emplrNI:  330, net: 2657 } },
]

const PR = {
  gross:   EMPLOYEES.reduce((s, e) => s + e.m.gross,   0), // 39,667
  tax:     EMPLOYEES.reduce((s, e) => s + e.m.tax,     0), //  7,926
  empNI:   EMPLOYEES.reduce((s, e) => s + e.m.empNI,   0), //  1,790
  emplrNI: EMPLOYEES.reduce((s, e) => s + e.m.emplrNI, 0), //  5,649
  net:     EMPLOYEES.reduce((s, e) => s + e.m.net,     0), // 29,951
  get paye() { return this.tax + this.empNI + this.emplrNI }, // 15,465
  get deductions() { return this.tax + this.empNI },          //  9,716
  get totalDeductions() { return this.tax + this.empNI },
}

// ─── Month names ──────────────────────────────────────────────────────────────

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June']

// ─── Cleanup helper ───────────────────────────────────────────────────────────

async function cleanup(orgId: string) {
  console.log('  🧹 Clearing existing Maple & Stone data...')
  const safe = async (fn: () => Promise<{ count: number }>, label: string) => {
    try { const r = await fn(); if (r.count) console.log(`     ✗ ${r.count} ${label}`) }
    catch { /* field or model may differ — skip */ }
  }
  await safe(() => prisma.manualJournalLine.deleteMany({ where: { manualJournal: { organizationId: orgId } } }), 'manualJournalLines')
  await safe(() => prisma.manualJournal.deleteMany({ where: { organizationId: orgId } }), 'manualJournals')
  await safe(() => prisma.transaction.deleteMany({ where: { organizationId: orgId } }), 'transactions')
  await safe(() => prisma.payrollEntry.deleteMany({ where: { organizationId: orgId } }), 'payrollEntries')
  await safe(() => prisma.payrollRun.deleteMany({ where: { organizationId: orgId } }), 'payrollRuns')
  await safe(() => prisma.invoiceItem.deleteMany({ where: { invoice: { organizationId: orgId } } }), 'invoiceItems')
  await safe(() => prisma.invoice.deleteMany({ where: { organizationId: orgId } }), 'invoices')
  await safe(() => prisma.billItem.deleteMany({ where: { bill: { organizationId: orgId } } }), 'billItems')
  await safe(() => prisma.bill.deleteMany({ where: { organizationId: orgId } }), 'bills')
  await safe(() => prisma.bankTransaction.deleteMany({ where: { organizationId: orgId } }), 'bankTransactions')
  await safe(() => prisma.reconciliationLine.deleteMany({ where: { organizationId: orgId } }), 'reconciliationLines')
  await safe(() => prisma.reconciliation.deleteMany({ where: { organizationId: orgId } }), 'reconciliations')
  await safe(() => prisma.budgetLine.deleteMany({ where: { budget: { organizationId: orgId } } }), 'budgetLines')
  await safe(() => prisma.budget.deleteMany({ where: { organizationId: orgId } }), 'budgets')
  await safe(() => prisma.grantMilestone.deleteMany({ where: { grant: { organizationId: orgId } } }), 'grantMilestones')
  await safe(() => prisma.grant.deleteMany({ where: { organizationId: orgId } }), 'grants')
  await safe(() => prisma.taxSubmission.deleteMany({ where: { organizationId: orgId } }), 'taxSubmissions')
  await safe(() => prisma.project.deleteMany({ where: { organizationId: orgId } }), 'projects')
  await safe(() => prisma.employee.deleteMany({ where: { organizationId: orgId } }), 'employees')
  await safe(() => prisma.vendor.deleteMany({ where: { organizationId: orgId } }), 'vendors')
  await safe(() => prisma.customer.deleteMany({ where: { organizationId: orgId } }), 'customers')
  await safe(() => prisma.bankAccount.deleteMany({ where: { organizationId: orgId } }), 'bankAccounts')
  await safe(() => prisma.chartOfAccount.deleteMany({ where: { organizationId: orgId } }), 'chartOfAccounts')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱  Maple & Stone Consulting Ltd — Demo Seed')
  console.log('    Period: January 2025 – June 2025\n')

  // ── 1. User ──────────────────────────────────────────────────────────────────
  const hashedPw = await bcrypt.hash('password123', 12)
  const user = await prisma.user.upsert({
    where:  { email: 'demo@mapleandstone.co.uk' },
    update: {},
    create: { email: 'demo@mapleandstone.co.uk', name: 'Michael Brennan', password: hashedPw },
  })
  const userId = user.id
  console.log(`✅  User: ${user.email}`)

  // ── 2. Organisation ──────────────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where:  { slug: 'maple-stone-consulting' },
    update: {},
    create: {
      name: 'Maple & Stone Consulting Ltd',
      slug: 'maple-stone-consulting',
      email: 'accounts@mapleandstone.co.uk',
      phone: '+44 20 7946 0123',
      website: 'https://www.mapleandstone.co.uk',
      address: { street: 'Floor 12, 88 Bishopsgate', city: 'London', postcode: 'EC2N 4AG', country: 'United Kingdom' },
      creatorId: userId,
    },
  })
  const orgId = org.id
  console.log(`✅  Organisation: ${org.name} (${orgId})`)

  await prisma.organizationMember.upsert({
    where:  { userId_organizationId: { userId, organizationId: orgId } },
    update: {},
    create: { userId, organizationId: orgId, role: 'OWNER' },
  })

  // ── 3. Cleanup previous demo data ────────────────────────────────────────────
  await cleanup(orgId)
  coaCache.clear()

  // ── 4. Chart of Accounts ─────────────────────────────────────────────────────
  console.log('\n📋  Creating Chart of Accounts...')
  for (const acct of COA) {
    await prisma.chartOfAccount.create({
      data: {
        organizationId: orgId,
        code: acct.code,
        name: acct.name,
        type: acct.type as any,
        normalBalance: acct.normalBalance as any,
        vatTreatment: ('vatTreatment' in acct ? acct.vatTreatment : 'NOT_APPLICABLE') as any,
        isActive: true,
      },
    })
  }
  console.log(`   ✅  ${COA.length} accounts created`)

  // ── 5. Bank accounts ─────────────────────────────────────────────────────────
  console.log('\n🏦  Creating bank accounts...')
  const bankCurrent = await prisma.bankAccount.create({
    data: {
      organizationId: orgId,
      name:          'Barclays Business Current Account',
      accountNumber: '12345678',
      sortCode:      '20-00-00',
      currency:      'GBP',
      openingBalance: 250000,
      currentBalance: 250000,
    },
  })
  const bankSavings = await prisma.bankAccount.create({
    data: {
      organizationId: orgId,
      name:          'Barclays Business Savings Account',
      accountNumber: '87654321',
      sortCode:      '20-00-00',
      currency:      'GBP',
      openingBalance: 150000,
      currentBalance: 150000,
    },
  })
  console.log(`   ✅  2 bank accounts created`)

  // ── 6. Customers ─────────────────────────────────────────────────────────────
  console.log('\n👥  Creating customers...')
  const customerMap = new Map<string, string>() // name → id
  for (const c of CUSTOMERS) {
    const cust = await prisma.customer.create({
      data: {
        organizationId: orgId,
        name:         c.name,
        email:        c.email,
        address:      c.address,
        paymentTerms: c.paymentTerms,
        currency:     'GBP',
        creditLimit:  100000,
        tags:         [],
        isActive:     true,
      },
    })
    customerMap.set(c.name, cust.id)
  }
  console.log(`   ✅  ${CUSTOMERS.length} customers created`)

  // ── 7. Vendors ───────────────────────────────────────────────────────────────
  console.log('\n🏢  Creating vendors...')
  const vendorMap = new Map<string, string>() // name → id
  for (const v of VENDORS) {
    const ven = await prisma.vendor.create({
      data: {
        organizationId: orgId,
        name:  v.name,
        email: v.email,
        currency: 'GBP',
        tags: [],
        isActive: true,
      },
    })
    vendorMap.set(v.name, ven.id)
  }
  console.log(`   ✅  ${VENDORS.length} vendors created`)

  // ── 8. Employees ─────────────────────────────────────────────────────────────
  console.log('\n👤  Creating employees...')
  const employeeMap = new Map<string, string>() // num → id
  for (const e of EMPLOYEES) {
    const emp = await prisma.employee.create({
      data: {
        organizationId: orgId,
        employeeNumber: e.num,
        firstName:      e.first,
        lastName:       e.last,
        employmentType: 'FULL_TIME',
        status:         'ACTIVE',
        salary:         e.salary,
        taxCode:        e.taxCode,
        startDate:      d(2023, 9, 1),
      },
    })
    employeeMap.set(e.num, emp.id)
  }
  console.log(`   ✅  ${EMPLOYEES.length} employees created`)

  // ── 9. Opening equity journal ─────────────────────────────────────────────────
  // Post opening balances: DR Bank / CR Share Capital
  const openRef = 'OB-2025-001'
  await ledger(orgId, d(2025, 1, 1), openRef, 'Opening balances — Maple & Stone Consulting Ltd', [
    { code: '1200', debit: 250000, memo: 'Opening bank balance — current account' },
    { code: '1210', debit: 150000, memo: 'Opening bank balance — savings account' },
    { code: '3000', credit: 100000, memo: 'Share capital' },
    { code: '3100', credit: 300000, memo: 'Retained earnings brought forward' },
  ])

  // ── 10. Six months of trading data ───────────────────────────────────────────

  let invCount = 0, billCount = 0, jnlCount = 0, bankCount = 0, prCount = 0
  let vatOutputQ1 = 0, vatInputQ1 = 0, vatOutputQ2 = 0, vatInputQ2 = 0

  // VAT accumulator refs
  const vatOut = (m: number, amt: number) => { if (m <= 3) vatOutputQ1 += amt; else vatOutputQ2 += amt }
  const vatIn  = (m: number, amt: number) => { if (m <= 3) vatInputQ1  += amt; else vatInputQ2  += amt }

  for (let month = 1; month <= 6; month++) {
    console.log(`\n📅  ${MONTHS[month]} 2025...`)
    const reconcileJan = month === 1
    const reconciledAt = reconcileJan ? d(2025, 2, 5) : undefined // January reconciled on 5 Feb

    // ── a) Retainer invoices (raised 1st of month) ──────────────────────────

    for (const cust of CUSTOMERS.filter(c => c.retainer > 0)) {
      const invDate  = d(2025, month, 1)
      const dueDate  = addDays(invDate, 30)
      const net      = cust.retainer
      const vatAmt   = vat(net)
      const total    = r2(net + vatAmt)
      const ref      = nextSI()

      await prisma.invoice.create({
        data: {
          organizationId: orgId,
          customerId:     customerMap.get(cust.name)!,
          invoiceNumber:  ref,
          date:           invDate,
          dueDate,
          status:         'PAID',
          subtotal:       net,
          taxAmount:      vatAmt,
          total,
          currency: 'GBP',
          notes: `Monthly retainer — ${MONTHS[month]} 2025`,
          items: { create: [{
            description: `Consulting retainer — ${MONTHS[month]} 2025`,
            quantity: 1, unitPrice: net, total: net, taxRate: 20,
          }] },
        },
      })

      // Ledger: invoice posting
      await ledger(orgId, invDate, ref, `${cust.name} — Retainer ${MONTHS[month]} 2025`, [
        { code: '1100', debit:  total,  memo: `${cust.name} — ${ref}` },
        { code: '4000', credit: net,    memo: `Retainer — ${MONTHS[month]} 2025` },
        { code: '2200', credit: vatAmt, memo: 'Output VAT 20%' },
      ])
      vatOut(month, vatAmt)

      // Ledger: payment receipt
      const paidDate = addDays(dueDate, -5)
      await ledger(orgId, paidDate, `PMT-${ref}`, `Receipt: ${cust.name}`, [
        { code: '1200', debit:  total, memo: `Bank receipt — ${cust.name}` },
        { code: '1100', credit: total, memo: `${ref} settled` },
      ])

      // Bank transaction (credit = money in)
      await prisma.bankTransaction.create({
        data: {
          organizationId: orgId,
          bankAccountId:  bankCurrent.id,
          date:           paidDate,
          description:    `${cust.name.substring(0, 32)} RETAINER`,
          amount:         total,
          reference:      ref,
          type:           'CREDIT',
          sourceType:     'MANUAL',
          ...(reconciledAt && { reconciledAt }),
        },
      })
      bankCount++; invCount++
      jnlCount += 2
    }

    // ── b) Project invoices ────────────────────────────────────────────────────

    for (const pi of (PROJECT_INV[month] ?? [])) {
      const custData = CUSTOMERS.find(c => c.name === pi.customer)!
      const invDate  = d(2025, month, pi.day)
      const dueDate  = addDays(invDate, custData.paymentTerms)
      const net      = pi.net
      const vatAmt   = vat(net)
      const total    = r2(net + vatAmt)
      const isPaid   = month <= 5 || pi.day <= 12
      const ref      = nextSI()

      await prisma.invoice.create({
        data: {
          organizationId: orgId,
          customerId:     customerMap.get(pi.customer)!,
          invoiceNumber:  ref,
          date:           invDate,
          dueDate,
          status:         isPaid ? 'PAID' : 'SENT',
          subtotal:       net,
          taxAmount:      vatAmt,
          total,
          currency: 'GBP',
          items: { create: [{ description: pi.desc, quantity: 1, unitPrice: net, total: net, taxRate: 20 }] },
        },
      })

      await ledger(orgId, invDate, ref, `${pi.customer} — Project Invoice`, [
        { code: '1100', debit:  total,  memo: `${pi.customer} — ${ref}` },
        { code: '4100', credit: net,    memo: pi.desc.substring(0, 70) },
        { code: '2200', credit: vatAmt, memo: 'Output VAT 20%' },
      ])
      vatOut(month, vatAmt)
      jnlCount++

      if (isPaid) {
        const paidDate = addDays(invDate, custData.paymentTerms)
        await ledger(orgId, paidDate, `PMT-${ref}`, `Receipt: ${pi.customer}`, [
          { code: '1200', debit:  total, memo: `Bank receipt — ${pi.customer}` },
          { code: '1100', credit: total, memo: `${ref} settled` },
        ])
        await prisma.bankTransaction.create({
          data: {
            organizationId: orgId, bankAccountId: bankCurrent.id,
            date: paidDate, description: `${pi.customer.substring(0, 28)} PROJ`,
            amount: total, reference: ref, type: 'CREDIT', sourceType: 'MANUAL',
            ...(reconciledAt && { reconciledAt }),
          },
        })
        bankCount++; jnlCount++
      }
      invCount++
    }

    // ── c) Purchase invoices (regular vendors) ─────────────────────────────────

    for (const vendor of VENDORS.filter(v => v.net > 0)) {
      const invDate  = d(2025, month, vendor.day)
      const dueDate  = vendor.dueDays === 0 ? invDate : addDays(invDate, vendor.dueDays)
      const net      = vendor.net
      const vatAmt   = r2(net * vendor.vatRate)
      const total    = r2(net + vatAmt)
      const ref      = nextPI()

      const expAccId = await aid(orgId, vendor.code)

      await prisma.bill.create({
        data: {
          organizationId: orgId,
          vendorId:       vendorMap.get(vendor.name)!,
          billNumber:     ref,
          date:           invDate,
          dueDate,
          status:         'PAID',
          subtotal:       net,
          taxAmount:      vatAmt,
          total,
          currency: 'GBP',
          items: { create: [{
            description: `${vendor.name} — ${MONTHS[month]} 2025`,
            quantity: 1, unitPrice: net, total: net,
            taxRate: vendor.vatRate * 100,
            accountId: expAccId,
          }] },
        },
      })

      const drLines: LLine[] = [{ code: vendor.code, debit: net, memo: `${vendor.name} — ${MONTHS[month]} 2025` }]
      if (vatAmt > 0) { drLines.push({ code: '2200', debit: vatAmt, memo: 'Input VAT 20%' }); vatIn(month, vatAmt) }
      drLines.push({ code: '2100', credit: total, memo: `${vendor.name} — ${ref}` })
      await ledger(orgId, invDate, ref, `${vendor.name} — ${MONTHS[month]} 2025`, drLines)
      jnlCount++

      const payDate = vendor.dueDays === 0 ? invDate : addDays(dueDate, -1)
      await ledger(orgId, payDate, `PAY-${ref}`, `Payment: ${vendor.name}`, [
        { code: '2100', debit:  total, memo: `${ref} cleared` },
        { code: '1200', credit: total, memo: `Payment — ${vendor.name}` },
      ])
      await prisma.bankTransaction.create({
        data: {
          organizationId: orgId, bankAccountId: bankCurrent.id,
          date: payDate, description: `${vendor.name.substring(0, 30)} PAY`,
          amount: -total, reference: ref, type: 'DEBIT', sourceType: 'MANUAL',
          ...(reconciledAt && { reconciledAt }),
        },
      })
      bankCount++; billCount++; jnlCount++
    }

    // ── d) KPMG quarterly bill ─────────────────────────────────────────────────

    if (KPMG_Q[month]) {
      const net     = KPMG_Q[month]
      const vatAmt  = vat(net)
      const total   = r2(net + vatAmt)
      const invDate = d(2025, month, 15)
      const ref     = nextPI()
      const quarter = month <= 3 ? 1 : 2
      const expAccId = await aid(orgId, '6050')

      await prisma.bill.create({
        data: {
          organizationId: orgId,
          vendorId:       vendorMap.get('KPMG LLP')!,
          billNumber:     ref,
          date:           invDate,
          dueDate:        addDays(invDate, 30),
          status:         'PAID',
          subtotal: net, taxAmount: vatAmt, total, currency: 'GBP',
          items: { create: [{
            description: `External audit & advisory fees — Q${quarter} 2025`,
            quantity: 1, unitPrice: net, total: net, taxRate: 20, accountId: expAccId,
          }] },
        },
      })

      await ledger(orgId, invDate, ref, `KPMG LLP — Q${quarter} 2025 audit fees`, [
        { code: '6050', debit: net,    memo: `KPMG Q${quarter} 2025 audit` },
        { code: '2200', debit: vatAmt, memo: 'Input VAT 20%' },
        { code: '2100', credit: total, memo: `KPMG — ${ref}` },
      ])
      vatIn(month, vatAmt)
      jnlCount++

      const payDate = addDays(invDate, 29)
      await ledger(orgId, payDate, `PAY-${ref}`, 'Payment: KPMG LLP', [
        { code: '2100', debit:  total, memo: `${ref} cleared` },
        { code: '1200', credit: total, memo: 'Payment — KPMG LLP' },
      ])
      await prisma.bankTransaction.create({
        data: {
          organizationId: orgId, bankAccountId: bankCurrent.id,
          date: payDate, description: `KPMG LLP Q${quarter} AUDIT FEES`,
          amount: -total, reference: ref, type: 'DEBIT', sourceType: 'MANUAL',
          ...(reconciledAt && { reconciledAt }),
        },
      })
      bankCount++; billCount++; jnlCount++
    }

    // ── e) Travel expenses ─────────────────────────────────────────────────────

    if (TRAVEL_NET[month]) {
      const net   = TRAVEL_NET[month]
      const meDate = eom(2025, month)
      const ref   = `TE-2025-${pad(month)}`

      await ledger(orgId, meDate, ref, `Staff travel & expenses — ${MONTHS[month]} 2025`, [
        { code: '6020', debit:  net, memo: `T&E reimbursements ${MONTHS[month]} 2025` },
        { code: '1200', credit: net, memo: `Staff expenses BACS ${MONTHS[month]} 2025` },
      ])
      await prisma.bankTransaction.create({
        data: {
          organizationId: orgId, bankAccountId: bankCurrent.id,
          date: meDate, description: `STAFF EXPENSES ${MONTHS[month].toUpperCase()} 2025`,
          amount: -net, reference: ref, type: 'DEBIT', sourceType: 'MANUAL',
          ...(reconciledAt && { reconciledAt }),
        },
      })
      bankCount++; jnlCount++
    }

    // ── f) Payroll ─────────────────────────────────────────────────────────────

    const payDate     = d(2025, month, 28)
    const runNum      = nextPR()
    const totalDeds   = PR.tax + PR.empNI  // per-run total employee deductions (for payrollRun.totalDeductions)

    const run = await prisma.payrollRun.create({
      data: {
        organizationId: orgId,
        runNumber:      runNum,
        payPeriodStart: d(2025, month, 1),
        payPeriodEnd:   eom(2025, month),
        payDate,
        status:         'PROCESSED',
        totalGross:     PR.gross,
        totalDeductions: totalDeds,
        totalNet:       PR.net,
        employeeCount:  EMPLOYEES.length,
        processedAt:    payDate,
        notes:          `${MONTHS[month]} 2025 payroll — ${EMPLOYEES.length} employees`,
      },
    })

    for (const e of EMPLOYEES) {
      await prisma.payrollEntry.create({
        data: {
          organizationId: orgId,
          payrollRunId:   run.id,
          employeeId:     employeeMap.get(e.num)!,
          grossPay:       e.m.gross,
          taxAmount:      e.m.tax,
          nationalInsurance: e.m.empNI,
          pensionEmployer:   e.m.emplrNI,
          deductions:     e.m.tax + e.m.empNI,
          netPay:         e.m.net,
        },
      })
    }
    prCount++

    // Payroll journal (ManualJournal + Transaction)
    // DR Salaries 39,667 + DR Employer NI 5,649 = 45,316
    // CR PAYE/NI 15,465 + CR Bank (net) 29,951 = 45,416  ← rounding in headcount
    // Use PR.paye and PR.net which come from individual employee calcs
    const prRef = `PR-JNL-${pad(month)}`
    const prLines: LLine[] = [
      { code: '5000', debit:  PR.gross,   memo: `Gross wages ${MONTHS[month]} 2025` },
      { code: '5010', debit:  PR.emplrNI, memo: `Employer NI ${MONTHS[month]} 2025` },
      { code: '2210', credit: PR.paye,    memo: `PAYE/NI liability ${MONTHS[month]} 2025` },
      { code: '1200', credit: PR.net,     memo: `Net pay BACS ${MONTHS[month]} 2025` },
    ]
    await ledger(orgId, payDate, prRef, `Payroll — ${MONTHS[month]} 2025`, prLines)
    await manualJournal(orgId, payDate, prRef, `Payroll — ${MONTHS[month]} 2025`, userId, prLines)
    jnlCount++

    // Bank: net pay outgoing
    await prisma.bankTransaction.create({
      data: {
        organizationId: orgId, bankAccountId: bankCurrent.id,
        date: payDate, description: `BACS PAYROLL ${MONTHS[month].toUpperCase()} 2025`,
        amount: -PR.net, reference: prRef, type: 'DEBIT', sourceType: 'MANUAL',
        ...(reconciledAt && { reconciledAt }),
      },
    })
    bankCount++

    // PAYE/NI payment to HMRC (19th of following month) — for months 1-5
    if (month < 6) {
      const payeDate = d(2025, month + 1, 19)
      const payeRef  = `PAYE-${pad(month)}`
      await ledger(orgId, payeDate, payeRef, `HMRC PAYE/NI — ${MONTHS[month]} 2025`, [
        { code: '2210', debit:  PR.paye, memo: `HMRC PAYE ${MONTHS[month]} 2025` },
        { code: '1200', credit: PR.paye, memo: 'HMRC PAYE/NI payment' },
      ])
      await prisma.bankTransaction.create({
        data: {
          organizationId: orgId, bankAccountId: bankCurrent.id,
          date: payeDate, description: `HMRC PAYE ${MONTHS[month].toUpperCase()} 2025`,
          amount: -PR.paye, reference: payeRef, type: 'DEBIT', sourceType: 'MANUAL',
        },
      })
      bankCount++; jnlCount++
    }

    // ── g) Month-end accrual journal ──────────────────────────────────────────

    const meDate = eom(2025, month)
    const acrRef = `ACR-2025-${pad(month)}`
    const acrLines: LLine[] = [
      { code: '6060', debit: 550, memo: `Marketing accrual ${MONTHS[month]} 2025` },
      { code: '2300', credit: 550, memo: 'Accrued marketing expenses' },
    ]
    await ledger(orgId, meDate, acrRef, `Month-end accrual — ${MONTHS[month]} 2025`, acrLines)
    await manualJournal(orgId, meDate, acrRef, `Month-end accrual — ${MONTHS[month]} 2025`, userId, acrLines)
    jnlCount++

    console.log(`   ✅  ${MONTHS[month]}: ${invCount} invoices, ${billCount} bills, ${jnlCount} journal lines, ${bankCount} bank txns, ${prCount} payroll runs`)
  }

  // ── 11. January bank reconciliation ────────────────────────────────────────────
  console.log('\n🏦  Creating January reconciliation...')
  const janBankTxns = await prisma.bankTransaction.findMany({
    where: { organizationId: orgId, bankAccountId: bankCurrent.id, reconciledAt: { not: null } },
  })
  const janCredits = janBankTxns.filter(t => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0)
  const janDebits  = janBankTxns.filter(t => Number(t.amount) < 0).reduce((s, t) => s + Number(t.amount), 0)
  const janClosing = 250000 + janCredits + janDebits
  const rec = await prisma.reconciliation.create({
    data: {
      organizationId:    orgId,
      bankAccountId:     bankCurrent.id,
      statementDate:     d(2025, 1, 31),
      statementBalance:  janClosing,
      reconciledBalance: janClosing,
      difference:        0,
      status:            'COMPLETED',
      reconciledAt:      d(2025, 2, 5),
      reconciledBy:      userId,
      notes:             'January 2025 bank reconciliation — all items matched',
    },
  })
  // Link reconciliation lines
  for (const bt of janBankTxns) {
    await prisma.reconciliationLine.create({
      data: {
        organizationId:    orgId,
        reconciliationId:  rec.id,
        bankTransactionId: bt.id,
        amount:            bt.amount,
        matchType:         'MANUAL',
      },
    })
  }
  console.log(`   ✅  January reconciliation: ${janBankTxns.length} transactions, closing balance £${janClosing.toFixed(2)}`)

  // ── 12. VAT / Tax submissions ───────────────────────────────────────────────
  console.log('\n📊  Creating VAT returns...')
  const q1Net = r2(vatOutputQ1 - vatInputQ1)
  const q2Net = r2(vatOutputQ2 - vatInputQ2)

  await prisma.taxSubmission.create({
    data: {
      organizationId: orgId,
      submissionType: 'VAT_RETURN',
      periodStart:    d(2025, 1, 1),
      periodEnd:      d(2025, 3, 31),
      submissionDate: d(2025, 4, 22),
      status:         'SUBMITTED',
      reference:      'VR-2025-Q1',
      totalAmount:    q1Net,
      data: {
        box1: r2(vatOutputQ1), box2: 0, box3: r2(vatOutputQ1),
        box4: r2(vatInputQ1),  box5: Math.abs(q1Net),
        box6: 0, box7: 0, box8: 0, box9: 0,
        notes: 'Q1 2025 VAT return — submitted via MTD',
      },
      submittedAt: d(2025, 4, 22),
      submittedBy: userId,
    },
  })

  await prisma.taxSubmission.create({
    data: {
      organizationId: orgId,
      submissionType: 'VAT_RETURN',
      periodStart:    d(2025, 4, 1),
      periodEnd:      d(2025, 6, 30),
      submissionDate: d(2025, 8, 7),
      status:         'DRAFT',
      reference:      'VR-2025-Q2',
      totalAmount:    q2Net,
      data: {
        box1: r2(vatOutputQ2), box2: 0, box3: r2(vatOutputQ2),
        box4: r2(vatInputQ2),  box5: Math.abs(q2Net),
        box6: 0, box7: 0, box8: 0, box9: 0,
        notes: 'Q2 2025 VAT return — in preparation',
      },
    },
  })

  console.log(`   ✅  Q1 (SUBMITTED): output £${vatOutputQ1.toFixed(2)} | input £${vatInputQ1.toFixed(2)} | net £${q1Net.toFixed(2)}`)
  console.log(`   ✅  Q2 (DRAFT):     output £${vatOutputQ2.toFixed(2)} | input £${vatInputQ2.toFixed(2)} | net £${q2Net.toFixed(2)}`)

  // ── 13. Budget ─────────────────────────────────────────────────────────────
  console.log('\n📊  Creating budget...')

  // [month 1..6] budgeted amounts (net, £)
  const BUDGET_BY_CODE: Record<string, number[]> = {
    '4000': [26000, 26000, 26000, 26000, 26000, 26000],
    '4100': [28000, 28000, 20000, 30000, 40000, 55000],
    '5000': [39667, 39667, 39667, 39667, 39667, 39667],
    '5010': [ 5649,  5649,  5649,  5649,  5649,  5649],
    '6000': [ 8500,  8500,  8500,  8500,  8500,  8500],
    '6010': [ 2087,  2087,  2087,  2087,  2087,  2087],
    '6030': [  310,   310,   310,   310,   310,   310],
    '6040': [  445,   445,   445,   445,   445,   445],
    '6050': [  800,   800,  9500,   800,   800, 11000],
    '6020': [ 1500,  2000,  2000,  2000,  2500,  2500],
    '6060': [  600,   600,   600,   600,   600,   600],
    '6070': [   45,    45,    45,    45,    45,    45],
  }

  // Actual amounts (derived from what we created above)
  const retainerActuals = [
    25700, 25700, 25700, 25700, 25700, 25700, // Hargreaves 15k + Pemberton 6.5k + Aldgate 4.2k
  ]
  // Simplified actuals for budget lines
  const ACTUALS_BY_CODE: Record<string, number[]> = {
    '4000': [25700, 25700, 25700, 25700, 25700, 25700],
    '4100': [25000, 27000, 27000, 40000, 45500, 63000],
    '5000': [39667, 39667, 39667, 39667, 39667, 39667],
    '5010': [ 5649,  5649,  5649,  5649,  5649,  5649],
    '6000': [ 8500,  8500,  8500,  8500,  8500,  8500],
    '6010': [ 2087,  2087,  2087,  2087,  2087,  2087],
    '6030': [  310,   310,   310,   310,   310,   310],
    '6040': [  445,   445,   445,   445,   445,   445],
    '6050': [  800,   800,  9500,   800,   800, 11000],
    '6020': [ 1420,  2180,  1650,  1890,  2340,  2780],
    '6060': [  550,   550,   550,   550,   550,   550],
    '6070': [   45,    45,    45,    45,    45,    45],
  }

  const budget = await prisma.budget.create({
    data: {
      organizationId: orgId,
      name:           'FY2025 Annual Budget',
      description:    'Maple & Stone Consulting Ltd — Financial Year 2025 approved budget',
      budgetType:     'ANNUAL',
      periodStart:    d(2025, 1, 1),
      periodEnd:      d(2025, 12, 31),
      status:         'APPROVED',
      currency:       'GBP',
      approvedAt:     d(2024, 12, 15),
      approvedBy:     userId,
      notes:          'Approved by board on 15 December 2024',
    },
  })

  let budgetLineCount = 0
  for (const [code, budgeted] of Object.entries(BUDGET_BY_CODE)) {
    const accId = await aid(orgId, code)
    for (let i = 0; i < 6; i++) {
      const actual  = (ACTUALS_BY_CODE[code]?.[i] ?? 0)
      const bAmt    = budgeted[i]
      const variance = r2(bAmt - actual)
      await prisma.budgetLine.create({
        data: {
          organizationId: orgId,
          budgetId:       budget.id,
          accountId:      accId,
          periodStart:    d(2025, i + 1, 1),
          periodEnd:      eom(2025, i + 1),
          budgetedAmount: bAmt,
          actualAmount:   actual,
          variance,
          description:    `${MONTHS[i + 1]} 2025`,
        },
      })
      budgetLineCount++
    }
  }
  console.log(`   ✅  ${budgetLineCount} budget lines across ${Object.keys(BUDGET_BY_CODE).length} accounts`)

  // ── 14. Projects ───────────────────────────────────────────────────────────
  console.log('\n🗂️   Creating projects...')

  const projects = [
    {
      projectNumber: 'PRJ-001',
      name:          'Whitmore Q1 Strategy Review',
      description:   'Full end-to-end strategy review for Whitmore Group plc. Discovery, analysis, options development and board presentation.',
      customerId:    customerMap.get('Whitmore Group plc')!,
      status:        'COMPLETED' as const,
      startDate:     d(2025, 1, 6),
      endDate:       d(2025, 3, 31),
      budget:        45000,
    },
    {
      projectNumber: 'PRJ-002',
      name:          'Kestrel Supply Chain Optimisation',
      description:   'Multi-phase supply chain transformation programme covering discovery, design, implementation support and benefits realisation.',
      customerId:    customerMap.get('Kestrel Logistics Ltd')!,
      status:        'ACTIVE' as const,
      startDate:     d(2025, 2, 3),
      endDate:       d(2025, 8, 31),
      budget:        85000,
    },
    {
      projectNumber: 'PRJ-003',
      name:          'Beaumont Operational Excellence',
      description:   'Operational improvement programme for Beaumont Food Group: baseline assessment, quick wins, and transformation delivery.',
      customerId:    customerMap.get('Beaumont Food Group plc')!,
      status:        'ACTIVE' as const,
      startDate:     d(2025, 4, 7),
      endDate:       d(2025, 10, 31),
      budget:        120000,
    },
  ]

  for (const p of projects) {
    await prisma.project.create({
      data: {
        organizationId: orgId,
        projectNumber:  p.projectNumber,
        name:           p.name,
        description:    p.description,
        customerId:     p.customerId,
        status:         p.status,
        startDate:      p.startDate,
        endDate:        p.endDate,
        budget:         p.budget,
        currency:       'GBP',
        tags:           [],
      },
    })
  }
  console.log(`   ✅  ${projects.length} projects created`)

  // ── 15. Grants ─────────────────────────────────────────────────────────────
  console.log('\n🏛️   Creating grants...')

  const grants = [
    {
      grantNumber:     'GRN-001',
      name:            'Innovate UK — SME Business Growth Fund',
      funder:          'Innovate UK',
      funderReference: 'IUK-2024-BG-104872',
      grantType:       'RESTRICTED' as const,
      totalAmount:     75000,
      receivedAmount:  50000,
      spentAmount:     42300,
      startDate:       d(2024, 10, 1),
      endDate:         d(2025, 9, 30),
      status:          'ACTIVE' as const,
      description:     'SME Business Growth Fund grant to support expansion of consulting practice into public sector digital transformation services.',
      conditions:      'Match funding requirement: 20% of grant value. Reporting periods: quarterly. Final report due 31 October 2025.',
      milestones: [
        { name: 'Project Kick-off & Inception Report',          dueDate: d(2024, 12, 31), amount: 15000, status: 'COMPLETED' as const, completedAt: d(2024, 12, 20) },
        { name: 'Mid-Point Progress Report & Interim Claim',    dueDate: d(2025, 3, 31),  amount: 35000, status: 'COMPLETED' as const, completedAt: d(2025, 3, 28) },
        { name: 'Final Report & Expenditure Statement',         dueDate: d(2025, 9, 30),  amount: 25000, status: 'PENDING' as const },
      ],
    },
    {
      grantNumber:     'GRN-002',
      name:            'UKRI — Digital Innovation in Professional Services',
      funder:          'UK Research and Innovation (UKRI)',
      funderReference: 'UKRI-2025-DIPS-009341',
      grantType:       'REVENUE' as const,
      totalAmount:     120000,
      receivedAmount:  30000,
      spentAmount:     18750,
      startDate:       d(2025, 2, 1),
      endDate:         d(2026, 1, 31),
      status:          'ACTIVE' as const,
      description:     'Research grant to develop AI-assisted audit methodologies for SME consulting engagements. 24-month programme with quarterly reporting.',
      conditions:      'Research outputs must be published. IP jointly owned UKRI 30% / Maple & Stone 70%. No commercial exploitation without prior consent.',
      milestones: [
        { name: 'Research Design & Methodology Framework',      dueDate: d(2025, 4, 30), amount: 30000, status: 'COMPLETED' as const, completedAt: d(2025, 4, 25) },
        { name: 'Prototype Development — Phase 1',              dueDate: d(2025, 8, 31), amount: 40000, status: 'IN_PROGRESS' as const },
        { name: 'Pilot Testing & Evaluation',                   dueDate: d(2025, 12, 31),amount: 30000, status: 'PENDING' as const },
        { name: 'Final Dissemination & Knowledge Transfer',     dueDate: d(2026, 1, 31), amount: 20000, status: 'PENDING' as const },
      ],
    },
  ]

  for (const g of grants) {
    const { milestones, ...grantData } = g
    const grantRecord = await prisma.grant.create({
      data: { organizationId: orgId, ...grantData, tags: [] },
    })
    for (const ms of milestones) {
      await prisma.grantMilestone.create({
        data: { organizationId: orgId, grantId: grantRecord.id, ...ms },
      })
    }
  }
  console.log(`   ✅  ${grants.length} grants created with milestones`)

  // ── Summary ───────────────────────────────────────────────────────────────

  const totalRevenue =
    CUSTOMERS.filter(c => c.retainer > 0).reduce((s, c) => s + c.retainer * 6, 0) +
    Object.values(PROJECT_INV).flat().reduce((s, i) => s + i.net, 0)

  console.log('\n' + '═'.repeat(58))
  console.log('✅  Demo seed complete\n')
  console.log(`   Organisation   : Maple & Stone Consulting Ltd`)
  console.log(`   Login          : demo@mapleandstone.co.uk / password123`)
  console.log(`   Period         : January – June 2025`)
  console.log(`   COA            : ${COA.length} accounts`)
  console.log(`   Customers      : ${CUSTOMERS.length}`)
  console.log(`   Vendors        : ${VENDORS.length}`)
  console.log(`   Employees      : ${EMPLOYEES.length}`)
  console.log(`   Sales invoices : ${invCount}`)
  console.log(`   Purchase bills : ${billCount}`)
  console.log(`   Journal entries: ${jnlCount} (ledger) + payroll + accruals`)
  console.log(`   Bank txns      : ${bankCount} (January fully reconciled)`)
  console.log(`   Payroll runs   : ${prCount}`)
  console.log(`   VAT returns    : 2 (Q1 submitted, Q2 draft)`)
  console.log(`   Budget lines   : ${budgetLineCount}`)
  console.log(`   Projects       : ${projects.length}`)
  console.log(`   Grants         : ${grants.length}`)
  console.log(`\n   6-month revenue (net) : £${totalRevenue.toLocaleString('en-GB')}`)
  console.log(`   Monthly payroll cost  : £${(PR.gross + PR.emplrNI).toLocaleString('en-GB')}`)
  console.log('═'.repeat(58))
}

main()
  .catch((e) => {
    console.error('\n❌  Seed failed:', e.message ?? e)
    if (e.code === 'P2002') console.error('   → Unique constraint violation — re-run: the cleanup should clear this.')
    if (e.message?.includes('not found')) console.error('   → Check COA creation succeeded above.')
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
