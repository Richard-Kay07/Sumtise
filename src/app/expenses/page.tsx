"use client"

import { useState, useRef, useMemo, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { trpc } from "@/lib/trpc-client"
import { formatCurrency, formatDate } from "@/lib/utils"
import { 
  Plus, 
  Upload, 
  Camera, 
  FileText, 
  DollarSign,
  Calendar,
  Tag,
  MapPin,
  CheckCircle,
  AlertCircle,
  Scan,
  Bot
} from "lucide-react"

interface ExpenseData {
  description: string
  amount: number
  category: string
  date: string
  merchant?: string
  location?: string
  confidence: number
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseData[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLVideoElement>(null)

  // Get user's organizations
  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()

  // Get bills for the first organization
  const { data: billsData, isLoading: billsLoading, refetch: refetchBills } = trpc.bills.getAll.useQuery(
    {
      organizationId: organizations?.[0]?.id || "",
      page: 1,
      limit: 50,
      sortBy: "date",
      sortOrder: "desc",
    },
    { enabled: !!organizations?.[0]?.id }
  )

  const bills = billsData?.bills || []

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      processReceipt(file)
    }
  }

  const processReceipt = async (file: File) => {
    setIsScanning(true)
    setScanProgress(0)

    try {
      // Simulate OCR processing
      const interval = setInterval(() => {
        setScanProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval)
            return 100
          }
          return prev + 10
        })
      }, 200)

      // Simulate AI processing delay
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Mock extracted data
      const mockExpense: ExpenseData = {
        description: "Business lunch with client",
        amount: 45.50,
        category: "Meals & Entertainment",
        date: new Date().toISOString().split('T')[0],
        merchant: "The Restaurant Co.",
        location: "London, UK",
        confidence: 0.95
      }

      setExpenses(prev => [...prev, mockExpense])
      setSelectedFile(null)
    } catch (error) {
      console.error("Receipt processing error:", error)
    } finally {
      setIsScanning(false)
      setScanProgress(0)
    }
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (cameraRef.current) {
        cameraRef.current.srcObject = stream
      }
    } catch (error) {
      console.error("Camera access error:", error)
    }
  }

  const capturePhoto = () => {
    if (cameraRef.current) {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      canvas.width = cameraRef.current.videoWidth
      canvas.height = cameraRef.current.videoHeight
      
      if (context) {
        context.drawImage(cameraRef.current, 0, 0)
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], 'receipt.jpg', { type: 'image/jpeg' })
            processReceipt(file)
          }
        }, 'image/jpeg')
      }
    }
  }

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      "Meals & Entertainment": "bg-blue-100 text-blue-800",
      "Travel": "bg-green-100 text-green-800",
      "Office Supplies": "bg-purple-100 text-purple-800",
      "Marketing": "bg-orange-100 text-orange-800",
      "Utilities": "bg-red-100 text-red-800",
      "Other": "bg-gray-100 text-gray-800"
    }
    return colors[category] || colors["Other"]
  }

  // Memoize expense calculations
  const totalAmount = useMemo(() => {
    return expenses.reduce((sum, expense) => sum + expense.amount, 0)
  }, [expenses])

  const averageConfidence = useMemo(() => {
    return expenses.length > 0 
      ? expenses.reduce((sum, expense) => sum + expense.confidence, 0) / expenses.length 
      : 0
  }, [expenses])

  // Memoize category counts
  const categoryStats = useMemo(() => {
    const counts: Record<string, number> = {}
    expenses.forEach(expense => {
      counts[expense.category] = (counts[expense.category] || 0) + 1
    })
    return counts
  }, [expenses])

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
              <h1 className="text-2xl font-bold">Expense Management</h1>
            </div>
            <nav className="flex items-center space-x-2">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Expense
              </Button>
            </nav>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Receipt Scanning */}
          <div className="lg:col-span-2">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Scan className="mr-2 h-5 w-5" />
                  Scan Receipt
                </CardTitle>
                <CardDescription>
                  Upload or capture receipts for automatic processing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {/* File Upload */}
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                      <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Upload Receipt</p>
                        <p className="text-xs text-muted-foreground">
                          Drag and drop or click to select
                        </p>
                        <Button 
                          variant="outline" 
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isScanning}
                        >
                          Choose File
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,.pdf"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Camera Capture */}
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                      <Camera className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Capture Receipt</p>
                        <p className="text-xs text-muted-foreground">
                          Use your camera to scan receipts
                        </p>
                        <Button 
                          variant="outline" 
                          onClick={startCamera}
                          disabled={isScanning}
                        >
                          Open Camera
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Camera Preview */}
                {cameraRef.current?.srcObject && (
                  <div className="mt-4">
                    <video
                      ref={cameraRef}
                      autoPlay
                      playsInline
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    <div className="mt-2 text-center">
                      <Button onClick={capturePhoto}>
                        <Camera className="mr-2 h-4 w-4" />
                        Capture Receipt
                      </Button>
                    </div>
                  </div>
                )}

                {/* Scanning Progress */}
                {isScanning && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center">
                        <Bot className="mr-2 h-4 w-4" />
                        AI is processing your receipt...
                      </span>
                      <span>{scanProgress}%</span>
                    </div>
                    <Progress value={scanProgress} className="h-2" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Expenses List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Processed Expenses ({expenses.length})</span>
                  <Badge variant="outline">
                    Avg Confidence: {Math.round(averageConfidence * 100)}%
                  </Badge>
                </CardTitle>
                <CardDescription>
                  AI-processed expenses ready for review
                </CardDescription>
              </CardHeader>
              <CardContent>
                {expenses.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">No expenses yet</h3>
                    <p className="text-muted-foreground">
                      Upload or capture receipts to get started
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {expenses.map((expense, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h3 className="font-medium">{expense.description}</h3>
                              <Badge className={getCategoryColor(expense.category)}>
                                {expense.category}
                              </Badge>
                              <Badge variant="outline">
                                {Math.round(expense.confidence * 100)}% confidence
                              </Badge>
                            </div>
                            
                            <div className="grid gap-2 md:grid-cols-2 text-sm text-muted-foreground">
                              <div className="flex items-center">
                                <DollarSign className="mr-2 h-4 w-4" />
                                {formatCurrency(expense.amount)}
                              </div>
                              <div className="flex items-center">
                                <Calendar className="mr-2 h-4 w-4" />
                                {formatDate(expense.date)}
                              </div>
                              {expense.merchant && (
                                <div className="flex items-center">
                                  <Tag className="mr-2 h-4 w-4" />
                                  {expense.merchant}
                                </div>
                              )}
                              {expense.location && (
                                <div className="flex items-center">
                                  <MapPin className="mr-2 h-4 w-4" />
                                  {expense.location}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2 ml-4">
                            <Button variant="outline" size="sm">
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <AlertCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Expense Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Amount</span>
                    <span className="font-bold">{formatCurrency(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Number of Expenses</span>
                    <span className="font-bold">{expenses.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Average Amount</span>
                    <span className="font-bold">
                      {expenses.length > 0 ? formatCurrency(totalAmount / expenses.length) : formatCurrency(0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">AI Confidence</span>
                    <span className="font-bold">{Math.round(averageConfidence * 100)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Categories */}
            <Card>
              <CardHeader>
                <CardTitle>Expense Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(
                    expenses.reduce((acc, expense) => {
                      acc[expense.category] = (acc[expense.category] || 0) + expense.amount
                      return acc
                    }, {} as { [key: string]: number })
                  ).map(([category, amount]) => (
                    <div key={category} className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${getCategoryColor(category).split(' ')[0]}`}></div>
                        <span className="text-sm">{category}</span>
                      </div>
                      <span className="text-sm font-medium">{formatCurrency(amount)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* AI Features */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bot className="mr-2 h-5 w-5" />
                  AI Features
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Automatic categorization</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">OCR text extraction</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Merchant recognition</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Duplicate detection</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Tax compliance</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
