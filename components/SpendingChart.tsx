'use client'

import { useMemo, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Transaction, Account } from '@/types'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

interface CostGoal {
  month: number
  amount: number
}

interface Props {
  year: number
  scope: 'personal' | 'family' | 'business'
  transactions: Transaction[]
  accounts: Account[]
  householdId: string
  userId: string | undefined
  color: string   // e.g. '#2563eb'
  label: string   // e.g. 'Personal'
}

const CAD = (n: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n)

export default function SpendingChart({ year, scope, transactions, accounts, householdId, userId, color, label }: Props) {
  const supabase = createClient()
  const [goals, setGoals] = useState<CostGoal[]>([])
  const now = new Date()
  const currentYear  = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // 1-based

  // Load goals for this scope + year
  useEffect(() => {
    if (!householdId) return
    const loadGoals = async () => {
      const query = supabase
        .from('cost_goals')
        .select('month, amount')
        .eq('household_id', householdId)
        .eq('scope', scope)
        .eq('year', year)

      if (scope === 'family') {
        query.is('user_id', null)
      } else if (userId) {
        query.eq('user_id', userId)
      }

      const { data } = await query
      setGoals((data as CostGoal[]) ?? [])
    }
    loadGoals()
  }, [householdId, userId, scope, year]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scope-filter transactions
  const scopedTx = useMemo(() => {
    if (scope === 'family') {
      return transactions.filter(tx => !tx.account || tx.account.type === 'personal')
    }
    const ids = new Set(accounts.filter(a => a.type === scope).map(a => a.id))
    return transactions.filter(tx => tx.account_id && ids.has(tx.account_id))
  }, [transactions, accounts, scope])

  // Monthly expense totals
  const monthlyActual = useMemo(() => {
    const totals = new Array(12).fill(0)
    for (const tx of scopedTx) {
      if (tx.type !== 'expense') continue
      const m = parseInt(tx.date.slice(5, 7), 10) - 1
      if (m >= 0 && m < 12) totals[m] += tx.amount
    }
    return totals
  }, [scopedTx])

  const goalByMonth = useMemo(() => {
    const map = new Array(12).fill(0)
    for (const g of goals) map[g.month - 1] = Number(g.amount)
    return map
  }, [goals])

  // ── SVG chart ────────────────────────────────────────────────
  const W = 560, H = 180
  const pad = { top: 16, right: 20, bottom: 28, left: 58 }
  const cw = W - pad.left - pad.right
  const ch = H - pad.top - pad.bottom

  const allVals = [
    ...monthlyActual.filter((_, i) => year < currentYear || i < currentMonth),
    ...goalByMonth,
  ].filter(v => v > 0)

  const rawMax = allVals.length > 0 ? Math.max(...allVals) : 1000
  // Round max up to a nice number
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)))
  const maxY = Math.ceil(rawMax / magnitude) * magnitude * 1.1

  const xPos = (i: number) => pad.left + (i / 11) * cw
  const yPos = (v: number) => pad.top + ch - Math.min(1, v / maxY) * ch

  // Y-axis grid lines (4 levels)
  const yTicks = [0, 0.25, 0.5, 0.75, 1]

  // Actual line — only up to current month for current year
  const actualVisible = MONTHS.map((_, i) => {
    if (year < currentYear) return monthlyActual[i]
    if (i < currentMonth) return monthlyActual[i]
    return null
  })

  const buildPath = (vals: (number | null)[]) =>
    vals.reduce<string>((path, v, i) => {
      if (v === null) return path
      const cmd = path === '' ? 'M' : 'L'
      return `${path}${cmd}${xPos(i).toFixed(1)},${yPos(v).toFixed(1)} `
    }, '')

  const actualPath = buildPath(actualVisible)
  const goalPath   = buildPath(goalByMonth)

  // Forecast starts after the last actual point
  const forecastStart = year < currentYear ? -1 : currentMonth - 1
  const forecastPath = goalByMonth.reduce<string>((path, v, i) => {
    if (i < forecastStart) return path
    const cmd = path === '' ? 'M' : 'L'
    return `${path}${cmd}${xPos(i).toFixed(1)},${yPos(v).toFixed(1)} `
  }, '')

  const hasGoals = goalByMonth.some(v => v > 0)
  const hasActual = actualVisible.some(v => v !== null && v > 0)

  if (!hasGoals && !hasActual) {
    return (
      <div className="text-center py-6 text-sm text-gray-400">
        No data yet. Add transactions and set goals to see the chart.
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[320px]">
        {/* Grid */}
        {yTicks.map(t => (
          <g key={t}>
            <line
              x1={pad.left} y1={pad.top + ch * (1 - t)}
              x2={pad.left + cw} y2={pad.top + ch * (1 - t)}
              stroke="#f3f4f6" strokeWidth="1"
            />
            <text
              x={pad.left - 6} y={pad.top + ch * (1 - t) + 4}
              textAnchor="end" fontSize="9" fill="#9ca3af"
            >
              {CAD(maxY * t)}
            </text>
          </g>
        ))}

        {/* Goal line — solid for past, dashed for future forecast */}
        {hasGoals && <>
          {/* Past goal (solid, light) */}
          {year <= currentYear && goalPath && (
            <path d={goalPath} fill="none" stroke="#d1d5db" strokeWidth="1.5" />
          )}
          {/* Forecast (dashed) */}
          {year === currentYear && forecastPath && (
            <path d={forecastPath} fill="none" stroke={color} strokeWidth="1.5"
              strokeDasharray="5,4" opacity="0.5" />
          )}
        </>}

        {/* Actual line */}
        {actualPath && (
          <path d={actualPath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        )}

        {/* Dots on actual */}
        {actualVisible.map((v, i) => v !== null && v > 0 && (
          <circle key={i} cx={xPos(i)} cy={yPos(v)} r="3" fill={color} />
        ))}

        {/* X labels */}
        {MONTHS.map((m, i) => (
          <text
            key={m}
            x={xPos(i)} y={H - 6}
            textAnchor="middle" fontSize="9"
            fill={year === currentYear && i === currentMonth - 1 ? color : '#9ca3af'}
            fontWeight={year === currentYear && i === currentMonth - 1 ? 'bold' : 'normal'}
          >
            {m}
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-1 px-2">
        {hasActual && (
          <div className="flex items-center gap-1.5">
            <svg width="18" height="8"><line x1="0" y1="4" x2="18" y2="4" stroke={color} strokeWidth="2" /></svg>
            <span className="text-xs text-gray-500">Actual spend</span>
          </div>
        )}
        {hasGoals && (
          <>
            <div className="flex items-center gap-1.5">
              <svg width="18" height="8"><line x1="0" y1="4" x2="18" y2="4" stroke="#d1d5db" strokeWidth="1.5" /></svg>
              <span className="text-xs text-gray-500">Goal</span>
            </div>
            {year === currentYear && (
              <div className="flex items-center gap-1.5">
                <svg width="18" height="8"><line x1="0" y1="4" x2="18" y2="4" stroke={color} strokeWidth="1.5" strokeDasharray="4,3" opacity="0.5" /></svg>
                <span className="text-xs text-gray-500">Forecast</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
