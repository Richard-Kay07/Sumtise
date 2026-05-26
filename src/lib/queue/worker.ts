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

  console.log('[worker] pg-boss worker started')
}
