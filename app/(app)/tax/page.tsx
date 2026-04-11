'use client'

import { useState } from 'react'
import { useHousehold } from '@/hooks/useHousehold'
import { useTransactions } from '@/hooks/useTransactions'
import { useTaxSummary } from '@/hooks/useTaxSummary'
import TaxSection from '@/components/TaxSection'
import { getCurrentTaxYear } from '@/utils/format'
import { downloadTaxPackage } from '@/utils/export'
import { Download, RefreshCw, FileText } from 'lucide-react'

type Tab = 'personal' | 'business'

export default function TaxPage() {
  const [year, setYear] = useState(getCurrentTaxYear())
  const [tab, setTab] = useState<Tab>('personal')
  const [downloading, setDownloading] = useState(false)

  const { household, loading: hhLoading } = useHousehold()
  const { transactions } = useTransactions({ householdId: household?.id, year })
  const { summary, loading, error, refetch } = useTaxSummary(household?.id, year)

  const currentYear = getCurrentTaxYear()
  const years = [currentYear, currentYear - 1, currentYear - 2]

  const handleDownload = async () => {
    if (!summary) return
    setDownloading(true)
    try {
      await downloadTaxPackage(transactions, summary)
    } catch (e) {
      console.error(e)
    } finally {
      setDownloading(false)
    }
  }

  if (hhLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Tax Report</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            CRA-ready values — copy each field directly into your tax software or forms.
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            {years.map((y) => <option key={y} value={y}>{y} Tax Year</option>)}
          </select>

          <button
            onClick={refetch}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={handleDownload}
            disabled={downloading || !summary}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:justify-start"
          >
            <Download className="h-4 w-4" />
            {downloading ? 'Preparing…' : 'Download Tax Package'}
          </button>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>Note:</strong> These figures are calculated from your recorded transactions.
        Always verify with a qualified accountant before filing. Generated:{' '}
        {summary ? new Date(summary.generated_at).toLocaleString('en-CA') : '—'}
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex border-b border-gray-200">
        <button
          onClick={() => setTab('personal')}
          className={`mr-6 border-b-2 pb-3 text-sm font-medium transition-colors ${
            tab === 'personal'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
          }`}
        >
          Personal (T1)
        </button>
        <button
          onClick={() => setTab('business')}
          className={`mr-6 border-b-2 pb-3 text-sm font-medium transition-colors ${
            tab === 'business'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
          }`}
        >
          Business (T2125 + GST34)
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : !summary ? (
        <div className="flex justify-center py-20 text-sm text-gray-500">
          No data found for {year}.
        </div>
      ) : tab === 'personal' ? (
        <div className="space-y-6">
          {/* T4 — Employment Income */}
          <TaxSection
            title="Employment Income — T4"
            subtitle="Copy Line 10100 into your T1 General return"
            fields={[
              {
                label: 'Line 10100 — Employment Income',
                value: summary.personal.employment_income,
                description: 'T4 Box 14 — Total salary and wages received',
              },
            ]}
          />

          {/* T5 — Dividend Income */}
          <TaxSection
            title="Dividend Income — T5"
            subtitle="Copy each line into the Investment Income section of your T1"
            fields={[
              {
                label: 'Line 12010 — Eligible Dividends (actual)',
                value: summary.personal.eligible_dividends_actual,
                description: 'T5 Box 24 — Actual amount of eligible dividends received',
              },
              {
                label: 'Line 12000 — Eligible Dividends (taxable, ×1.38)',
                value: summary.personal.eligible_dividends_grossed,
                description: 'T5 Box 26 — Grossed-up amount to enter on T1 Line 12000',
              },
              {
                label: 'Line 12019 — Non-Eligible Dividends (actual)',
                value: summary.personal.non_eligible_dividends_actual,
                description: 'T5 Box 10 — Actual amount of non-eligible dividends received',
              },
              {
                label: 'Line 12000 — Non-Eligible Dividends (taxable, ×1.15)',
                value: summary.personal.non_eligible_dividends_grossed,
                description: 'T5 Box 11 — Grossed-up amount to enter on T1 Line 12000',
              },
              {
                label: 'Line 12000 — Total Taxable Dividends',
                value: summary.personal.total_taxable_dividends,
                description: 'Sum of all grossed-up dividends — enter on T1 Line 12000',
              },
            ]}
          />

          {/* Other Personal Income */}
          <TaxSection
            title="Other Income — Personal Accounts"
            subtitle="Unclassified income from personal accounts — T1 Line 13000"
            fields={[
              {
                label: 'Line 13000 — Other Income',
                value: summary.personal.other_income,
                description: 'Personal account income not tagged as employment or dividends',
              },
            ]}
          />

          {/* Personal Subtotal */}
          <TaxSection
            title="Personal Income Subtotal — T1 Line 15000"
            subtitle="Total before deductions, excluding self-employment income (see Business tab)"
            fields={[
              {
                label: 'Line 15000 — Total Personal Income',
                value: summary.personal.total_income,
                description: 'Line 10100 + Line 12000 + Line 13000 — enter on T1 Line 15000',
              },
            ]}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* T2125 — Business Income */}
          <TaxSection
            title="Statement of Business Activities — T2125"
            subtitle="Complete T2125 and carry Line 9946 to T1 Line 13500"
            fields={[
              {
                label: 'Line 8000 — Gross Business Revenue',
                value: summary.business.gross_income,
                description: 'Total revenue from business activities — enter on T2125 Line 8000',
              },
              {
                label: 'Line 9270 — Total Business Expenses',
                value: summary.business.total_expenses,
                description: 'All deductible business expenses — enter on T2125 Line 9270',
              },
              {
                label: 'Line 9946 — Net Business Income',
                value: summary.business.net_income,
                description: 'Gross revenue minus expenses — carry to T1 Line 13500',
              },
            ]}
          />

          {/* GST34 */}
          <TaxSection
            title="GST/HST Return — GST34"
            subtitle="File with CRA separately from your T1 — typically quarterly or annually"
            fields={[
              {
                label: 'Line 101 — Total Sales & Revenue',
                value: summary.business.gross_income,
                description: 'Total business revenue for the reporting period',
              },
              {
                label: 'Line 105 — GST/HST Collected',
                value: summary.gst.gst_collected,
                description: 'GST/HST charged to customers on taxable supplies',
              },
              {
                label: 'Line 108 — Input Tax Credits (ITC)',
                value: summary.gst.gst_paid,
                description: 'GST/HST paid on business expenses — claimable as ITC',
              },
              {
                label: 'Line 109 — Net Tax Payable',
                value: summary.gst.net_gst_payable,
                description: 'Line 105 minus Line 108 — remit to CRA if positive, claim refund if negative',
              },
            ]}
          />
        </div>
      )}
    </div>
  )
}
