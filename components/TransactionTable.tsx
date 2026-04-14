'use client'

import { useState } from 'react'
import { Trash2, Pencil, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import type { Transaction, SortKey } from '@/types'
import { formatCAD } from '@/utils/format'

interface TransactionTableProps {
  transactions: Transaction[]
  onEdit?: (tx: Transaction) => void
  onDelete?: (id: string) => Promise<{ error: string | null }>
  sortBy?: SortKey
  onSort?: (key: SortKey) => void
  /** If provided, edit/delete actions are only shown for transactions owned by this user */
  currentUserId?: string
}

type SortField = 'date' | 'category' | 'type' | 'amount'

function SortIcon({ field, sortBy }: { field: SortField; sortBy?: SortKey }) {
  if (!sortBy) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
  const lastUnderscore = sortBy.lastIndexOf('_')
  const activeField = sortBy.slice(0, lastUnderscore)
  const dir = sortBy.slice(lastUnderscore + 1)
  if (activeField !== field) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
  return dir === 'asc'
    ? <ArrowUp className="h-3.5 w-3.5 text-blue-600" />
    : <ArrowDown className="h-3.5 w-3.5 text-blue-600" />
}

export default function TransactionTable({
  transactions, onEdit, onDelete, sortBy, onSort, currentUserId,
}: TransactionTableProps) {
  const canAct = (tx: Transaction) =>
    !currentUserId || tx.user_id === currentUserId
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!onDelete) return
    if (!confirm('Delete this transaction?')) return
    setDeletingId(id)
    await onDelete(id)
    setDeletingId(null)
  }

  const handleSort = (field: SortField) => {
    if (!onSort) return
    const lastUnderscore = sortBy?.lastIndexOf('_') ?? -1
    const activeField = sortBy ? sortBy.slice(0, lastUnderscore) : ''
    const activeDir = sortBy ? sortBy.slice(lastUnderscore + 1) : ''
    const newDir = activeField === field && activeDir === 'asc' ? 'desc' : 'asc'
    onSort(`${field}_${newDir}` as SortKey)
  }

  const thClass = (field: SortField) =>
    `group cursor-pointer select-none px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-800 ${
      sortBy?.startsWith(field) ? 'text-blue-700' : ''
    }`

  if (transactions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 px-6 py-12 text-center">
        <p className="text-sm text-gray-500">No transactions yet. Add your first one above.</p>
      </div>
    )
  }

  return (
    <>
      {/* ── Card list (< lg) ── */}
      <div className="space-y-2 lg:hidden">
        {transactions.map((tx) => (
          <div
            key={tx.id}
            onClick={() => onEdit?.(tx)}
            className={`rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm ${
              onEdit ? 'cursor-pointer active:bg-blue-50' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">
                  {tx.description ?? '—'}
                </p>
                {tx.income_detail && (
                  <span className="mt-0.5 inline-block rounded-full bg-purple-100 px-1.5 py-0.5 text-xs text-purple-700">
                    {tx.income_detail.income_type}
                    {tx.income_detail.dividend_type ? ` · ${tx.income_detail.dividend_type}` : ''}
                  </span>
                )}
              </div>
              <p className={`shrink-0 text-sm font-semibold tabular-nums ${
                tx.type === 'income' ? 'text-green-700' : 'text-red-700'
              }`}>
                {tx.type === 'income' ? '+' : '-'}{formatCAD(tx.amount)}
              </p>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
              <span>{tx.date}</span>
              {tx.account  && <><span>·</span><span>{tx.account.name}</span></>}
              {tx.category && <><span>·</span><span>{tx.category.name}</span></>}
              <span className={`rounded-full px-1.5 py-0.5 font-medium ${
                tx.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {tx.type}
              </span>
              {tx.gst_entry && (
                <span className={`rounded-full px-1.5 py-0.5 ${
                  tx.gst_entry.gst_type === 'collected'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-orange-100 text-orange-700'
                }`}>
                  GST {tx.gst_entry.gst_type === 'collected' ? 'coll.' : 'paid'}{' '}
                  {formatCAD(tx.gst_entry.gst_amount)}
                </span>
              )}
            </div>

            {(onEdit || onDelete) && canAct(tx) && (
              <div className="mt-2 flex justify-end gap-3">
                {onEdit && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(tx) }}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => handleDelete(e, tx.id)}
                    disabled={deletingId === tx.id}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Table (lg+) ── */}
      <div className="hidden rounded-xl border border-gray-200 lg:block">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th onClick={() => handleSort('date')} className={thClass('date')}>
                <span className="flex items-center gap-1">
                  Date <SortIcon field="date" sortBy={sortBy} />
                </span>
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Description
              </th>
              <th className="hidden px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 xl:table-cell">
                Account
              </th>
              <th onClick={() => handleSort('category')} className={`hidden xl:table-cell ${thClass('category')}`}>
                <span className="flex items-center gap-1">
                  Category <SortIcon field="category" sortBy={sortBy} />
                </span>
              </th>
              <th onClick={() => handleSort('category')} className={`xl:hidden ${thClass('category')}`}>
                <span className="flex items-center gap-1">
                  Category <SortIcon field="category" sortBy={sortBy} />
                </span>
              </th>
              <th onClick={() => handleSort('type')} className={thClass('type')}>
                <span className="flex items-center gap-1">
                  Type <SortIcon field="type" sortBy={sortBy} />
                </span>
              </th>
              <th onClick={() => handleSort('amount')} className={`${thClass('amount')} text-right`}>
                <span className="flex items-center justify-end gap-1">
                  <SortIcon field="amount" sortBy={sortBy} /> Amount
                </span>
              </th>
              <th className="hidden px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 xl:table-cell">
                GST
              </th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {transactions.map((tx) => (
              <tr
                key={tx.id}
                onClick={() => onEdit?.(tx)}
                className={`transition-colors ${onEdit ? 'cursor-pointer hover:bg-blue-50' : 'hover:bg-gray-50'}`}
              >
                <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-600">{tx.date}</td>

                <td className="px-3 py-3">
                  <p className="max-w-[180px] truncate text-sm text-gray-900">
                    {tx.description ?? '—'}
                  </p>
                  {tx.income_detail && (
                    <span className="mt-0.5 inline-block rounded-full bg-purple-100 px-1.5 py-0.5 text-xs text-purple-700">
                      {tx.income_detail.income_type}
                      {tx.income_detail.dividend_type ? ` · ${tx.income_detail.dividend_type}` : ''}
                    </span>
                  )}
                </td>

                <td className="hidden whitespace-nowrap px-3 py-3 text-sm text-gray-600 xl:table-cell">
                  {tx.account?.name ?? '—'}
                </td>

                <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-600">
                  {tx.category?.name ?? '—'}
                </td>

                <td className="whitespace-nowrap px-3 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    tx.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {tx.type}
                  </span>
                </td>

                <td className={`whitespace-nowrap px-3 py-3 text-right text-sm font-semibold tabular-nums ${
                  tx.type === 'income' ? 'text-green-700' : 'text-red-700'
                }`}>
                  {tx.type === 'income' ? '+' : '-'}{formatCAD(tx.amount)}
                </td>

                <td className="hidden whitespace-nowrap px-3 py-3 text-xs text-gray-500 xl:table-cell">
                  {tx.gst_entry ? (
                    <span className={`rounded-full px-1.5 py-0.5 ${
                      tx.gst_entry.gst_type === 'collected'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {tx.gst_entry.gst_type === 'collected' ? 'Coll.' : 'Paid'}{' '}
                      {formatCAD(tx.gst_entry.gst_amount)}
                    </span>
                  ) : '—'}
                </td>

                <td className="px-3 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {onEdit && canAct(tx) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onEdit(tx) }}
                        className="text-gray-300 transition-colors hover:text-blue-500"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {onDelete && canAct(tx) && (
                      <button
                        onClick={(e) => handleDelete(e, tx.id)}
                        disabled={deletingId === tx.id}
                        className="text-gray-300 transition-colors hover:text-red-500 disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
