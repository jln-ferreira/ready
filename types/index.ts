export type AccountType = 'personal' | 'business'
export type SortKey = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'category_asc' | 'category_desc' | 'type_asc' | 'type_desc'
export type TransactionType = 'income' | 'expense'
export type GSTType = 'collected' | 'paid'
export type IncomeType = 'salary' | 'dividend'
export type DividendType = 'eligible' | 'non_eligible'

export interface Household {
  id: string
  name: string
  created_at: string
}

export interface UserHousehold {
  user_id: string
  household_id: string
}

export interface Account {
  id: string
  household_id: string
  name: string
  type: AccountType
  created_at: string
}

export interface Category {
  id: string
  name: string
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  household_id: string
  account_id: string
  date: string
  amount: number
  type: TransactionType
  category_id: string | null
  description: string | null
  created_at: string
  // joined
  account?: Account
  category?: Category
  gst_entry?: GSTEntry
  income_detail?: IncomeDetail
}

export interface GSTEntry {
  id: string
  transaction_id: string
  gst_amount: number
  gst_type: GSTType
  created_at: string
}

export interface IncomeDetail {
  id: string
  transaction_id: string
  income_type: IncomeType
  dividend_type: DividendType | null
  created_at: string
}

// Form types
export interface TransactionFormData {
  date: string
  amount: string
  type: TransactionType
  account_id: string
  category_id: string
  description: string
  // GST
  has_gst: boolean
  gst_amount: string
  gst_type: GSTType
  // Income
  is_income_detail: boolean
  income_type: IncomeType
  dividend_type: DividendType | null
}

// Tax summary types
export interface PersonalSummary {
  // T4 — Employment Income
  employment_income: number              // T1 Line 10100

  // T5 — Dividend Income
  eligible_dividends_actual: number      // T5 Box 24 / T1 Line 12010
  eligible_dividends_grossed: number     // ×1.38 → T1 Line 12000
  non_eligible_dividends_actual: number  // T5 Box 10 / T1 Line 12019
  non_eligible_dividends_grossed: number // ×1.15 → T1 Line 12000
  total_taxable_dividends: number        // T1 Line 12000

  // Other personal income (unclassified, personal accounts)
  other_income: number                   // T1 Line 13000

  // Total before deductions
  total_income: number                   // T1 Line 15000 (excl. business)
}

export interface BusinessSummary {
  gross_income: number    // T2125 Line 8000
  total_expenses: number  // T2125 Line 9270
  net_income: number      // T2125 Line 9946 → T1 Line 13500
}

export interface GSTSummary {
  gst_collected: number    // GST34 Line 105
  gst_paid: number         // GST34 Line 108 (ITC)
  net_gst_payable: number  // GST34 Line 109
}

export interface TaxSummary {
  year: number
  personal: PersonalSummary
  business: BusinessSummary
  gst: GSTSummary
  generated_at: string
}

export interface DashboardTotals {
  income: number
  expenses: number
  gst_collected: number
  gst_paid: number
  net: number
}
