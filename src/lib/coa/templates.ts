/**
 * Chart of Accounts Templates
 *
 * FRS 102-aligned UK template (primary) plus lightweight stubs for
 * South Africa (IFRS for SMEs), Kenya (IFRS for SMEs) and Zambia (ZAS).
 *
 * `parentCode` is resolved to a real parentId after bulk-insert.
 * `isControlAccount` accounts may not be posted to directly — entries
 *  must go through the relevant sub-ledger (AR, AP, payroll, VAT).
 */

export type NormalBalance = "DR" | "CR"
export type VatTreatment =
  | "STANDARD_RATE"
  | "REDUCED_RATE"
  | "ZERO_RATE"
  | "EXEMPT"
  | "OUT_OF_SCOPE"
  | "NOT_APPLICABLE"
export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE"

export interface CoaEntry {
  code: string
  name: string
  type: AccountType
  subType: string
  normalBalance: NormalBalance
  description: string
  vatTreatment: VatTreatment
  parentCode: string | null
  isControlAccount?: boolean
}

// ─── UK — FRS 102 ────────────────────────────────────────────────────────────

export const UK_COA: CoaEntry[] = [

  // ══════════════════════════════════════════════════════════════════════════
  // ASSETS
  // ══════════════════════════════════════════════════════════════════════════

  // ── Fixed Assets ────────────────────────────────────────────────────────
  {
    code: "0010", name: "Fixed Assets", type: "ASSET",
    subType: "FIXED_ASSET", normalBalance: "DR",
    description: "Non-current tangible assets held for use in the business",
    vatTreatment: "NOT_APPLICABLE", parentCode: null,
  },
  {
    code: "0011", name: "Land & Property", type: "ASSET",
    subType: "FIXED_ASSET", normalBalance: "DR",
    description: "Freehold and leasehold land and property at cost",
    vatTreatment: "NOT_APPLICABLE", parentCode: "0010",
  },
  {
    code: "0012", name: "Plant & Equipment", type: "ASSET",
    subType: "FIXED_ASSET", normalBalance: "DR",
    description: "Plant, equipment and machinery at cost",
    vatTreatment: "NOT_APPLICABLE", parentCode: "0010",
  },
  {
    code: "0013", name: "Fixtures & Fittings", type: "ASSET",
    subType: "FIXED_ASSET", normalBalance: "DR",
    description: "Fixtures, fittings and furniture at cost",
    vatTreatment: "NOT_APPLICABLE", parentCode: "0010",
  },
  {
    code: "0014", name: "Motor Vehicles", type: "ASSET",
    subType: "FIXED_ASSET", normalBalance: "DR",
    description: "Company motor vehicles at cost",
    vatTreatment: "NOT_APPLICABLE", parentCode: "0010",
  },
  {
    code: "0015", name: "Computer Equipment", type: "ASSET",
    subType: "FIXED_ASSET", normalBalance: "DR",
    description: "Computer hardware and peripherals at cost",
    vatTreatment: "NOT_APPLICABLE", parentCode: "0010",
  },
  {
    code: "0016", name: "ROU Assets — PPE", type: "ASSET",
    subType: "FIXED_ASSET", normalBalance: "DR",
    description: "Right-of-use assets recognised under FRS 102 Section 20 / IFRS 16 lease accounting",
    vatTreatment: "NOT_APPLICABLE", parentCode: "0010",
  },
  {
    code: "0017", name: "Assets Under Construction (AUC)", type: "ASSET",
    subType: "FIXED_ASSET", normalBalance: "DR",
    description: "Capital expenditure on assets not yet complete and ready for use; transferred to the relevant asset account on completion",
    vatTreatment: "NOT_APPLICABLE", parentCode: "0010",
  },
  {
    code: "0019", name: "Accumulated Depreciation", type: "ASSET",
    subType: "ACCUMULATED_DEPRECIATION", normalBalance: "CR",
    description: "Accumulated depreciation on all tangible fixed assets (contra-asset)",
    vatTreatment: "NOT_APPLICABLE", parentCode: "0010",
  },

  // ── Intangible Assets ───────────────────────────────────────────────────
  {
    code: "0030", name: "Intangible Assets", type: "ASSET",
    subType: "INTANGIBLE_ASSET", normalBalance: "DR",
    description: "Non-monetary assets without physical substance",
    vatTreatment: "NOT_APPLICABLE", parentCode: null,
  },
  {
    code: "0031", name: "Goodwill", type: "ASSET",
    subType: "INTANGIBLE_ASSET", normalBalance: "DR",
    description: "Purchased goodwill arising on business combinations",
    vatTreatment: "NOT_APPLICABLE", parentCode: "0030",
  },
  {
    code: "0032", name: "Patents & Trademarks", type: "ASSET",
    subType: "INTANGIBLE_ASSET", normalBalance: "DR",
    description: "Intellectual property rights at cost",
    vatTreatment: "NOT_APPLICABLE", parentCode: "0030",
  },
  {
    code: "0033", name: "Internally Developed Software", type: "ASSET",
    subType: "INTANGIBLE_ASSET", normalBalance: "DR",
    description: "Capitalised internal development costs for software projects meeting FRS 102 criteria",
    vatTreatment: "NOT_APPLICABLE", parentCode: "0030",
  },
  {
    code: "0039", name: "Accumulated Amortisation", type: "ASSET",
    subType: "ACCUMULATED_DEPRECIATION", normalBalance: "CR",
    description: "Accumulated amortisation on intangible assets (contra-asset)",
    vatTreatment: "NOT_APPLICABLE", parentCode: "0030",
  },

  // ── Investments ─────────────────────────────────────────────────────────
  {
    code: "0050", name: "Investments", type: "ASSET",
    subType: "INVESTMENT", normalBalance: "DR",
    description: "Long-term financial investments",
    vatTreatment: "NOT_APPLICABLE", parentCode: null,
  },
  {
    code: "0051", name: "Investments in Subsidiaries", type: "ASSET",
    subType: "INVESTMENT", normalBalance: "DR",
    description: "Cost of investments in subsidiary undertakings",
    vatTreatment: "NOT_APPLICABLE", parentCode: "0050",
  },
  {
    code: "0052", name: "Other Investments", type: "ASSET",
    subType: "INVESTMENT", normalBalance: "DR",
    description: "Equity holdings, bonds and other long-term financial assets",
    vatTreatment: "NOT_APPLICABLE", parentCode: "0050",
  },

  // ── Current Assets ──────────────────────────────────────────────────────
  {
    code: "1000", name: "Current Assets", type: "ASSET",
    subType: "CURRENT_ASSET", normalBalance: "DR",
    description: "Assets expected to be realised within 12 months",
    vatTreatment: "NOT_APPLICABLE", parentCode: null,
  },

  // Inventory
  {
    code: "1100", name: "Stock & Work in Progress", type: "ASSET",
    subType: "INVENTORY", normalBalance: "DR",
    description: "Goods held for sale and work in progress at lower of cost or NRV — inventory control account",
    vatTreatment: "NOT_APPLICABLE", parentCode: "1000",
    isControlAccount: true,
  },
  {
    code: "1110", name: "Stock", type: "ASSET",
    subType: "INVENTORY", normalBalance: "DR",
    description: "Raw materials and finished goods",
    vatTreatment: "NOT_APPLICABLE", parentCode: "1100",
  },
  {
    code: "1115", name: "Work in Progress", type: "ASSET",
    subType: "INVENTORY", normalBalance: "DR",
    description: "Long-term contract work in progress",
    vatTreatment: "NOT_APPLICABLE", parentCode: "1100",
  },

  // Receivables — control account
  {
    code: "1200", name: "Trade Debtors", type: "ASSET",
    subType: "TRADE_DEBTOR", normalBalance: "DR",
    description: "Amounts owed by customers for goods and services supplied — sales ledger control account",
    vatTreatment: "NOT_APPLICABLE", parentCode: "1000",
    isControlAccount: true,
  },
  {
    code: "1205", name: "Provision for Bad & Doubtful Debts", type: "ASSET",
    subType: "TRADE_DEBTOR", normalBalance: "CR",
    description: "Allowance for expected credit losses on trade debtors (contra-asset)",
    vatTreatment: "NOT_APPLICABLE", parentCode: "1200",
  },
  {
    code: "1210", name: "Other Debtors", type: "ASSET",
    subType: "CURRENT_ASSET", normalBalance: "DR",
    description: "Other amounts receivable not classified as trade debtors",
    vatTreatment: "NOT_APPLICABLE", parentCode: "1000",
  },
  {
    code: "1215", name: "Staff Debtors & Loans", type: "ASSET",
    subType: "CURRENT_ASSET", normalBalance: "DR",
    description: "Salary advances, season ticket loans and other employee receivables",
    vatTreatment: "NOT_APPLICABLE", parentCode: "1000",
  },
  {
    code: "1220", name: "Prepayments", type: "ASSET",
    subType: "PREPAYMENT", normalBalance: "DR",
    description: "Payments made in advance of the period to which they relate",
    vatTreatment: "NOT_APPLICABLE", parentCode: "1000",
  },
  {
    code: "1225", name: "Accrued Income", type: "ASSET",
    subType: "CURRENT_ASSET", normalBalance: "DR",
    description: "Revenue earned but not yet invoiced at period end",
    vatTreatment: "NOT_APPLICABLE", parentCode: "1000",
  },
  {
    code: "1230", name: "VAT Recoverable (Input Tax)", type: "ASSET",
    subType: "VAT_ASSET", normalBalance: "DR",
    description: "VAT paid on purchases recoverable from HMRC — VAT control account",
    vatTreatment: "NOT_APPLICABLE", parentCode: "1000",
    isControlAccount: true,
  },
  {
    code: "1240", name: "Corporation Tax Recoverable", type: "ASSET",
    subType: "CURRENT_ASSET", normalBalance: "DR",
    description: "Overpaid corporation tax or R&D tax credit repayable by HMRC",
    vatTreatment: "NOT_APPLICABLE", parentCode: "1000",
  },

  // Cash & Bank
  {
    code: "1300", name: "Cash & Bank", type: "ASSET",
    subType: "CASH_AND_BANK", normalBalance: "DR",
    description: "Cash in hand and balances held at financial institutions",
    vatTreatment: "NOT_APPLICABLE", parentCode: "1000",
  },
  {
    code: "1310", name: "Bank — Current Account", type: "ASSET",
    subType: "CASH_AND_BANK", normalBalance: "DR",
    description: "Main business current account",
    vatTreatment: "NOT_APPLICABLE", parentCode: "1300",
  },
  {
    code: "1320", name: "Bank — Savings Account", type: "ASSET",
    subType: "CASH_AND_BANK", normalBalance: "DR",
    description: "Business savings or deposit account",
    vatTreatment: "NOT_APPLICABLE", parentCode: "1300",
  },
  {
    code: "1330", name: "Petty Cash", type: "ASSET",
    subType: "CASH_AND_BANK", normalBalance: "DR",
    description: "Small cash float held on the premises",
    vatTreatment: "NOT_APPLICABLE", parentCode: "1300",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // LIABILITIES
  // ══════════════════════════════════════════════════════════════════════════

  // ── Current Liabilities ─────────────────────────────────────────────────
  {
    code: "2000", name: "Current Liabilities", type: "LIABILITY",
    subType: "CURRENT_LIABILITY", normalBalance: "CR",
    description: "Obligations due within 12 months",
    vatTreatment: "NOT_APPLICABLE", parentCode: null,
  },

  // Payables — control account
  {
    code: "2100", name: "Trade Creditors", type: "LIABILITY",
    subType: "TRADE_CREDITOR", normalBalance: "CR",
    description: "Amounts owed to suppliers for goods and services received — purchase ledger control account",
    vatTreatment: "NOT_APPLICABLE", parentCode: "2000",
    isControlAccount: true,
  },
  {
    code: "2110", name: "Other Creditors", type: "LIABILITY",
    subType: "CURRENT_LIABILITY", normalBalance: "CR",
    description: "Other amounts payable not classified as trade creditors",
    vatTreatment: "NOT_APPLICABLE", parentCode: "2000",
  },
  {
    code: "2120", name: "Accruals", type: "LIABILITY",
    subType: "ACCRUAL", normalBalance: "CR",
    description: "Costs incurred but not yet invoiced at period end",
    vatTreatment: "NOT_APPLICABLE", parentCode: "2000",
  },
  {
    code: "2130", name: "Deferred Income", type: "LIABILITY",
    subType: "DEFERRED_INCOME", normalBalance: "CR",
    description: "Income received in advance of the period to which it relates",
    vatTreatment: "NOT_APPLICABLE", parentCode: "2000",
  },

  // VAT — control accounts
  {
    code: "2200", name: "VAT Liability (Output Tax)", type: "LIABILITY",
    subType: "VAT_LIABILITY", normalBalance: "CR",
    description: "VAT collected on sales and payable to HMRC — VAT output control account",
    vatTreatment: "NOT_APPLICABLE", parentCode: "2000",
    isControlAccount: true,
  },

  // Payroll liabilities — control accounts
  {
    code: "2210", name: "PAYE & NI Payable", type: "LIABILITY",
    subType: "PAYE_LIABILITY", normalBalance: "CR",
    description: "Income tax (PAYE) and National Insurance contributions due to HMRC — payroll control account",
    vatTreatment: "NOT_APPLICABLE", parentCode: "2000",
    isControlAccount: true,
  },
  {
    code: "2220", name: "Pension Contributions Payable", type: "LIABILITY",
    subType: "CURRENT_LIABILITY", normalBalance: "CR",
    description: "Employer and employee pension contributions not yet remitted — payroll control account",
    vatTreatment: "NOT_APPLICABLE", parentCode: "2000",
    isControlAccount: true,
  },
  {
    code: "2225", name: "Net Wages Payable", type: "LIABILITY",
    subType: "CURRENT_LIABILITY", normalBalance: "CR",
    description: "Net pay owed to employees not yet paid",
    vatTreatment: "NOT_APPLICABLE", parentCode: "2000",
  },

  // Tax liabilities
  {
    code: "2230", name: "Corporation Tax Payable", type: "LIABILITY",
    subType: "TAX_LIABILITY", normalBalance: "CR",
    description: "Corporation tax due to HMRC for the current accounting period — tax control account",
    vatTreatment: "NOT_APPLICABLE", parentCode: "2000",
    isControlAccount: true,
  },
  {
    code: "2235", name: "Deferred Tax (Current)", type: "LIABILITY",
    subType: "TAX_LIABILITY", normalBalance: "CR",
    description: "Short-term deferred tax liabilities due within 12 months",
    vatTreatment: "NOT_APPLICABLE", parentCode: "2000",
  },

  // Other current liabilities
  {
    code: "2240", name: "Directors' Loan Account", type: "LIABILITY",
    subType: "CURRENT_LIABILITY", normalBalance: "CR",
    description: "Net balance owed to or from directors (credit = owed to directors)",
    vatTreatment: "NOT_APPLICABLE", parentCode: "2000",
  },
  {
    code: "2250", name: "Bank Overdraft", type: "LIABILITY",
    subType: "BANK_OVERDRAFT", normalBalance: "CR",
    description: "Overdrawn balance on the bank current account",
    vatTreatment: "NOT_APPLICABLE", parentCode: "2000",
  },
  {
    code: "2260", name: "Short-term Loans", type: "LIABILITY",
    subType: "CURRENT_LIABILITY", normalBalance: "CR",
    description: "Loans and borrowings repayable within one year",
    vatTreatment: "NOT_APPLICABLE", parentCode: "2000",
  },

  // ── Long-term Liabilities ────────────────────────────────────────────────
  {
    code: "2500", name: "Long-term Liabilities", type: "LIABILITY",
    subType: "LONG_TERM_LIABILITY", normalBalance: "CR",
    description: "Obligations due after more than 12 months",
    vatTreatment: "NOT_APPLICABLE", parentCode: null,
  },
  {
    code: "2510", name: "Long-term Bank Loans", type: "LIABILITY",
    subType: "LONG_TERM_LIABILITY", normalBalance: "CR",
    description: "Bank loans and mortgages repayable after one year",
    vatTreatment: "NOT_APPLICABLE", parentCode: "2500",
  },
  {
    code: "2520", name: "Lease Liabilities (IFRS 16 / FRS 102 S20)", type: "LIABILITY",
    subType: "FINANCE_LEASE", normalBalance: "CR",
    description: "Obligations under finance and operating leases recognised on balance sheet",
    vatTreatment: "NOT_APPLICABLE", parentCode: "2500",
  },
  {
    code: "2530", name: "Deferred Tax Liability", type: "LIABILITY",
    subType: "LONG_TERM_LIABILITY", normalBalance: "CR",
    description: "Deferred tax arising from timing differences",
    vatTreatment: "NOT_APPLICABLE", parentCode: "2500",
  },
  {
    code: "2540", name: "Provisions", type: "LIABILITY",
    subType: "LONG_TERM_LIABILITY", normalBalance: "CR",
    description: "Provisions for liabilities of uncertain timing or amount (e.g. dilapidations, warranties)",
    vatTreatment: "NOT_APPLICABLE", parentCode: "2500",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // EQUITY
  // ══════════════════════════════════════════════════════════════════════════

  {
    code: "3000", name: "Capital & Reserves", type: "EQUITY",
    subType: "EQUITY", normalBalance: "CR",
    description: "Shareholders' funds and reserves",
    vatTreatment: "NOT_APPLICABLE", parentCode: null,
  },
  {
    code: "3010", name: "Called Up Share Capital", type: "EQUITY",
    subType: "SHARE_CAPITAL", normalBalance: "CR",
    description: "Nominal value of shares issued and called up",
    vatTreatment: "NOT_APPLICABLE", parentCode: "3000",
  },
  {
    code: "3020", name: "Share Premium", type: "EQUITY",
    subType: "RESERVE", normalBalance: "CR",
    description: "Amount received above nominal value on issue of shares",
    vatTreatment: "NOT_APPLICABLE", parentCode: "3000",
  },
  {
    code: "3030", name: "Revaluation Reserve", type: "EQUITY",
    subType: "RESERVE", normalBalance: "CR",
    description: "Unrealised gains on revaluation of fixed assets",
    vatTreatment: "NOT_APPLICABLE", parentCode: "3000",
  },
  {
    code: "3040", name: "Other Reserves", type: "EQUITY",
    subType: "RESERVE", normalBalance: "CR",
    description: "Capital redemption, merger and other statutory reserves",
    vatTreatment: "NOT_APPLICABLE", parentCode: "3000",
  },
  {
    code: "3090", name: "Retained Earnings", type: "EQUITY",
    subType: "RETAINED_EARNINGS", normalBalance: "CR",
    description: "Accumulated profit or loss since incorporation",
    vatTreatment: "NOT_APPLICABLE", parentCode: "3000",
  },
  {
    code: "3091", name: "Dividends Paid", type: "EQUITY",
    subType: "RETAINED_EARNINGS", normalBalance: "DR",
    description: "Dividends distributed to shareholders (reduces retained earnings)",
    vatTreatment: "NOT_APPLICABLE", parentCode: "3090",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // REVENUE
  // ══════════════════════════════════════════════════════════════════════════

  // ── Turnover ─────────────────────────────────────────────────────────────
  {
    code: "4000", name: "Turnover", type: "REVENUE",
    subType: "SALES_INCOME", normalBalance: "CR",
    description: "Total revenue from ordinary activities (excluding VAT)",
    vatTreatment: "NOT_APPLICABLE", parentCode: null,
  },
  {
    code: "4010", name: "Sales — Standard Rate (20%)", type: "REVENUE",
    subType: "SALES_INCOME", normalBalance: "CR",
    description: "Revenue from goods and services subject to 20% VAT",
    vatTreatment: "STANDARD_RATE", parentCode: "4000",
  },
  {
    code: "4020", name: "Sales — Reduced Rate (5%)", type: "REVENUE",
    subType: "SALES_INCOME", normalBalance: "CR",
    description: "Revenue from goods and services subject to 5% VAT",
    vatTreatment: "REDUCED_RATE", parentCode: "4000",
  },
  {
    code: "4030", name: "Sales — Zero Rated", type: "REVENUE",
    subType: "SALES_INCOME", normalBalance: "CR",
    description: "Revenue from zero-rated goods and services (0% VAT)",
    vatTreatment: "ZERO_RATE", parentCode: "4000",
  },
  {
    code: "4040", name: "Sales — Exempt", type: "REVENUE",
    subType: "SALES_INCOME", normalBalance: "CR",
    description: "Revenue from VAT-exempt supplies (e.g. insurance, finance, education)",
    vatTreatment: "EXEMPT", parentCode: "4000",
  },
  {
    code: "4050", name: "Sales — Export / Outside Scope", type: "REVENUE",
    subType: "SALES_INCOME", normalBalance: "CR",
    description: "Revenue from exports outside the UK — outside scope of UK VAT",
    vatTreatment: "OUT_OF_SCOPE", parentCode: "4000",
  },
  {
    code: "4060", name: "Credit Notes Issued", type: "REVENUE",
    subType: "SALES_INCOME", normalBalance: "DR",
    description: "Returns and credit notes issued to customers (contra-revenue)",
    vatTreatment: "NOT_APPLICABLE", parentCode: "4000",
  },

  // ── Other Income ─────────────────────────────────────────────────────────
  {
    code: "4500", name: "Other Income", type: "REVENUE",
    subType: "OTHER_INCOME", normalBalance: "CR",
    description: "Income not arising from ordinary trading activities",
    vatTreatment: "NOT_APPLICABLE", parentCode: null,
  },
  {
    code: "4510", name: "Interest Received", type: "REVENUE",
    subType: "OTHER_INCOME", normalBalance: "CR",
    description: "Interest earned on bank deposits and loans",
    vatTreatment: "EXEMPT", parentCode: "4500",
  },
  {
    code: "4520", name: "Rental Income", type: "REVENUE",
    subType: "OTHER_INCOME", normalBalance: "CR",
    description: "Income from letting property or equipment",
    vatTreatment: "EXEMPT", parentCode: "4500",
  },
  {
    code: "4530", name: "Grant Income", type: "REVENUE",
    subType: "OTHER_INCOME", normalBalance: "CR",
    description: "Government and other grants recognised as income",
    vatTreatment: "EXEMPT", parentCode: "4500",
  },
  {
    code: "4540", name: "Gain on Disposal of Fixed Assets", type: "REVENUE",
    subType: "OTHER_INCOME", normalBalance: "CR",
    description: "Profit on sale of fixed assets above net book value",
    vatTreatment: "NOT_APPLICABLE", parentCode: "4500",
  },
  {
    code: "4550", name: "Foreign Exchange Gains", type: "REVENUE",
    subType: "OTHER_INCOME", normalBalance: "CR",
    description: "Realised and unrealised FX gains on monetary items",
    vatTreatment: "NOT_APPLICABLE", parentCode: "4500",
  },
  {
    code: "4560", name: "R&D Tax Credit Income", type: "REVENUE",
    subType: "OTHER_INCOME", normalBalance: "CR",
    description: "HMRC R&D tax credit received as a cash repayment (SME scheme / RDEC)",
    vatTreatment: "NOT_APPLICABLE", parentCode: "4500",
  },
  {
    code: "4570", name: "Miscellaneous Income", type: "REVENUE",
    subType: "OTHER_INCOME", normalBalance: "CR",
    description: "Other miscellaneous income not classified elsewhere",
    vatTreatment: "NOT_APPLICABLE", parentCode: "4500",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // EXPENSES
  // ══════════════════════════════════════════════════════════════════════════

  // ── Cost of Sales ────────────────────────────────────────────────────────
  {
    code: "5000", name: "Cost of Sales", type: "EXPENSE",
    subType: "COST_OF_SALES", normalBalance: "DR",
    description: "Direct costs attributable to the production of revenue",
    vatTreatment: "NOT_APPLICABLE", parentCode: null,
  },
  {
    code: "5010", name: "Materials & Direct Costs", type: "EXPENSE",
    subType: "COST_OF_SALES", normalBalance: "DR",
    description: "Raw materials and components consumed in production",
    vatTreatment: "STANDARD_RATE", parentCode: "5000",
  },
  {
    code: "5020", name: "Direct Labour", type: "EXPENSE",
    subType: "COST_OF_SALES", normalBalance: "DR",
    description: "Wages and salaries directly attributable to production",
    vatTreatment: "NOT_APPLICABLE", parentCode: "5000",
  },
  {
    code: "5030", name: "Subcontractors", type: "EXPENSE",
    subType: "COST_OF_SALES", normalBalance: "DR",
    description: "Third-party contractors used in delivering services or goods",
    vatTreatment: "STANDARD_RATE", parentCode: "5000",
  },
  {
    code: "5040", name: "Inbound Freight & Logistics", type: "EXPENSE",
    subType: "COST_OF_SALES", normalBalance: "DR",
    description: "Delivery, shipping and logistics costs on purchased goods",
    vatTreatment: "STANDARD_RATE", parentCode: "5000",
  },
  {
    code: "5050", name: "Packaging", type: "EXPENSE",
    subType: "COST_OF_SALES", normalBalance: "DR",
    description: "Packaging materials directly associated with goods sold",
    vatTreatment: "STANDARD_RATE", parentCode: "5000",
  },
  {
    code: "5060", name: "Warranty & Returns Costs", type: "EXPENSE",
    subType: "COST_OF_SALES", normalBalance: "DR",
    description: "Costs of warranty claims, product returns and remediation",
    vatTreatment: "STANDARD_RATE", parentCode: "5000",
  },

  // ── Salaries & Wages ─────────────────────────────────────────────────────
  {
    code: "6000", name: "Salaries & Wages", type: "EXPENSE",
    subType: "WAGES_SALARIES", normalBalance: "DR",
    description: "All employee and worker remuneration costs",
    vatTreatment: "NOT_APPLICABLE", parentCode: null,
  },
  {
    code: "6010", name: "Gross Salaries & Wages", type: "EXPENSE",
    subType: "WAGES_SALARIES", normalBalance: "DR",
    description: "Gross pay before deductions — permanent employees",
    vatTreatment: "NOT_APPLICABLE", parentCode: "6000",
  },
  {
    code: "6020", name: "Employers NI Contributions", type: "EXPENSE",
    subType: "WAGES_SALARIES", normalBalance: "DR",
    description: "Employer's National Insurance contributions",
    vatTreatment: "NOT_APPLICABLE", parentCode: "6000",
  },
  {
    code: "6025", name: "Apprenticeship Levy", type: "EXPENSE",
    subType: "WAGES_SALARIES", normalBalance: "DR",
    description: "0.5% levy on payroll >£3m paid to HMRC; offsets HMRC apprenticeship service account",
    vatTreatment: "NOT_APPLICABLE", parentCode: "6000",
  },
  {
    code: "6030", name: "Employer Pension Contributions", type: "EXPENSE",
    subType: "WAGES_SALARIES", normalBalance: "DR",
    description: "Employer contributions to workplace pension schemes (auto-enrolment and above)",
    vatTreatment: "NOT_APPLICABLE", parentCode: "6000",
  },
  {
    code: "6035", name: "Staff Benefits & Allowances", type: "EXPENSE",
    subType: "WAGES_SALARIES", normalBalance: "DR",
    description: "Taxable and non-taxable benefits: health insurance, life assurance, EAP, cycle-to-work",
    vatTreatment: "NOT_APPLICABLE", parentCode: "6000",
  },
  {
    code: "6040", name: "Staff Training & Development", type: "EXPENSE",
    subType: "WAGES_SALARIES", normalBalance: "DR",
    description: "Courses, qualifications, professional subscriptions and staff development",
    vatTreatment: "STANDARD_RATE", parentCode: "6000",
  },
  {
    code: "6045", name: "Staff Welfare & Team Events", type: "EXPENSE",
    subType: "WAGES_SALARIES", normalBalance: "DR",
    description: "Staff parties, team events, wellbeing programmes and social activities (subject to £150/head exempt limit)",
    vatTreatment: "STANDARD_RATE", parentCode: "6000",
  },
  {
    code: "6050", name: "Staff Recruitment", type: "EXPENSE",
    subType: "WAGES_SALARIES", normalBalance: "DR",
    description: "Recruitment agency fees, job boards and onboarding costs",
    vatTreatment: "STANDARD_RATE", parentCode: "6000",
  },
  {
    code: "6055", name: "Agency Staff", type: "EXPENSE",
    subType: "WAGES_SALARIES", normalBalance: "DR",
    description: "Temporary workers supplied via staffing agencies",
    vatTreatment: "STANDARD_RATE", parentCode: "6000",
  },
  {
    code: "6060", name: "Interim Staff & Contractors", type: "EXPENSE",
    subType: "WAGES_SALARIES", normalBalance: "DR",
    description: "Interim managers and independent contractors (non-PAYE workers engaged directly)",
    vatTreatment: "STANDARD_RATE", parentCode: "6000",
  },

  // ── Premises & Occupancy ─────────────────────────────────────────────────
  {
    code: "6100", name: "Premises & Occupancy", type: "EXPENSE",
    subType: "PREMISES", normalBalance: "DR",
    description: "Costs associated with business premises",
    vatTreatment: "NOT_APPLICABLE", parentCode: null,
  },
  {
    code: "6110", name: "Rent & Rates", type: "EXPENSE",
    subType: "PREMISES", normalBalance: "DR",
    description: "Rent payable and business rates on occupied premises",
    vatTreatment: "EXEMPT", parentCode: "6100",
  },
  {
    code: "6115", name: "Service Charges", type: "EXPENSE",
    subType: "PREMISES", normalBalance: "DR",
    description: "Building service charges, estate management and common area costs",
    vatTreatment: "STANDARD_RATE", parentCode: "6100",
  },
  {
    code: "6120", name: "Utilities", type: "EXPENSE",
    subType: "PREMISES", normalBalance: "DR",
    description: "Gas, electricity and water charges",
    vatTreatment: "STANDARD_RATE", parentCode: "6100",
  },
  {
    code: "6130", name: "Repairs & Maintenance", type: "EXPENSE",
    subType: "PREMISES", normalBalance: "DR",
    description: "Costs of maintaining and repairing premises and equipment",
    vatTreatment: "STANDARD_RATE", parentCode: "6100",
  },
  {
    code: "6140", name: "Insurance", type: "EXPENSE",
    subType: "PREMISES", normalBalance: "DR",
    description: "Buildings, contents, public liability and professional indemnity insurance premiums",
    vatTreatment: "EXEMPT", parentCode: "6100",
  },
  {
    code: "6145", name: "Security & Cleaning", type: "EXPENSE",
    subType: "PREMISES", normalBalance: "DR",
    description: "Commercial cleaning, waste disposal and security services",
    vatTreatment: "STANDARD_RATE", parentCode: "6100",
  },

  // ── Motor & Travel ───────────────────────────────────────────────────────
  {
    code: "6200", name: "Motor & Travel", type: "EXPENSE",
    subType: "MOTOR_TRAVEL", normalBalance: "DR",
    description: "Vehicle running costs and business travel expenses",
    vatTreatment: "NOT_APPLICABLE", parentCode: null,
  },
  {
    code: "6210", name: "Motor Vehicle Expenses", type: "EXPENSE",
    subType: "MOTOR_TRAVEL", normalBalance: "DR",
    description: "Fuel, servicing, tyres and MOT on company vehicles",
    vatTreatment: "STANDARD_RATE", parentCode: "6200",
  },
  {
    code: "6220", name: "Mileage — Staff Reimbursement", type: "EXPENSE",
    subType: "MOTOR_TRAVEL", normalBalance: "DR",
    description: "HMRC-approved mileage allowance reimbursed to employees",
    vatTreatment: "NOT_APPLICABLE", parentCode: "6200",
  },
  {
    code: "6230", name: "Travel & Subsistence", type: "EXPENSE",
    subType: "MOTOR_TRAVEL", normalBalance: "DR",
    description: "Rail, air, taxi fares, accommodation and meal allowances for business travel",
    vatTreatment: "STANDARD_RATE", parentCode: "6200",
  },
  {
    code: "6235", name: "International Travel", type: "EXPENSE",
    subType: "MOTOR_TRAVEL", normalBalance: "DR",
    description: "Overseas flights, hotels and expenses for international business trips",
    vatTreatment: "OUT_OF_SCOPE", parentCode: "6200",
  },

  // ── IT & Communications ──────────────────────────────────────────────────
  {
    code: "6300", name: "IT & Communications", type: "EXPENSE",
    subType: "IT_TECH", normalBalance: "DR",
    description: "Technology, software and communications costs",
    vatTreatment: "NOT_APPLICABLE", parentCode: null,
  },
  {
    code: "6310", name: "Software & SaaS Subscriptions", type: "EXPENSE",
    subType: "IT_TECH", normalBalance: "DR",
    description: "Cloud services, SaaS platforms, software licences and app subscriptions",
    vatTreatment: "STANDARD_RATE", parentCode: "6300",
  },
  {
    code: "6320", name: "Telephone & Broadband", type: "EXPENSE",
    subType: "IT_TECH", normalBalance: "DR",
    description: "Mobile, landline and internet connection charges",
    vatTreatment: "STANDARD_RATE", parentCode: "6300",
  },
  {
    code: "6325", name: "Cloud Infrastructure & Hosting", type: "EXPENSE",
    subType: "IT_TECH", normalBalance: "DR",
    description: "AWS, Azure, GCP and other cloud compute, storage and networking costs",
    vatTreatment: "STANDARD_RATE", parentCode: "6300",
  },
  {
    code: "6330", name: "Website & Domain", type: "EXPENSE",
    subType: "IT_TECH", normalBalance: "DR",
    description: "Domain registration, web hosting and website maintenance",
    vatTreatment: "STANDARD_RATE", parentCode: "6300",
  },
  {
    code: "6335", name: "Cybersecurity", type: "EXPENSE",
    subType: "IT_TECH", normalBalance: "DR",
    description: "Security software, penetration testing, compliance tools and incident response",
    vatTreatment: "STANDARD_RATE", parentCode: "6300",
  },
  {
    code: "6340", name: "IT Support & Managed Services", type: "EXPENSE",
    subType: "IT_TECH", normalBalance: "DR",
    description: "Helpdesk, managed service provider (MSP) contracts and IT support retainers",
    vatTreatment: "STANDARD_RATE", parentCode: "6300",
  },

  // ── AI & Automation ──────────────────────────────────────────────────────
  {
    code: "6350", name: "AI & Automation", type: "EXPENSE",
    subType: "IT_TECH", normalBalance: "DR",
    description: "Artificial intelligence tools, models, automation and intelligent process automation costs",
    vatTreatment: "NOT_APPLICABLE", parentCode: null,
  },
  {
    code: "6351", name: "AI Tool Subscriptions", type: "EXPENSE",
    subType: "IT_TECH", normalBalance: "DR",
    description: "SaaS AI assistants, copilots and productivity tools (e.g. ChatGPT, Claude, Copilot, Gemini)",
    vatTreatment: "STANDARD_RATE", parentCode: "6350",
  },
  {
    code: "6352", name: "AI API & Model Costs", type: "EXPENSE",
    subType: "IT_TECH", normalBalance: "DR",
    description: "Pay-per-use API costs for AI and LLM providers (OpenAI, Anthropic, Google, Mistral, etc.)",
    vatTreatment: "STANDARD_RATE", parentCode: "6350",
  },
  {
    code: "6353", name: "Automation & RPA Software", type: "EXPENSE",
    subType: "IT_TECH", normalBalance: "DR",
    description: "Robotic process automation (RPA) platforms, workflow automation and no-code tooling",
    vatTreatment: "STANDARD_RATE", parentCode: "6350",
  },
  {
    code: "6354", name: "Data & Analytics Platforms", type: "EXPENSE",
    subType: "IT_TECH", normalBalance: "DR",
    description: "Business intelligence, data warehousing and analytics tools",
    vatTreatment: "STANDARD_RATE", parentCode: "6350",
  },

  // ── Admin & Office ───────────────────────────────────────────────────────
  {
    code: "6400", name: "Admin & Office", type: "EXPENSE",
    subType: "ADMIN_OFFICE", normalBalance: "DR",
    description: "General office and administration costs",
    vatTreatment: "NOT_APPLICABLE", parentCode: null,
  },
  {
    code: "6410", name: "Office Supplies & Stationery", type: "EXPENSE",
    subType: "ADMIN_OFFICE", normalBalance: "DR",
    description: "Paper, printing consumables and general office supplies",
    vatTreatment: "STANDARD_RATE", parentCode: "6400",
  },
  {
    code: "6420", name: "Postage & Courier", type: "EXPENSE",
    subType: "ADMIN_OFFICE", normalBalance: "DR",
    description: "Postage stamps, courier and delivery charges",
    vatTreatment: "ZERO_RATE", parentCode: "6400",
  },
  {
    code: "6430", name: "Printing & Reproduction", type: "EXPENSE",
    subType: "ADMIN_OFFICE", normalBalance: "DR",
    description: "Printing, photocopying and document reproduction costs",
    vatTreatment: "STANDARD_RATE", parentCode: "6400",
  },

  // ── Professional & Legal ─────────────────────────────────────────────────
  {
    code: "6500", name: "Professional & Legal", type: "EXPENSE",
    subType: "PROFESSIONAL", normalBalance: "DR",
    description: "External professional advisory and legal costs",
    vatTreatment: "NOT_APPLICABLE", parentCode: null,
  },
  {
    code: "6510", name: "Accountancy & Audit Fees", type: "EXPENSE",
    subType: "PROFESSIONAL", normalBalance: "DR",
    description: "Fees for external accountants, tax advisers and statutory auditors",
    vatTreatment: "STANDARD_RATE", parentCode: "6500",
  },
  {
    code: "6520", name: "Legal Fees", type: "EXPENSE",
    subType: "PROFESSIONAL", normalBalance: "DR",
    description: "Solicitors and legal advisory fees",
    vatTreatment: "STANDARD_RATE", parentCode: "6500",
  },
  {
    code: "6530", name: "Consultancy Fees", type: "EXPENSE",
    subType: "PROFESSIONAL", normalBalance: "DR",
    description: "Management consultancy and specialist advisory fees",
    vatTreatment: "STANDARD_RATE", parentCode: "6500",
  },
  {
    code: "6535", name: "HR & People Advisory", type: "EXPENSE",
    subType: "PROFESSIONAL", normalBalance: "DR",
    description: "External HR consultants, employment law advice and people analytics",
    vatTreatment: "STANDARD_RATE", parentCode: "6500",
  },
  {
    code: "6540", name: "Bank & Finance Charges", type: "EXPENSE",
    subType: "PROFESSIONAL", normalBalance: "DR",
    description: "Bank account transaction fees, card processing and payment gateway charges",
    vatTreatment: "EXEMPT", parentCode: "6500",
  },
  {
    code: "6545", name: "Regulatory & Compliance Fees", type: "EXPENSE",
    subType: "PROFESSIONAL", normalBalance: "DR",
    description: "FCA, ICO, Companies House and other regulatory fees and levies",
    vatTreatment: "EXEMPT", parentCode: "6500",
  },

  // ── Sales & Marketing ────────────────────────────────────────────────────
  {
    code: "6600", name: "Sales & Marketing", type: "EXPENSE",
    subType: "SALES_MARKETING", normalBalance: "DR",
    description: "Costs of promoting and selling the business",
    vatTreatment: "NOT_APPLICABLE", parentCode: null,
  },
  {
    code: "6610", name: "Digital Advertising", type: "EXPENSE",
    subType: "SALES_MARKETING", normalBalance: "DR",
    description: "Paid social, search (Google Ads, Meta, LinkedIn) and programmatic advertising",
    vatTreatment: "STANDARD_RATE", parentCode: "6600",
  },
  {
    code: "6615", name: "Print & Offline Marketing", type: "EXPENSE",
    subType: "SALES_MARKETING", normalBalance: "DR",
    description: "Brochures, direct mail, outdoor and print advertising",
    vatTreatment: "STANDARD_RATE", parentCode: "6600",
  },
  {
    code: "6620", name: "PR & Communications", type: "EXPENSE",
    subType: "SALES_MARKETING", normalBalance: "DR",
    description: "Public relations retainers, press releases and media relations",
    vatTreatment: "STANDARD_RATE", parentCode: "6600",
  },
  {
    code: "6625", name: "Events & Exhibitions", type: "EXPENSE",
    subType: "SALES_MARKETING", normalBalance: "DR",
    description: "Trade show stands, conference attendance and corporate event hosting",
    vatTreatment: "STANDARD_RATE", parentCode: "6600",
  },
  {
    code: "6630", name: "Client Entertainment", type: "EXPENSE",
    subType: "SALES_MARKETING", normalBalance: "DR",
    description: "Client meals, hospitality and gifts — note: generally not deductible for corporation tax",
    vatTreatment: "STANDARD_RATE", parentCode: "6600",
  },
  {
    code: "6635", name: "Sponsorship", type: "EXPENSE",
    subType: "SALES_MARKETING", normalBalance: "DR",
    description: "Commercial sponsorship of events, teams or content for brand awareness",
    vatTreatment: "STANDARD_RATE", parentCode: "6600",
  },
  {
    code: "6640", name: "Market Research", type: "EXPENSE",
    subType: "SALES_MARKETING", normalBalance: "DR",
    description: "Customer surveys, focus groups and market intelligence services",
    vatTreatment: "STANDARD_RATE", parentCode: "6600",
  },

  // ── Research & Development ───────────────────────────────────────────────
  {
    code: "6650", name: "Research & Development", type: "EXPENSE",
    subType: "RESEARCH_DEVELOPMENT", normalBalance: "DR",
    description: "Expenditure on scientific and technological R&D — track separately for HMRC R&D tax credit claims (RDEC / SME scheme)",
    vatTreatment: "NOT_APPLICABLE", parentCode: null,
  },
  {
    code: "6651", name: "R&D Staff Costs", type: "EXPENSE",
    subType: "RESEARCH_DEVELOPMENT", normalBalance: "DR",
    description: "Salaries, NI and pension for staff directly engaged in qualifying R&D activities",
    vatTreatment: "NOT_APPLICABLE", parentCode: "6650",
  },
  {
    code: "6652", name: "R&D Materials & Consumables", type: "EXPENSE",
    subType: "RESEARCH_DEVELOPMENT", normalBalance: "DR",
    description: "Materials, components and consumables used up in R&D projects",
    vatTreatment: "STANDARD_RATE", parentCode: "6650",
  },
  {
    code: "6653", name: "R&D Subcontractors & Freelancers", type: "EXPENSE",
    subType: "RESEARCH_DEVELOPMENT", normalBalance: "DR",
    description: "External R&D contractors and qualifying payments to externally provided workers",
    vatTreatment: "STANDARD_RATE", parentCode: "6650",
  },
  {
    code: "6654", name: "R&D Software & Cloud Costs", type: "EXPENSE",
    subType: "RESEARCH_DEVELOPMENT", normalBalance: "DR",
    description: "Cloud compute and software licences used solely in qualifying R&D",
    vatTreatment: "STANDARD_RATE", parentCode: "6650",
  },

  // ── Depreciation & Amortisation ──────────────────────────────────────────
  {
    code: "6700", name: "Depreciation & Amortisation", type: "EXPENSE",
    subType: "DEPRECIATION", normalBalance: "DR",
    description: "Systematic allocation of asset costs over useful economic life",
    vatTreatment: "NOT_APPLICABLE", parentCode: null,
  },
  {
    code: "6710", name: "Depreciation — Tangible Assets", type: "EXPENSE",
    subType: "DEPRECIATION", normalBalance: "DR",
    description: "Annual depreciation charge on plant, equipment and vehicles",
    vatTreatment: "NOT_APPLICABLE", parentCode: "6700",
  },
  {
    code: "6715", name: "Depreciation — ROU Assets", type: "EXPENSE",
    subType: "DEPRECIATION", normalBalance: "DR",
    description: "Depreciation charge on right-of-use assets (IFRS 16 / FRS 102 S20)",
    vatTreatment: "NOT_APPLICABLE", parentCode: "6700",
  },
  {
    code: "6720", name: "Amortisation — Intangible Assets", type: "EXPENSE",
    subType: "DEPRECIATION", normalBalance: "DR",
    description: "Annual amortisation charge on goodwill and other intangibles",
    vatTreatment: "NOT_APPLICABLE", parentCode: "6700",
  },
  {
    code: "6725", name: "Impairment Losses", type: "EXPENSE",
    subType: "DEPRECIATION", normalBalance: "DR",
    description: "Write-downs of fixed and intangible assets to recoverable amount",
    vatTreatment: "NOT_APPLICABLE", parentCode: "6700",
  },

  // ── Finance Costs ────────────────────────────────────────────────────────
  {
    code: "6800", name: "Finance Costs", type: "EXPENSE",
    subType: "FINANCE_COST", normalBalance: "DR",
    description: "Interest and finance charges",
    vatTreatment: "NOT_APPLICABLE", parentCode: null,
  },
  {
    code: "6810", name: "Bank Interest Paid", type: "EXPENSE",
    subType: "FINANCE_COST", normalBalance: "DR",
    description: "Interest charged on overdrafts and bank loans",
    vatTreatment: "EXEMPT", parentCode: "6800",
  },
  {
    code: "6820", name: "Loan Interest", type: "EXPENSE",
    subType: "FINANCE_COST", normalBalance: "DR",
    description: "Interest on term loans and other borrowings",
    vatTreatment: "EXEMPT", parentCode: "6800",
  },
  {
    code: "6825", name: "Lease Interest (IFRS 16 / S20)", type: "EXPENSE",
    subType: "FINANCE_COST", normalBalance: "DR",
    description: "Interest element of lease liability unwinding under IFRS 16 / FRS 102 S20",
    vatTreatment: "EXEMPT", parentCode: "6800",
  },
  {
    code: "6830", name: "Foreign Exchange Losses", type: "EXPENSE",
    subType: "FINANCE_COST", normalBalance: "DR",
    description: "Realised and unrealised FX losses on monetary items",
    vatTreatment: "NOT_APPLICABLE", parentCode: "6800",
  },
  {
    code: "6835", name: "Factoring & Invoice Finance Charges", type: "EXPENSE",
    subType: "FINANCE_COST", normalBalance: "DR",
    description: "Fees and interest on invoice discounting and factoring facilities",
    vatTreatment: "EXEMPT", parentCode: "6800",
  },

  // ── Other Charges ────────────────────────────────────────────────────────
  {
    code: "6900", name: "Other Charges", type: "EXPENSE",
    subType: "OTHER_EXPENSE", normalBalance: "DR",
    description: "Charges not classified elsewhere",
    vatTreatment: "NOT_APPLICABLE", parentCode: null,
  },
  {
    code: "6910", name: "Bad Debt Write-off", type: "EXPENSE",
    subType: "OTHER_EXPENSE", normalBalance: "DR",
    description: "Trade debts written off as irrecoverable",
    vatTreatment: "NOT_APPLICABLE", parentCode: "6900",
  },
  {
    code: "6915", name: "Movement in Bad Debt Provision", type: "EXPENSE",
    subType: "OTHER_EXPENSE", normalBalance: "DR",
    description: "Increase or decrease in the provision for bad and doubtful debts",
    vatTreatment: "NOT_APPLICABLE", parentCode: "6900",
  },
  {
    code: "6920", name: "Sundry Expenses", type: "EXPENSE",
    subType: "OTHER_EXPENSE", normalBalance: "DR",
    description: "Minor miscellaneous business expenses not classified above",
    vatTreatment: "STANDARD_RATE", parentCode: "6900",
  },
  {
    code: "6925", name: "Charitable Donations & CSR", type: "EXPENSE",
    subType: "OTHER_EXPENSE", normalBalance: "DR",
    description: "Qualifying charitable donations and corporate social responsibility expenditure",
    vatTreatment: "NOT_APPLICABLE", parentCode: "6900",
  },
  {
    code: "6930", name: "Restructuring & Redundancy Costs", type: "EXPENSE",
    subType: "OTHER_EXPENSE", normalBalance: "DR",
    description: "Reorganisation costs, statutory and enhanced redundancy payments",
    vatTreatment: "NOT_APPLICABLE", parentCode: "6900",
  },
  {
    code: "6935", name: "Corporation Tax Charge", type: "EXPENSE",
    subType: "OTHER_EXPENSE", normalBalance: "DR",
    description: "Current year corporation tax expense per the tax computation",
    vatTreatment: "NOT_APPLICABLE", parentCode: "6900",
  },
]

// ─── South Africa — IFRS for SMEs stub ───────────────────────────────────────

export const SOUTH_AFRICA_COA: CoaEntry[] = [
  { code: "1000", name: "Non-current Assets",        type: "ASSET",     subType: "FIXED_ASSET",        normalBalance: "DR", description: "Assets with useful life > 12 months",            vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "1100", name: "Property, Plant & Equipment",type: "ASSET",    subType: "FIXED_ASSET",        normalBalance: "DR", description: "Tangible non-current assets at cost",            vatTreatment: "NOT_APPLICABLE", parentCode: "1000" },
  { code: "1200", name: "Intangible Assets",          type: "ASSET",     subType: "INTANGIBLE_ASSET",   normalBalance: "DR", description: "Non-monetary assets without physical substance",  vatTreatment: "NOT_APPLICABLE", parentCode: "1000" },
  { code: "2000", name: "Current Assets",             type: "ASSET",     subType: "CURRENT_ASSET",      normalBalance: "DR", description: "Assets realisable within 12 months",             vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "2100", name: "Inventories",                type: "ASSET",     subType: "INVENTORY",          normalBalance: "DR", description: "Raw materials, WIP and finished goods",          vatTreatment: "NOT_APPLICABLE", parentCode: "2000" },
  { code: "2200", name: "Trade & Other Receivables",  type: "ASSET",     subType: "TRADE_DEBTOR",       normalBalance: "DR", description: "Amounts owed by customers",                      vatTreatment: "NOT_APPLICABLE", parentCode: "2000", isControlAccount: true },
  { code: "2300", name: "Cash & Cash Equivalents",    type: "ASSET",     subType: "CASH_AND_BANK",      normalBalance: "DR", description: "Bank balances and cash on hand",                 vatTreatment: "NOT_APPLICABLE", parentCode: "2000" },
  { code: "3000", name: "Equity",                     type: "EQUITY",    subType: "EQUITY",             normalBalance: "CR", description: "Shareholders' funds",                            vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "3100", name: "Share Capital",              type: "EQUITY",    subType: "SHARE_CAPITAL",      normalBalance: "CR", description: "Issued share capital",                           vatTreatment: "NOT_APPLICABLE", parentCode: "3000" },
  { code: "3200", name: "Retained Income",            type: "EQUITY",    subType: "RETAINED_EARNINGS",  normalBalance: "CR", description: "Accumulated profits",                            vatTreatment: "NOT_APPLICABLE", parentCode: "3000" },
  { code: "4000", name: "Non-current Liabilities",   type: "LIABILITY", subType: "LONG_TERM_LIABILITY", normalBalance: "CR", description: "Obligations due after 12 months",               vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "4100", name: "Long-term Borrowings",       type: "LIABILITY", subType: "LONG_TERM_LIABILITY", normalBalance: "CR", description: "Loans repayable after one year",                vatTreatment: "NOT_APPLICABLE", parentCode: "4000" },
  { code: "5000", name: "Current Liabilities",        type: "LIABILITY", subType: "CURRENT_LIABILITY",  normalBalance: "CR", description: "Obligations due within 12 months",               vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "5100", name: "Trade & Other Payables",     type: "LIABILITY", subType: "TRADE_CREDITOR",     normalBalance: "CR", description: "Amounts owed to suppliers",                      vatTreatment: "NOT_APPLICABLE", parentCode: "5000", isControlAccount: true },
  { code: "5200", name: "VAT Payable",                type: "LIABILITY", subType: "VAT_LIABILITY",      normalBalance: "CR", description: "VAT collected and payable to SARS",              vatTreatment: "NOT_APPLICABLE", parentCode: "5000", isControlAccount: true },
  { code: "6000", name: "Revenue",                    type: "REVENUE",   subType: "SALES_INCOME",       normalBalance: "CR", description: "Turnover from ordinary activities",              vatTreatment: "STANDARD_RATE",  parentCode: null },
  { code: "7000", name: "Cost of Sales",              type: "EXPENSE",   subType: "COST_OF_SALES",      normalBalance: "DR", description: "Direct cost of goods and services sold",         vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "8000", name: "Operating Expenses",         type: "EXPENSE",   subType: "ADMIN_OFFICE",       normalBalance: "DR", description: "Indirect business expenses",                    vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "8100", name: "Employee Costs",             type: "EXPENSE",   subType: "WAGES_SALARIES",     normalBalance: "DR", description: "Salaries, wages and related costs",              vatTreatment: "NOT_APPLICABLE", parentCode: "8000" },
  { code: "8200", name: "Depreciation",               type: "EXPENSE",   subType: "DEPRECIATION",       normalBalance: "DR", description: "Depreciation and amortisation charges",          vatTreatment: "NOT_APPLICABLE", parentCode: "8000" },
  { code: "8300", name: "Finance Costs",              type: "EXPENSE",   subType: "FINANCE_COST",       normalBalance: "DR", description: "Interest and bank charges",                      vatTreatment: "NOT_APPLICABLE", parentCode: "8000" },
  { code: "8900", name: "Income Tax Expense",         type: "EXPENSE",   subType: "OTHER_EXPENSE",      normalBalance: "DR", description: "Current and deferred income tax",                vatTreatment: "NOT_APPLICABLE", parentCode: "8000" },
]

// ─── Kenya — IFRS for SMEs stub ──────────────────────────────────────────────

export const KENYA_COA: CoaEntry[] = [
  { code: "1000", name: "Non-current Assets",        type: "ASSET",     subType: "FIXED_ASSET",        normalBalance: "DR", description: "Long-term assets",                               vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "1100", name: "Property, Plant & Equipment",type: "ASSET",    subType: "FIXED_ASSET",        normalBalance: "DR", description: "Tangible fixed assets at cost",                  vatTreatment: "NOT_APPLICABLE", parentCode: "1000" },
  { code: "2000", name: "Current Assets",             type: "ASSET",     subType: "CURRENT_ASSET",      normalBalance: "DR", description: "Short-term assets",                              vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "2100", name: "Inventories",                type: "ASSET",     subType: "INVENTORY",          normalBalance: "DR", description: "Stock and work in progress",                     vatTreatment: "NOT_APPLICABLE", parentCode: "2000" },
  { code: "2200", name: "Trade Receivables",          type: "ASSET",     subType: "TRADE_DEBTOR",       normalBalance: "DR", description: "Debtors and other receivables",                  vatTreatment: "NOT_APPLICABLE", parentCode: "2000", isControlAccount: true },
  { code: "2300", name: "Bank & Cash",                type: "ASSET",     subType: "CASH_AND_BANK",      normalBalance: "DR", description: "Cash balances",                                  vatTreatment: "NOT_APPLICABLE", parentCode: "2000" },
  { code: "3000", name: "Equity",                     type: "EQUITY",    subType: "EQUITY",             normalBalance: "CR", description: "Owners' equity",                                 vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "3100", name: "Share Capital",              type: "EQUITY",    subType: "SHARE_CAPITAL",      normalBalance: "CR", description: "Issued share capital",                           vatTreatment: "NOT_APPLICABLE", parentCode: "3000" },
  { code: "3200", name: "Retained Earnings",          type: "EQUITY",    subType: "RETAINED_EARNINGS",  normalBalance: "CR", description: "Accumulated profits",                            vatTreatment: "NOT_APPLICABLE", parentCode: "3000" },
  { code: "4000", name: "Non-current Liabilities",   type: "LIABILITY", subType: "LONG_TERM_LIABILITY", normalBalance: "CR", description: "Long-term obligations",                         vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "4100", name: "Long-term Loans",            type: "LIABILITY", subType: "LONG_TERM_LIABILITY", normalBalance: "CR", description: "Borrowings due after 12 months",                vatTreatment: "NOT_APPLICABLE", parentCode: "4000" },
  { code: "5000", name: "Current Liabilities",        type: "LIABILITY", subType: "CURRENT_LIABILITY",  normalBalance: "CR", description: "Short-term obligations",                         vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "5100", name: "Trade Payables",             type: "LIABILITY", subType: "TRADE_CREDITOR",     normalBalance: "CR", description: "Creditors and other payables",                   vatTreatment: "NOT_APPLICABLE", parentCode: "5000", isControlAccount: true },
  { code: "5200", name: "VAT Payable",                type: "LIABILITY", subType: "VAT_LIABILITY",      normalBalance: "CR", description: "VAT collected payable to KRA",                   vatTreatment: "NOT_APPLICABLE", parentCode: "5000", isControlAccount: true },
  { code: "6000", name: "Revenue",                    type: "REVENUE",   subType: "SALES_INCOME",       normalBalance: "CR", description: "Income from ordinary activities",                vatTreatment: "STANDARD_RATE",  parentCode: null },
  { code: "7000", name: "Cost of Sales",              type: "EXPENSE",   subType: "COST_OF_SALES",      normalBalance: "DR", description: "Direct costs",                                   vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "8000", name: "Operating Expenses",         type: "EXPENSE",   subType: "ADMIN_OFFICE",       normalBalance: "DR", description: "Overhead expenses",                              vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "8100", name: "Employee Costs",             type: "EXPENSE",   subType: "WAGES_SALARIES",     normalBalance: "DR", description: "Salaries and related costs",                     vatTreatment: "NOT_APPLICABLE", parentCode: "8000" },
  { code: "8200", name: "Depreciation",               type: "EXPENSE",   subType: "DEPRECIATION",       normalBalance: "DR", description: "Asset depreciation",                             vatTreatment: "NOT_APPLICABLE", parentCode: "8000" },
  { code: "8300", name: "Finance Costs",              type: "EXPENSE",   subType: "FINANCE_COST",       normalBalance: "DR", description: "Interest expense",                               vatTreatment: "NOT_APPLICABLE", parentCode: "8000" },
  { code: "8900", name: "Income Tax",                 type: "EXPENSE",   subType: "OTHER_EXPENSE",      normalBalance: "DR", description: "Corporation tax charge",                         vatTreatment: "NOT_APPLICABLE", parentCode: "8000" },
]

// ─── Zambia — ZAS / IFRS for SMEs stub ───────────────────────────────────────

export const ZAMBIA_COA: CoaEntry[] = [
  { code: "1000", name: "Non-current Assets",        type: "ASSET",     subType: "FIXED_ASSET",        normalBalance: "DR", description: "Long-term assets",                               vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "1100", name: "Property, Plant & Equipment",type: "ASSET",    subType: "FIXED_ASSET",        normalBalance: "DR", description: "Tangible fixed assets",                          vatTreatment: "NOT_APPLICABLE", parentCode: "1000" },
  { code: "2000", name: "Current Assets",             type: "ASSET",     subType: "CURRENT_ASSET",      normalBalance: "DR", description: "Short-term assets",                              vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "2100", name: "Inventories",                type: "ASSET",     subType: "INVENTORY",          normalBalance: "DR", description: "Goods held for sale",                            vatTreatment: "NOT_APPLICABLE", parentCode: "2000" },
  { code: "2200", name: "Trade Receivables",          type: "ASSET",     subType: "TRADE_DEBTOR",       normalBalance: "DR", description: "Amounts owed by customers",                      vatTreatment: "NOT_APPLICABLE", parentCode: "2000", isControlAccount: true },
  { code: "2300", name: "Bank & Cash",                type: "ASSET",     subType: "CASH_AND_BANK",      normalBalance: "DR", description: "Cash and bank balances",                         vatTreatment: "NOT_APPLICABLE", parentCode: "2000" },
  { code: "3000", name: "Equity",                     type: "EQUITY",    subType: "EQUITY",             normalBalance: "CR", description: "Owners' equity",                                 vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "3100", name: "Share Capital",              type: "EQUITY",    subType: "SHARE_CAPITAL",      normalBalance: "CR", description: "Issued share capital",                           vatTreatment: "NOT_APPLICABLE", parentCode: "3000" },
  { code: "3200", name: "Retained Earnings",          type: "EQUITY",    subType: "RETAINED_EARNINGS",  normalBalance: "CR", description: "Accumulated profits",                            vatTreatment: "NOT_APPLICABLE", parentCode: "3000" },
  { code: "4000", name: "Non-current Liabilities",   type: "LIABILITY", subType: "LONG_TERM_LIABILITY", normalBalance: "CR", description: "Long-term obligations",                         vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "4100", name: "Long-term Loans",            type: "LIABILITY", subType: "LONG_TERM_LIABILITY", normalBalance: "CR", description: "Loans due after one year",                      vatTreatment: "NOT_APPLICABLE", parentCode: "4000" },
  { code: "5000", name: "Current Liabilities",        type: "LIABILITY", subType: "CURRENT_LIABILITY",  normalBalance: "CR", description: "Short-term obligations",                         vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "5100", name: "Trade Payables",             type: "LIABILITY", subType: "TRADE_CREDITOR",     normalBalance: "CR", description: "Amounts owed to suppliers",                      vatTreatment: "NOT_APPLICABLE", parentCode: "5000", isControlAccount: true },
  { code: "5200", name: "VAT Payable",                type: "LIABILITY", subType: "VAT_LIABILITY",      normalBalance: "CR", description: "VAT collected payable to ZRA",                   vatTreatment: "NOT_APPLICABLE", parentCode: "5000", isControlAccount: true },
  { code: "6000", name: "Revenue",                    type: "REVENUE",   subType: "SALES_INCOME",       normalBalance: "CR", description: "Sales and service income",                       vatTreatment: "STANDARD_RATE",  parentCode: null },
  { code: "7000", name: "Cost of Sales",              type: "EXPENSE",   subType: "COST_OF_SALES",      normalBalance: "DR", description: "Direct production costs",                        vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "8000", name: "Operating Expenses",         type: "EXPENSE",   subType: "ADMIN_OFFICE",       normalBalance: "DR", description: "Indirect overhead costs",                        vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "8100", name: "Employee Costs",             type: "EXPENSE",   subType: "WAGES_SALARIES",     normalBalance: "DR", description: "Salaries, NAPSA and NHIMA contributions",        vatTreatment: "NOT_APPLICABLE", parentCode: "8000" },
  { code: "8200", name: "Depreciation",               type: "EXPENSE",   subType: "DEPRECIATION",       normalBalance: "DR", description: "Depreciation of assets",                         vatTreatment: "NOT_APPLICABLE", parentCode: "8000" },
  { code: "8300", name: "Finance Costs",              type: "EXPENSE",   subType: "FINANCE_COST",       normalBalance: "DR", description: "Interest on borrowings",                         vatTreatment: "NOT_APPLICABLE", parentCode: "8000" },
  { code: "8900", name: "Income Tax Expense",         type: "EXPENSE",   subType: "OTHER_EXPENSE",      normalBalance: "DR", description: "Current and deferred tax",                       vatTreatment: "NOT_APPLICABLE", parentCode: "8000" },
]

// ─── Registry ─────────────────────────────────────────────────────────────────

export const COA_TEMPLATES: Record<string, CoaEntry[]> = {
  uk:           UK_COA,
  south_africa: SOUTH_AFRICA_COA,
  kenya:        KENYA_COA,
  zambia:       ZAMBIA_COA,
}

/**
 * Seed a COA template into the database for a given organisation.
 * Resolves parentCode references to real parentIds after insert.
 * Uses upsert so it is idempotent and safe to call on existing orgs.
 */
export async function seedCOA(
  orgId: string,
  template: "uk" | "south_africa" | "kenya" | "zambia",
  prisma: { chartOfAccount: { upsert: Function; findMany: Function } }
): Promise<number> {
  const entries = COA_TEMPLATES[template] ?? UK_COA

  // Step 1: upsert all accounts without parentId
  for (const entry of entries) {
    await prisma.chartOfAccount.upsert({
      where: { organizationId_code: { organizationId: orgId, code: entry.code } },
      update: {
        name:             entry.name,
        type:             entry.type,
        subType:          entry.subType,
        normalBalance:    entry.normalBalance,
        description:      entry.description,
        vatTreatment:     entry.vatTreatment,
        isControlAccount: entry.isControlAccount ?? false,
      },
      create: {
        organizationId:   orgId,
        code:             entry.code,
        name:             entry.name,
        type:             entry.type,
        subType:          entry.subType,
        normalBalance:    entry.normalBalance,
        description:      entry.description,
        vatTreatment:     entry.vatTreatment,
        isControlAccount: entry.isControlAccount ?? false,
      },
    })
  }

  // Step 2: resolve parentCode → parentId and wire up
  const allAccounts = await prisma.chartOfAccount.findMany({
    where: { organizationId: orgId },
    select: { id: true, code: true },
  })
  const codeToId = new Map(allAccounts.map((a: any) => [a.code, a.id]))

  for (const entry of entries) {
    if (!entry.parentCode) continue
    const parentId = codeToId.get(entry.parentCode)
    if (!parentId) continue

    await prisma.chartOfAccount.upsert({
      where: { organizationId_code: { organizationId: orgId, code: entry.code } },
      update: { parentId },
      create: {
        organizationId:   orgId,
        code:             entry.code,
        name:             entry.name,
        type:             entry.type,
        subType:          entry.subType,
        normalBalance:    entry.normalBalance,
        description:      entry.description,
        vatTreatment:     entry.vatTreatment,
        isControlAccount: entry.isControlAccount ?? false,
        parentId,
      },
    })
  }

  return entries.length
}
