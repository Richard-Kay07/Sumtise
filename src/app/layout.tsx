export const dynamic = 'force-dynamic'

import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ClerkProvider } from "@clerk/nextjs"
import { Providers } from "@/components/providers"
import { Nav } from "@/components/nav"

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

const clerkAppearance = {
  variables: {
    colorPrimary: "#50B0E0",
    colorBackground: "#ffffff",
    colorText: "#1A1D24",
    colorInputBackground: "#f9fafb",
    colorInputText: "#1A1D24",
    borderRadius: "0.75rem",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  elements: {
    card: "shadow-xl border border-gray-100 rounded-2xl",
    headerTitle: "text-2xl font-bold text-[#1A1D24]",
    headerSubtitle: "text-gray-500",
    formButtonPrimary:
      "bg-[#50B0E0] hover:bg-[#3a9fd0] text-white font-semibold rounded-xl transition-colors",
    formFieldInput:
      "border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#50B0E0] focus:border-[#50B0E0]",
    footerActionLink: "text-[#50B0E0] hover:text-[#3a9fd0] font-medium",
    identityPreviewEditButton: "text-[#50B0E0]",
    logoImage: "rounded-xl",
    dividerLine: "bg-gray-200",
    dividerText: "text-gray-400 text-xs",
    socialButtonsBlockButton:
      "border border-gray-200 rounded-xl hover:bg-[#50B0E0]/5 hover:border-[#50B0E0] transition-colors",
    socialButtonsBlockButtonText: "font-medium text-gray-700",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>
          <Providers>
            <Nav />
            <div className="pt-14">
              {children}
            </div>
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}
