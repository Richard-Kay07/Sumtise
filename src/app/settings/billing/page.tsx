"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Logo } from "@/components/logo"
import { Construction, CreditCard } from "lucide-react"

export default function BillingPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="flex items-center space-x-4">
            <a className="flex items-center space-x-2" href="/">
              <Logo size={32} showText={true} />
            </a>
            <h1 className="text-2xl font-bold">Billing</h1>
          </div>
        </div>
      </div>

      <main className="container mx-auto py-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CreditCard className="h-5 w-5" />
              <span>Billing & Subscription</span>
            </CardTitle>
            <CardDescription>
              Manage your subscription and billing information
            </CardDescription>
          </CardHeader>
          <CardContent className="py-12 text-center">
            <Construction className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
            <p className="text-muted-foreground mb-4">
              Billing management is currently under development.
            </p>
            <p className="text-sm text-muted-foreground">
              This feature will allow you to manage your subscription plan, payment methods, billing history, and usage tracking.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}




