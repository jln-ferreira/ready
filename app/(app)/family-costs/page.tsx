'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useHousehold } from '@/hooks/useHousehold'
import { useTransactions } from '@/hooks/useTransactions'
import TransactionTable from '@/components/TransactionTable'
import EditTransactionModal from '@/components/EditTransactionModal'
import type { Transaction, TransactionFormData } from '@/types'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const fmt = (n: number) =>
  n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })

export default function FamilyCostsPage() {
  const supabase = createClient()
  const now = new Date()

  const { household, accounts, categories, loading: householdLoading } = useHousehold()
  const [currentUserId, setCurrentUserId] = useState<string | undefined>()
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)

  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState<number | null>(now.getMonth() + 1) // 1-based; null = all year

  const { transactions, loading, updateTransaction, deleteTransaction } = useTransactions({
    householdId: household?.id,
    year,
    month: month ?? undefined,
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Personal accounts only
  const personalTx = useMemo(
    () => transactions.filter(tx => !tx.account || tx.account.type === 'personal'),
    [transactions]
  )

  const income   = personalTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expenses = personalTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const net      = income - expenses

  const handleUpdate = async (id: string, data: TransactionFormData) => {
    const result = await updateTransaction(id, data)
    if (!result.error) setEditingTx(null)
    return result
  }

  const handleDelete = async (id: string) => {
    const result = await deleteTransaction(id)
    if (!result.error) setEditingTx(null)
    return result
  }

  if (householdLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="h-6 w-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-6 max-w-5xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Family Costs</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          {household?.name} · personal accounts only · you can only edit your own
        </p>
      </div>

      {/* ── Year navigator ── */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setYear(y => y - 1)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-base font-semibold text-gray-900 w-12 text-center">{year}</span>
        <button
          onClick={() => setYear(y => y + 1)}
          disabled={year >= now.getFullYear()}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* ── Month selector ── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setMonth(null)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            month === null
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        {MONTHS.map((label, i) => {
          const m = i + 1
          const isFuture = year === now.getFullYear() && m > now.getMonth() + 1
          return (
            <button
              key={m}
              onClick={() => setMonth(m)}
              disabled={isFuture}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                month === m
                  ? 'bg-blue-600 text-white'
                  : isFuture
                  ? 'text-gray-300 cursor-default'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
          <p className="text-xs text-gray-500">Income</p>
          <p className="text-sm sm:text-base font-semibold text-green-700 mt-1 tabular-nums truncate">{fmt(income)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
          <p className="text-xs text-gray-500">Expenses</p>
          <p className="text-sm sm:text-base font-semibold text-red-700 mt-1 tabular-nums truncate">{fmt(expenses)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
          <p className="text-xs text-gray-500">Net</p>
          <p className={`text-sm sm:text-base font-semibold mt-1 tabular-nums truncate ${net >= 0 ? 'text-gray-900' : 'text-red-700'}`}>
            {fmt(net)}
          </p>
        </div>
      </div>

      {/* ── Transactions ── */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
        </div>
      ) : (
        <TransactionTable
          transactions={personalTx}
          currentUserId={currentUserId}
          onEdit={tx => currentUserId && tx.user_id === currentUserId ? setEditingTx(tx) : undefined}
          onDelete={handleDelete}
        />
      )}

      {editingTx && (
        <EditTransactionModal
          transaction={editingTx}
          accounts={accounts}
          categories={categories}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onClose={() => setEditingTx(null)}
        />
      )}
    </div>
  )
}
