export const dynamic = 'force-dynamic'
import { type NextRequest } from 'next/server'

const handler = async (req: NextRequest) => {
  const { appRouter } = await import('@/server/routers/app')
  const { createTRPCContext } = await import('@/lib/trpc')
  const { fetchRequestHandler } = await import('@trpc/server/adapters/fetch')
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ req }),
  })
}
export { handler as GET, handler as POST }
