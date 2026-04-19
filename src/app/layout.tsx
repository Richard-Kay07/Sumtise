export const dynamic = 'force-dynamic'

import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ClerkProvider, SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs"
import { Providers } from "@/components/providers"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Sumtise - Modern Accounting Software for SMEs",
  description: "Complete accounting solution for UK and African markets with AI-powered insights",
  keywords: ["accounting", "bookkeeping", "SME", "UK", "Africa", "finance", "invoicing"],
  authors: [{ name: "Sumtise Team" }],
  openGraph: {
    title: "Sumtise - Modern Accounting Software",
    description: "Complete accounting solution for SMEs",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ClerkProvider>
          <header className="flex justify-end p-4 gap-2">
            <Show when="signed-out">
              <SignInButton />
              <SignUpButton />
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </header>
          <Providers>
            {children}
          </Providers>
        </ClerkProvider>
      </body>
    </html>
  )
}
