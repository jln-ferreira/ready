'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useHousehold } from '@/hooks/useHousehold'
import { useTransactions } from '@/hooks/useTransactions'
import { useActiveMembers } from '@/contexts/ActiveMemberContext'
import TransactionTable from '@/components/TransactionTable'
import { getCurrentTaxYear } from '@/utils/format'
import { PlusCircle, Search, X, ArrowLeftRight } from 'lucide-react'
import type { Transaction, SortKey } from '@/types'

type Tab = 'personal' | 'business'

export default function TransactionsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('personal')
  const [year, setYear] = useState(getCurrentTaxYear())
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('date_desc')

  const { accountType, activeMemberId, activeMember } = useActiveMembers()
  const { household, accounts, categories, loading: hhLoading } = useHousehold()

  // Family account with no member selected: personal transactions are meaningless
  const lockedToFamily = accountType === 'family' && !activeMemberId

  // When family account has a member selected, filter to that member's transactions
  const filterUserId = accountType === 'family' ? activeMemberId ?? undefined : undefined

  const { transactions, loading, deleteTransaction } = useTransactions({
    householdId: household?.id,
    year,
    filterUserId,
  })

  const personalAccountIds = new Set(
    accounts.filter((a) => a.type === 'personal').map((a) => a.id)
  )
  const businessAccountIds = new Set(
    accounts.filter((a) => a.type === 'business').map((a) => a.id)
  )

  const idsForTab = (t: Tab) => (t === 'personal' ? personalAccountIds : businessAccountIds)

  const tabTransactions = transactions.filter(
    (tx) => tx.account_id && idsForTab(tab).has(tx.account_id)
  )

  const tabCategoryIds = useMemo(
    () => new Set(tabTransactions.map((tx) => tx.category_id).filter(Boolean)),
    [tabTransactions]
  )
  const availableCategories = categories.filter((c) => tabCategoryIds.has(c.id))

  const filtered = useMemo(() => {
    let result = tabTransactions
    if (typeFilter !== 'all') result = result.filter((tx) => tx.type === typeFilter)
    if (categoryFilter) result = result.filter((tx) => tx.category_id === categoryFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((tx) => tx.description?.toLowerCase().includes(q))
    }
    return [...result].sort((a, b) => {
      switch (sortBy) {
        case 'date_asc':      return a.date.localeCompare(b.date)
        case 'date_desc':     return b.date.localeCompare(a.date)
        case 'amount_asc':    return a.amount - b.amount
        case 'amount_desc':   return b.amount - a.amount
        case 'category_asc':  return (a.category?.name ?? '').localeCompare(b.category?.name ?? '')
        case 'category_desc': return (b.category?.name ?? '').localeCompare(a.category?.name ?? '')
        case 'type_asc':      return a.type.localeCompare(b.type)
        case 'type_desc':     return b.type.localeCompare(a.type)
        default: return 0
      }
    })
  }, [tabTransactions, typeFilter, categoryFilter, search, sortBy])

  const hasActiveFilters = typeFilter !== 'all' || categoryFilter !== '' || search.trim() !== ''
  const clearFilters = () => { setTypeFilter('all'); setCategoryFilter(''); setSearch('') }

  const currentYear = getCurrentTaxYear()
  const years = [currentYear, currentYear - 1, currentYear - 2]

  const memberName = activeMember?.display_name || activeMember?.email.split('@')[0] || ''

  if (hhLoading) return (
    <div className="flex h-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
    </div>
  )

  // Family account with no member selected
  if (lockedToFamily) return (
    <div className="flex flex-1 items-center justify-center h-full px-6">
      <div className="text-center">
        <ArrowLeftRight className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-500">Select a family member to view transactions</p>
      </div>
    </div>
  )

  const newTransactionHref = activeMemberId
    ? `/transactions/new?memberId=${activeMemberId}`
    : '/transactions/new'

  return (
    <div className="p-4 sm:p-6 lg:p-6">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">
          {memberName ? `${memberName}'s Transactions` : 'Transactions'}
        </h1>
        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={(e) => { setYear(Number(e.target.value)); setCategoryFilter('') }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={() => router.push(newTransactionHref)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            <PlusCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Add Transaction</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex border-b border-gray-200">
        {(['personal', 'business'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setCategoryFilter('') }}
            className={`mr-6 border-b-2 pb-3 text-sm capitalize transition-colors ${
              tab === t
                ? t === 'personal'
                  ? 'border-blue-600 font-semibold text-blue-700'
                  : 'border-emerald-600 font-semibold text-emerald-700'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            {t}
            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              {transactions.filter((tx) => tx.account_id && idsForTab(t).has(tx.account_id)).length}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search descriptions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-9 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="all">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>

          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">All categories</option>
            {availableCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 lg:hidden">
            <option value="date_desc">Date ↓</option>
            <option value="date_asc">Date ↑</option>
            <option value="amount_desc">Amount ↓</option>
            <option value="amount_asc">Amount ↑</option>
            <option value="category_asc">Category A→Z</option>
            <option value="category_desc">Category Z→A</option>
            <option value="type_asc">Type A→Z</option>
            <option value="type_desc">Type Z→A</option>
          </select>

          {hasActiveFilters && (
            <button onClick={clearFilters}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700">
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      <p className="mb-3 text-sm text-gray-500">
        {filtered.length} {tab} transaction{filtered.length !== 1 ? 's' : ''}
        {hasActiveFilters ? ` (filtered from ${tabTransactions.length})` : ` in ${year}`}
        {' · '}<span className="text-gray-400">Click any row to edit</span>
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <TransactionTable
          transactions={filtered}
          onEdit={(tx: Transaction) => router.push(`/transactions/${tx.id}`)}
          onDelete={deleteTransaction}
          sortBy={sortBy}
          onSort={setSortBy}
        />
      )}
    </div>
  )
}
