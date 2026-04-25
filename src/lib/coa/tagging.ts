/**
 * Transaction tagging utilities.
 *
 * Pure functions — no DB calls. All monetary values use Prisma.Decimal.
 */

import { Prisma } from "@prisma/client"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProposedTag {
  tagType: string
  projectId?: string
  grantId?: string
  relatedPartyId?: string
  wgaCpidId?: string
  customTagId?: string
  allocationPercent?: Prisma.Decimal
  allocationAmount?: Prisma.Decimal
  isSplitLine?: boolean
  /** Set by caller when counterparty is known to be a related party */
  counterpartyIsRelatedParty?: boolean
  /** Whether related-party tag is mandatory for this counterparty */
  relatedPartyTagIsMandatory?: boolean
  /** Whether the transaction involves a public-sector entity */
  counterpartyIsPublicSector?: boolean
}

export interface OrgModuleSettingsFlags {
  enableProjectTagging:      boolean
  enableGrantTagging:        boolean
  enableRelatedPartyTagging: boolean
  enableWGACPIDCodes:        boolean
  enablePayrollCOAPosting:   boolean
  enableIFRS16Leases:        boolean
}

export interface TagValidationResult {
  valid:    boolean
  errors:   string[]
  warnings: string[]
}

export interface SplitTag {
  /** Identifies which line this split belongs to (e.g. projectId / grantId) */
  dimensionKey: string
  allocationPercent?: Prisma.Decimal
  allocationAmount?: Prisma.Decimal
  projectId?:      string
  grantId?:        string
  costCentreId?:   string
  analysisCodeId?: string
}

export interface TaggedLine {
  id:       string
  amount:   Prisma.Decimal
  isDebit:  boolean
  tagType:  string
  targetId: string
  allocationAmount?: Prisma.Decimal
  allocationPercent?: Prisma.Decimal
}

export interface TaggedBalance {
  tagType:   string
  targetId:  string
  totalDebit:  Prisma.Decimal
  totalCredit: Prisma.Decimal
  net:         Prisma.Decimal
  lineCount:   number
}

export interface TransactionTagRecord {
  id:                string
  transactionLineId: string
  tagType:           string
  projectId?:        string | null
  grantId?:          string | null
  relatedPartyId?:   string | null
  wgaCpidId?:        string | null
  customTagId?:      string | null
  allocationPercent?: Prisma.Decimal | null
  allocationAmount?:  Prisma.Decimal | null
  createdAt:          Date
}

export interface RelatedPartyRecord {
  id:           string
  name:         string
  relationship: string
  description?: string | null
  isActive:     boolean
}

export interface WGACPIDCodeRecord {
  id:                string
  cpid:              string
  entityName:        string
  entityType:        string
  departmentalGroup?: string | null
}

export interface RelatedPartyDisclosureItem {
  partyId:             string
  partyName:           string
  relationship:        string
  totalTransactions:   Prisma.Decimal
  transactionCount:    number
  outstandingBalance?: Prisma.Decimal
}

export interface WGAScheduleRow {
  cpid:              string
  entityName:        string
  entityType:        string
  departmentalGroup?: string | null
  totalIncome:       Prisma.Decimal
  totalExpenditure:  Prisma.Decimal
  net:               Prisma.Decimal
  transactionCount:  number
}

// ---------------------------------------------------------------------------
// 1. validateTagCombination
// ---------------------------------------------------------------------------

export function validateTagCombination(
  tags: ProposedTag[],
  _lineAmount: Prisma.Decimal,
  moduleSettings: OrgModuleSettingsFlags
): TagValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Duplicate project on same line
  const projectIds = tags.map((t) => t.projectId).filter(Boolean) as string[]
  if (new Set(projectIds).size < projectIds.length) {
    errors.push("A transaction line cannot be tagged to the same project twice.")
  }

  // Duplicate grant on same line
  const grantIds = tags.map((t) => t.grantId).filter(Boolean) as string[]
  if (new Set(grantIds).size < grantIds.length) {
    errors.push("A transaction line cannot be tagged to the same grant twice.")
  }

  // Split allocation percent sum ≤ 100 per dimension
  const splitTags = tags.filter((t) => t.isSplitLine && t.allocationPercent != null)
  if (splitTags.length > 0) {
    // Group by unique dimension (project or grant id as proxy key)
    const byDimension = new Map<string, Prisma.Decimal>()
    for (const tag of splitTags) {
      const key = tag.projectId ?? tag.grantId ?? tag.customTagId ?? "__default__"
      const prev = byDimension.get(key) ?? new Prisma.Decimal(0)
      byDimension.set(key, prev.plus(tag.allocationPercent!))
    }
    for (const [dim, total] of byDimension) {
      if (total.greaterThan(100)) {
        errors.push(
          `Allocation percentages for dimension "${dim}" sum to ${total.toFixed(2)}% — must be ≤ 100%.`
        )
      }
    }
  }

  // WGA: expense to public-sector entity should have CPID (warning only)
  if (moduleSettings.enableWGACPIDCodes) {
    const hasPublicSector = tags.some((t) => t.counterpartyIsPublicSector)
    const hasCPID         = tags.some((t) => t.wgaCpidId)
    if (hasPublicSector && !hasCPID) {
      warnings.push(
        "Expense to a public-sector entity should have a WGA CPID tag for consolidation compliance."
      )
    }
  }

  // Related party: mandatory tag missing
  if (moduleSettings.enableRelatedPartyTagging) {
    const relatedPartyMandatory = tags.some(
      (t) => t.counterpartyIsRelatedParty && t.relatedPartyTagIsMandatory
    )
    const hasRelatedPartyTag = tags.some((t) => t.relatedPartyId)
    if (relatedPartyMandatory && !hasRelatedPartyTag) {
      errors.push("A related-party tag is required because this counterparty is a related party.")
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

// ---------------------------------------------------------------------------
// 2. calculateSplitAmounts
// ---------------------------------------------------------------------------

export function calculateSplitAmounts(
  lineAmount: Prisma.Decimal,
  tags: SplitTag[]
): SplitTag[] {
  if (tags.length === 0) return []

  const HUNDRED = new Prisma.Decimal(100)
  const result: SplitTag[] = []
  let allocated = new Prisma.Decimal(0)

  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i]
    const isLast = i === tags.length - 1

    if (isLast && tag.allocationPercent == null) {
      // Last split with no percent — assign remainder
      const remainder = lineAmount.minus(allocated)
      result.push({ ...tag, allocationAmount: remainder })
    } else if (tag.allocationPercent != null) {
      const amount = isLast
        ? lineAmount.minus(allocated) // exact remainder on last to avoid rounding
        : lineAmount.mul(tag.allocationPercent).div(HUNDRED)
      allocated = allocated.plus(amount)
      result.push({ ...tag, allocationAmount: amount })
    } else {
      result.push(tag)
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// 3. aggregateByTag
// ---------------------------------------------------------------------------

export function aggregateByTag(
  lines: TaggedLine[],
  tagType: string,
  targetId: string
): TaggedBalance {
  const matching = lines.filter((l) => l.tagType === tagType && l.targetId === targetId)

  let totalDebit  = new Prisma.Decimal(0)
  let totalCredit = new Prisma.Decimal(0)

  for (const line of matching) {
    const effective = line.allocationAmount ?? line.amount
    if (line.isDebit) {
      totalDebit = totalDebit.plus(effective)
    } else {
      totalCredit = totalCredit.plus(effective)
    }
  }

  return {
    tagType,
    targetId,
    totalDebit,
    totalCredit,
    net:       totalDebit.minus(totalCredit),
    lineCount: matching.length,
  }
}

// ---------------------------------------------------------------------------
// 4. buildRelatedPartyDisclosure (FRS 102 s.33)
// ---------------------------------------------------------------------------

export function buildRelatedPartyDisclosure(
  tags: TransactionTagRecord[],
  parties: RelatedPartyRecord[],
  periodStart: Date,
  periodEnd: Date
): RelatedPartyDisclosureItem[] {
  const partyMap = new Map(parties.map((p) => [p.id, p]))
  const byParty = new Map<string, { total: Prisma.Decimal; count: number }>()

  for (const tag of tags) {
    if (!tag.relatedPartyId) continue
    if (tag.createdAt < periodStart || tag.createdAt > periodEnd) continue

    const entry = byParty.get(tag.relatedPartyId) ?? {
      total: new Prisma.Decimal(0),
      count: 0,
    }
    entry.total = entry.total.plus(tag.allocationAmount ?? 0)
    entry.count++
    byParty.set(tag.relatedPartyId, entry)
  }

  return [...byParty.entries()]
    .map(([partyId, data]) => {
      const party = partyMap.get(partyId)
      return {
        partyId,
        partyName:           party?.name ?? partyId,
        relationship:        party?.relationship ?? "",
        totalTransactions:   data.total,
        transactionCount:    data.count,
      }
    })
    .sort((a, b) => b.totalTransactions.minus(a.totalTransactions).toNumber())
}

// ---------------------------------------------------------------------------
// 5. buildWGASchedule
// ---------------------------------------------------------------------------

export function buildWGASchedule(
  tags: TransactionTagRecord[],
  cpidCodes: WGACPIDCodeRecord[],
  periodStart: Date,
  periodEnd: Date
): WGAScheduleRow[] {
  const cpidMap = new Map(cpidCodes.map((c) => [c.id, c]))

  interface AccRow {
    income:      Prisma.Decimal
    expenditure: Prisma.Decimal
    count:       number
  }
  const byCpid = new Map<string, AccRow>()

  for (const tag of tags) {
    if (!tag.wgaCpidId) continue
    if (tag.createdAt < periodStart || tag.createdAt > periodEnd) continue

    const row = byCpid.get(tag.wgaCpidId) ?? {
      income:      new Prisma.Decimal(0),
      expenditure: new Prisma.Decimal(0),
      count:       0,
    }

    const amount = tag.allocationAmount ?? new Prisma.Decimal(0)
    // Tag type "INCOME" vs everything else classified as expenditure
    if (tag.tagType === "INCOME") {
      row.income = row.income.plus(amount)
    } else {
      row.expenditure = row.expenditure.plus(amount)
    }
    row.count++
    byCpid.set(tag.wgaCpidId, row)
  }

  return [...byCpid.entries()]
    .map(([cpidId, data]) => {
      const cpid = cpidMap.get(cpidId)
      return {
        cpid:              cpid?.cpid ?? cpidId,
        entityName:        cpid?.entityName ?? cpidId,
        entityType:        cpid?.entityType ?? "",
        departmentalGroup: cpid?.departmentalGroup,
        totalIncome:       data.income,
        totalExpenditure:  data.expenditure,
        net:               data.income.minus(data.expenditure),
        transactionCount:  data.count,
      }
    })
    .sort((a, b) => a.cpid.localeCompare(b.cpid))
}
