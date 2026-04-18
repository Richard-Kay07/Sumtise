import { createTRPCNext } from "@trpc/next"
import { httpBatchLink } from "@trpc/client"
import superjson from "superjson"
import type { AppRouter } from "@/server/routers/app"

export const trpc = createTRPCNext<AppRouter>({
  config() {
    return {
      transformer: superjson,
      links: [
        httpBatchLink({
          url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/trpc`,
        }),
      ],
    }
  },
  ssr: false,
})
