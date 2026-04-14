'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useHousehold } from '@/hooks/useHousehold'
import { getCurrentTaxYear } from '@/utils/format'
import { Target } from 'lucide-react'

type Scope = 'personal' | 'family' | 'business'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Nov','Oct','Dec']
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']

const SCOPE_STYLES: Record<Scope, { tab: string; ring: string }> = {
  personal: { tab: 'border-blue-600 text-blue-700',    ring: 'focus:ring-blue-100 focus:border-blue-400' },
  family:   { tab: 'border-purple-600 text-purple-700', ring: 'focus:ring-purple-100 focus:border-purple-400' },
  business: { tab: 'border-emerald-600 text-emerald-700', ring: 'focus:ring-emerald-100 focus:border-emerald-400' },
}

interface GoalRow {
  month: number
  amount: string // string for input
  saving: boolean
}

export default function GoalsPage() {
  const { household, loading: hhLoading } = useHousehold()
  const supabase = createClient()

  const [scope, setScope]   = useState<Scope>('personal')
  const [year, setYear]     = useState(getCurrentTaxYear())
  const [userId, setUserId] = useState<string | null>(null)
  const [rows, setRows]     = useState<GoalRow[]>(
    Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount: '', saving: false }))
  )
  const [loading, setLoading] = useState(false)

  const currentYear = getCurrentTaxYear()
  const currentMonth = new Date().getMonth() + 1
  const years = [currentYear, currentYear - 1, currentYear - 2]

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadGoals = useCallback(async () => {
    if (!household || !userId) return
    setLoading(true)

    const query = supabase
      .from('cost_goals')
      .select('month, amount')
      .eq('household_id', household.id)
      .eq('scope', scope)
      .eq('year', year)

    if (scope === 'family') {
      query.is('user_id', null)
    } else {
      query.eq('user_id', userId)
    }

    const { data } = await query
    const goalMap: Record<number, number> = {}
    for (const g of (data ?? [])) goalMap[g.month] = Number(g.amount)

    setRows(Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      amount: goalMap[i + 1] ? String(goalMap[i + 1]) : '',
      saving: false,
    })))
    setLoading(false)
  }, [household, userId, scope, year]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadGoals() }, [loadGoals])

  const saveGoal = async (month: number, rawValue: string) => {
    if (!household || !userId) return
    const amount = parseFloat(rawValue)
    if (isNaN(amount) && rawValue !== '') return

    setRows(prev => prev.map(r => r.month === month ? { ...r, saving: true } : r))

    if (!rawValue || isNaN(amount) || amount === 0) {
      // Delete
      const query = supabase
        .from('cost_goals')
        .delete()
        .eq('household_id', household.id)
        .eq('scope', scope)
        .eq('year', year)
        .eq('month', month)

      if (scope === 'family') query.is('user_id', null)
      else query.eq('user_id', userId)

      await query
    } else {
      // Upsert
      const record = {
        household_id: household.id,
        scope,
        year,
        month,
        amount,
        updated_at: new Date().toISOString(),
        ...(scope === 'family' ? { user_id: null } : { user_id: userId }),
      }
      await supabase.from('cost_goals').upsert(record, {
        onConflict: scope === 'family'
          ? 'household_id,scope,year,month'
          : 'user_id,household_id,scope,year,month',
      })
    }

    setRows(prev => prev.map(r => r.month === month ? { ...r, saving: false } : r))
  }

  if (hhLoading) return <Spinner />

  const styles = SCOPE_STYLES[scope]

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-8">

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

      <p className="text-sm text-gray-500 mb-5">
        Set monthly spending targets. They appear as reference lines on the Reports chart.
        {scope === 'family' && ' Family goals are shared with all household members.'}
      </p>

      {/* Scope tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {(['personal', 'family', 'business'] as Scope[]).map(s => (
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

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {rows.map(row => {
            const isCurrentMonth = year === currentYear && row.month === currentMonth
            return (
              <div
                key={row.month}
                className={`rounded-2xl border p-4 bg-white transition-colors ${
                  isCurrentMonth ? 'border-blue-200 ring-1 ring-blue-100' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-semibold uppercase tracking-wide ${
                    isCurrentMonth ? 'text-blue-600' : 'text-gray-400'
                  }`}>
                    {MONTHS_FULL[row.month - 1]}
                  </span>
                  {row.saving && (
                    <span className="text-xs text-gray-300">saving…</span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    placeholder="0"
                    value={row.amount}
                    onChange={e => setRows(prev => prev.map(r => r.month === row.month ? { ...r, amount: e.target.value } : r))}
                    onBlur={e => saveGoal(row.month, e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveGoal(row.month, row.amount)}
                    className={`w-full pl-6 pr-3 py-2 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 ${styles.ring} tabular-nums`}
                  />
                </div>
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
