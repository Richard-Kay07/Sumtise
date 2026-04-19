export const dynamic = 'force-dynamic'

import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ClerkProvider } from "@clerk/nextjs"
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
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>
          <Providers>
            {children}
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}
