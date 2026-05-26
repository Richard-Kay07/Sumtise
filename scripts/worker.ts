import { startWorker } from '@/lib/queue/worker'
import { stopBoss } from '@/lib/queue/boss'

process.on('SIGTERM', async () => {
  console.log('[worker] SIGTERM received, shutting down')
  await stopBoss()
  process.exit(0)
})

process.on('SIGINT', async () => {
  await stopBoss()
  process.exit(0)
})

startWorker().catch((err) => {
  console.error('[worker] Fatal startup error:', err)
  process.exit(1)
})
