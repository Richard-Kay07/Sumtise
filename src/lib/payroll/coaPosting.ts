/**
 * Payroll COA journal generation utilities.
 *
 * Pure functions — no DB calls. Produces balanced double-entry journals from
 * a payroll run and its COA mappings / employee allocation rules.
 */

import { Prisma } from "@prisma/client"
import { applyAllocationToPayComponent, type ResolvedAllocation } from "./costAllocation"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PayrollCOAMappingRecord {
  componentType:       string
  debitAccountId:      string
  creditAccountId:     string
  defaultCostCentreId?: string | null
}

export interface PayrollEntryRecord {
  id:                string
  employeeId:        string
  grossPay:          Prisma.Decimal
  taxAmount:         Prisma.Decimal
  nationalInsurance: Prisma.Decimal
  pensionEmployee:   Prisma.Decimal
  pensionEmployer:   Prisma.Decimal
  netPay:            Prisma.Decimal
}

export interface PayrollRunRecord {
  id:         string
  totalGross: Prisma.Decimal
  totalNet:   Prisma.Decimal
  entries:    PayrollEntryRecord[]
}

export interface GeneratedJournalLine {
  lineNumber:      number
  accountId:       string
  costCentreId?:   string | null
  projectId?:      string | null
  grantId?:        string | null
  analysisCodeId?: string | null
  debit:           Prisma.Decimal
  credit:          Prisma.Decimal
  description:     string
  componentType:   string
  employeeCount:   number
  employeeIds:     string[]
}

export interface GeneratedJournal {
  payrollRunId:  string
  journalDate:   Date
  description:   string
  reference:     string
  lines:         GeneratedJournalLine[]
  totalDebits:   Prisma.Decimal
  totalCredits:  Prisma.Decimal
  isBalanced:    boolean
  warnings:      string[]
}

export interface PayrollJournalParams {
  payrollRun:   PayrollRunRecord
  mappings:     PayrollCOAMappingRecord[]
  allocations:  ResolvedAllocation[]
  journalDate:  Date
  reference:    string
}

export interface PayrollSummary {
  byCostCentre:   Map<string | null, Prisma.Decimal>
  byProject:      Map<string | null, Prisma.Decimal>
  byGrant:        Map<string | null, Prisma.Decimal>
  byAnalysisCode: Map<string | null, Prisma.Decimal>
  byComponent:    Map<string, Prisma.Decimal>
}

// ---------------------------------------------------------------------------
// Component type keys matching PayrollCOAMapping.componentType
// ---------------------------------------------------------------------------

const COMPONENT_TYPES = [
  "GROSS_SALARY",
  "PAYE_TAX",
  "EMPLOYEE_NI",
  "EMPLOYER_NI",
  "EMPLOYEE_PENSION",
  "EMPLOYER_PENSION",
  "NET_PAY",
] as const

type ComponentType = (typeof COMPONENT_TYPES)[number]

function entryComponents(e: PayrollEntryRecord): Record<ComponentType, Prisma.Decimal> {
  return {
    GROSS_SALARY:     e.grossPay,
    PAYE_TAX:         e.taxAmount,
    EMPLOYEE_NI:      e.nationalInsurance,
    EMPLOYER_NI:      e.pensionEmployer, // employer NI if mapped; schema uses pensionEmployer field
    EMPLOYEE_PENSION: e.pensionEmployee,
    EMPLOYER_PENSION: e.pensionEmployer,
    NET_PAY:          e.netPay,
  }
}

// ---------------------------------------------------------------------------
// 5. generatePayrollJournal
// ---------------------------------------------------------------------------

export function generatePayrollJournal(params: PayrollJournalParams): GeneratedJournal {
  const { payrollRun, mappings, allocations, journalDate, reference } = params

  const ZERO    = new Prisma.Decimal(0)
  const warnings: string[] = []
  const lines: GeneratedJournalLine[] = []
  let lineNumber = 1

  const mappingIndex = new Map(mappings.map((m) => [m.componentType, m]))
  const allocationIndex = new Map(allocations.map((a) => [a.employeeId, a.splits]))

  // Accumulate credit-side lines in a map so we can consolidate them
  // (credits go to control accounts at entity level — not per cost-centre)
  interface CreditKey { accountId: string; componentType: string }
  const creditAcc = new Map<string, { acc: Prisma.Decimal; empIds: Set<string> }>()

  function addCredit(accountId: string, componentType: string, amount: Prisma.Decimal, empId: string) {
    const key = `${accountId}::${componentType}`
    const existing = creditAcc.get(key) ?? { acc: ZERO, empIds: new Set() }
    existing.acc = existing.acc.plus(amount)
    existing.empIds.add(empId)
    creditAcc.set(key, existing)
    // Track key → accountId/componentType for later materialisation
    keyMeta.set(key, { accountId, componentType })
  }
  const keyMeta = new Map<string, { accountId: string; componentType: string }>()

  // Build debit lines (cost allocation) and feed credit accumulator
  for (const entry of payrollRun.entries) {
    const splits = allocationIndex.get(entry.employeeId) ?? [
      { allocationPercent: new Prisma.Decimal(100), costCentreId: null, projectId: null, grantId: null, analysisCodeId: null },
    ]

    const components = entryComponents(entry)

    for (const [componentType, amount] of Object.entries(components) as [ComponentType, Prisma.Decimal][]) {
      if (amount.lessThanOrEqualTo(0)) continue

      const mapping = mappingIndex.get(componentType)
      if (!mapping) {
        warnings.push(`No COA mapping found for component type "${componentType}" — skipped.`)
        continue
      }

      // Debit side — split across cost centres / projects
      const allocated = applyAllocationToPayComponent(
        { componentType, amount, employeeId: entry.employeeId },
        splits
      )

      for (const alloc of allocated) {
        lines.push({
          lineNumber:     lineNumber++,
          accountId:      mapping.debitAccountId,
          costCentreId:   alloc.costCentreId ?? mapping.defaultCostCentreId ?? null,
          projectId:      alloc.projectId,
          grantId:        alloc.grantId,
          analysisCodeId: alloc.analysisCodeId,
          debit:          alloc.amount,
          credit:         ZERO,
          description:    `${componentType} — ${entry.employeeId}`,
          componentType,
          employeeCount:  1,
          employeeIds:    [entry.employeeId],
        })
      }

      // Credit side — entity level (control account)
      addCredit(mapping.creditAccountId, componentType, amount, entry.employeeId)
    }
  }

  // Materialise credit lines
  for (const [key, data] of creditAcc) {
    const meta = keyMeta.get(key)!
    lines.push({
      lineNumber:    lineNumber++,
      accountId:     meta.accountId,
      costCentreId:  null,
      projectId:     null,
      grantId:       null,
      analysisCodeId: null,
      debit:         ZERO,
      credit:        data.acc,
      description:   `${meta.componentType} payable`,
      componentType: meta.componentType,
      employeeCount: data.empIds.size,
      employeeIds:   [...data.empIds],
    })
  }

  // Totals
  const totalDebits  = lines.reduce((s, l) => s.plus(l.debit),  ZERO)
  const totalCredits = lines.reduce((s, l) => s.plus(l.credit), ZERO)
  const isBalanced   = totalDebits.minus(totalCredits).abs().lessThan("0.01")

  return {
    payrollRunId: payrollRun.id,
    journalDate,
    description:  `Payroll journal — run ${payrollRun.id}`,
    reference,
    lines,
    totalDebits,
    totalCredits,
    isBalanced,
    warnings,
  }
}

// ---------------------------------------------------------------------------
// 6. generatePayrollSummaryByDimension
// ---------------------------------------------------------------------------

export function generatePayrollSummaryByDimension(journal: GeneratedJournal): PayrollSummary {
  const ZERO = new Prisma.Decimal(0)

  const byCostCentre   = new Map<string | null, Prisma.Decimal>()
  const byProject      = new Map<string | null, Prisma.Decimal>()
  const byGrant        = new Map<string | null, Prisma.Decimal>()
  const byAnalysisCode = new Map<string | null, Prisma.Decimal>()
  const byComponent    = new Map<string, Prisma.Decimal>()

  for (const line of journal.lines) {
    if (line.debit.lessThanOrEqualTo(0)) continue // only debit (cost) lines

    const key = (m: Map<string | null, Prisma.Decimal>, k: string | null) => {
      m.set(k, (m.get(k) ?? ZERO).plus(line.debit))
    }

    key(byCostCentre,   line.costCentreId ?? null)
    key(byProject,      line.projectId ?? null)
    key(byGrant,        line.grantId ?? null)
    key(byAnalysisCode, line.analysisCodeId ?? null)
    byComponent.set(line.componentType, (byComponent.get(line.componentType) ?? ZERO).plus(line.debit))
  }

  return { byCostCentre, byProject, byGrant, byAnalysisCode, byComponent }
}

// ---------------------------------------------------------------------------
// 7. generateP32Journal (HMRC payment)
// ---------------------------------------------------------------------------

export function generateP32Journal(
  payrollRunId: string,
  payeAmount: Prisma.Decimal,
  niAmount: Prisma.Decimal,
  paymentDate: Date,
  mappings: PayrollCOAMappingRecord[],
  bankAccountId: string
): GeneratedJournal {
  const ZERO     = new Prisma.Decimal(0)
  const mappingIndex = new Map(mappings.map((m) => [m.componentType, m]))

  const payeMapping = mappingIndex.get("PAYE_TAX")
  const niMapping   = mappingIndex.get("EMPLOYEE_NI")

  const lines: GeneratedJournalLine[] = []
  const warnings: string[] = []
  let ln = 1

  const addLine = (accountId: string, debit: Prisma.Decimal, credit: Prisma.Decimal, desc: string, type: string) => {
    lines.push({
      lineNumber: ln++, accountId, costCentreId: null, projectId: null,
      grantId: null, analysisCodeId: null, debit, credit,
      description: desc, componentType: type, employeeCount: 0, employeeIds: [],
    })
  }

  if (payeMapping) {
    addLine(payeMapping.creditAccountId, payeAmount, ZERO, "PAYE tax payable — HMRC payment", "PAYE_TAX")
  } else {
    warnings.push("No PAYE_TAX mapping found — PAYE debit line omitted.")
  }

  if (niMapping) {
    addLine(niMapping.creditAccountId, niAmount, ZERO, "National Insurance payable — HMRC payment", "EMPLOYEE_NI")
  } else {
    warnings.push("No EMPLOYEE_NI mapping found — NI debit line omitted.")
  }

  const totalPayment = payeAmount.plus(niAmount)
  addLine(bankAccountId, ZERO, totalPayment, "HMRC PAYE/NI payment", "NET_PAY")

  const totalDebits  = lines.reduce((s, l) => s.plus(l.debit),  ZERO)
  const totalCredits = lines.reduce((s, l) => s.plus(l.credit), ZERO)

  return {
    payrollRunId,
    journalDate:  paymentDate,
    description:  "HMRC P32 payment",
    reference:    `P32-${payrollRunId}`,
    lines,
    totalDebits,
    totalCredits,
    isBalanced: totalDebits.minus(totalCredits).abs().lessThan("0.01"),
    warnings,
  }
}
