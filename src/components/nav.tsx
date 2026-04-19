"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserButton, SignedIn, SignedOut, SignInButton } from "@clerk/nextjs"
import { trpc } from "@/lib/trpc-client"
import { Logo } from "@/components/logo"
import { ChevronDown } from "lucide-react"
import { useState } from "react"

const BRAND_BLUE = "#50B0E0"
const BRAND_DARK = "#1A1D24"

function NavDropdown({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group">
      <button className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-white hover:bg-[#50B0E0] rounded-lg transition-colors gap-1">
        {label}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      <div className="absolute top-full left-0 mt-1 min-w-56 bg-white rounded-xl shadow-lg border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
        <div className="py-1">{children}</div>
      </div>
    </div>
  )
}

function NavItem({ href, children, icon }: { href: string; children: React.ReactNode; icon?: React.ReactNode }) {
  const pathname = usePathname()
  const active = pathname === href
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors rounded-lg mx-1 ${
        active
          ? "bg-[#50B0E0]/10 text-[#50B0E0] font-medium"
          : "text-gray-700 hover:bg-[#50B0E0]/10 hover:text-[#50B0E0]"
      }`}
    >
      {icon && <span className="h-4 w-4 flex-shrink-0">{icon}</span>}
      {children}
    </Link>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1">
      {children}
    </div>
  )
}

function Divider() {
  return <div className="border-t border-gray-100 my-1" />
}

export function Nav() {
  const { data: organizations } = trpc.organization.getUserOrganizations.useQuery()
  const org = organizations?.[0]

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-screen-2xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <Logo size={28} showText={false} />
            <span className="text-lg font-bold tracking-tight" style={{ color: BRAND_BLUE }}>
              SUMTISE
            </span>
          </Link>

          {/* Main Nav */}
          <div className="hidden lg:flex items-center gap-1">
            <Link
              href="/"
              className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-white hover:bg-[#50B0E0] rounded-lg transition-colors"
            >
              Dashboard
            </Link>

            {/* Accounting */}
            <NavDropdown label="Accounting">
              <NavItem href="/invoices">Invoices</NavItem>
              <NavItem href="/expenses">Expenses</NavItem>
              <NavItem href="/expenses/payment-run">Payment Run</NavItem>
              <NavItem href="/banking/reconciliation">Bank Reconciliation</NavItem>
              <NavItem href="/reports/trial-balance">Trial Balance</NavItem>
              <NavItem href="/transactions/journal">Journals</NavItem>
              <NavItem href="/accounting/fixed-assets">Fixed Assets</NavItem>
              <NavItem href="/accounting/inventory">Inventory Management</NavItem>
              <Divider />
              <SectionLabel>Period End</SectionLabel>
              <NavItem href="/accounting/period-end">Period End &amp; Close</NavItem>
              <Divider />
              <SectionLabel>Accounting Settings</SectionLabel>
              <NavItem href="/settings/accounting">Accounting Settings</NavItem>
              <NavItem href="/settings/accounting/chart-of-accounts">Chart of Accounts</NavItem>
              <NavItem href="/settings/accounting/analysis-codes">Analysis Codes</NavItem>
            </NavDropdown>

            {/* Projects & Grants */}
            <NavDropdown label="Projects & Grants">
              <NavItem href="/projects">Project Accounting</NavItem>
              <NavItem href="/grants">Grants Management (NFP)</NavItem>
            </NavDropdown>

            {/* Reports */}
            <NavDropdown label="Reports">
              <SectionLabel>Financial Reporting</SectionLabel>
              <NavItem href="/reports/income-statement">Income Statement</NavItem>
              <NavItem href="/reports/balance-sheet">Balance Sheet</NavItem>
              <NavItem href="/reports/trial-balance">Trial Balance</NavItem>
              <Divider />
              <SectionLabel>Management Accounting</SectionLabel>
              <NavItem href="/reports/budget-variance">Budget Variance</NavItem>
              <NavItem href="/reports/cost-analysis">Cost Analysis</NavItem>
              <NavItem href="/reports/project-profitability">Project Profitability</NavItem>
              <NavItem href="/reports/forecasting">Smart Forecasting</NavItem>
              <Divider />
              <SectionLabel>Cashflow Reports</SectionLabel>
              <NavItem href="/reports/cashflow">Cashflow Statement</NavItem>
              <NavItem href="/reports/aged-receivables">Aged Receivables</NavItem>
              <NavItem href="/reports/aged-payables">Aged Payables</NavItem>
              <Divider />
              <SectionLabel>Tax Reports</SectionLabel>
              <NavItem href="/tax/vat-mtd">VAT Report</NavItem>
              <NavItem href="/tax/corporation-tax">Corporation Tax Report</NavItem>
            </NavDropdown>

            {/* Payroll */}
            <NavDropdown label="Payroll">
              <SectionLabel>Manage Employees</SectionLabel>
              <NavItem href="/payroll/employees">Employees</NavItem>
              <NavItem href="/payroll/leave">Leave</NavItem>
              <NavItem href="/payroll/timesheets">Timesheets</NavItem>
              <Divider />
              <SectionLabel>Payroll Processing</SectionLabel>
              <NavItem href="/payroll/pay-salaries">Pay Salaries and Wages</NavItem>
              <NavItem href="/payroll/pension-submission">Pension Submission</NavItem>
              <NavItem href="/payroll/rti-submission">RTI Submission</NavItem>
              <NavItem href="/payroll/taxes-submission">Taxes Submission</NavItem>
              <Divider />
              <SectionLabel>Payroll Settings</SectionLabel>
              <NavItem href="/payroll/settings">Payroll Settings</NavItem>
            </NavDropdown>

            {/* Tax */}
            <NavDropdown label="Tax">
              <NavItem href="/tax/vat-mtd">VAT Return – MTD Submit via Sumtise</NavItem>
              <NavItem href="/tax/vat-non-mtd">VAT Return – Non-Sumtise Submission</NavItem>
              <NavItem href="/tax/corporation-tax">Corporation Tax Computation</NavItem>
              <Divider />
              <SectionLabel>Tax Settings</SectionLabel>
              <NavItem href="/tax/settings">Tax Settings</NavItem>
            </NavDropdown>

            {/* Settings */}
            <NavDropdown label="Sumtise Settings">
              <NavItem href="/settings/profile">Profile</NavItem>
              <NavItem href="/settings/organisation">Organisation</NavItem>
              <NavItem href="/settings/integrations">Integrations</NavItem>
              <NavItem href="/settings/billing">Billing</NavItem>
            </NavDropdown>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {org && (
              <span className="hidden md:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                {org.name}
              </span>
            )}
            <SignedIn>
              <UserButton afterSignOutUrl="/auth/signin" />
            </SignedIn>
            <SignedOut>
              <SignInButton>
                <button
                  className="text-sm font-medium text-white px-4 py-2 rounded-lg"
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
