'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  format, startOfWeek, addDays, addWeeks, subWeeks, subMonths, parseISO, isToday,
} from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useHousehold } from '@/hooks/useHousehold'
import { useActiveMembers } from '@/contexts/ActiveMemberContext'
import { Utensils, ChevronLeft, ChevronRight, X, Trophy, ChevronDown } from 'lucide-react'

type MealType = 'breakfast' | 'lunch' | 'dinner'

const MEAL_SLOTS: { key: MealType; label: string; emoji: string }[] = [
  { key: 'breakfast', label: 'Breakfast', emoji: '☀️' },
  { key: 'lunch',     label: 'Lunch',     emoji: '🌤️' },
  { key: 'dinner',    label: 'Dinner',    emoji: '🌙' },
]

interface MealPlan {
  id: string
  household_id: string
  plan_date: string
  meal_type: MealType
  title: string
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

interface MealLog {
  user_id: string
  points: number
  plan_date: string
  meal_type: MealType
}

interface MemberProfile {
  user_id: string
  email: string
  display_name?: string
}

const PTS_PLAN = 8

export default function MealsPage() {
  const { household, loading: householdLoading } = useHousehold()
  const { accountType, activeMemberId, effectiveUserId } = useActiveMembers()
  const isReadOnly = accountType === 'family' && !activeMemberId
  const supabase = createClient()

  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )
  const [plans,         setPlans]         = useState<MealPlan[]>([])
  const [mealLogs,      setMealLogs]      = useState<MealLog[]>([])
  const [loading,       setLoading]       = useState(true)
  const [editing,       setEditing]       = useState<{ date: string; type: MealType } | null>(null)
  const [draftTitle,    setDraftTitle]    = useState('')
  const [draftNotes,    setDraftNotes]    = useState('')
  const [saving,        setSaving]        = useState(false)
  const [members,       setMembers]       = useState<MemberProfile[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [expandedDays,  setExpandedDays]  = useState<Set<string>>(() =>
    new Set([format(new Date(), 'yyyy-MM-dd')])
  )
  const inputRef = useRef<HTMLInputElement>(null)

  const days     = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekFrom = format(weekStart, 'yyyy-MM-dd')
  const weekTo   = format(addDays(weekStart, 6), 'yyyy-MM-dd')

  // Fetch user ID immediately so actorId() is ready before any interaction
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!household) return
    loadWeek()
  }, [household, weekStart]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!household) return
    loadLeaderboard()
  }, [household]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadWeek() {
    setLoading(true)
    const { data } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('household_id', household!.id)
      .gte('plan_date', weekFrom)
      .lte('plan_date', weekTo)
    setPlans((data as MealPlan[]) ?? [])
    setLoading(false)
  }

  async function loadLeaderboard() {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id ?? null)

    const since = format(subMonths(new Date(), 6), 'yyyy-MM-dd')
    const [logsRes, profileRes] = await Promise.all([
      supabase
        .from('meal_logs')
        .select('user_id, points, plan_date, meal_type')
        .eq('household_id', household!.id)
        .gte('plan_date', since),
      supabase.rpc('get_household_members_with_profiles'),
    ])

    setMealLogs((logsRes.data as MealLog[]) ?? [])

    let memberData: MemberProfile[]
    if (!profileRes.error && profileRes.data) {
      memberData = profileRes.data as MemberProfile[]
    } else {
      const { data: basicData } = await supabase.rpc('get_household_members')
      memberData = (basicData ?? []) as MemberProfile[]
    }
    setMembers(memberData)
  }

  function actorId(): string | null {
    return effectiveUserId ?? currentUserId
  }

  function getPlan(dateStr: string, type: MealType): MealPlan | undefined {
    return plans.find(p => p.plan_date === dateStr && p.meal_type === type)
  }

  function toggleDay(dateStr: string) {
    setExpandedDays(prev => {
      const next = new Set(prev)
      if (next.has(dateStr)) next.delete(dateStr)
      else next.add(dateStr)
      return next
    })
  }

  function openEdit(dateStr: string, type: MealType) {
    if (isReadOnly) return
    const existing = getPlan(dateStr, type)
    setEditing({ date: dateStr, type })
    setDraftTitle(existing?.title ?? '')
    setDraftNotes(existing?.notes ?? '')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function cancelEdit() {
    setEditing(null)
    setDraftTitle('')
    setDraftNotes('')
  }

  async function saveMeal() {
    if (!editing || !draftTitle.trim() || !household) return
    setSaving(true)

    const actor = actorId()
    const { data: { user } } = await supabase.auth.getUser()
    const userId = actor ?? user?.id ?? null
    if (!userId) { setSaving(false); return }

    const { date: planDate, type: mealType } = editing
    const existing = getPlan(planDate, mealType)

    if (existing) {
      // Update shared meal — no new points for edits
      const { data, error } = await supabase
        .from('meal_plans')
        .update({ title: draftTitle.trim(), notes: draftNotes.trim() || null, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select().single()
      if (!error && data) {
        setPlans(prev => prev.map(p => p.id === existing.id ? data as MealPlan : p))
      }
    } else {
      // New meal — insert and award points to first planner
      const { data, error } = await supabase
        .from('meal_plans')
        .insert({
          household_id: household.id,
          plan_date: planDate,
          meal_type: mealType,
          title: draftTitle.trim(),
          notes: draftNotes.trim() || null,
          created_by: userId,
        })
        .select().single()
      if (!error && data) {
        setPlans(prev => [...prev, data as MealPlan])
        // Award points to first planner; 23505 = slot already logged, ignore
        const { data: logData, error: logErr } = await supabase
          .from('meal_logs')
          .insert({ household_id: household.id, user_id: userId, points: PTS_PLAN, plan_date: planDate, meal_type: mealType })
          .select('user_id, points, plan_date, meal_type')
          .single()
        if (!logErr && logData) {
          setMealLogs(prev => [...prev, logData as MealLog])
        }
      }
    }

    setSaving(false)
    cancelEdit()
  }

  async function deleteMeal(plan: MealPlan) {
    const { error } = await supabase.from('meal_plans').delete().eq('id', plan.id)
    if (!error) {
      setPlans(prev => prev.filter(p => p.id !== plan.id))
      // meal_logs intentionally NOT deleted — history preserved for leaderboard
    }
  }

  function memberName(userId: string) {
    if (userId === currentUserId) return 'You'
    const m = members.find(m => m.user_id === userId)
    return m ? (m.display_name || m.email.split('@')[0]) : 'Someone'
  }

  const leaderboard = useMemo(() => {
    const adminId = accountType === 'family' ? currentUserId : null
    const monthMap: Record<string, Record<string, number>> = {}

    for (const log of mealLogs) {
      if (adminId && log.user_id === adminId) continue
      const month = log.plan_date.slice(0, 7)
      monthMap[month] ??= {}
      monthMap[month][log.user_id] = (monthMap[month][log.user_id] ?? 0) + log.points
    }

    return Object.keys(monthMap).sort().reverse().slice(0, 6).map(month => {
      const byMember = monthMap[month]
      const sorted = Object.entries(byMember).sort((a, b) => b[1] - a[1])
      const max = sorted[0]?.[1] ?? 1
      return {
        month,
        label: format(parseISO(`${month}-01`), 'MMMM yyyy'),
        winner: sorted[0]?.[0] ?? null,
        max,
        sorted,
      }
    })
  }, [mealLogs, accountType, currentUserId])

  if (householdLoading) return <Spinner />

  return (
    <div className="max-w-xl mx-auto px-4 md:px-6 py-8 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Utensils className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">Meal Planner</h1>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setWeekStart(w => subWeeks(w, 1))} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))} className="px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
            This week
          </button>
          <button onClick={() => setWeekStart(w => addWeeks(w, 1))} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-400 -mt-4">
        {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
        <span className="ml-2 text-xs">· +{PTS_PLAN} pts per meal planned</span>
      </p>

      {/* Week view */}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="space-y-2">
          {days.map(day => {
            const dateStr   = format(day, 'yyyy-MM-dd')
            const today     = isToday(day)
            const expanded  = expandedDays.has(dateStr)
            const dayPlans  = plans.filter(p => p.plan_date === dateStr)

            return (
              <div
                key={dateStr}
                className={`rounded-2xl border overflow-hidden ${today ? 'border-blue-200' : 'border-gray-200'}`}
              >
                {/* Collapsible day header */}
                <button
                  onClick={() => toggleDay(dateStr)}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors ${
                    today ? 'bg-blue-50 hover:bg-blue-100' : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <span className={`text-xs font-bold uppercase tracking-wide ${today ? 'text-blue-600' : 'text-gray-500'}`}>
                    {format(day, 'EEE')}
                  </span>
                  <span className={`text-xs ${today ? 'text-blue-400' : 'text-gray-400'}`}>
                    {format(day, 'MMM d')}
                  </span>
                  {today && (
                    <span className="text-xs font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">Today</span>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    {!expanded && dayPlans.length > 0 && (
                      <span className="text-xs text-gray-400">{dayPlans.length} meal{dayPlans.length !== 1 ? 's' : ''}</span>
                    )}
                    <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Meal slots */}
                {expanded && (
                  <div className="divide-y divide-gray-100">
                    {MEAL_SLOTS.map(slot => {
                      const plan      = getPlan(dateStr, slot.key)
                      const isEditing = editing?.date === dateStr && editing?.type === slot.key

                      return (
                        <div key={slot.key} className="bg-white">
                          {isEditing ? (
                            <div className="px-4 py-3 space-y-2">
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                {slot.emoji} {slot.label}
                              </p>
                              <input
                                ref={inputRef}
                                type="text"
                                placeholder={`What's for ${slot.label.toLowerCase()}?`}
                                value={draftTitle}
                                onChange={e => setDraftTitle(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveMeal(); if (e.key === 'Escape') cancelEdit() }}
                                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                              />
                              <input
                                type="text"
                                placeholder="Notes (optional)"
                                value={draftNotes}
                                onChange={e => setDraftNotes(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveMeal(); if (e.key === 'Escape') cancelEdit() }}
                                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-400 focus:outline-none"
                              />
                              <div className="flex gap-2 justify-end">
                                <button onClick={cancelEdit} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">
                                  Cancel
                                </button>
                                <button
                                  onClick={saveMeal}
                                  disabled={!draftTitle.trim() || saving}
                                  className="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                >
                                  {saving ? 'Saving…' : 'Save'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              className={`flex items-center gap-3 px-4 py-2.5 ${!isReadOnly ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}`}
                              onClick={() => !isReadOnly && openEdit(dateStr, slot.key)}
                            >
                              <span className="text-sm leading-none flex-shrink-0">{slot.emoji}</span>
                              <div className="flex-1 min-w-0">
                                {plan ? (
                                  <>
                                    <p className="text-sm text-gray-900 truncate">{plan.title}</p>
                                    {plan.notes && <p className="text-xs text-gray-400 truncate">{plan.notes}</p>}
                                  </>
                                ) : (
                                  <span className="text-sm text-gray-300">
                                    {isReadOnly ? `No ${slot.label.toLowerCase()} planned` : `Add ${slot.label.toLowerCase()}…`}
                                  </span>
                                )}
                              </div>
                              {plan && (
                                <span className="text-xs text-gray-400 flex-shrink-0 hidden sm:inline">
                                  {memberName(plan.created_by)}
                                </span>
                              )}
                              {!isReadOnly && plan && (
                                <button
                                  onClick={e => { e.stopPropagation(); deleteMeal(plan) }}
                                  className="p-1 text-gray-200 hover:text-red-400 transition-colors flex-shrink-0"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Monthly Leaderboard */}
      {leaderboard.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-4 w-4 text-amber-500" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Monthly Leaderboard</h2>
          </div>
          <div className="space-y-3">
            {leaderboard.map(({ month, label, winner, max, sorted }) => (
              <div key={month} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">{label}</span>
                  {winner && (
                    <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-0.5 rounded-full">
                      👑 {memberName(winner)}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {sorted.map(([userId, pts]) => (
                    <div key={userId} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-16 truncate flex-shrink-0">
                        {memberName(userId)}
                      </span>
                      <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-400 rounded-full transition-all"
                          style={{ width: `${(pts / max) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-700 w-14 text-right flex-shrink-0">
                        {pts} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
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
