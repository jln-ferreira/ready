'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useHousehold } from '@/hooks/useHousehold'
import { useTransactions } from '@/hooks/useTransactions'
import TransactionForm from '@/components/TransactionForm'
import type { Transaction, TransactionFormData } from '@/types'

function transactionToFormData(tx: Transaction): TransactionFormData {
  return {
    date: tx.date,
    amount: tx.amount.toString(),
    type: tx.type,
    account_id: tx.account_id ?? '',
    category_id: tx.category_id ?? '',
    description: tx.description ?? '',
    has_gst: !!tx.gst_entry,
    gst_amount: tx.gst_entry?.gst_amount.toString() ?? '',
    gst_type: tx.gst_entry?.gst_type ?? 'paid',
    is_income_detail: !!tx.income_detail,
    income_type: tx.income_detail?.income_type ?? 'salary',
    dividend_type: tx.income_detail?.dividend_type ?? null,
  }
}

export default function EditTransactionPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()

  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [txLoading, setTxLoading] = useState(true)
  const [txError, setTxError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { household, accounts, categories, loading: hhLoading } = useHousehold()
  const { updateTransaction, deleteTransaction } = useTransactions({ householdId: household?.id })

  useEffect(() => {
    async function load() {
      setTxLoading(true)
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          account:accounts(*),
          category:categories(*),
          gst_entry:gst_entries(*),
          income_detail:income_details(*)
        `)
        .eq('id', id)
        .single()

      if (error || !data) {
        setTxError('Transaction not found.')
      } else {
        setTransaction(data as Transaction)
      }
      setTxLoading(false)
    }
    load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (data: TransactionFormData) => {
    return updateTransaction(id, data)
  }

  const handleDelete = async () => {
    if (!confirm('Delete this transaction? This cannot be undone.')) return
    setDeleting(true)
    await deleteTransaction(id)
    router.push('/transactions')
  }

  const loading = txLoading || hhLoading

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  if (txError || !transaction) {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-8">
        <button
          onClick={() => router.push('/transactions')}
          className="mb-6 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Transactions
        </button>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {txError ?? 'Transaction not found.'}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      {/* Back + Delete */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => router.push('/transactions')}
          className="flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Transactions
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          {deleting ? 'Deleting…' : 'Delete Transaction'}
        </button>
      </div>

      <h1 className="mb-1 text-2xl font-bold text-gray-900">Edit Transaction</h1>
      <p className="mb-6 text-sm text-gray-500">
        {transaction.date} · {transaction.account?.name ?? 'No account'} ·{' '}
        <span className={transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}>
          {transaction.type}
        </span>
      </p>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <TransactionForm
          accounts={accounts}
          categories={categories}
          initialData={transactionToFormData(transaction)}
          submitLabel="Save Changes"
          onSubmit={handleSubmit}
          onSuccess={() => router.push('/transactions')}
        />
      </div>
    </div>
  )
}
