"use client"

import { useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import Link from "next/link"
import { trpc } from "@/lib/trpc-client"
import { formatCurrency } from "@/lib/utils"
import {
  DollarSign, TrendingUp, TrendingDown, CreditCard, FileText,
  Plus, Users, BarChart3, FilePlus, Receipt
} from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Pie, PieChart as RechartsPieChart, Cell } from "recharts"

const BRAND_BLUE = "#50B0E0"
const BRAND_DARK = "#1A1D24"

const revenueData = [
  { month: "Jan", revenue: 18000, expenses: 11000 },
  { month: "Feb", revenue: 21000, expenses: 13000 },
  { month: "Mar", revenue: 19000, expenses: 12000 },
  { month: "Apr", revenue: 24000, expenses: 14000 },
  { month: "May", revenue: 22000, expenses: 13500 },
  { month: "Jun", revenue: 27000, expenses: 16000 },
]

const cashFlowData = [
  { month: "Jan", inflow: 18000, outflow: 11000 },
  { month: "Feb", inflow: 21000, outflow: 13000 },
  { month: "Mar", inflow: 19000, outflow: 12000 },
  { month: "Apr", inflow: 24000, outflow: 14000 },
  { month: "May", inflow: 22000, outflow: 13500 },
  { month: "Jun", inflow: 27000, outflow: 16000 },
]

const expenseCategories = [
  { name: "Office Supplies", value: 4000, color: BRAND_BLUE },
  { name: "Travel", value: 3000, color: "#10B981" },
  { name: "Marketing", value: 2500, color: "#F59E0B" },
  { name: "Utilities", value: 2000, color: "#EF4444" },
  { name: "Other", value: 1500, color: "#8B5CF6" },
]

const recentActivity = [
  { color: "#10B981", label: "Invoice #INV-2024001 paid", time: "2 hours ago", badge: "+£2,500", badgeColor: "bg-green-100 text-green-800" },
  { color: BRAND_BLUE, label: "New customer added", time: "4 hours ago", badge: "ABC Corp", badgeColor: "bg-blue-100 text-blue-800" },
  { color: "#F59E0B", label: "Expense recorded", time: "6 hours ago", badge: "-£150", badgeColor: "bg-orange-100 text-orange-800" },
  { color: "#EF4444", label: "Invoice overdue", time: "1 day ago", badge: "#INV-2024002", badgeColor: "bg-red-100 text-red-800" },
]

export default function Dashboard() {
  const { user, isLoaded } = useUser()
  const router = useRouter()

  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()
  const { data: stats } = trpc.dashboard.getStats.useQuery(
    { organizationId: organizations?.[0]?.id || "" },
    { enabled: !!organizations?.[0]?.id }
  )

  useEffect(() => {
    if (isLoaded && !user) router.push("/auth/signin")
  }, [isLoaded, user, router])

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: BRAND_BLUE }} />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto py-6 px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: BRAND_DARK }}>Dashboard</h1>
          <p className="text-gray-500">Welcome back! Here&apos;s what&apos;s happening with your business.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          {[
            { label: "Total Revenue", value: formatCurrency(stats?.totalRevenue ?? 103000), icon: <DollarSign className="h-5 w-5 text-gray-400" />, trend: "+20.1% from last month", up: true },
            { label: "Total Expenses", value: formatCurrency(stats?.totalExpenses ?? 67500), icon: <TrendingDown className="h-5 w-5 text-gray-400" />, trend: "+5.2% from last month", up: false },
            { label: "Net Profit", value: formatCurrency(stats?.netProfit ?? 35500), icon: <TrendingUp className="h-5 w-5 text-gray-400" />, trend: "+12.5% from last month", up: true },
            { label: "Cash Position", value: formatCurrency(stats?.cashPosition ?? 42300), icon: <CreditCard className="h-5 w-5 text-gray-400" />, trend: `Across ${stats?.bankBalances?.length ?? 3} bank accounts`, up: null },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">{card.icon}</div>
                <div>
                  <p className="text-sm font-medium text-gray-500">{card.label}</p>
                  <p className="text-xl font-bold" style={{ color: BRAND_DARK }}>{card.value}</p>
                </div>
              </div>
              <p className={`mt-2 text-xs ${card.up === true ? "text-green-600" : card.up === false ? "text-red-500" : "text-gray-400"}`}>
                {card.up === true && <TrendingUp className="inline h-3 w-3 mr-1" />}
                {card.trend}
              </p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid gap-6 md:grid-cols-2 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-800">Revenue vs Expenses</h3>
            </div>
            <p className="text-xs text-gray-400 mb-4">Monthly comparison</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="revenue" fill={BRAND_BLUE} name="Revenue" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#EF4444" name="Expenses" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-800">Cash Flow Trend</h3>
            </div>
            <p className="text-xs text-gray-400 mb-4">Monthly cash flow analysis</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Line type="monotone" dataKey="inflow" stroke={BRAND_BLUE} strokeWidth={2} dot={false} name="Cash In" />
                <Line type="monotone" dataKey="outflow" stroke="#EF4444" strokeWidth={2} dot={false} name="Cash Out" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid gap-6 md:grid-cols-3 mb-6">
          {/* Expense Categories */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Expense Categories</h3>
            <div className="flex justify-center mb-4">
              <RechartsPieChart width={160} height={160}>
                <Pie data={expenseCategories} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                  {expenseCategories.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
              </RechartsPieChart>
            </div>
            <div className="space-y-2">
              {expenseCategories.map((e) => (
                <div key={e.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.color }} />
                    <span className="text-gray-600">{e.name}</span>
                  </div>
                  <span className="font-medium text-gray-800">{formatCurrency(e.value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Outstanding Invoices */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-800">Outstanding Invoices</h3>
            </div>
            <div className="text-3xl font-bold mb-3" style={{ color: BRAND_DARK }}>{stats?.outstandingInvoices ?? 12}</div>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between"><span className="text-gray-500">Current</span><span className="font-medium">{stats?.outstandingInvoices ?? 8}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Overdue</span><span className="font-medium text-red-500">{stats?.overdueInvoices ?? 4}</span></div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
              <div className="h-1.5 rounded-full" style={{ width: "75%", backgroundColor: BRAND_BLUE }} />
            </div>
            <p className="text-xs text-gray-400">75% collection rate this month</p>
          </div>

          {/* Bank Balances */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-800">Bank Balances</h3>
            </div>
            <div className="space-y-4">
              {stats?.bankBalances?.map((a, i) => (
                <div key={i} className="flex justify-between items-center">
                  <div>
                    <div className="text-sm font-medium text-gray-800">{a.accountName}</div>
                    <div className="text-xs text-gray-400">{a.currency}</div>
                  </div>
                  <div className="font-bold text-gray-900">{formatCurrency(a.balance, a.currency)}</div>
                </div>
              )) ?? (
                <>
                  <div className="flex justify-between items-center">
                    <div><div className="text-sm font-medium text-gray-800">Business Account</div><div className="text-xs text-gray-400">GBP</div></div>
                    <div className="font-bold text-gray-900">£28,500</div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div><div className="text-sm font-medium text-gray-800">Savings Account</div><div className="text-xs text-gray-400">GBP</div></div>
                    <div className="font-bold text-gray-900">£13,800</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions + Activity */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { href: "/invoices/new", icon: <FilePlus className="h-5 w-5" />, label: "Create Invoice" },
                { href: "/customers/new", icon: <Users className="h-5 w-5" />, label: "Add Customer" },
                { href: "/expenses/new", icon: <Receipt className="h-5 w-5" />, label: "Record Expense" },
                { href: "/reports", icon: <TrendingUp className="h-5 w-5" />, label: "View Reports" },
              ].map((a) => (
                <Link
                  key={a.label}
                  href={a.href}
                  className="flex flex-col items-center justify-center gap-2 h-20 border border-gray-200 rounded-xl text-gray-600 hover:border-[#50B0E0] hover:text-[#50B0E0] hover:bg-[#50B0E0]/5 transition-colors text-sm font-medium"
                >
                  {a.icon}
                  {a.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Recent Activity</h3>
            <div className="space-y-4">
              {recentActivity.map((a, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: a.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{a.label}</p>
                    <p className="text-xs text-gray-400">{a.time}</p>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${a.badgeColor}`}>
                    {a.badge}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
