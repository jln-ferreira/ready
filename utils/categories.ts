import type { Category } from '@/types'

const INCOME_CATEGORY_NAMES = new Set([
  'Client Revenue',
  'Contract Work',
  'Dividends Received',
  'Investment Income',
  'Other Income',
  'Payroll / Salary',
])

const EXPENSE_CATEGORY_NAMES = new Set([
  'Advertising & Marketing',
  'Bank Fees',
  'Business Meals',
  'Equipment',
  'Home Office',
  'Insurance',
  'Internet & Phone',
  'Legal & Professional',
  'Office Supplies',
  'Rent',
  'Software & Subscriptions',
  'Travel',
  'Utilities',
  'Vehicle / Mileage',
  'Other Expense',
])

export function filterCategoriesByType(
  categories: Category[],
  type: 'income' | 'expense'
): Category[] {
  const set = type === 'income' ? INCOME_CATEGORY_NAMES : EXPENSE_CATEGORY_NAMES
  const matched = categories.filter((c) => set.has(c.name))
  // Fall back to all categories if none match (e.g. user added custom ones)
  return matched.length > 0 ? matched : categories
}
