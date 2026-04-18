"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { trpc } from "@/lib/trpc-client"
import { formatCurrency, formatDate } from "@/lib/utils"
import { 
  Calculator, 
  FileText, 
  Calendar, 
  AlertTriangle, 
  CheckCircle,
  Download,
  Upload,
  Clock,
  TrendingUp,
  Receipt,
  Globe
} from "lucide-react"
import { Logo } from "@/components/logo"

interface TaxReturn {
  id: string
  period: string
  type: 'VAT' | 'PAYE' | 'Corporation' | 'Provisional'
  status: 'draft' | 'ready' | 'submitted' | 'accepted' | 'rejected'
  dueDate: string
  submittedDate?: string
  amount: number
  region: 'UK' | 'ZA' | 'KE' | 'ZM'
}

interface TaxCalculation {
  category: string
  amount: number
  rate: number
  tax: number
}

export default function TaxPage() {
  const [selectedRegion, setSelectedRegion] = useState<string>("UK")
  const [selectedPeriod, setSelectedPeriod] = useState<string>("2024-Q1")

  // Get user's organizations
  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()

  // Mock tax returns data
  const mockTaxReturns: TaxReturn[] = [
    {
      id: "1",
      period: "2024-Q1",
      type: "VAT",
      status: "ready",
      dueDate: "2024-05-07",
      amount: 2500.00,
      region: "UK"
    },
    {
      id: "2",
      period: "2024-Q1",
      type: "Corporation",
      status: "draft",
      dueDate: "2024-12-31",
      amount: 15000.00,
      region: "UK"
    },
    {
      id: "3",
      period: "2024-Q1",
      type: "VAT",
      status: "submitted",
      dueDate: "2024-04-25",
      submittedDate: "2024-04-20",
      amount: 3200.00,
      region: "ZA"
    }
  ]

  const mockCalculations: TaxCalculation[] = [
    { category: "Standard Rate Sales", amount: 10000, rate: 20, tax: 2000 },
    { category: "Reduced Rate Sales", amount: 2000, rate: 5, tax: 100 },
    { category: "Zero Rate Sales", amount: 5000, rate: 0, tax: 0 },
    { category: "Purchases", amount: 8000, rate: 20, tax: 1600 },
    { category: "Net VAT Due", amount: 0, rate: 0, tax: 500 }
  ]

  const regions = [
    { code: "UK", name: "United Kingdom", flag: "🇬🇧" },
    { code: "ZA", name: "South Africa", flag: "🇿🇦" },
    { code: "KE", name: "Kenya", flag: "🇰🇪" },
    { code: "ZM", name: "Zambia", flag: "🇿🇲" }
  ]

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "ready":
        return "default"
      case "draft":
        return "secondary"
      case "submitted":
        return "outline"
      case "accepted":
        return "default"
      case "rejected":
        return "destructive"
      default:
        return "outline"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ready":
        return CheckCircle
      case "draft":
        return FileText
      case "submitted":
        return Upload
      case "accepted":
        return CheckCircle
      case "rejected":
        return AlertTriangle
      default:
        return Clock
    }
  }

  const getRegionTaxTypes = (region: string) => {
    switch (region) {
      case "UK":
        return ["VAT", "Corporation Tax", "PAYE", "National Insurance"]
      case "ZA":
        return ["VAT", "Income Tax", "Provisional Tax", "PAYE"]
      case "KE":
        return ["VAT", "Income Tax", "PAYE", "NHIF"]
      case "ZM":
        return ["VAT", "Income Tax", "PAYE", "NPS"]
      default:
        return []
    }
  }

  const handleSubmitReturn = async (returnId: string) => {
    // This would integrate with HMRC, SARS, KRA, or ZRA APIs
    console.log(`Submitting tax return ${returnId}`)
  }

  const handleCalculateTax = async () => {
    // This would calculate tax based on transactions
    console.log("Calculating tax...")
  }

  const filteredReturns = mockTaxReturns.filter(return_ => return_.region === selectedRegion)
  const taxTypes = getRegionTaxTypes(selectedRegion)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <a className="mr-6" href="/">
              <Logo size={32} showText={true} />
            </a>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="w-full flex-1 md:w-auto md:flex-none">
              <h1 className="text-2xl font-bold">Tax Compliance</h1>
            </div>
            <nav className="flex items-center space-x-2">
              <Button variant="outline">
                <Calculator className="mr-2 h-4 w-4" />
                Calculate Tax
              </Button>
              <Button>
                <FileText className="mr-2 h-4 w-4" />
                New Return
              </Button>
            </nav>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto py-6">
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Region Selection */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Globe className="mr-2 h-5 w-5" />
                  Tax Regions
                </CardTitle>
                <CardDescription>
                  Select your tax jurisdiction
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {regions.map((region) => (
                    <Button
                      key={region.code}
                      variant={selectedRegion === region.code ? "default" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => setSelectedRegion(region.code)}
                    >
                      <span className="mr-2">{region.flag}</span>
                      {region.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Tax Types */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Tax Types</CardTitle>
                <CardDescription>
                  Available for {regions.find(r => r.code === selectedRegion)?.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {taxTypes.map((type) => (
                    <div key={type} className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm font-medium">{type}</span>
                      <Badge variant="outline">Active</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start">
                    <Calculator className="mr-2 h-4 w-4" />
                    Calculate VAT
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <FileText className="mr-2 h-4 w-4" />
                    Generate Return
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Download className="mr-2 h-4 w-4" />
                    Export Data
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Upload className="mr-2 h-4 w-4" />
                    Submit Return
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tax Returns and Calculations */}
          <div className="lg:col-span-3">
            <div className="space-y-6">
              {/* Tax Returns */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Tax Returns</span>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">
                        {filteredReturns.length} returns
                      </Badge>
                      <Button variant="outline" size="sm">
                        <Calendar className="mr-2 h-4 w-4" />
                        {selectedPeriod}
                      </Button>
                    </div>
                  </CardTitle>
                  <CardDescription>
                    Manage your tax returns for {regions.find(r => r.code === selectedRegion)?.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredReturns.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                      <h3 className="mt-4 text-lg font-semibold">No tax returns</h3>
                      <p className="text-muted-foreground">
                        Create your first tax return for this period
                      </p>
                      <Button className="mt-4">
                        <FileText className="mr-2 h-4 w-4" />
                        Create Return
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredReturns.map((return_) => {
                        const StatusIcon = getStatusIcon(return_.status)
                        return (
                          <div key={return_.id} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <StatusIcon className="h-5 w-5 text-muted-foreground" />
                                <div>
                                  <h3 className="font-medium">{return_.type} Return</h3>
                                  <p className="text-sm text-muted-foreground">
                                    Period: {return_.period} • Due: {formatDate(return_.dueDate)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-3">
                                <div className="text-right">
                                  <div className="font-bold">{formatCurrency(return_.amount)}</div>
                                  <Badge variant={getStatusBadgeVariant(return_.status)}>
                                    {return_.status}
                                  </Badge>
                                </div>
                                <div className="flex space-x-1">
                                  <Button variant="outline" size="sm">
                                    <FileText className="h-4 w-4" />
                                  </Button>
                                  <Button variant="outline" size="sm">
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  {return_.status === "ready" && (
                                    <Button size="sm" onClick={() => handleSubmitReturn(return_.id)}>
                                      <Upload className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tax Calculation */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calculator className="mr-2 h-5 w-5" />
                    Tax Calculation
                  </CardTitle>
                  <CardDescription>
                    Current period tax calculations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mockCalculations.map((calc, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{calc.category}</div>
                          {calc.rate > 0 && (
                            <div className="text-sm text-muted-foreground">
                              {formatCurrency(calc.amount)} × {calc.rate}%
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-bold">
                            {calc.tax > 0 ? formatCurrency(calc.tax) : '-'}
                          </div>
                          {calc.rate > 0 && (
                            <div className="text-sm text-muted-foreground">
                              {calc.rate}% rate
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-6 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-bold">Total Tax Due</div>
                      <div className="text-2xl font-bold text-red-600">
                        {formatCurrency(mockCalculations[mockCalculations.length - 1].tax)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Compliance Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CheckCircle className="mr-2 h-5 w-5" />
                    Compliance Status
                  </CardTitle>
                  <CardDescription>
                    Your tax compliance overview
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-green-600">95%</div>
                      <div className="text-sm text-muted-foreground">Compliance Score</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">2</div>
                      <div className="text-sm text-muted-foreground">Returns Due</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">0</div>
                      <div className="text-sm text-muted-foreground">Overdue</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Regional Compliance Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Regional Compliance</CardTitle>
                  <CardDescription>
                    Tax requirements for {regions.find(r => r.code === selectedRegion)?.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedRegion === "UK" && (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Making Tax Digital (MTD) compliant</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">HMRC integration ready</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">VAT returns automated</span>
                      </div>
                    </div>
                  )}
                  
                  {selectedRegion === "ZA" && (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">SARS eFiling integration</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Provisional tax calculations</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">PAYE compliance</span>
                      </div>
                    </div>
                  )}
                  
                  {selectedRegion === "KE" && (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">KRA iTax integration</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">NHIF calculations</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">PAYE automation</span>
                      </div>
                    </div>
                  )}
                  
                  {selectedRegion === "ZM" && (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">ZRA integration</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">NPS compliance</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Local tax calculations</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
