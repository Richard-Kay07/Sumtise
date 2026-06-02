"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { UserButton, SignedIn, SignedOut, SignInButton } from "@clerk/nextjs"
import { OrgSwitcher } from "@/components/org-switcher"
import {
  ChevronDown, ChevronRight, Building2, CreditCard, Wallet,
  FileText, Receipt, RefreshCw,
  BarChart3, Scale, BookOpen, PiggyBank,
  Landmark, Package, CalendarClock,
  Settings2, GitBranch, LineChart,
  Users, Calendar, Clock, Banknote, ShieldCheck, Send,
  FileBarChart2, TrendingUp, ArrowLeftRight, Clock3,
  FileSearch, Tags, Waves,
  BadgePercent, Building, LayoutGrid, Globe, UserCog, Layers,
  Sparkles, ShoppingCart, Upload,
} from "lucide-react"

// ─── Brand tokens ──────────────────────────────────────────────────────────────
const NAV_BG   = "#1D3348"   // Dark navy — from brand colour1/dark variant
const BRAND    = "#50B0E0"   // Sumtise sky blue accent
const NAV_TEXT = "rgba(255,255,255,0.72)"  // Resting nav link colour

// ─── Dropdown NavItem (inside white panels) ───────────────────────────────────

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
      className={`flex items-center gap-2 px-3 py-1.5 text-[13px] rounded-lg mx-1.5 my-0.5 transition-colors whitespace-nowrap ${
        active
          ? "bg-[#50B0E0]/10 text-[#50B0E0] font-medium"
          : "text-gray-600 hover:bg-[#50B0E0]/8 hover:text-[#50B0E0]"
      }`}
    >
      {icon && (
        <span className="inline-flex items-center justify-center w-3.5 h-3.5 shrink-0 opacity-70 text-current">
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

// ─── Sub-menu flyout ───────────────────────────────────────────────────────────
// flip=true opens leftward (for right-side nav items that would overflow screen)

function NavSubMenu({
  label,
  icon,
  children,
  flip = false,
}: {
  label: string
  icon?: React.ReactNode
  children: React.ReactNode
  flip?: boolean
}) {
  return (
    <div className="relative group/sub">
      <button className="flex items-center justify-between w-full px-3 py-1.5 text-[13px] text-gray-600 hover:bg-[#50B0E0]/8 hover:text-[#50B0E0] rounded-lg mx-1.5 my-0.5 transition-colors whitespace-nowrap">
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
      {/* 4px overlap on the hinge side prevents hover loss during diagonal mouse movement */}
      <div className={`absolute top-0 opacity-0 invisible group-hover/sub:opacity-100 group-hover/sub:visible transition-all duration-150 z-[60] ${
        flip ? "right-full -mr-1" : "left-full -ml-1"
      }`}>
        <div className={`bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 ${flip ? "mr-1" : "ml-1"}`}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── Top-level dropdown (opens from dark nav bar) ─────────────────────────────

function NavDropdown({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="relative group">
      <button
        className="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors"
        style={{ color: NAV_TEXT }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#fff"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.10)" }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = NAV_TEXT; (e.currentTarget as HTMLElement).style.background = "transparent" }}
      >
        {label}
        <ChevronDown className="h-3.5 w-3.5 opacity-50" />
      </button>
      <div className="absolute top-full left-0 mt-1 min-w-[12rem] bg-white rounded-xl shadow-xl border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 py-1.5">
        {children}
      </div>
    </div>
  )
}

// ─── Right-anchored dropdown (for Tax, Settings — prevents right overflow) ────

function NavDropdownRight({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="relative group">
      <button
        className="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors"
        style={{ color: NAV_TEXT }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#fff"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.10)" }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = NAV_TEXT; (e.currentTarget as HTMLElement).style.background = "transparent" }}
      >
        {label}
        <ChevronDown className="h-3.5 w-3.5 opacity-50" />
      </button>
      <div className="absolute top-full right-0 mt-1 min-w-[12rem] bg-white rounded-xl shadow-xl border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 py-1.5">
        {children}
      </div>
    </div>
  )
}


// ─── Active top-level link (Dashboard, AI) ────────────────────────────────────

function NavTopLink({ href, children, icon }: { href: string; children: React.ReactNode; icon?: React.ReactNode }) {
  const pathname = usePathname()
  const active = pathname === href || (href !== "/" && pathname.startsWith(href))
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors"
      style={{
        color: active ? "#fff" : NAV_TEXT,
        backgroundColor: active ? "rgba(80,176,224,0.22)" : "transparent",
      }}
      onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.color = "#fff"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.10)" } }}
      onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.color = NAV_TEXT; (e.currentTarget as HTMLElement).style.background = "transparent" } }}
    >
      {icon}
      {children}
    </Link>
  )
}

// ─── Main Nav ─────────────────────────────────────────────────────────────────

export function Nav() {
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 border-b shadow-lg"
      style={{ backgroundColor: NAV_BG, borderColor: "rgba(255,255,255,0.08)" }}
    >
      <div className="max-w-screen-2xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">

          {/* ── Left: Logo + Org Switcher ── */}
          <div className="flex items-center gap-0 shrink-0">
            <Link href="/" className="flex items-center gap-2 shrink-0 mr-3">
              <Image
                src="/logo.png"
                alt="Sumtise"
                width={26}
                height={26}
                className="shrink-0 object-contain"
                unoptimized
                priority
              />
              <span
                className="text-sm font-bold tracking-[0.18em] uppercase text-white hidden xl:block"
                style={{ letterSpacing: "0.18em" }}
              >
                SUMTISE
              </span>
            </Link>

            {/* vertical divider */}
            <div className="w-px h-6 mx-3 bg-white/15" />

            {/* Org switcher — prominently left, always visible */}
            <OrgSwitcher />

            {/* vertical divider before nav items */}
            <div className="w-px h-6 mx-3 bg-white/15 hidden lg:block" />
          </div>

          {/* ── Centre: Navigation ── */}
          <div className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">

            {/* Dashboard */}
            <NavTopLink href="/">Dashboard</NavTopLink>

            {/* ── Accounting ───────────────────────────────────────── */}
            <NavDropdown label="Accounting">
              <NavItem href="/accounting"          icon={<LayoutGrid />}>All Accounting</NavItem>
              <Divider />
              <NavItem href="/invoices"            icon={<FileText />}>Invoices</NavItem>
              <NavItem href="/expenses"            icon={<Receipt />}>Expenses</NavItem>
              <NavSubMenu label="Purchase Orders" icon={<ShoppingCart />}>
                <NavItem href="/purchase-orders/all"             icon={<ShoppingCart />}>All Purchase Orders</NavItem>
                <NavItem href="/purchase-orders/new"             icon={<ShoppingCart />}>New Purchase Order</NavItem>
                <NavItem href="/purchase-orders/committed-spend" icon={<BarChart3 />}>Committed Spend</NavItem>
              </NavSubMenu>
              <NavItem href="/budgets"             icon={<PiggyBank />}>Budgets</NavItem>

              <Divider />

              <NavSubMenu label="Billing & Payments" icon={<CreditCard />}>
                <NavItem href="/invoices/recurring"       icon={<RefreshCw />}>Recurring Invoices</NavItem>
                <NavItem href="/expenses/payment-run"     icon={<Wallet />}>Payment Runs</NavItem>
              </NavSubMenu>

              <NavSubMenu label="Ledger & Banking" icon={<Landmark />}>
                <NavItem href="/transactions/journal"        icon={<BookOpen />}>Journals</NavItem>
                <NavItem href="/transactions/journal/import" icon={<Upload />}>Import Journals</NavItem>
                <NavItem href="/banking/reconciliation"      icon={<ArrowLeftRight />}>Bank Reconciliation</NavItem>
                <NavItem href="/reports/trial-balance"       icon={<Scale />}>Trial Balance</NavItem>
              </NavSubMenu>

              <NavSubMenu label="Assets & Inventory" icon={<Package />}>
                <NavItem href="/accounting/fixed-assets"   icon={<Layers />}>Fixed Assets</NavItem>
                <NavItem href="/accounting/inventory"      icon={<Package />}>Inventory Management</NavItem>
              </NavSubMenu>

              <Divider />
              <NavItem href="/accounting/period-end" icon={<CalendarClock />}>Period End &amp; Close</NavItem>
              <Divider />

              <NavSubMenu label="Accounting Settings" icon={<Settings2 />}>
                <NavItem href="/settings/accounting"                    icon={<Settings2 />}>Accounting Settings</NavItem>
                <NavItem href="/settings/accounting/chart-of-accounts"  icon={<GitBranch />}>Chart of Accounts</NavItem>
                <NavItem href="/settings/accounting/analysis-codes"     icon={<Tags />}>Analysis Codes</NavItem>
              </NavSubMenu>
            </NavDropdown>

            {/* ── Projects ─────────────────────────────────────────── */}
            <NavDropdown label="Projects">
              <NavItem href="/projects" icon={<LayoutGrid />}>All Projects</NavItem>
              <Divider />
              <NavItem href="/projects" icon={<BarChart3 />}>Project Accounting</NavItem>
              <NavItem href="/grants"   icon={<BadgePercent />}>Grants Management</NavItem>
              <NavItem href="/leases"   icon={<Building />}>Lease Register (IFRS 16)</NavItem>
            </NavDropdown>

            {/* ── Reports ──────────────────────────────────────────── */}
            <NavDropdown label="Reports">
              <NavSubMenu label="Financial Statements" icon={<FileBarChart2 />}>
                <NavItem href="/reports/income-statement"  icon={<TrendingUp />}>Income Statement</NavItem>
                <NavItem href="/reports/balance-sheet"     icon={<Scale />}>Balance Sheet</NavItem>
                <NavItem href="/reports/trial-balance"     icon={<BookOpen />}>Trial Balance</NavItem>
              </NavSubMenu>

              <NavSubMenu label="Management Accounting" icon={<LineChart />}>
                <NavItem href="/reports/budget-variance"        icon={<BarChart3 />}>Budget Variance</NavItem>
                <NavItem href="/reports/cost-analysis"          icon={<BarChart3 />}>Cost Analysis</NavItem>
                <NavItem href="/reports/project-profitability"  icon={<TrendingUp />}>Project Profitability</NavItem>
                <NavItem href="/reports/forecasting"            icon={<Waves />}>Smart Forecasting</NavItem>
              </NavSubMenu>

              <NavSubMenu label="Cashflow & Aging" icon={<Wallet />}>
                <NavItem href="/reports/cashflow"           icon={<ArrowLeftRight />}>Cashflow Statement</NavItem>
                <NavItem href="/reports/aged-receivables"   icon={<Clock3 />}>Aged Receivables</NavItem>
                <NavItem href="/reports/aged-payables"      icon={<Clock3 />}>Aged Payables</NavItem>
              </NavSubMenu>

              <NavSubMenu label="Analysis" icon={<Tags />}>
                <NavItem href="/reports/tagged-transactions"      icon={<FileSearch />}>Tagged Transactions</NavItem>
                <NavItem href="/reports/analysis-code-breakdown"  icon={<Tags />}>Analysis Code Breakdown</NavItem>
              </NavSubMenu>

              <Divider />

              <NavSubMenu label="Tax Reports" icon={<BadgePercent />}>
                <NavItem href="/tax/vat-mtd"          icon={<FileText />}>VAT Report</NavItem>
                <NavItem href="/tax/corporation-tax"  icon={<Banknote />}>Corporation Tax Report</NavItem>
              </NavSubMenu>
            </NavDropdown>

            {/* ── Payroll ──────────────────────────────────────────── */}
            <NavDropdown label="Payroll">
              <NavSubMenu label="Employees" icon={<Users />}>
                <NavItem href="/payroll/employees"    icon={<Users />}>Employees</NavItem>
                <NavItem href="/payroll/leave"        icon={<Calendar />}>Leave</NavItem>
                <NavItem href="/payroll/timesheets"   icon={<Clock />}>Timesheets</NavItem>
              </NavSubMenu>

              <Divider />

              <NavSubMenu label="Payroll Run" icon={<Banknote />}>
                <NavItem href="/payroll/pay-salaries"        icon={<Banknote />}>Pay Salaries &amp; Wages</NavItem>
                <NavItem href="/payroll/pension-submission"  icon={<ShieldCheck />}>Pension Submission</NavItem>
                <NavItem href="/payroll/rti-submission"      icon={<Send />}>RTI Submission</NavItem>
                <NavItem href="/payroll/taxes-submission"    icon={<BadgePercent />}>Taxes Submission</NavItem>
              </NavSubMenu>

              <Divider />
              <NavItem href="/payroll/settings" icon={<Settings2 />}>Payroll Settings</NavItem>
            </NavDropdown>

            {/* ── Tax (right-anchored, flyouts open left) ───────────── */}
            <NavDropdownRight label="Tax">
              <SectionLabel>VAT Returns</SectionLabel>
              <NavItem href="/tax/vat-mtd"      icon={<Send />}>MTD — Submit via Sumtise</NavItem>
              <NavItem href="/tax/vat-non-mtd"  icon={<FileText />}>Non-MTD Submission</NavItem>
              <Divider />
              <NavItem href="/tax/corporation-tax" icon={<Banknote />}>Corporation Tax</NavItem>
              <Divider />
              <NavItem href="/tax/settings" icon={<Settings2 />}>Tax Settings</NavItem>
            </NavDropdownRight>

            {/* ── AI ───────────────────────────────────────────────── */}
            <NavTopLink href="/ai" icon={<Sparkles className="h-3.5 w-3.5" style={{ color: BRAND }} />}>
              AI
            </NavTopLink>

            {/* ── Settings (right-anchored, flyouts open left) ──────── */}
            <NavDropdownRight label="Settings">
              <NavItem href="/settings"               icon={<LayoutGrid />}>All Settings</NavItem>
              <Divider />
              <NavItem href="/settings/profile"       icon={<UserCog />}>Profile</NavItem>
              <NavItem href="/settings/organisation"  icon={<Building2 />}>Organisation</NavItem>
              <NavItem href="/settings/integrations"  icon={<Globe />}>Integrations</NavItem>
              <NavItem href="/settings/billing"       icon={<CreditCard />}>Billing &amp; Plan</NavItem>
              <Divider />
              <NavSubMenu label="System &amp; Modules" icon={<LayoutGrid />}>
                <NavItem href="/settings/modules"         icon={<LayoutGrid />}>Module Settings</NavItem>
                <NavItem href="/settings/currency"        icon={<Globe />}>Multi-Currency / FX</NavItem>
                <NavItem href="/settings/payroll-coa"     icon={<GitBranch />}>Payroll COA</NavItem>
                <NavItem href="/settings/related-parties" icon={<Users />}>Related Parties</NavItem>
                <NavItem href="/settings/wga-codes"       icon={<Tags />}>WGA / CPID Codes</NavItem>
              </NavSubMenu>
            </NavDropdownRight>
          </div>

          {/* ── Right side: user avatar only ── */}
          <div className="flex items-center gap-2.5 shrink-0">
            <SignedIn>
              <UserButton afterSignOutUrl="/auth/signin" />
            </SignedIn>
            <SignedOut>
              <SignInButton>
                <button
                  className="text-sm font-medium text-white px-4 py-2 rounded-lg transition-opacity hover:opacity-90"
                  style={{ backgroundColor: BRAND }}
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
