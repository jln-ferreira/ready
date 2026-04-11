'use client'

import { useEffect } from 'react'
import { X, Trash2 } from 'lucide-react'
import TransactionForm from './TransactionForm'
import type { Transaction, Account, Category, TransactionFormData } from '@/types'

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

interface EditTransactionModalProps {
  transaction: Transaction
  accounts: Account[]
  categories: Category[]
  onUpdate: (id: string, data: TransactionFormData) => Promise<{ error: string | null }>
  onDelete: (id: string) => Promise<{ error: string | null }>
  onClose: () => void
}

export default function EditTransactionModal({
  transaction,
  accounts,
  categories,
  onUpdate,
  onDelete,
  onClose,
}: EditTransactionModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSubmit = (data: TransactionFormData) => onUpdate(transaction.id, data)

  const handleDelete = async () => {
    if (!confirm('Delete this transaction? This cannot be undone.')) return
    await onDelete(transaction.id)
    onClose()
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl" style={{ maxHeight: '90dvh' }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Edit Transaction</h2>
            <p className="mt-0.5 text-xs text-gray-400">
              {transaction.date} · {transaction.account?.name ?? 'No account'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="p-4 sm:p-6">
          <TransactionForm
            accounts={accounts}
            categories={categories}
            initialData={transactionToFormData(transaction)}
            submitLabel="Save Changes"
            onSubmit={handleSubmit}
            onSuccess={onClose}
          />
        </div>
      </div>
    </div>
  )
}
