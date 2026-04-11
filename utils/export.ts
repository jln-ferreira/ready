import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { jsPDF } from 'jspdf'
import type { Transaction, TaxSummary } from '@/types'
import { formatCAD, formatCADPlain } from './format'

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

function toCSV(headers: string[], rows: string[][]): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const lines = [headers.map(escape).join(',')]
  for (const row of rows) {
    lines.push(row.map(escape).join(','))
  }
  return lines.join('\n')
}

export function buildTransactionsCSV(transactions: Transaction[]): string {
  const headers = [
    'Date',
    'Description',
    'Account',
    'Category',
    'Type',
    'Amount (CAD)',
    'GST Amount',
    'GST Type',
    'Income Type',
    'Dividend Type',
  ]
  const rows = transactions.map((t) => [
    t.date,
    t.description ?? '',
    t.account?.name ?? '',
    t.category?.name ?? '',
    t.type,
    t.amount.toFixed(2),
    t.gst_entry?.gst_amount?.toFixed(2) ?? '',
    t.gst_entry?.gst_type ?? '',
    t.income_detail?.income_type ?? '',
    t.income_detail?.dividend_type ?? '',
  ])
  return toCSV(headers, rows)
}

export function buildGSTSummaryCSV(summary: TaxSummary): string {
  const headers = ['Line', 'Description', 'Amount (CAD)']
  const rows = [
    ['101', 'Total Sales & Revenue', summary.business.gross_income.toFixed(2)],
    ['105', 'GST/HST Collected', summary.gst.gst_collected.toFixed(2)],
    ['108', 'Input Tax Credits (ITC)', summary.gst.gst_paid.toFixed(2)],
    ['109', 'Net Tax Payable', summary.gst.net_gst_payable.toFixed(2)],
  ]
  return toCSV(headers, rows)
}

export function buildPersonalSummaryCSV(summary: TaxSummary): string {
  const p = summary.personal
  const headers = ['T1 Line', 'Form / Box', 'Description', 'Amount (CAD)']
  const rows = [
    ['10100', 'T4 Box 14', 'Employment Income', p.employment_income.toFixed(2)],
    ['12010', 'T5 Box 24', 'Eligible Dividends (actual)', p.eligible_dividends_actual.toFixed(2)],
    ['12000', '', 'Eligible Dividends (grossed up ×1.38)', p.eligible_dividends_grossed.toFixed(2)],
    ['12019', 'T5 Box 10', 'Non-Eligible Dividends (actual)', p.non_eligible_dividends_actual.toFixed(2)],
    ['12000', '', 'Non-Eligible Dividends (grossed up ×1.15)', p.non_eligible_dividends_grossed.toFixed(2)],
    ['12000', '', 'Total Taxable Dividends', p.total_taxable_dividends.toFixed(2)],
    ['13000', '', 'Other Income (personal accounts)', p.other_income.toFixed(2)],
    ['15000', '', 'Total Personal Income (excl. business)', p.total_income.toFixed(2)],
  ]
  return toCSV(headers, rows)
}

export function buildBusinessSummaryCSV(summary: TaxSummary): string {
  const b = summary.business
  const headers = ['T2125 Line', 'Description', 'Amount (CAD)']
  const rows = [
    ['8000', 'Gross Business Revenue', b.gross_income.toFixed(2)],
    ['9270', 'Total Business Expenses', b.total_expenses.toFixed(2)],
    ['9946', 'Net Business Income → T1 Line 13500', b.net_income.toFixed(2)],
  ]
  return toCSV(headers, rows)
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

export function buildTaxPDF(summary: TaxSummary): Blob {
  const doc = new jsPDF()
  const lineH = 8
  let y = 20

  const h1 = (text: string) => {
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(text, 14, y)
    y += lineH + 2
  }

  const h2 = (text: string) => {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(40, 40, 40)
    doc.text(text, 14, y)
    y += lineH
  }

  const row = (label: string, value: number) => {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60, 60, 60)
    doc.text(label, 20, y)
    doc.text(formatCAD(value), 150, y, { align: 'right' })
    y += lineH - 1
  }

  const divider = () => {
    doc.setDrawColor(200, 200, 200)
    doc.line(14, y, 196, y)
    y += 4
  }

  h1(`Canadian Tax Summary — ${summary.year}`)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(120, 120, 120)
  doc.text(`Generated: ${new Date(summary.generated_at).toLocaleString('en-CA')}`, 14, y)
  y += lineH + 2
  divider()

  h2('Personal Income (T1)')
  row('Line 10100 — Employment Income (T4)', summary.personal.employment_income)
  row('Line 12010 — Eligible Dividends, actual (T5)', summary.personal.eligible_dividends_actual)
  row('Line 12000 — Eligible Dividends, grossed up (×1.38)', summary.personal.eligible_dividends_grossed)
  row('Line 12019 — Non-Eligible Dividends, actual (T5)', summary.personal.non_eligible_dividends_actual)
  row('Line 12000 — Non-Eligible Dividends, grossed up (×1.15)', summary.personal.non_eligible_dividends_grossed)
  row('Line 12000 — Total Taxable Dividends', summary.personal.total_taxable_dividends)
  row('Line 13000 — Other Income', summary.personal.other_income)
  row('Line 15000 — Total Income (excl. business)', summary.personal.total_income)
  y += 4
  divider()

  h2('Business Income (T2125)')
  row('Line 8000 — Gross Business Revenue', summary.business.gross_income)
  row('Line 9270 — Total Business Expenses', summary.business.total_expenses)
  row('Line 9946 — Net Business Income → T1 Line 13500', summary.business.net_income)
  y += 4
  divider()

  h2('GST/HST Return (GST34)')
  row('Line 101 — Total Sales & Revenue', summary.business.gross_income)
  row('Line 105 — GST/HST Collected', summary.gst.gst_collected)
  row('Line 108 — Input Tax Credits (ITC)', summary.gst.gst_paid)
  row('Line 109 — Net Tax Payable', summary.gst.net_gst_payable)
  y += 4

  return doc.output('blob')
}

// ---------------------------------------------------------------------------
// ZIP bundle
// ---------------------------------------------------------------------------

export async function downloadTaxPackage(
  transactions: Transaction[],
  summary: TaxSummary
): Promise<void> {
  const zip = new JSZip()

  zip.file('transactions.csv', buildTransactionsCSV(transactions))
  zip.file('personal_summary.csv', buildPersonalSummaryCSV(summary))
  zip.file('business_summary.csv', buildBusinessSummaryCSV(summary))
  zip.file('gst_summary.csv', buildGSTSummaryCSV(summary))
  zip.file('tax_summary.json', JSON.stringify(summary, null, 2))
  zip.file('tax_summary.pdf', buildTaxPDF(summary))

  const blob = await zip.generateAsync({ type: 'blob' })
  saveAs(blob, `tax-package-${summary.year}.zip`)
}
