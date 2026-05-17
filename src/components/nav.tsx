"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserButton, SignedIn, SignedOut, SignInButton } from "@clerk/nextjs"
import { trpc } from "@/lib/trpc-client"
import { Logo } from "@/components/logo"
import {
  ChevronDown, ChevronRight, Building2,
  FileText, Receipt, RefreshCw, CreditCard, Wallet,
  BarChart3, Scale, BookOpen, PiggyBank,
  Landmark, Package, CalendarClock,
  Settings2, GitBranch, LineChart,
  Users, Calendar, Clock, Banknote, ShieldCheck, Send,
  FileBarChart2, TrendingUp, ArrowLeftRight, Clock3,
  FileSearch, Tags, Waves,
  BadgePercent, Building, LayoutGrid, Globe, UserCog, Layers,
  Sparkles,
} from "lucide-react"

const BRAND_BLUE = "#50B0E0"
const BRAND_DARK = "#1A1D24"

// ─── Primitives ───────────────────────────────────────────────────────────────

function NavItem({
  href,
  icon,
  children,
}: {
  href: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const active = pathname === href || (href !== "/" && pathname.startsWith(href))
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-3.5 py-1.5 text-[13px] rounded-lg mx-1 transition-colors whitespace-nowrap ${
        active
          ? "bg-[#50B0E0]/10 text-[#50B0E0] font-medium"
          : "text-gray-600 hover:bg-[#50B0E0]/10 hover:text-[#50B0E0]"
      }`}
    >
      {icon && (
        <span className="inline-flex items-center justify-center w-3.5 h-3.5 shrink-0 text-current opacity-70">
          {icon}
        </span>
      )}
      {children}
    </Link>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3.5 pt-2.5 pb-0.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
      {children}
    </div>
  )
}

function Divider() {
  return <div className="border-t border-gray-100 my-1 mx-3" />
}

// ─── Sub-menu (right-opening flyout) ─────────────────────────────────────────

function NavSubMenu({
  label,
  icon,
  children,
}: {
  label: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="relative group/sub">
      <button className="flex items-center justify-between w-full px-3.5 py-1.5 text-[13px] text-gray-600 hover:bg-[#50B0E0]/10 hover:text-[#50B0E0] rounded-lg mx-1 transition-colors whitespace-nowrap">
        <span className="flex items-center gap-2">
          {icon && (
            <span className="inline-flex items-center justify-center w-3.5 h-3.5 shrink-0 opacity-70">
              {icon}
            </span>
          )}
          {label}
        </span>
        <ChevronRight className="h-3 w-3 text-gray-400 ml-4 shrink-0" />
      </button>
      {/* -ml-1 creates a 4 px overlap so moving diagonally doesn't lose hover */}
      <div className="absolute left-full top-0 -ml-1 opacity-0 invisible group-hover/sub:opacity-100 group-hover/sub:visible transition-all duration-150 z-[60]">
        <div className="ml-1 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5">
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── Top-level dropdown ───────────────────────────────────────────────────────

function NavDropdown({
  label,
  children,
  wide,
}: {
  label: string
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className="relative group">
      <button className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 hover:text-[#50B0E0] hover:bg-[#50B0E0]/10 rounded-lg transition-colors">
        {label}
        <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
      </button>
      <div
        className={`absolute top-full left-0 mt-1 ${wide ? "min-w-[14rem]" : "min-w-[12rem]"} bg-white rounded-xl shadow-xl border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 py-1.5`}
      >
        {children}
      </div>
    </div>
  )
}

// ─── Organisation button ──────────────────────────────────────────────────────

function OrgButton({ name }: { name: string }) {
  return (
    <Link
      href="/settings/organisation"
      className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all hover:shadow-sm group"
      style={{
        backgroundColor: "#50B0E0" + "12",
        borderColor: "#50B0E0" + "30",
      }}
      title="Organisation settings"
    >
      <span
        className="flex items-center justify-center w-5 h-5 rounded-md shrink-0"
        style={{ backgroundColor: BRAND_BLUE + "20" }}
      >
        <Building2
          className="w-3 h-3 group-hover:scale-110 transition-transform"
          style={{ color: BRAND_BLUE }}
        />
      </span>
      <span
        className="text-xs font-semibold max-w-[140px] truncate"
        style={{ color: BRAND_DARK }}
      >
        {name}
      </span>
    </Link>
  )
}

// ─── Main Nav ─────────────────────────────────────────────────────────────────

export function Nav() {
  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()
  const org = organizations?.[0]

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
      <div className="max-w-screen-2xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">

          {/* ── Logo ── */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <Logo size={28} showText={false} />
            <span className="text-lg font-bold tracking-tight" style={{ color: BRAND_BLUE }}>
              SUMTISE
            </span>
          </Link>

          {/* ── Navigation ── */}
          <div className="hidden lg:flex items-center gap-0.5">

            {/* Dashboard */}
            <Link
              href="/"
              className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-[#50B0E0] hover:bg-[#50B0E0]/10 rounded-lg transition-colors"
            >
              Dashboard
            </Link>

            {/* ── Accounting ───────────────────────────────────────── */}
            <NavDropdown label="Accounting">
              {/* Quick access */}
              <NavItem href="/invoices"            icon={<FileText />}>Invoices</NavItem>
              <NavItem href="/expenses"            icon={<Receipt />}>Expenses</NavItem>
              <NavItem href="/budgets"             icon={<PiggyBank />}>Budgets</NavItem>

              <Divider />

              {/* Billing & Payments sub-menu */}
              <NavSubMenu label="Billing & Payments" icon={<CreditCard />}>
                <NavItem href="/invoices/recurring"       icon={<RefreshCw />}>Recurring Invoices</NavItem>
                <NavItem href="/expenses/payment-run"     icon={<Wallet />}>Payment Runs</NavItem>
              </NavSubMenu>

              {/* Ledger & Banking sub-menu */}
              <NavSubMenu label="Ledger & Banking" icon={<Landmark />}>
                <NavItem href="/transactions/journal"       icon={<BookOpen />}>Journals</NavItem>
                <NavItem href="/banking/reconciliation"     icon={<ArrowLeftRight />}>Bank Reconciliation</NavItem>
                <NavItem href="/reports/trial-balance"      icon={<Scale />}>Trial Balance</NavItem>
              </NavSubMenu>

              {/* Assets & Inventory sub-menu */}
              <NavSubMenu label="Assets & Inventory" icon={<Package />}>
                <NavItem href="/accounting/fixed-assets"   icon={<Layers />}>Fixed Assets</NavItem>
                <NavItem href="/accounting/inventory"      icon={<Package />}>Inventory Management</NavItem>
              </NavSubMenu>

              <Divider />
              <NavItem href="/accounting/period-end" icon={<CalendarClock />}>Period End &amp; Close</NavItem>
              <Divider />

              {/* Accounting Settings sub-menu */}
              <NavSubMenu label="Accounting Settings" icon={<Settings2 />}>
                <NavItem href="/settings/accounting"                    icon={<Settings2 />}>Accounting Settings</NavItem>
                <NavItem href="/settings/accounting/chart-of-accounts"  icon={<GitBranch />}>Chart of Accounts</NavItem>
                <NavItem href="/settings/accounting/analysis-codes"     icon={<Tags />}>Analysis Codes</NavItem>
              </NavSubMenu>
            </NavDropdown>

            {/* ── Projects & Grants ────────────────────────────────── */}
            <NavDropdown label="Projects">
              <NavItem href="/projects" icon={<BarChart3 />}>Project Accounting</NavItem>
              <NavItem href="/grants"   icon={<BadgePercent />}>Grants Management (NFP)</NavItem>
              <NavItem href="/leases"   icon={<Building />}>Lease Register (IFRS 16)</NavItem>
            </NavDropdown>

            {/* ── Reports ──────────────────────────────────────────── */}
            <NavDropdown label="Reports" wide>
              {/* Financial Statements sub-menu */}
              <NavSubMenu label="Financial Statements" icon={<FileBarChart2 />}>
                <NavItem href="/reports/income-statement"  icon={<TrendingUp />}>Income Statement</NavItem>
                <NavItem href="/reports/balance-sheet"     icon={<Scale />}>Balance Sheet</NavItem>
                <NavItem href="/reports/trial-balance"     icon={<BookOpen />}>Trial Balance</NavItem>
              </NavSubMenu>

              {/* Management Accounting sub-menu */}
              <NavSubMenu label="Management Accounting" icon={<LineChart />}>
                <NavItem href="/reports/budget-variance"        icon={<BarChart3 />}>Budget Variance</NavItem>
                <NavItem href="/reports/cost-analysis"          icon={<BarChart3 />}>Cost Analysis</NavItem>
                <NavItem href="/reports/project-profitability"  icon={<TrendingUp />}>Project Profitability</NavItem>
                <NavItem href="/reports/forecasting"            icon={<Waves />}>Smart Forecasting</NavItem>
              </NavSubMenu>

              {/* Cashflow & Aging sub-menu */}
              <NavSubMenu label="Cashflow &amp; Aging" icon={<Wallet />}>
                <NavItem href="/reports/cashflow"           icon={<ArrowLeftRight />}>Cashflow Statement</NavItem>
                <NavItem href="/reports/aged-receivables"   icon={<Clock3 />}>Aged Receivables</NavItem>
                <NavItem href="/reports/aged-payables"      icon={<Clock3 />}>Aged Payables</NavItem>
              </NavSubMenu>

              {/* Analysis sub-menu */}
              <NavSubMenu label="Analysis" icon={<Tags />}>
                <NavItem href="/reports/tagged-transactions"      icon={<FileSearch />}>Tagged Transactions</NavItem>
                <NavItem href="/reports/analysis-code-breakdown"  icon={<Tags />}>Analysis Code Breakdown</NavItem>
              </NavSubMenu>

              <Divider />

              {/* Tax Reports sub-menu */}
              <NavSubMenu label="Tax Reports" icon={<BadgePercent />}>
                <NavItem href="/tax/vat-mtd"          icon={<FileText />}>VAT Report</NavItem>
                <NavItem href="/tax/corporation-tax"  icon={<Banknote />}>Corporation Tax Report</NavItem>
              </NavSubMenu>
            </NavDropdown>

            {/* ── Payroll ──────────────────────────────────────────── */}
            <NavDropdown label="Payroll">
              {/* Employees sub-menu */}
              <NavSubMenu label="Employees" icon={<Users />}>
                <NavItem href="/payroll/employees"    icon={<Users />}>Employees</NavItem>
                <NavItem href="/payroll/leave"        icon={<Calendar />}>Leave</NavItem>
                <NavItem href="/payroll/timesheets"   icon={<Clock />}>Timesheets</NavItem>
              </NavSubMenu>

              <Divider />

              {/* Payroll Run sub-menu */}
              <NavSubMenu label="Payroll Run" icon={<Banknote />}>
                <NavItem href="/payroll/pay-salaries"       icon={<Banknote />}>Pay Salaries &amp; Wages</NavItem>
                <NavItem href="/payroll/pension-submission"  icon={<ShieldCheck />}>Pension Submission</NavItem>
                <NavItem href="/payroll/rti-submission"      icon={<Send />}>RTI Submission</NavItem>
                <NavItem href="/payroll/taxes-submission"    icon={<BadgePercent />}>Taxes Submission</NavItem>
              </NavSubMenu>

              <Divider />
              <NavItem href="/payroll/settings" icon={<Settings2 />}>Payroll Settings</NavItem>
            </NavDropdown>

            {/* ── Tax ──────────────────────────────────────────────── */}
            <NavDropdown label="Tax">
              <SectionLabel>VAT Returns</SectionLabel>
              <NavItem href="/tax/vat-mtd"      icon={<Send />}>MTD — Submit via Sumtise</NavItem>
              <NavItem href="/tax/vat-non-mtd"  icon={<FileText />}>Non-MTD Submission</NavItem>
              <Divider />
              <NavItem href="/tax/corporation-tax" icon={<Banknote />}>Corporation Tax</NavItem>
              <Divider />
              <NavItem href="/tax/settings" icon={<Settings2 />}>Tax Settings</NavItem>
            </NavDropdown>

            {/* ── AI ───────────────────────────────────────────────── */}
            <Link
              href="/ai"
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 hover:text-[#50B0E0] hover:bg-[#50B0E0]/10 rounded-lg transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#50B0E0]" />
              AI
            </Link>

            {/* ── Settings ─────────────────────────────────────────── */}
            <NavDropdown label="Settings">
              <NavItem href="/settings/profile"       icon={<UserCog />}>Profile</NavItem>
              <NavItem href="/settings/organisation"  icon={<Building2 />}>Organisation</NavItem>
              <NavItem href="/settings/integrations"  icon={<Globe />}>Integrations</NavItem>
              <NavItem href="/settings/billing"       icon={<CreditCard />}>Billing &amp; Plan</NavItem>
              <Divider />

              {/* System & Modules sub-menu */}
              <NavSubMenu label="System &amp; Modules" icon={<LayoutGrid />}>
                <NavItem href="/settings/modules"         icon={<LayoutGrid />}>Module Settings</NavItem>
                <NavItem href="/settings/currency"        icon={<Globe />}>Multi-Currency / FX</NavItem>
                <NavItem href="/settings/payroll-coa"     icon={<GitBranch />}>Payroll COA</NavItem>
                <NavItem href="/settings/related-parties" icon={<Users />}>Related Parties</NavItem>
                <NavItem href="/settings/wga-codes"       icon={<Tags />}>WGA / CPID Codes</NavItem>
              </NavSubMenu>
            </NavDropdown>
          </div>

          {/* ── Right side ── */}
          <div className="flex items-center gap-2.5">
            {org && <OrgButton name={org.name} />}

            <SignedIn>
              <UserButton afterSignOutUrl="/auth/signin" />
            </SignedIn>
            <SignedOut>
              <SignInButton>
                <button
                  className="text-sm font-medium text-white px-4 py-2 rounded-lg transition-opacity hover:opacity-90"
                  style={{ backgroundColor: BRAND_BLUE }}
                >
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>
          </div>

        </div>
      </div>
    </nav>
  )
}
