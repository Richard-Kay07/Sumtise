"use client"

import { useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { trpc } from "@/lib/trpc-client"
import { formatCurrency, formatDate } from "@/lib/utils"
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  FileText, 
  AlertTriangle,
  Plus,
  Users,
  Calendar,
  Target,
  PieChart,
  BarChart3
} from "lucide-react"
import { Logo } from "@/components/logo"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell } from "recharts"

// Sample data for charts
const revenueData = [
  { month: "Jan", revenue: 12000, expenses: 8000 },
  { month: "Feb", revenue: 15000, expenses: 9000 },
  { month: "Mar", revenue: 18000, expenses: 10000 },
  { month: "Apr", revenue: 16000, expenses: 8500 },
  { month: "May", revenue: 20000, expenses: 12000 },
  { month: "Jun", revenue: 22000, expenses: 11000 },
]

const expenseCategories = [
  { name: "Office Supplies", value: 4000, color: "#0088FE" },
  { name: "Travel", value: 3000, color: "#00C49F" },
  { name: "Marketing", value: 2500, color: "#FFBB28" },
  { name: "Utilities", value: 2000, color: "#FF8042" },
  { name: "Other", value: 1500, color: "#8884D8" },
]

const cashFlowData = [
  { month: "Jan", inflow: 12000, outflow: 8000 },
  { month: "Feb", inflow: 15000, outflow: 9000 },
  { month: "Mar", inflow: 18000, outflow: 10000 },
  { month: "Apr", inflow: 16000, outflow: 8500 },
  { month: "May", inflow: 20000, outflow: 12000 },
  { month: "Jun", inflow: 22000, outflow: 11000 },
]

export default function Dashboard() {
  const { user, isLoaded } = useUser()
  const router = useRouter()

  // Get user's organizations
  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()

  // Get dashboard stats for the first organization
  const { data: stats } = trpc.dashboard.getStats.useQuery(
    { organizationId: organizations?.[0]?.id || "" },
    { enabled: !!organizations?.[0]?.id }
  )

  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/auth/signin")
    }
  }, [isLoaded, user, router])

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <a className="mr-6" href="/">
              <Logo size={32} showText={true} />
            </a>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="w-full flex-1 md:w-auto md:flex-none">
              {/* Organization selector would go here */}
              {organizations && organizations.length > 0 && (
                <Badge variant="outline" className="mr-2">
                  {organizations[0].name}
                </Badge>
              )}
            </div>
            <nav className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Quick Add
              </Button>
              <Button variant="outline" size="sm">
                <Users className="mr-2 h-4 w-4" />
                {user.fullName || user.emailAddresses[0]?.emailAddress}
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening with your business.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(stats?.totalRevenue || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                <TrendingUp className="inline h-3 w-3 text-green-500" /> +20.1% from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(stats?.totalExpenses || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                <TrendingUp className="inline h-3 w-3 text-red-500" /> +5.2% from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(stats?.netProfit || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                <TrendingUp className="inline h-3 w-3 text-green-500" /> +12.5% from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cash Position</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(stats?.cashPosition || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Across {stats?.bankBalances?.length || 0} bank accounts
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid gap-6 md:grid-cols-2 mb-6">
          {/* Revenue vs Expenses Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="mr-2 h-5 w-5" />
                Revenue vs Expenses
              </CardTitle>
              <CardDescription>
                Monthly comparison of revenue and expenses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="revenue" fill="#10B981" name="Revenue" />
                  <Bar dataKey="expenses" fill="#EF4444" name="Expenses" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Cash Flow Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="mr-2 h-5 w-5" />
                Cash Flow Trend
              </CardTitle>
              <CardDescription>
                Monthly cash flow analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={cashFlowData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Line type="monotone" dataKey="inflow" stroke="#10B981" strokeWidth={2} name="Cash In" />
                  <Line type="monotone" dataKey="outflow" stroke="#EF4444" strokeWidth={2} name="Cash Out" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Expense Categories and Additional Info */}
        <div className="grid gap-6 md:grid-cols-3 mb-6">
          {/* Expense Categories Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <PieChart className="mr-2 h-5 w-5" />
                Expense Categories
              </CardTitle>
              <CardDescription>
                Breakdown by category
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <RechartsPieChart>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Pie
                    data={expenseCategories}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {expenseCategories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </RechartsPieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Outstanding Invoices */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="mr-2 h-5 w-5" />
                Outstanding Invoices
              </CardTitle>
              <CardDescription>
                Invoices waiting for payment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-2xl font-bold">
                  {stats?.outstandingInvoices || 0}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Current</span>
                    <span>{stats?.outstandingInvoices || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Overdue</span>
                    <span className="text-red-600">{stats?.overdueInvoices || 0}</span>
                  </div>
                </div>
                <Progress value={75} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  75% collection rate this month
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Bank Balances */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="mr-2 h-5 w-5" />
                Bank Balances
              </CardTitle>
              <CardDescription>
                Current account balances
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats?.bankBalances?.map((account, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{account.accountName}</div>
                      <div className="text-sm text-muted-foreground">{account.currency}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">
                        {formatCurrency(account.balance, account.currency)}
                      </div>
                    </div>
                  </div>
                )) || (
                  <p className="text-sm text-muted-foreground">No bank accounts configured</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions and Recent Activity */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Common tasks to get you started
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2">
                <Button variant="outline" className="h-16 flex-col">
                  <FileText className="mb-2 h-6 w-6" />
                  Create Invoice
                </Button>
                <Button variant="outline" className="h-16 flex-col">
                  <Users className="mb-2 h-6 w-6" />
                  Add Customer
                </Button>
                <Button variant="outline" className="h-16 flex-col">
                  <CreditCard className="mb-2 h-6 w-6" />
                  Record Payment
                </Button>
                <Button variant="outline" className="h-16 flex-col">
                  <TrendingUp className="mb-2 h-6 w-6" />
                  View Reports
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="mr-2 h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>
                Latest transactions and updates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Invoice #INV-2024001 paid</p>
                    <p className="text-xs text-muted-foreground">2 hours ago</p>
                  </div>
                  <Badge variant="outline">+£2,500</Badge>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">New customer added</p>
                    <p className="text-xs text-muted-foreground">4 hours ago</p>
                  </div>
                  <Badge variant="outline">ABC Corp</Badge>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Expense recorded</p>
                    <p className="text-xs text-muted-foreground">6 hours ago</p>
                  </div>
                  <Badge variant="outline">-£150</Badge>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Invoice overdue</p>
                    <p className="text-xs text-muted-foreground">1 day ago</p>
                  </div>
                  <Badge variant="destructive">#INV-2024002</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}