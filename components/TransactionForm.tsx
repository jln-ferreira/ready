'use client'

import { useState } from 'react'
import type { Account, Category, TransactionFormData, TransactionType, GSTType, IncomeType, DividendType } from '@/types'
import { filterCategoriesByType } from '@/utils/categories'
import { suggestCategory, type PastTx } from '@/utils/suggestCategory'
import { Sparkles, X } from 'lucide-react'

interface TransactionFormProps {
  accounts: Account[]
  categories: Category[]
  pastTransactions?: PastTx[]
  onSubmit: (data: TransactionFormData) => Promise<{ error: string | null }>
  onSuccess?: () => void
  initialData?: TransactionFormData
  submitLabel?: string
}

const DEFAULT_FORM: TransactionFormData = {
  date: new Date().toISOString().split('T')[0],
  amount: '',
  type: 'expense',
  account_id: '',
  category_id: '',
  description: '',
  has_gst: false,
  gst_amount: '',
  gst_type: 'paid',
  is_income_detail: false,
  income_type: 'salary',
  dividend_type: null,
}

export default function TransactionForm({
  accounts,
  categories,
  pastTransactions = [],
  onSubmit,
  onSuccess,
  initialData,
  submitLabel = 'Add Transaction',
}: TransactionFormProps) {
  const [form, setForm] = useState<TransactionFormData>(initialData ?? DEFAULT_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [suggestion, setSuggestion] = useState<{ id: string; name: string } | null>(null)

  const set = <K extends keyof TransactionFormData>(key: K, value: TransactionFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  // All accounts shown — user picks personal or business account explicitly
  const visibleAccounts = accounts

  // Filter categories based on selected transaction type
  const visibleCategories = filterCategoriesByType(categories, form.type)

  const handleDescriptionBlur = () => {
    // Only suggest if no category is already selected
    if (form.category_id) return
    const id = suggestCategory(form.description, visibleCategories, pastTransactions)
    if (!id) { setSuggestion(null); return }
    const cat = visibleCategories.find(c => c.id === id)
    if (cat) setSuggestion({ id, name: cat.name })
  }

  const acceptSuggestion = () => {
    if (!suggestion) return
    set('category_id', suggestion.id)
    setSuggestion(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!form.amount || isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) {
      setError('Please enter a valid amount.')
      return
    }

    setSubmitting(true)
    const { error: err } = await onSubmit(form)
    setSubmitting(false)

    if (err) {
      setError(err)
    } else {
      setSuccess(true)
      setForm(DEFAULT_FORM)
      onSuccess?.()
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Transaction added successfully!
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Date */}
        <div className="col-span-1">
          <label className="block text-xs font-medium text-gray-700">Date</label>
          <input
            type="date"
            required
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Type */}
        <div className="col-span-1">
          <label className="block text-xs font-medium text-gray-700">Type</label>
          <select
            value={form.type}
            onChange={(e) => {
              const t = e.target.value as TransactionType
              // Reset category when type changes since the list will change
              setForm((prev) => ({
                ...prev,
                type: t,
                category_id: '',
                gst_type: t === 'expense' ? 'paid' : 'collected',
                is_income_detail: t === 'expense' ? false : prev.is_income_detail,
              }))
              setSuggestion(null)
            }}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </div>

        {/* Amount */}
        <div className="col-span-1">
          <label className="block text-xs font-medium text-gray-700">Amount (CAD)</label>
          <div className="relative mt-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
              className="w-full rounded-md border border-gray-300 pl-7 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Account — pre-filtered to tab context */}
        <div className="col-span-1">
          <label className="block text-xs font-medium text-gray-700">Account</label>
          <select
            value={form.account_id}
            onChange={(e) => set('account_id', e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select account</option>
            {['personal', 'business'].map((type) => {
              const group = visibleAccounts.filter((a) => a.type === type)
              if (group.length === 0) return null
              return (
                <optgroup key={type} label={type === 'personal' ? 'Personal' : 'Business'}>
                  {group.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </optgroup>
              )
            })}
          </select>
        </div>

        {/* Category — filtered by income/expense */}
        <div className="col-span-1">
          <label className="block text-xs font-medium text-gray-700">
            Category
            <span className="ml-1 text-gray-400">
              ({form.type === 'income' ? 'income' : 'expense'})
            </span>
          </label>
          <select
            value={form.category_id}
            onChange={(e) => { set('category_id', e.target.value); setSuggestion(null) }}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select category</option>
            {visibleCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {suggestion && (
            <div className="mt-1.5 flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-2.5 py-1.5">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-blue-500" />
              <span className="text-xs text-blue-700">
                Suggested: <strong>{suggestion.name}</strong>
              </span>
              <button
                type="button"
                onClick={acceptSuggestion}
                className="ml-auto rounded px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
              >
                Use
              </button>
              <button
                type="button"
                onClick={() => setSuggestion(null)}
                className="text-blue-400 hover:text-blue-600"
                aria-label="Dismiss suggestion"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="col-span-1">
          <label className="block text-xs font-medium text-gray-700">Description</label>
          <input
            type="text"
            placeholder="Optional note"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            onBlur={handleDescriptionBlur}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* GST toggle */}
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-3">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={form.has_gst}
            onChange={(e) => set('has_gst', e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">Include GST</span>
        </label>

        {form.has_gst && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-700">GST Amount</label>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.gst_amount}
                  onChange={(e) => set('gst_amount', e.target.value)}
                  className="w-full rounded-md border border-gray-300 pl-7 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">GST Type</label>
              <select
                value={form.gst_type}
                onChange={(e) => set('gst_type', e.target.value as GSTType)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="collected">Collected (from customer)</option>
                <option value="paid">Paid / ITC (to supplier)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Income detail toggle */}
      {form.type === 'income' && (
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={form.is_income_detail}
              onChange={(e) => set('is_income_detail', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Classify income type</span>
          </label>

          {form.is_income_detail && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-700">Income Type</label>
                <select
                  value={form.income_type}
                  onChange={(e) => {
                    set('income_type', e.target.value as IncomeType)
                    if (e.target.value !== 'dividend') set('dividend_type', null)
                  }}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="salary">Salary / Employment</option>
                  <option value="dividend">Dividend</option>
                </select>
              </div>
              {form.income_type === 'dividend' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700">Dividend Type</label>
                  <select
                    value={form.dividend_type ?? 'eligible'}
                    onChange={(e) => set('dividend_type', e.target.value as DividendType)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="eligible">Eligible</option>
                    <option value="non_eligible">Non-Eligible</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  )
}
