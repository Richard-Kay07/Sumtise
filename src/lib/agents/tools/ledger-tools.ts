import type Anthropic from '@anthropic-ai/sdk'
import { executeTool } from '@/lib/ai/accountant-tools'

export const LEDGER_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_journal_entries',
    description: 'Fetch recent journal entries (ledger transactions) optionally filtered by date range, account code, or reference. Returns grouped entries showing all lines of each posting together.',
    input_schema: {
      type: 'object',
      properties: {
        dateFrom:    { type: 'string', description: 'Start date YYYY-MM-DD' },
        dateTo:      { type: 'string', description: 'End date YYYY-MM-DD' },
        accountCode: { type: 'string', description: 'Filter to a specific account code' },
        reference:   { type: 'string', description: 'Filter by reference or description (partial match)' },
        limit:       { type: 'number', description: 'Max results (default 20, max 50)' },
      },
    },
  },
  {
    name: 'get_account_balance',
    description: 'Get the current balance of one or more accounts, optionally as of a specific date. Useful for checking if an accruals or prepayment account has a balance before creating entries.',
    input_schema: {
      type: 'object',
      required: ['accountCode'],
      properties: {
        accountCode: { type: 'string', description: 'Account code (e.g. 2100, 1200)' },
        asOfDate:    { type: 'string', description: 'Balance as of this date YYYY-MM-DD (default: today)' },
      },
    },
  },
  {
    name: 'get_chart_of_accounts',
    description: "Fetch the organisation's chart of accounts. Use this before proposing journal entries to find the correct account codes and verify account types.",
    input_schema: {
      type: 'object',
      properties: {
        accountType: {
          type: 'string',
          enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'],
          description: 'Filter by account type',
        },
        search: { type: 'string', description: 'Search account name or code' },
      },
    },
  },
  {
    name: 'find_transaction_group',
    description: 'Find all lines of a journal entry by its reference code. Use this before reversing or correcting a transaction to see the full original posting.',
    input_schema: {
      type: 'object',
      required: ['reference'],
      properties: {
        reference: { type: 'string', description: 'The transaction reference or document reference to find' },
      },
    },
  },
  {
    name: 'get_trial_balance_snapshot',
    description: 'Get a summary trial balance showing all accounts with non-zero balances. Useful for understanding the current state of the ledger.',
    input_schema: {
      type: 'object',
      properties: {
        asOfDate: { type: 'string', description: 'Balance as of YYYY-MM-DD (default: today)' },
      },
    },
  },
]

export { executeTool as executeLedgerTool }
