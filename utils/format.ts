/**
 * Format a number as Canadian dollar currency.
 */
export function formatCAD(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
  }).format(amount)
}

/**
 * Format a number as a plain dollar string without the symbol (for copy-paste).
 */
export function formatCADPlain(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Get the current tax year.
 */
export function getCurrentTaxYear(): number {
  const now = new Date()
  return now.getFullYear()
}

/**
 * Format date to YYYY-MM-DD.
 */
export function formatDate(date: string | Date): string {
  const d = new Date(date)
  return d.toISOString().split('T')[0]
}

/**
 * Get the first and last day of a month.
 */
export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  return {
    start: formatDate(start),
    end: formatDate(end),
  }
}

/**
 * Get the first and last day of a year.
 */
export function getYearRange(year: number): { start: string; end: string } {
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  }
}
