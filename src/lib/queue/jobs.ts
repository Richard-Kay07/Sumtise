export const JOBS = {
  LEDGER_CLASSIFY:     'agent.ledger.classify',
  TAX_COMPILE_VAT:     'agent.tax.compile_vat',
  TAX_SUBMIT_HMRC:     'agent.tax.submit_hmrc',
  APAR_CHASE_DEBTORS:  'agent.apar.chase_debtors',
  APAR_MATCH_PAYMENTS: 'agent.apar.match_payments',
  PAYROLL_PROCESS:     'agent.payroll.process',
  FPNA_FORECAST:       'agent.fpna.forecast',
  FPNA_VARIANCE:       'agent.fpna.variance',
  BANK_FEED_SYNC:      'agent.bankfeed.sync',
} as const

export type JobName = typeof JOBS[keyof typeof JOBS]
