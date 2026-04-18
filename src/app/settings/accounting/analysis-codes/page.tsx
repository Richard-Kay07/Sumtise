"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/logo"
import { Plus, RefreshCw, FileText, Construction } from "lucide-react"
import Link from "next/link"

export default function AnalysisCodesPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center space-x-4">
            <a className="flex items-center space-x-2" href="/">
              <Logo size={32} showText={true} />
            </a>
            <h1 className="text-2xl font-bold">Analysis Codes</h1>
          </div>
          <div className="flex items-center space-x-2">
            <Link href="/settings/accounting">
              <Button variant="outline">Back to Settings</Button>
            </Link>
          </div>
        </div>
      </div>

      <main className="container mx-auto py-6">
        <Card>
          <CardHeader>
            <CardTitle>Analysis Codes & Tracking Dimensions</CardTitle>
            <CardDescription>
              Manage tracking codes for projects, departments, cost centers, and other dimensions
            </CardDescription>
          </CardHeader>
          <CardContent className="py-12 text-center">
            <Construction className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
            <p className="text-muted-foreground mb-4">
              Analysis codes management is currently under development.
            </p>
            <p className="text-sm text-muted-foreground">
              This feature will allow you to create and manage tracking dimensions such as:
            </p>
            <ul className="text-sm text-muted-foreground mt-4 space-y-1">
              <li>• Project codes</li>
              <li>• Department codes</li>
              <li>• Cost centers</li>
              <li>• Location codes</li>
              <li>• Custom tracking dimensions</li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}




