import type Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { aggregateVATReturn, type VATTransactionLine } from '@/lib/tax/vat'

export const TAX_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_vat_transactions',
    description: 'Fetch all transactions in a VAT period with their VAT treatment codes. Returns output (sales) and input (purchase) lines needed to compile the VAT100 return.',
    input_schema: {
      type: 'object',
      required: ['periodStart', 'periodEnd'],
      properties: {
        periodStart: { type: 'string', description: 'Period start date YYYY-MM-DD' },
        periodEnd:   { type: 'string', description: 'Period end date YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'get_vat_return_calculation',
    description: 'Run the VAT100 box calculation engine for a given period. Returns all 9 boxes with amounts. Always call this before proposing a return.',
    input_schema: {
      type: 'object',
      required: ['periodStart', 'periodEnd'],
      properties: {
        periodStart: { type: 'string', description: 'Period start date YYYY-MM-DD' },
        periodEnd:   { type: 'string', description: 'Period end date YYYY-MM-DD' },
        scheme:      { type: 'string', enum: ['standard', 'cash', 'flat_rate'], description: 'VAT scheme (default: standard)' },
      },
    },
  },
  {
    name: 'get_vat_obligations',
    description: 'Get the list of VAT periods (obligations) from the local database. Shows which periods are open, fulfilled, or overdue.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['OPEN', 'FULFILLED', 'OVERDUE'], description: 'Filter by status' },
      },
    },
  },
  {
    name: 'flag_missing_vat_treatment',
    description: 'Identify transactions in the period that have no VAT treatment code on their account, which could cause mis-stated VAT returns.',
    input_schema: {
      type: 'object',
      required: ['periodStart', 'periodEnd'],
      properties: {
        periodStart: { type: 'string', description: 'Period start date YYYY-MM-DD' },
        periodEnd:   { type: 'string', description: 'Period end date YYYY-MM-DD' },
      },
    },
  },
]

export async function executeTaxTool(
  name: string,
  args: Record<string, any>,
  organizationId: string
): Promise<unknown> {
  switch (name) {
    case 'get_vat_transactions':      return getVatTransactions(args, organizationId)
    case 'get_vat_return_calculation': return getVatReturnCalculation(args, organizationId)
    case 'get_vat_obligations':        return getVatObligationsLocal(args, organizationId)
    case 'flag_missing_vat_treatment': return flagMissingVatTreatment(args, organizationId)
    default: return { error: `Unknown tool: ${name}` }
  }
}

async function getVatTransactions(args: any, orgId: string) {
  const start = new Date(args.periodStart)
  const end = new Date(args.periodEnd)

  const txns = await prisma.transaction.findMany({
    where: { organizationId: orgId, date: { gte: start, lte: end } },
    include: { account: { select: { code: true, name: true, type: true, vatTreatment: true } } },
    orderBy: { date: 'asc' },
    take: 500,
  })

  const output = txns.filter(t => t.account.type === 'REVENUE')
  const input  = txns.filter(t => t.account.type === 'EXPENSE' || t.account.type === 'ASSET')

  return {
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
    outputTransactions: output.length,
    inputTransactions: input.length,
    totalOutputNet: output.reduce((s, t) => s + Number(t.credit) - Number(t.debit), 0),
    totalInputNet:  input.reduce((s, t) => s + Number(t.debit) - Number(t.credit), 0),
    sample: txns.slice(0, 10).map(t => ({
      date: t.date.toISOString().split('T')[0],
      account: `[${t.account.code}] ${t.account.name}`,
      vatTreatment: t.account.vatTreatment ?? 'NOT SET',
      debit: Number(t.debit),
      credit: Number(t.credit),
    })),
  }
}

async function getVatReturnCalculation(args: any, orgId: string) {
  const start = new Date(args.periodStart)
  const end = new Date(args.periodEnd)

  const txns = await prisma.transaction.findMany({
    where: { organizationId: orgId, date: { gte: start, lte: end } },
    include: { account: { select: { type: true, vatTreatment: true } } },
  })

  const lines: VATTransactionLine[] = txns
    .filter(t => t.account.vatTreatment)
    .map(t => {
      const netAmount = Number(t.credit) - Number(t.debit)
      const isOutput = t.account.type === 'REVENUE'
      const vatRate = t.account.vatTreatment === 'STANDARD' ? 0.20
        : t.account.vatTreatment === 'REDUCED' ? 0.05
        : 0
      const netPence = Math.round(Math.abs(netAmount) * 100)
      const vatPence = Math.round(netPence * vatRate)
      return {
        netPence: isOutput ? netPence : -netPence,
        vatPence: isOutput ? vatPence : -vatPence,
        rateCode: (t.account.vatTreatment ?? 'ZERO') as any,
        isOutput,
      }
    })

  const vatReturn = aggregateVATReturn({ transactions: lines, scheme: args.scheme ?? 'standard' })

  return {
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
    box1OutputVat: vatReturn.box1OutputVat / 100,
    box2: vatReturn.box2 / 100,
    box3TotalVatDue: vatReturn.box3TotalVatDue / 100,
    box4InputVat: vatReturn.box4InputVat / 100,
    box5NetVat: vatReturn.box5NetVat / 100,
    box6SalesNet: vatReturn.box6TotalValueSales / 100,
    box7PurchasesNet: vatReturn.box7TotalValuePurchases / 100,
    box8: vatReturn.box8 / 100,
    box9: vatReturn.box9 / 100,
    linesProcessed: lines.length,
  }
}

async function getVatObligationsLocal(args: any, orgId: string) {
  const where: any = { organizationId: orgId }
  if (args.status) where.status = args.status

  const periods = await prisma.vatPeriod.findMany({
    where,
    orderBy: { dueDate: 'desc' },
    take: 20,
  })

  return { periods: periods.map(p => ({
    periodKey: p.periodKey,
    periodStart: p.periodStart.toISOString().split('T')[0],
    periodEnd: p.periodEnd.toISOString().split('T')[0],
    dueDate: p.dueDate.toISOString().split('T')[0],
    status: p.status,
  })) }
}

async function flagMissingVatTreatment(args: any, orgId: string) {
  const start = new Date(args.periodStart)
  const end = new Date(args.periodEnd)

  const txns = await prisma.transaction.findMany({
    where: {
      organizationId: orgId,
      date: { gte: start, lte: end },
      account: { vatTreatment: null },
    },
    include: { account: { select: { code: true, name: true, type: true } } },
    distinct: ['accountId'],
    take: 50,
  })

  return {
    count: txns.length,
    affectedAccounts: txns.map(t => ({
      code: t.account.code,
      name: t.account.name,
      type: t.account.type,
    })),
  }
}
