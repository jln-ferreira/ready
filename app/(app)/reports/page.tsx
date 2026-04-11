'use client'

import { useState } from 'react'
import { useHousehold } from '@/hooks/useHousehold'
import { useTransactions } from '@/hooks/useTransactions'
import StatCard from '@/components/StatCard'
import { getCurrentTaxYear } from '@/utils/format'
import { BarChart2, TrendingUp, TrendingDown, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import type { AccountType } from '@/types'

type Tab = 'personal' | 'business'
type BarSortField = 'name' | 'amount'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const CAD = (n: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)

function SortIcon({ field, activeField, dir }: { field: BarSortField; activeField: BarSortField; dir: 'asc' | 'desc' }) {
  if (field !== activeField) return <ArrowUpDown className="h-3 w-3 opacity-40" />
  return dir === 'asc' ? <ArrowUp className="h-3 w-3 text-blue-600" /> : <ArrowDown className="h-3 w-3 text-blue-600" />
}

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('personal')
  const [year, setYear] = useState(getCurrentTaxYear())
  const [month, setMonth] = useState(0)
  const [barSortField, setBarSortField] = useState<BarSortField>('amount')
  const [barSortDir, setBarSortDir] = useState<'asc' | 'desc'>('desc')

  const { household, accounts, loading: hhLoading } = useHousehold()
  const { transactions, loading } = useTransactions({ householdId: household?.id, year })

  const tabAccountIds = new Set(
    accounts.filter((a) => a.type === (tab as AccountType)).map((a) => a.id)
  )
  const tabTransactions = transactions.filter(
    (tx) => tx.account_id && tabAccountIds.has(tx.account_id)
  )

  const visibleTransactions = month === 0
    ? tabTransactions
    : tabTransactions.filter((tx) =>
        tx.date.startsWith(`${year}-${String(month).padStart(2, '0')}`)
      )

  const expenseByCategory: Record<string, number> = {}
  const incomeByCategory: Record<string, number> = {}
  let totalIncome = 0
  let totalExpenses = 0
  let gstCollected = 0
  let gstPaid = 0

  for (const tx of visibleTransactions) {
    const cat = tx.category?.name ?? 'Uncategorized'
    if (tx.type === 'expense') {
      expenseByCategory[cat] = (expenseByCategory[cat] ?? 0) + tx.amount
      totalExpenses += tx.amount
    } else {
      incomeByCategory[cat] = (incomeByCategory[cat] ?? 0) + tx.amount
      totalIncome += tx.amount
    }
    if (tx.gst_entry?.gst_type === 'collected') gstCollected += tx.gst_entry.gst_amount
    if (tx.gst_entry?.gst_type === 'paid') gstPaid += tx.gst_entry.gst_amount
  }

  const compareFn = (a: [string, number], b: [string, number]) => {
    const cmp = barSortField === 'name' ? a[0].localeCompare(b[0]) : a[1] - b[1]
    return barSortDir === 'asc' ? cmp : -cmp
  }
  const sortedExpenses = Object.entries(expenseByCategory).sort(compareFn)
  const sortedIncome = Object.entries(incomeByCategory).sort(compareFn)

  const handleBarSort = (field: BarSortField) => {
    if (barSortField === field) {
      setBarSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    } else {
      setBarSortField(field)
      setBarSortDir(field === 'amount' ? 'desc' : 'asc')
    }
  }

  const currentYear = getCurrentTaxYear()
  const years = [currentYear, currentYear - 1, currentYear - 2]
  const periodLabel = month === 0 ? `${year}` : `${MONTHS[month - 1]} ${year}`

  if (hhLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  const CategoryHeader = () => (
    <div className="flex items-center gap-3 border-b border-gray-100 px-3 py-2 sm:gap-4 sm:px-6">
      <button
        onClick={() => handleBarSort('name')}
        className={`flex w-20 items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors sm:w-32 ${
          barSortField === 'name' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        Category
        <SortIcon field="name" activeField={barSortField} dir={barSortDir} />
      </button>
      <div className="flex-1" />
      <button
        onClick={() => handleBarSort('amount')}
        className={`flex w-20 items-center justify-end gap-1 text-xs font-semibold uppercase tracking-wide transition-colors sm:w-28 ${
          barSortField === 'amount' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        <SortIcon field="amount" activeField={barSortField} dir={barSortDir} />
        Amount
      </button>
    </div>
  )

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="mt-1 text-sm text-gray-500">Financial overview — {periodLabel}</p>
        </div>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex border-b border-gray-200">
        {(['personal', 'business'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`mr-6 border-b-2 pb-3 text-sm capitalize transition-colors ${
              tab === t
                ? t === 'personal'
                  ? 'border-blue-600 font-semibold text-blue-700'
                  : 'border-emerald-600 font-semibold text-emerald-700'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Month filter */}
      <div className="mb-6">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value={0}>All months</option>
          {MONTHS.map((name, i) => (
            <option key={i + 1} value={i + 1}>{name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total Income" amount={totalIncome} colorClass="text-green-700" subtitle={periodLabel} />
            <StatCard label="Total Expenses" amount={totalExpenses} colorClass="text-red-700" subtitle={periodLabel} />
            {tab === 'business' && (
              <>
                <StatCard label="GST Collected" amount={gstCollected} colorClass="text-blue-700" />
                <StatCard label="Net GST Payable" amount={gstCollected - gstPaid} colorClass="text-purple-700" />
              </>
            )}
          </div>

          {/* Net income */}
          <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              {totalIncome - totalExpenses >= 0
                ? <TrendingUp className="h-6 w-6 text-green-600" />
                : <TrendingDown className="h-6 w-6 text-red-600" />
              }
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Net {tab === 'personal' ? 'Personal' : 'Business'} Income — {periodLabel}
                </p>
                <p className={`text-3xl font-bold tabular-nums ${totalIncome - totalExpenses >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {CAD(totalIncome - totalExpenses)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Income by category */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-4 py-4 sm:px-6">
                <div className="flex items-center gap-2">
                  <BarChart2 className="h-5 w-5 text-green-500" />
                  <h2 className="text-base font-semibold text-gray-900">Income by Category</h2>
                </div>
              </div>
              {sortedIncome.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-400 sm:px-6">No income recorded for {periodLabel}.</p>
              ) : (
                <>
                  <CategoryHeader />
                  <div className="divide-y divide-gray-100">
                    {sortedIncome.map(([cat, amount]) => {
                      const pct = totalIncome > 0 ? (amount / totalIncome) * 100 : 0
                      return (
                        <div key={cat} className="flex items-center gap-3 px-3 py-3 sm:gap-4 sm:px-6">
                          <div className="w-20 truncate text-sm font-medium text-gray-700 sm:w-32">{cat}</div>
                          <div className="flex flex-1 items-center gap-2 sm:gap-3">
                            <div className="h-2 flex-1 rounded-full bg-gray-100">
                              <div className="h-2 rounded-full bg-green-400" style={{ width: `${pct.toFixed(1)}%` }} />
                            </div>
                            <span className="w-8 text-right text-xs text-gray-400 sm:w-10">{pct.toFixed(0)}%</span>
                          </div>
                          <div className="w-20 text-right text-sm font-semibold tabular-nums text-gray-900 sm:w-28">
                            {CAD(amount)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Expenses by category */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-4 py-4 sm:px-6">
                <div className="flex items-center gap-2">
                  <BarChart2 className="h-5 w-5 text-red-400" />
                  <h2 className="text-base font-semibold text-gray-900">Expenses by Category</h2>
                </div>
              </div>
              {sortedExpenses.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-400 sm:px-6">No expenses recorded for {periodLabel}.</p>
              ) : (
                <>
                  <CategoryHeader />
                  <div className="divide-y divide-gray-100">
                    {sortedExpenses.map(([cat, amount]) => {
                      const pct = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
                      return (
                        <div key={cat} className="flex items-center gap-3 px-3 py-3 sm:gap-4 sm:px-6">
                          <div className="w-20 truncate text-sm font-medium text-gray-700 sm:w-32">{cat}</div>
                          <div className="flex flex-1 items-center gap-2 sm:gap-3">
                            <div className="h-2 flex-1 rounded-full bg-gray-100">
                              <div className="h-2 rounded-full bg-red-400" style={{ width: `${pct.toFixed(1)}%` }} />
                            </div>
                            <span className="w-8 text-right text-xs text-gray-400 sm:w-10">{pct.toFixed(0)}%</span>
                          </div>
                          <div className="w-20 text-right text-sm font-semibold tabular-nums text-gray-900 sm:w-28">
                            {CAD(amount)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
