'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useHousehold } from '@/hooks/useHousehold'
import { useTransactions } from '@/hooks/useTransactions'
import TransactionForm from '@/components/TransactionForm'
import type { TransactionFormData } from '@/types'

export default function NewTransactionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const memberId = searchParams.get('memberId') ?? undefined

  const { household, accounts, categories, loading } = useHousehold()
  const { addTransaction, transactions } = useTransactions({ householdId: household?.id })

  const handleSubmit = async (data: TransactionFormData) => {
    if (!household) return { error: 'No household found' }
    const result = await addTransaction(data, household.id, memberId)
    return result
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-8">
      <button
        onClick={() => router.push('/transactions')}
        className="mb-6 flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Transactions
      </button>

      <h1 className="mb-1 text-2xl font-bold text-gray-900">New Transaction</h1>
      <p className="mb-6 text-sm text-gray-500">
        Select an account to determine if this is personal or business.
        Categories update automatically based on income or expense type.
      </p>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <TransactionForm
          accounts={accounts}
          categories={categories}
          pastTransactions={transactions}
          onSubmit={handleSubmit}
          onSuccess={() => router.push('/transactions')}
          submitLabel="Add Transaction"
        />
      </div>
    </div>
  )
}
