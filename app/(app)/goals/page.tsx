'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useHousehold } from '@/hooks/useHousehold'
import { getCurrentTaxYear } from '@/utils/format'
import { Target, Copy, Check, ChevronDown, Users } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useActiveMembers } from '@/contexts/ActiveMemberContext'

type Scope = 'family' | 'business'

const MONTHS_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const SCOPE_STYLES: Record<Scope, { tab: string; ring: string }> = {
  family:   { tab: 'border-purple-600 text-purple-700',  ring: 'focus:ring-purple-100 focus:border-purple-400' },
  business: { tab: 'border-emerald-600 text-emerald-700', ring: 'focus:ring-emerald-100 focus:border-emerald-400' },
}

const CATEGORIES: Record<Scope, string[]> = {
  family:   ['Housing','Groceries','Transport','Utilities','Healthcare','Entertainment','Shopping','Dining Out','Savings','Other'],
  business: ['Advertising','Equipment','Insurance','Internet & Phone','Meals','Office Supplies','Rent','Software','Travel','Utilities','Vehicle','Other'],
}

type CategoryGoal = { amount: string; saving: boolean }
type GoalState    = Record<number, Record<string, CategoryGoal>>

function makeEmptyState(categories: string[]): GoalState {
  const state: GoalState = {}
  for (let m = 1; m <= 12; m++) {
    state[m] = {}
    for (const cat of categories) state[m][cat] = { amount: '', saving: false }
  }
  return state
}

export default function GoalsPage() {
  const { household, loading: hhLoading } = useHousehold()
  const supabase     = createClient()
  const searchParams = useSearchParams()
  const { accountType, activeMemberId, effectiveUserId } = useActiveMembers()

  // Family account with no member: locked to family scope only
  const lockedToFamily = accountType === 'family' && !activeMemberId

  const [scope, setScope] = useState<Scope>(
    lockedToFamily ? 'family' : (searchParams.get('scope') as Scope) ?? 'family'
  )
  const [year, setYear]       = useState(getCurrentTaxYear())
  const [userId, setUserId]   = useState<string | null>(null)
  const [goals, setGoals]     = useState<GoalState>({})
  const [loading, setLoading] = useState(false)

  // which month card is expanded
  const [expandedMonths, setExpandedMonths] = useState<Set<number>>(new Set())
  // which month's copy picker is open
  const [copyPickerMonth, setCopyPickerMonth] = useState<number | null>(null)
  // feedback: { from, to } where to is a month number or 'all'
  const [copiedFeedback, setCopiedFeedback] = useState<{ from: number; to: number | 'all' } | null>(null)

  const currentYear  = getCurrentTaxYear()
  const currentMonth = new Date().getMonth() + 1
  const years        = [currentYear, currentYear - 1, currentYear - 2]
  const categories   = CATEGORIES[scope]

  // Reset expanded/copy state when switching scope or year
  useEffect(() => {
    setExpandedMonths(new Set())
    setCopyPickerMonth(null)
    setCopiedFeedback(null)
  }, [scope, year])

  // When locked to family mode, force scope back if it drifted
  useEffect(() => {
    if (lockedToFamily) setScope('family')
  }, [lockedToFamily])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Use activeMemberId when a member is selected in the family account
  const queryUserId = effectiveUserId ?? userId

  const loadGoals = useCallback(async () => {
    if (!household || !queryUserId) return
    setLoading(true)

    const query = supabase
      .from('cost_goals')
      .select('month, amount, category')
      .eq('household_id', household.id)
      .eq('scope', scope)
      .eq('year', year)

    if (scope === 'family') query.is('user_id', null)
    else                    query.eq('user_id', queryUserId)

    const { data } = await query
    const state = makeEmptyState(categories)
    for (const g of (data ?? [])) {
      const cat = g.category ?? 'Other'
      if (state[g.month]?.[cat] !== undefined)
        state[g.month][cat] = { amount: String(g.amount || ''), saving: false }
    }
    setGoals(state)
    setLoading(false)
  }, [household, queryUserId, scope, year, categories]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadGoals() }, [loadGoals])

  const saveGoal = useCallback(async (month: number, category: string, rawValue: string) => {
    if (!household || !queryUserId) return
    const amount = parseFloat(rawValue)
    if (isNaN(amount) && rawValue !== '') return

    setGoals(prev => ({
      ...prev,
      [month]: { ...prev[month], [category]: { amount: rawValue, saving: true } },
    }))

    // Always delete first, then insert if a value was given.
    // This avoids the upsert onConflict issue with the expression-based unique index.
    const delQ = supabase.from('cost_goals').delete()
      .eq('household_id', household.id)
      .eq('scope', scope).eq('year', year)
      .eq('month', month).eq('category', category)
    if (scope === 'family') delQ.is('user_id', null)
    else                    delQ.eq('user_id', queryUserId)
    await delQ

    if (rawValue && !isNaN(amount) && amount !== 0) {
      await supabase.from('cost_goals').insert({
        household_id: household.id,
        scope, year, month, category, amount,
        updated_at: new Date().toISOString(),
        ...(scope === 'family' ? { user_id: null } : { user_id: queryUserId }),
      })
    }

    setGoals(prev => ({
      ...prev,
      [month]: { ...prev[month], [category]: { amount: rawValue, saving: false } },
    }))
  }, [household, queryUserId, scope, year]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopyTo = async (sourceMonth: number, target: number | 'all') => {
    if (!household || !userId) return
    const source = goals[sourceMonth] ?? {}
    const targets = target === 'all'
      ? Array.from({ length: 12 }, (_, i) => i + 1).filter(m => m !== sourceMonth)
      : [target]

    const updates: Promise<void>[] = []
    for (const m of targets) {
      for (const [cat, { amount }] of Object.entries(source)) {
        if (amount) updates.push(saveGoal(m, cat, amount))
      }
    }
    await Promise.all(updates)
    setCopyPickerMonth(null)
    setCopiedFeedback({ from: sourceMonth, to: target })
    setTimeout(() => setCopiedFeedback(null), 2500)
  }

  const toggleOpen = (month: number) =>
    setExpandedMonths(prev => {
      const next = new Set(prev)
      if (next.has(month)) {
        next.delete(month)
        if (copyPickerMonth === month) setCopyPickerMonth(null)
      } else {
        next.add(month)
      }
      return next
    })

  if (hhLoading) return <Spinner />

  const styles = SCOPE_STYLES[scope]

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">Monthly Goals</h1>
        </div>
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none"
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Scope tabs — hidden when family account with no member active */}
      {!lockedToFamily && (
        <div className="flex border-b border-gray-200 mb-6">
          {(['family', 'business'] as Scope[]).map(s => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`mr-6 pb-3 border-b-2 text-sm capitalize transition-colors ${
                scope === s ? SCOPE_STYLES[s].tab + ' font-semibold' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {s === 'family' ? 'Family' : s}
            </button>
          ))}
        </div>
      )}

      {/* Family shared banner */}
      {scope === 'family' && (
        <div className="flex items-center gap-2 mb-5 rounded-xl bg-purple-50 border border-purple-100 px-4 py-2.5 text-sm text-purple-700">
          <Users className="h-4 w-4 shrink-0" />
          These goals are shared with all household members.
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
            const isCurrentMonth = year === currentYear && month === currentMonth
            const monthGoals     = goals[month] ?? {}
            const total          = Object.values(monthGoals)
              .reduce((sum, g) => sum + (parseFloat(g.amount) || 0), 0)
            const isOpen         = expandedMonths.has(month)
            const showCopyPicker = copyPickerMonth === month
            const justCopied     = copiedFeedback?.from === month

            return (
              <div
                key={month}
                className={`rounded-2xl border bg-white transition-colors ${
                  isCurrentMonth ? 'border-blue-200 ring-1 ring-blue-100' : 'border-gray-200'
                }`}
              >
                {/* Card header — click to expand/collapse */}
                <button
                  type="button"
                  onClick={() => toggleOpen(month)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold uppercase tracking-wide ${
                      isCurrentMonth ? 'text-blue-600' : 'text-gray-500'
                    }`}>
                      {MONTHS_FULL[month - 1]}
                    </span>
                    {total > 0 ? (
                      <span className="text-sm font-medium text-gray-800 tabular-nums">
                        ${total.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* Expandable body */}
                {isOpen && (
                  <div className="px-4 pb-4 border-t border-gray-100">

                    {/* Category rows */}
                    <div className="space-y-1.5 mt-3">
                      {categories.map(cat => (
                        <div key={cat} className="flex items-center gap-2">
                          <span className="w-28 shrink-0 text-xs text-gray-500 truncate">{cat}</span>
                          <div className="relative flex-1">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">$</span>
                            <input
                              type="number"
                              min="0"
                              step="50"
                              placeholder="0"
                              value={monthGoals[cat]?.amount ?? ''}
                              onChange={e => setGoals(prev => ({
                                ...prev,
                                [month]: { ...prev[month], [cat]: { amount: e.target.value, saving: false } },
                              }))}
                              onBlur={e  => saveGoal(month, cat, e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && saveGoal(month, cat, monthGoals[cat]?.amount ?? '')}
                              className={`w-full pl-5 pr-2 py-1 rounded-lg border border-gray-200 text-xs bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 ${styles.ring} tabular-nums`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Copy section */}
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      {!showCopyPicker && !justCopied && (
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setCopyPickerMonth(month) }}
                          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy to…
                        </button>
                      )}

                      {justCopied && (
                        <p className="flex items-center gap-1.5 text-xs text-green-600">
                          <Check className="h-3.5 w-3.5" />
                          Copied to{' '}
                          {copiedFeedback!.to === 'all'
                            ? 'all months'
                            : MONTHS_FULL[(copiedFeedback!.to as number) - 1]}
                        </p>
                      )}

                      {showCopyPicker && (
                        <div>
                          <p className="text-xs text-gray-500 mb-2">Copy to which month?</p>
                          <div className="flex flex-wrap gap-1">
                            {Array.from({ length: 12 }, (_, i) => i + 1)
                              .filter(m => m !== month)
                              .map(m => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={e => { e.stopPropagation(); handleCopyTo(month, m) }}
                                  className="px-2 py-1 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                                >
                                  {MONTHS_SHORT[m - 1]}
                                </button>
                              ))
                            }
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); handleCopyTo(month, 'all') }}
                              className="px-2 py-1 rounded-lg border border-blue-200 text-xs text-blue-600 hover:bg-blue-50 transition-colors font-medium"
                            >
                              All
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); setCopyPickerMonth(null) }}
                            className="mt-2 text-xs text-gray-400 hover:text-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex flex-1 items-center justify-center h-full">
      <div className="h-6 w-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  )
}
