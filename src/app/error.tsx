"use client"

/**
 * Application error boundary.
 *
 * There was no error.tsx or global-error.tsx anywhere under src/app, so any
 * render-time exception surfaced as Next.js's bare "Application error: a
 * client-side exception has occurred (see the browser console for more
 * information)" — which tells a user nothing and gives us nothing to act on.
 */

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[app error boundary]", error)
  }, [error])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-lg w-full border-red-200">
        <CardContent className="pt-8 pb-8 space-y-4 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
          <h1 className="text-lg font-semibold">Something went wrong on this page</h1>
          <p className="text-sm text-muted-foreground">
            The rest of the application is unaffected — you can go back to the dashboard
            or try this page again.
          </p>

          {/* Shown so a user can quote something specific when reporting it. */}
          <div className="rounded-md bg-muted/50 border px-3 py-2 text-left">
            <p className="text-xs font-mono break-words text-muted-foreground">
              {error.message || "Unknown error"}
            </p>
            {error.digest && (
              <p className="text-xs font-mono text-muted-foreground mt-1">
                Reference: {error.digest}
              </p>
            )}
          </div>

          <div className="flex justify-center gap-2 pt-1">
            <Button size="sm" onClick={reset}>
              <RefreshCw className="h-4 w-4 mr-2" />Try again
            </Button>
            <Link href="/">
              <Button size="sm" variant="outline">
                <Home className="h-4 w-4 mr-2" />Dashboard
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
