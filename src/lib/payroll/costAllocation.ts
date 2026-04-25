/**
 * Payroll cost allocation utilities.
 *
 * Pure functions — no DB calls. Resolves employee allocation rules and
 * applies them to pay components.
 */

import { Prisma } from "@prisma/client"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AllocationSplit {
  allocationPercent: Prisma.Decimal
  costCentreId?:   string | null
  projectId?:      string | null
  grantId?:        string | null
  analysisCodeId?: string | null
  componentTypes?: string[]
}

export interface EmployeeAllocationRuleRecord {
  id:           string
  employeeId:   string
  effectiveFrom: Date
  effectiveTo?:  Date | null
  isActive:      boolean
  splitLines:    Array<AllocationSplit & { id: string }>
}

export interface EmployeeWithRules {
  id:              string
  defaultMappingId?: string | null
  allocationRules: EmployeeAllocationRuleRecord[]
}

export interface ResolvedAllocation {
  employeeId:  string
  splits:      AllocationSplit[]
}

export interface PayComponent {
  componentType: string
  amount:        Prisma.Decimal
  employeeId:    string
}

export interface AllocatedComponent {
  componentType:   string
  amount:          Prisma.Decimal
  employeeId:      string
  costCentreId?:   string | null
  projectId?:      string | null
  grantId?:        string | null
  analysisCodeId?: string | null
}

export interface ValidationResult {
  valid:  boolean
  errors: string[]
}

export interface VarianceRow {
  split:    AllocationSplit
  plannedPercent: Prisma.Decimal
  plannedAmount:  Prisma.Decimal
  actualAmount:   Prisma.Decimal
  variance:       Prisma.Decimal
}

// ---------------------------------------------------------------------------
// 1. resolveEmployeeAllocations
// ---------------------------------------------------------------------------

export function resolveEmployeeAllocations(
  employees: EmployeeWithRules[],
  payrollRunDate: Date
): ResolvedAllocation[] {
  return employees.map((emp) => {
    // Find the active rule as at the run date
    const activeRule = emp.allocationRules
      .filter((r) => {
        if (!r.isActive) return false
        if (r.effectiveFrom > payrollRunDate) return false
        if (r.effectiveTo != null && r.effectiveTo < payrollRunDate) return false
        return true
      })
      .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0]

    if (!activeRule) {
      // No rule — single split to default cost centre
      return {
        employeeId: emp.id,
        splits: [
          {
            allocationPercent: new Prisma.Decimal(100),
            costCentreId: emp.defaultMappingId ?? null,
          },
        ],
      }
    }

    return {
      employeeId: emp.id,
      splits: activeRule.splitLines.map((s) => ({
        allocationPercent: s.allocationPercent,
        costCentreId:      s.costCentreId,
        projectId:         s.projectId,
        grantId:           s.grantId,
        analysisCodeId:    s.analysisCodeId,
        componentTypes:    s.componentTypes,
      })),
    }
  })
}

// ---------------------------------------------------------------------------
// 2. applyAllocationToPayComponent
// ---------------------------------------------------------------------------

export function applyAllocationToPayComponent(
  component: PayComponent,
  splits: AllocationSplit[]
): AllocatedComponent[] {
  if (splits.length === 0) {
    return [
      {
        componentType: component.componentType,
        amount:        component.amount,
        employeeId:    component.employeeId,
      },
    ]
  }

  // Filter splits applicable to this component type
  const applicable = splits.filter(
    (s) =>
      !s.componentTypes ||
      s.componentTypes.length === 0 ||
      s.componentTypes.includes(component.componentType)
  )

  if (applicable.length === 0) {
    return [
      {
        componentType: component.componentType,
        amount:        component.amount,
        employeeId:    component.employeeId,
      },
    ]
  }

  const HUNDRED  = new Prisma.Decimal(100)
  const result: AllocatedComponent[] = []
  let allocated  = new Prisma.Decimal(0)

  for (let i = 0; i < applicable.length; i++) {
    const split  = applicable[i]
    const isLast = i === applicable.length - 1
    const amount = isLast
      ? component.amount.minus(allocated) // exact remainder — no rounding residual
      : component.amount.mul(split.allocationPercent).div(HUNDRED)

    allocated = allocated.plus(amount)

    result.push({
      componentType:   component.componentType,
      amount,
      employeeId:      component.employeeId,
      costCentreId:    split.costCentreId,
      projectId:       split.projectId,
      grantId:         split.grantId,
      analysisCodeId:  split.analysisCodeId,
    })
  }

  return result
}

// ---------------------------------------------------------------------------
// 3. validateAllocationRules
// ---------------------------------------------------------------------------

export function validateAllocationRules(rules: AllocationSplit[]): ValidationResult {
  const errors: string[] = []

  if (rules.length === 0) {
    errors.push("At least one allocation split is required.")
    return { valid: false, errors }
  }

  // Percentages must sum to exactly 100
  const total = rules.reduce(
    (s, r) => s.plus(r.allocationPercent),
    new Prisma.Decimal(0)
  )
  if (!total.equals(100)) {
    errors.push(
      `Allocation percentages must sum to exactly 100.00 (currently ${total.toFixed(2)}).`
    )
  }

  // Each split must have at least one dimension
  rules.forEach((r, i) => {
    if (!r.costCentreId && !r.projectId && !r.grantId && !r.analysisCodeId) {
      errors.push(
        `Split ${i + 1}: at least one dimension (cost centre, project, grant, or analysis code) must be specified.`
      )
    }
  })

  // No duplicate dimension combinations
  const combos = rules.map((r) =>
    [r.costCentreId, r.projectId, r.grantId, r.analysisCodeId].join("|")
  )
  const unique = new Set(combos)
  if (unique.size < combos.length) {
    errors.push("Duplicate dimension combinations are not allowed within the same allocation rule.")
  }

  return { valid: errors.length === 0, errors }
}

// ---------------------------------------------------------------------------
// 4. calculateAllocationVariance
// ---------------------------------------------------------------------------

export function calculateAllocationVariance(
  planned: AllocationSplit[],
  actual: AllocatedComponent[],
  totalComponentAmount: Prisma.Decimal
): VarianceRow[] {
  const HUNDRED = new Prisma.Decimal(100)

  return planned.map((p) => {
    const plannedAmount = totalComponentAmount.mul(p.allocationPercent).div(HUNDRED)
    const matchKey = [p.costCentreId, p.projectId, p.grantId, p.analysisCodeId].join("|")

    const actualAmount = actual
      .filter((a) => {
        const k = [a.costCentreId, a.projectId, a.grantId, a.analysisCodeId].join("|")
        return k === matchKey
      })
      .reduce((s, a) => s.plus(a.amount), new Prisma.Decimal(0))

    return {
      split:          p,
      plannedPercent: p.allocationPercent,
      plannedAmount,
      actualAmount,
      variance:       actualAmount.minus(plannedAmount),
    }
  })
}
