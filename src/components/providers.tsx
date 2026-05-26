'use client'
import { trpc } from '@/lib/trpc-client'
import { httpBatchLink } from '@trpc/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import superjson from 'superjson'
import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Don't retry on auth (401/403) or client errors (400) — only on network/server errors
        retry: (failureCount, error: any) => {
          const status = error?.data?.httpStatus
          if (status === 401 || status === 403 || status === 400) return false
          return failureCount < 2
        },
        staleTime: 30_000,
      },
    },
  })
}

export function Providers({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth()
  const [queryClient] = useState(() => makeQueryClient())
  const [trpcClient] = useState(() =>
    trpc.createClient({
      transformer: superjson,
      links: [
        httpBatchLink({
          url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://sumtise-production.up.railway.app'}/api/trpc`,
          // Pass the Clerk session token as Authorization header so the server
          // can authenticate even when cookie propagation is delayed.
          headers: async () => {
            const token = await getToken()
            return token ? { authorization: `Bearer ${token}` } : {}
          },
        }),
      ],
    })
  )
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  )
}
