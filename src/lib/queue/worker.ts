import { getBoss } from './boss'
import { JOBS } from './jobs'

export async function startWorker(): Promise<void> {
  const boss = await getBoss()

  boss.on('error', (err) => {
    console.error('[worker] pg-boss error:', err)
  })

  await boss.work(JOBS.LEDGER_CLASSIFY, async (job) => {
    const { organizationId, triggeredBy, message } = job.data as {
      organizationId: string
      triggeredBy: string
      message: string
    }
    const { LedgerAgent } = await import('@/lib/agents/ledger-agent')
    const agent = new LedgerAgent()
    await agent.run(message, { organizationId, triggeredBy, jobId: job.id })
  })

  await boss.work(JOBS.TAX_COMPILE_VAT, async (job) => {
    const { organizationId, triggeredBy, periodKey } = job.data as {
      organizationId: string
      triggeredBy: string
      periodKey: string
    }
    const { TaxAgent } = await import('@/lib/agents/tax-agent')
    const agent = new TaxAgent()
    await agent.run(
      `Compile the VAT return for period ${periodKey}. Check for missing VAT treatments, calculate all 9 boxes, and flag any anomalies.`,
      { organizationId, triggeredBy, jobId: job.id }
    )
  })

  await boss.work(JOBS.FPNA_FORECAST, async (job) => {
    const { organizationId, triggeredBy } = job.data as {
      organizationId: string
      triggeredBy: string
    }
    const { FpnaAgent } = await import('@/lib/agents/fpna-agent')
    const agent = new FpnaAgent()
    await agent.run(
      'Generate a 6-month cash flow forecast. Analyse historical trends, review budget vs actuals, and identify the top 5 variances. Provide an executive summary and risk flags.',
      { organizationId, triggeredBy, jobId: job.id }
    )
  })

  await boss.work(JOBS.FPNA_VARIANCE, async (job) => {
    const { organizationId, triggeredBy } = job.data as {
      organizationId: string
      triggeredBy: string
    }
    const { FpnaAgent } = await import('@/lib/agents/fpna-agent')
    const agent = new FpnaAgent()
    await agent.run(
      'Run a full budget vs actuals variance analysis for the current period. Identify accounts where actuals exceed budget by more than 15%. Explain each variance and suggest corrective actions.',
      { organizationId, triggeredBy, jobId: job.id }
    )
  })

  await boss.work(JOBS.BANK_FEED_SYNC, async (job) => {
    const { organizationId, bankAccountId, triggeredBy } = job.data as {
      organizationId: string
      bankAccountId: string
      triggeredBy: string
    }
    const { syncTransactions } = await import('@/lib/bank-feed/truelayer')
    const created = await syncTransactions(bankAccountId, organizationId)
    console.log(`[worker] Bank feed sync: ${created} new transactions for org ${organizationId}`)
  })

  // Heartbeat every 60s
  setInterval(() => console.log('[worker] heartbeat — pg-boss running'), 60_000)

  console.log('[worker] pg-boss worker started with all handlers registered')
}
