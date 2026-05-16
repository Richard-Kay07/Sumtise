/**
 * Chart of Accounts Templates
 *
 * FRS 102-aligned UK template (primary) plus lightweight stubs for
 * South Africa (IFRS for SMEs), Kenya (IFRS for SMEs) and Zambia (ZAS).
 *
 * Each entry omits `code` duplicates — codes are unique per organisation.
 * `parentCode` is resolved to a real parentId after bulk-insert.
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
}

// ─── UK — FRS 102 ────────────────────────────────────────────────────────────

export const UK_COA: CoaEntry[] = [
  // ── Fixed Assets ────────────────────────────────────────────────────────
  {
    code: "0010", name: "Fixed Assets", type: "ASSET",
    subType: "FIXED_ASSET", normalBalance: "DR",
    description: "Non-current tangible assets held for use in the business",
    vatTreatment: "NOT_APPLICABLE", parentCode: null,
  },
  {
    code: "0011", name: "Land & Buildings", type: "ASSET",
    subType: "FIXED_ASSET", normalBalance: "DR",
    description: "Freehold and leasehold land and buildings at cost",
    vatTreatment: "NOT_APPLICABLE", parentCode: "0010",
  },
  {
    code: "0012", name: "Plant & Machinery", type: "ASSET",
    subType: "FIXED_ASSET", normalBalance: "DR",
    description: "Plant, machinery and equipment at cost",
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
  // ── Current Assets ──────────────────────────────────────────────────────
  {
    code: "1000", name: "Current Assets", type: "ASSET",
    subType: "CURRENT_ASSET", normalBalance: "DR",
    description: "Assets expected to be realised within 12 months",
    vatTreatment: "NOT_APPLICABLE", parentCode: null,
  },
  {
    code: "1100", name: "Stock & Work in Progress", type: "ASSET",
    subType: "INVENTORY", normalBalance: "DR",
    description: "Goods held for sale and work in progress at lower of cost or NRV",
    vatTreatment: "NOT_APPLICABLE", parentCode: "1000",
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
  {
    code: "1200", name: "Trade Debtors", type: "ASSET",
    subType: "TRADE_DEBTOR", normalBalance: "DR",
    description: "Amounts owed by customers for goods and services supplied",
    vatTreatment: "NOT_APPLICABLE", parentCode: "1000",
  },
  {
    code: "1210", name: "Other Debtors", type: "ASSET",
    subType: "CURRENT_ASSET", normalBalance: "DR",
    description: "Other amounts receivable not classified as trade debtors",
    vatTreatment: "NOT_APPLICABLE", parentCode: "1000",
  },
  {
    code: "1220", name: "Prepayments", type: "ASSET",
    subType: "PREPAYMENT", normalBalance: "DR",
    description: "Payments made in advance of the period to which they relate",
    vatTreatment: "NOT_APPLICABLE", parentCode: "1000",
  },
  {
    code: "1230", name: "VAT Recoverable (Input Tax)", type: "ASSET",
    subType: "VAT_ASSET", normalBalance: "DR",
    description: "VAT paid on purchases recoverable from HMRC",
    vatTreatment: "NOT_APPLICABLE", parentCode: "1000",
  },
  // ── Cash & Bank ─────────────────────────────────────────────────────────
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

  // ── Current Liabilities ─────────────────────────────────────────────────
  {
    code: "2000", name: "Current Liabilities", type: "LIABILITY",
    subType: "CURRENT_LIABILITY", normalBalance: "CR",
    description: "Obligations due within 12 months",
    vatTreatment: "NOT_APPLICABLE", parentCode: null,
  },
  {
    code: "2100", name: "Trade Creditors", type: "LIABILITY",
    subType: "TRADE_CREDITOR", normalBalance: "CR",
    description: "Amounts owed to suppliers for goods and services received",
    vatTreatment: "NOT_APPLICABLE", parentCode: "2000",
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
  {
    code: "2200", name: "VAT Liability (Output Tax)", type: "LIABILITY",
    subType: "VAT_LIABILITY", normalBalance: "CR",
    description: "VAT collected on sales and payable to HMRC",
    vatTreatment: "NOT_APPLICABLE", parentCode: "2000",
  },
  {
    code: "2210", name: "PAYE & NI Payable", type: "LIABILITY",
    subType: "PAYE_LIABILITY", normalBalance: "CR",
    description: "Income tax (PAYE) and National Insurance contributions due to HMRC",
    vatTreatment: "NOT_APPLICABLE", parentCode: "2000",
  },
  {
    code: "2220", name: "Pension Contributions Payable", type: "LIABILITY",
    subType: "CURRENT_LIABILITY", normalBalance: "CR",
    description: "Employer and employee pension contributions not yet remitted",
    vatTreatment: "NOT_APPLICABLE", parentCode: "2000",
  },
  {
    code: "2230", name: "Corporation Tax Payable", type: "LIABILITY",
    subType: "TAX_LIABILITY", normalBalance: "CR",
    description: "Corporation tax due to HMRC for the current accounting period",
    vatTreatment: "NOT_APPLICABLE", parentCode: "2000",
  },
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
    code: "2520", name: "Finance Lease Liabilities", type: "LIABILITY",
    subType: "FINANCE_LEASE", normalBalance: "CR",
    description: "Obligations under finance leases (IFRS 16 / FRS 102 S20)",
    vatTreatment: "NOT_APPLICABLE", parentCode: "2500",
  },
  {
    code: "2530", name: "Deferred Tax Liability", type: "LIABILITY",
    subType: "LONG_TERM_LIABILITY", normalBalance: "CR",
    description: "Deferred tax arising from timing differences",
    vatTreatment: "NOT_APPLICABLE", parentCode: "2500",
  },

  // ── Equity ───────────────────────────────────────────────────────────────
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
    description: "Revenue from VAT-exempt supplies (e.g. insurance, finance)",
    vatTreatment: "EXEMPT", parentCode: "4000",
  },
  {
    code: "4050", name: "Sales — Export", type: "REVENUE",
    subType: "SALES_INCOME", normalBalance: "CR",
    description: "Revenue from exports outside the UK (outside scope / zero-rated)",
    vatTreatment: "OUT_OF_SCOPE", parentCode: "4000",
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
    code: "5040", name: "Carriage Inwards & Freight", type: "EXPENSE",
    subType: "COST_OF_SALES", normalBalance: "DR",
    description: "Delivery and freight costs on purchased goods",
    vatTreatment: "STANDARD_RATE", parentCode: "5000",
  },

  // ── Wages & Salaries ─────────────────────────────────────────────────────
  {
    code: "6000", name: "Wages & Salaries", type: "EXPENSE",
    subType: "WAGES_SALARIES", normalBalance: "DR",
    description: "Employee remuneration costs",
    vatTreatment: "NOT_APPLICABLE", parentCode: null,
  },
  {
    code: "6010", name: "Gross Wages & Salaries", type: "EXPENSE",
    subType: "WAGES_SALARIES", normalBalance: "DR",
    description: "Gross pay before deductions — all employees",
    vatTreatment: "NOT_APPLICABLE", parentCode: "6000",
  },
  {
    code: "6020", name: "Employers NI Contributions", type: "EXPENSE",
    subType: "WAGES_SALARIES", normalBalance: "DR",
    description: "Employer's National Insurance contributions",
    vatTreatment: "NOT_APPLICABLE", parentCode: "6000",
  },
  {
    code: "6030", name: "Employer Pension Contributions", type: "EXPENSE",
    subType: "WAGES_SALARIES", normalBalance: "DR",
    description: "Employer contributions to workplace pension schemes",
    vatTreatment: "NOT_APPLICABLE", parentCode: "6000",
  },
  {
    code: "6040", name: "Staff Training & Development", type: "EXPENSE",
    subType: "WAGES_SALARIES", normalBalance: "DR",
    description: "Courses, qualifications and professional development costs",
    vatTreatment: "STANDARD_RATE", parentCode: "6000",
  },
  {
    code: "6050", name: "Staff Recruitment", type: "EXPENSE",
    subType: "WAGES_SALARIES", normalBalance: "DR",
    description: "Recruitment agency fees, job board advertising and onboarding",
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
    description: "Buildings, contents and public liability insurance premiums",
    vatTreatment: "EXEMPT", parentCode: "6100",
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
    description: "Rail, air, taxi fares and accommodation for business travel",
    vatTreatment: "STANDARD_RATE", parentCode: "6200",
  },

  // ── IT & Communications ──────────────────────────────────────────────────
  {
    code: "6300", name: "IT & Communications", type: "EXPENSE",
    subType: "IT_TECH", normalBalance: "DR",
    description: "Technology and communications costs",
    vatTreatment: "NOT_APPLICABLE", parentCode: null,
  },
  {
    code: "6310", name: "Software & Subscriptions", type: "EXPENSE",
    subType: "IT_TECH", normalBalance: "DR",
    description: "SaaS, cloud services, software licences and app subscriptions",
    vatTreatment: "STANDARD_RATE", parentCode: "6300",
  },
  {
    code: "6320", name: "Telephone & Broadband", type: "EXPENSE",
    subType: "IT_TECH", normalBalance: "DR",
    description: "Mobile, landline and internet connection charges",
    vatTreatment: "STANDARD_RATE", parentCode: "6300",
  },
  {
    code: "6330", name: "Website & Hosting", type: "EXPENSE",
    subType: "IT_TECH", normalBalance: "DR",
    description: "Domain registration, web hosting and website maintenance",
    vatTreatment: "STANDARD_RATE", parentCode: "6300",
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
    code: "6540", name: "Bank Charges", type: "EXPENSE",
    subType: "PROFESSIONAL", normalBalance: "DR",
    description: "Bank account transaction fees and service charges",
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
    code: "6610", name: "Advertising & Marketing", type: "EXPENSE",
    subType: "SALES_MARKETING", normalBalance: "DR",
    description: "Digital, print and outdoor advertising spend",
    vatTreatment: "STANDARD_RATE", parentCode: "6600",
  },
  {
    code: "6620", name: "Entertainment & Hospitality", type: "EXPENSE",
    subType: "SALES_MARKETING", normalBalance: "DR",
    description: "Client entertainment — note: generally not deductible for CT",
    vatTreatment: "STANDARD_RATE", parentCode: "6600",
  },
  {
    code: "6630", name: "Subscriptions & Memberships", type: "EXPENSE",
    subType: "SALES_MARKETING", normalBalance: "DR",
    description: "Trade association fees, industry body subscriptions",
    vatTreatment: "STANDARD_RATE", parentCode: "6600",
  },

  // ── Depreciation ─────────────────────────────────────────────────────────
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
    code: "6720", name: "Amortisation — Intangible Assets", type: "EXPENSE",
    subType: "DEPRECIATION", normalBalance: "DR",
    description: "Annual amortisation charge on goodwill and other intangibles",
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
    code: "6830", name: "Finance Lease Interest", type: "EXPENSE",
    subType: "FINANCE_COST", normalBalance: "DR",
    description: "Interest element of finance lease payments (IFRS 16 / S20)",
    vatTreatment: "EXEMPT", parentCode: "6800",
  },
  {
    code: "6840", name: "Foreign Exchange Losses", type: "EXPENSE",
    subType: "FINANCE_COST", normalBalance: "DR",
    description: "Realised and unrealised FX losses on monetary items",
    vatTreatment: "NOT_APPLICABLE", parentCode: "6800",
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
    code: "6920", name: "Sundry Expenses", type: "EXPENSE",
    subType: "OTHER_EXPENSE", normalBalance: "DR",
    description: "Minor miscellaneous business expenses not classified above",
    vatTreatment: "STANDARD_RATE", parentCode: "6900",
  },
  {
    code: "6930", name: "Corporation Tax", type: "EXPENSE",
    subType: "OTHER_EXPENSE", normalBalance: "DR",
    description: "Current year corporation tax charge",
    vatTreatment: "NOT_APPLICABLE", parentCode: "6900",
  },
]

// ─── South Africa — IFRS for SMEs stub ───────────────────────────────────────
// Rand-based; follows SAICA recommended numbering.

export const SOUTH_AFRICA_COA: CoaEntry[] = [
  { code: "1000", name: "Non-current Assets",        type: "ASSET",     subType: "FIXED_ASSET",       normalBalance: "DR", description: "Assets with useful life > 12 months",            vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "1100", name: "Property, Plant & Equipment",type: "ASSET",    subType: "FIXED_ASSET",       normalBalance: "DR", description: "Tangible non-current assets at cost",            vatTreatment: "NOT_APPLICABLE", parentCode: "1000" },
  { code: "1200", name: "Intangible Assets",          type: "ASSET",     subType: "INTANGIBLE_ASSET",  normalBalance: "DR", description: "Non-monetary assets without physical substance",  vatTreatment: "NOT_APPLICABLE", parentCode: "1000" },
  { code: "2000", name: "Current Assets",             type: "ASSET",     subType: "CURRENT_ASSET",     normalBalance: "DR", description: "Assets realisable within 12 months",             vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "2100", name: "Inventories",                type: "ASSET",     subType: "INVENTORY",         normalBalance: "DR", description: "Raw materials, WIP and finished goods",          vatTreatment: "NOT_APPLICABLE", parentCode: "2000" },
  { code: "2200", name: "Trade & Other Receivables",  type: "ASSET",     subType: "TRADE_DEBTOR",      normalBalance: "DR", description: "Amounts owed by customers",                      vatTreatment: "NOT_APPLICABLE", parentCode: "2000" },
  { code: "2300", name: "Cash & Cash Equivalents",    type: "ASSET",     subType: "CASH_AND_BANK",     normalBalance: "DR", description: "Bank balances and cash on hand",                 vatTreatment: "NOT_APPLICABLE", parentCode: "2000" },
  { code: "3000", name: "Equity",                     type: "EQUITY",    subType: "EQUITY",            normalBalance: "CR", description: "Shareholders' funds",                            vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "3100", name: "Share Capital",              type: "EQUITY",    subType: "SHARE_CAPITAL",     normalBalance: "CR", description: "Issued share capital",                           vatTreatment: "NOT_APPLICABLE", parentCode: "3000" },
  { code: "3200", name: "Retained Income",            type: "EQUITY",    subType: "RETAINED_EARNINGS", normalBalance: "CR", description: "Accumulated profits",                            vatTreatment: "NOT_APPLICABLE", parentCode: "3000" },
  { code: "4000", name: "Non-current Liabilities",   type: "LIABILITY", subType: "LONG_TERM_LIABILITY",normalBalance: "CR", description: "Obligations due after 12 months",               vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "4100", name: "Long-term Borrowings",       type: "LIABILITY", subType: "LONG_TERM_LIABILITY",normalBalance: "CR", description: "Loans repayable after one year",                vatTreatment: "NOT_APPLICABLE", parentCode: "4000" },
  { code: "5000", name: "Current Liabilities",        type: "LIABILITY", subType: "CURRENT_LIABILITY", normalBalance: "CR", description: "Obligations due within 12 months",               vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "5100", name: "Trade & Other Payables",     type: "LIABILITY", subType: "TRADE_CREDITOR",    normalBalance: "CR", description: "Amounts owed to suppliers",                      vatTreatment: "NOT_APPLICABLE", parentCode: "5000" },
  { code: "5200", name: "VAT Payable",                type: "LIABILITY", subType: "VAT_LIABILITY",     normalBalance: "CR", description: "VAT collected and payable to SARS",              vatTreatment: "NOT_APPLICABLE", parentCode: "5000" },
  { code: "6000", name: "Revenue",                    type: "REVENUE",   subType: "SALES_INCOME",      normalBalance: "CR", description: "Turnover from ordinary activities",              vatTreatment: "STANDARD_RATE",  parentCode: null },
  { code: "7000", name: "Cost of Sales",              type: "EXPENSE",   subType: "COST_OF_SALES",     normalBalance: "DR", description: "Direct cost of goods and services sold",         vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "8000", name: "Operating Expenses",         type: "EXPENSE",   subType: "ADMIN_OFFICE",      normalBalance: "DR", description: "Indirect business expenses",                    vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "8100", name: "Employee Costs",             type: "EXPENSE",   subType: "WAGES_SALARIES",    normalBalance: "DR", description: "Salaries, wages and related costs",              vatTreatment: "NOT_APPLICABLE", parentCode: "8000" },
  { code: "8200", name: "Depreciation",               type: "EXPENSE",   subType: "DEPRECIATION",      normalBalance: "DR", description: "Depreciation and amortisation charges",          vatTreatment: "NOT_APPLICABLE", parentCode: "8000" },
  { code: "8300", name: "Finance Costs",              type: "EXPENSE",   subType: "FINANCE_COST",      normalBalance: "DR", description: "Interest and bank charges",                      vatTreatment: "NOT_APPLICABLE", parentCode: "8000" },
  { code: "8900", name: "Income Tax Expense",         type: "EXPENSE",   subType: "OTHER_EXPENSE",     normalBalance: "DR", description: "Current and deferred income tax",                vatTreatment: "NOT_APPLICABLE", parentCode: "8000" },
]

// ─── Kenya — IFRS for SMEs stub ──────────────────────────────────────────────

export const KENYA_COA: CoaEntry[] = [
  { code: "1000", name: "Non-current Assets",        type: "ASSET",     subType: "FIXED_ASSET",       normalBalance: "DR", description: "Long-term assets",                               vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "1100", name: "Property, Plant & Equipment",type: "ASSET",    subType: "FIXED_ASSET",       normalBalance: "DR", description: "Tangible fixed assets at cost",                  vatTreatment: "NOT_APPLICABLE", parentCode: "1000" },
  { code: "2000", name: "Current Assets",             type: "ASSET",     subType: "CURRENT_ASSET",     normalBalance: "DR", description: "Short-term assets",                              vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "2100", name: "Inventories",                type: "ASSET",     subType: "INVENTORY",         normalBalance: "DR", description: "Stock and work in progress",                     vatTreatment: "NOT_APPLICABLE", parentCode: "2000" },
  { code: "2200", name: "Trade Receivables",          type: "ASSET",     subType: "TRADE_DEBTOR",      normalBalance: "DR", description: "Debtors and other receivables",                  vatTreatment: "NOT_APPLICABLE", parentCode: "2000" },
  { code: "2300", name: "Bank & Cash",                type: "ASSET",     subType: "CASH_AND_BANK",     normalBalance: "DR", description: "Cash balances",                                  vatTreatment: "NOT_APPLICABLE", parentCode: "2000" },
  { code: "3000", name: "Equity",                     type: "EQUITY",    subType: "EQUITY",            normalBalance: "CR", description: "Owners' equity",                                 vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "3100", name: "Share Capital",              type: "EQUITY",    subType: "SHARE_CAPITAL",     normalBalance: "CR", description: "Issued share capital",                           vatTreatment: "NOT_APPLICABLE", parentCode: "3000" },
  { code: "3200", name: "Retained Earnings",          type: "EQUITY",    subType: "RETAINED_EARNINGS", normalBalance: "CR", description: "Accumulated profits",                            vatTreatment: "NOT_APPLICABLE", parentCode: "3000" },
  { code: "4000", name: "Non-current Liabilities",   type: "LIABILITY", subType: "LONG_TERM_LIABILITY",normalBalance: "CR", description: "Long-term obligations",                         vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "4100", name: "Long-term Loans",            type: "LIABILITY", subType: "LONG_TERM_LIABILITY",normalBalance: "CR", description: "Borrowings due after 12 months",                vatTreatment: "NOT_APPLICABLE", parentCode: "4000" },
  { code: "5000", name: "Current Liabilities",        type: "LIABILITY", subType: "CURRENT_LIABILITY", normalBalance: "CR", description: "Short-term obligations",                         vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "5100", name: "Trade Payables",             type: "LIABILITY", subType: "TRADE_CREDITOR",    normalBalance: "CR", description: "Creditors and other payables",                   vatTreatment: "NOT_APPLICABLE", parentCode: "5000" },
  { code: "5200", name: "VAT Payable",                type: "LIABILITY", subType: "VAT_LIABILITY",     normalBalance: "CR", description: "VAT collected payable to KRA",                   vatTreatment: "NOT_APPLICABLE", parentCode: "5000" },
  { code: "6000", name: "Revenue",                    type: "REVENUE",   subType: "SALES_INCOME",      normalBalance: "CR", description: "Income from ordinary activities",                vatTreatment: "STANDARD_RATE",  parentCode: null },
  { code: "7000", name: "Cost of Sales",              type: "EXPENSE",   subType: "COST_OF_SALES",     normalBalance: "DR", description: "Direct costs",                                   vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "8000", name: "Operating Expenses",         type: "EXPENSE",   subType: "ADMIN_OFFICE",      normalBalance: "DR", description: "Overhead expenses",                              vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "8100", name: "Employee Costs",             type: "EXPENSE",   subType: "WAGES_SALARIES",    normalBalance: "DR", description: "Salaries and related costs",                     vatTreatment: "NOT_APPLICABLE", parentCode: "8000" },
  { code: "8200", name: "Depreciation",               type: "EXPENSE",   subType: "DEPRECIATION",      normalBalance: "DR", description: "Asset depreciation",                             vatTreatment: "NOT_APPLICABLE", parentCode: "8000" },
  { code: "8300", name: "Finance Costs",              type: "EXPENSE",   subType: "FINANCE_COST",      normalBalance: "DR", description: "Interest expense",                               vatTreatment: "NOT_APPLICABLE", parentCode: "8000" },
  { code: "8900", name: "Income Tax",                 type: "EXPENSE",   subType: "OTHER_EXPENSE",     normalBalance: "DR", description: "Corporation tax charge",                         vatTreatment: "NOT_APPLICABLE", parentCode: "8000" },
]

// ─── Zambia — ZAS / IFRS for SMEs stub ───────────────────────────────────────

export const ZAMBIA_COA: CoaEntry[] = [
  { code: "1000", name: "Non-current Assets",        type: "ASSET",     subType: "FIXED_ASSET",       normalBalance: "DR", description: "Long-term assets",                               vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "1100", name: "Property, Plant & Equipment",type: "ASSET",    subType: "FIXED_ASSET",       normalBalance: "DR", description: "Tangible fixed assets",                          vatTreatment: "NOT_APPLICABLE", parentCode: "1000" },
  { code: "2000", name: "Current Assets",             type: "ASSET",     subType: "CURRENT_ASSET",     normalBalance: "DR", description: "Short-term assets",                              vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "2100", name: "Inventories",                type: "ASSET",     subType: "INVENTORY",         normalBalance: "DR", description: "Goods held for sale",                            vatTreatment: "NOT_APPLICABLE", parentCode: "2000" },
  { code: "2200", name: "Trade Receivables",          type: "ASSET",     subType: "TRADE_DEBTOR",      normalBalance: "DR", description: "Amounts owed by customers",                      vatTreatment: "NOT_APPLICABLE", parentCode: "2000" },
  { code: "2300", name: "Bank & Cash",                type: "ASSET",     subType: "CASH_AND_BANK",     normalBalance: "DR", description: "Cash and bank balances",                         vatTreatment: "NOT_APPLICABLE", parentCode: "2000" },
  { code: "3000", name: "Equity",                     type: "EQUITY",    subType: "EQUITY",            normalBalance: "CR", description: "Owners' equity",                                 vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "3100", name: "Share Capital",              type: "EQUITY",    subType: "SHARE_CAPITAL",     normalBalance: "CR", description: "Issued share capital",                           vatTreatment: "NOT_APPLICABLE", parentCode: "3000" },
  { code: "3200", name: "Retained Earnings",          type: "EQUITY",    subType: "RETAINED_EARNINGS", normalBalance: "CR", description: "Accumulated profits",                            vatTreatment: "NOT_APPLICABLE", parentCode: "3000" },
  { code: "4000", name: "Non-current Liabilities",   type: "LIABILITY", subType: "LONG_TERM_LIABILITY",normalBalance: "CR", description: "Long-term obligations",                         vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "4100", name: "Long-term Loans",            type: "LIABILITY", subType: "LONG_TERM_LIABILITY",normalBalance: "CR", description: "Loans due after one year",                      vatTreatment: "NOT_APPLICABLE", parentCode: "4000" },
  { code: "5000", name: "Current Liabilities",        type: "LIABILITY", subType: "CURRENT_LIABILITY", normalBalance: "CR", description: "Short-term obligations",                         vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "5100", name: "Trade Payables",             type: "LIABILITY", subType: "TRADE_CREDITOR",    normalBalance: "CR", description: "Amounts owed to suppliers",                      vatTreatment: "NOT_APPLICABLE", parentCode: "5000" },
  { code: "5200", name: "VAT Payable",                type: "LIABILITY", subType: "VAT_LIABILITY",     normalBalance: "CR", description: "VAT collected payable to ZRA",                   vatTreatment: "NOT_APPLICABLE", parentCode: "5000" },
  { code: "6000", name: "Revenue",                    type: "REVENUE",   subType: "SALES_INCOME",      normalBalance: "CR", description: "Sales and service income",                       vatTreatment: "STANDARD_RATE",  parentCode: null },
  { code: "7000", name: "Cost of Sales",              type: "EXPENSE",   subType: "COST_OF_SALES",     normalBalance: "DR", description: "Direct production costs",                        vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "8000", name: "Operating Expenses",         type: "EXPENSE",   subType: "ADMIN_OFFICE",      normalBalance: "DR", description: "Indirect overhead costs",                        vatTreatment: "NOT_APPLICABLE", parentCode: null },
  { code: "8100", name: "Employee Costs",             type: "EXPENSE",   subType: "WAGES_SALARIES",    normalBalance: "DR", description: "Salaries, NAPSA and NHIMA contributions",        vatTreatment: "NOT_APPLICABLE", parentCode: "8000" },
  { code: "8200", name: "Depreciation",               type: "EXPENSE",   subType: "DEPRECIATION",      normalBalance: "DR", description: "Depreciation of assets",                         vatTreatment: "NOT_APPLICABLE", parentCode: "8000" },
  { code: "8300", name: "Finance Costs",              type: "EXPENSE",   subType: "FINANCE_COST",      normalBalance: "DR", description: "Interest on borrowings",                         vatTreatment: "NOT_APPLICABLE", parentCode: "8000" },
  { code: "8900", name: "Income Tax Expense",         type: "EXPENSE",   subType: "OTHER_EXPENSE",     normalBalance: "DR", description: "Current and deferred tax",                       vatTreatment: "NOT_APPLICABLE", parentCode: "8000" },
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

  // Step 1: insert all accounts without parentId
  for (const entry of entries) {
    await prisma.chartOfAccount.upsert({
      where: { organizationId_code: { organizationId: orgId, code: entry.code } },
      update: {
        name:          entry.name,
        type:          entry.type,
        subType:       entry.subType,
        normalBalance: entry.normalBalance,
        description:   entry.description,
        vatTreatment:  entry.vatTreatment,
      },
      create: {
        organizationId: orgId,
        code:          entry.code,
        name:          entry.name,
        type:          entry.type,
        subType:       entry.subType,
        normalBalance: entry.normalBalance,
        description:   entry.description,
        vatTreatment:  entry.vatTreatment,
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
    const accountId = codeToId.get(entry.code)
    if (!accountId) continue

    await prisma.chartOfAccount.upsert({
      where: { organizationId_code: { organizationId: orgId, code: entry.code } },
      update: { parentId },
      create: {
        organizationId: orgId,
        code:          entry.code,
        name:          entry.name,
        type:          entry.type,
        subType:       entry.subType,
        normalBalance: entry.normalBalance,
        description:   entry.description,
        vatTreatment:  entry.vatTreatment,
        parentId,
      },
    })
  }

  return entries.length
}
