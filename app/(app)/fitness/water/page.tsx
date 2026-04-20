'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { format, subDays, addDays, isToday, parseISO, differenceInDays } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useHousehold } from '@/hooks/useHousehold'
import { useActiveMembers } from '@/contexts/ActiveMemberContext'
import { Droplets, Plus, Minus, ChevronLeft, ChevronRight } from 'lucide-react'

type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active'

const MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.0, light: 1.1, moderate: 1.2, active: 1.4,
}

function calcGoal(weight: number | null, activity: ActivityLevel): number {
  const w = weight ?? 70
  return Math.min(4000, Math.max(1500, Math.round((w * 35 * MULTIPLIERS[activity]) / 100) * 100))
}

interface LeaderboardEntry {
  user_id:   string
  email:     string
  amount_ml: number
  goal_ml:   number
  pct:       number
}

interface HistoryDay {
  date: string
  amount_ml: number
}

function avatarColor(uid: string) {
  const colors = ['bg-blue-100 text-blue-700','bg-green-100 text-green-700','bg-purple-100 text-purple-700','bg-orange-100 text-orange-700','bg-pink-100 text-pink-700','bg-teal-100 text-teal-700']
  const h = uid.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return colors[h % colors.length]
}

const todayStr = () => format(new Date(), 'yyyy-MM-dd')

export default function WaterIntakePage() {
  const { household, loading: hhLoading } = useHousehold()
  const { accountType, activeMemberId, activeMember } = useActiveMembers()
  const supabase = createClient()

  // Pure family account with no member selected — show leaderboard only
  const lockedToFamily = accountType === 'family' && !activeMemberId

  const [selectedDate, setSelectedDate]     = useState(todayStr())
  const [myAmount, setMyAmount]             = useState(0)
  const [myGoal, setMyGoal]                 = useState(2500)
  const [leaderboard, setLeaderboard]       = useState<LeaderboardEntry[]>([])
  const [history, setHistory]               = useState<HistoryDay[]>([])
  // The logged-in user's own ID — loaded once from auth, used as bootstrap trigger
  const [currentUserId, setCurrentUserId]   = useState<string | null>(null)
  const [loading, setLoading]               = useState(true)
  const [waterStreak, setWaterStreak]       = useState(0)
  const [adding, setAdding]                 = useState(false)
  const [addError, setAddError]             = useState<string | null>(null)
  const [customMl, setCustomMl]             = useState('')
  const animRef                             = useRef<number>(0)
  const [displayAmount, setDisplayAmount]   = useState(0)

  // The user whose data we show/edit:
  //   family account + member selected → that member's ID
  //   everyone else                    → own auth ID
  const targetUserId = activeMemberId ?? currentUserId

  // Smooth count-up animation
  useEffect(() => {
    if (displayAmount === myAmount) return
    const step = Math.ceil(Math.abs(myAmount - displayAmount) / 20)
    animRef.current = window.setTimeout(() => {
      setDisplayAmount(prev =>
        prev < myAmount ? Math.min(prev + step, myAmount) : Math.max(prev - step, myAmount)
      )
    }, 16)
    return () => clearTimeout(animRef.current)
  }, [myAmount, displayAmount])

  // Initial load: profile + history (mirrors original pattern — fetches own user, sets currentUserId)
  useEffect(() => {
    if (!household) return
    loadProfile()
    loadHistory()
  }, [household, activeMemberId]) // re-run when switching members // eslint-disable-line react-hooks/exhaustive-deps

  // Reload day data when date changes or when currentUserId first becomes available
  useEffect(() => {
    if (!household || !currentUserId) return
    if (lockedToFamily) {
      loadLeaderboard(selectedDate)
      setLoading(false)
      return
    }
    loadDay(selectedDate)
  }, [selectedDate, currentUserId, household, activeMemberId, lockedToFamily]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id ?? null)
    if (!user) { setLoading(false); return }

    let weightKg: number | null = null
    let activityLevel: ActivityLevel = 'moderate'

    if (accountType === 'family' && activeMemberId) {
      // VilelaFerreira can't read Jose's fitness_profiles row directly (RLS) — use service-role API
      const res = await fetch(`/api/member/profile?memberId=${activeMemberId}`)
      if (res.ok) {
        const json = await res.json()
        weightKg      = json.fitness?.weight_kg ?? null
        activityLevel = (json.fitness?.activity_level as ActivityLevel) ?? 'moderate'
      }
    } else {
      const { data } = await supabase
        .from('fitness_profiles')
        .select('weight_kg, activity_level')
        .eq('user_id', user.id)
        .maybeSingle()
      weightKg      = data?.weight_kg ?? null
      activityLevel = (data?.activity_level as ActivityLevel) ?? 'moderate'
    }

    setMyGoal(calcGoal(weightKg, activityLevel))
  }

  const loadDay = useCallback(async (date: string) => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const uid = activeMemberId ?? user.id

    // Family account viewing a member → use service-role API to bypass RLS
    if (accountType === 'family' && activeMemberId) {
      const res = await fetch(`/api/member/water?memberId=${activeMemberId}&date=${date}`)
      if (res.ok) {
        const json = await res.json()
        const amt = json.day_amount_ml ?? 0
        setMyAmount(amt)
        setDisplayAmount(amt)
      }
    } else {
      const { data: logData } = await supabase
        .from('water_logs')
        .select('amount_ml')
        .eq('user_id', uid)
        .eq('log_date', date)
        .single()
      const amt = logData?.amount_ml ?? 0
      setMyAmount(amt)
      setDisplayAmount(amt)
    }

    const { data: lb } = await supabase.rpc('get_household_water_leaderboard', { p_date: date })
    setLeaderboard((lb as LeaderboardEntry[]) ?? [])
    setLoading(false)
  }, [accountType, activeMemberId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadLeaderboard(date: string) {
    const { data: lb } = await supabase.rpc('get_household_water_leaderboard', { p_date: date })
    setLeaderboard((lb as LeaderboardEntry[]) ?? [])
  }

  async function loadHistory() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const uid  = activeMemberId ?? user.id
    const from = format(subDays(new Date(), 6), 'yyyy-MM-dd')
    const to   = todayStr()

    if (accountType === 'family' && activeMemberId) {
      const res = await fetch(`/api/member/water?memberId=${activeMemberId}&date=${to}`)
      if (res.ok) {
        const json = await res.json()
        setHistory(json.history ?? [])
        setWaterStreak(json.water_streak ?? 0)
      }
    } else {
      const since60 = format(subDays(new Date(), 60), 'yyyy-MM-dd')
      const [{ data: recent }, { data: streakData }] = await Promise.all([
        supabase.from('water_logs').select('log_date, amount_ml').eq('user_id', uid).gte('log_date', from).lte('log_date', to),
        supabase.from('water_logs').select('log_date').eq('user_id', uid).gte('log_date', since60).gt('amount_ml', 0),
      ])
      setHistory(
        ((recent ?? []) as { log_date: string; amount_ml: number }[]).map(r => ({
          date: r.log_date,
          amount_ml: r.amount_ml,
        }))
      )
      // Compute water streak from last 60 days
      const dates = [...new Set((streakData ?? []).map((r: { log_date: string }) => r.log_date))].sort().reverse()
      const today     = todayStr()
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
      if (!dates.length || (dates[0] !== today && dates[0] !== yesterday)) {
        setWaterStreak(0)
      } else {
        let s = 1
        for (let i = 1; i < dates.length; i++) {
          if (differenceInDays(parseISO(dates[i - 1]), parseISO(dates[i])) === 1) s++
          else break
        }
        setWaterStreak(s)
      }
    }
  }

  async function addWater(ml: number) {
    if (!ml || adding) return
    setAdding(true)
    setAddError(null)

    let newAmount: number | null = null

    if (accountType === 'family' && activeMemberId) {
      // Use service-role API to log water for the selected member
      const res = await fetch('/api/member/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: activeMemberId, amountMl: ml, date: selectedDate }),
      })
      if (res.ok) {
        const json = await res.json()
        newAmount = json.amount_ml
      } else {
        const json = await res.json().catch(() => ({}))
        setAddError(json.error ?? `Failed to log water (${res.status})`)
      }
    } else {
      const { data } = await supabase.rpc('log_water', { p_amount_ml: ml, p_date: selectedDate })
      newAmount = data as number
    }

    if (newAmount != null) {
      setMyAmount(newAmount)
      await loadHistory()
      const { data: lb } = await supabase.rpc('get_household_water_leaderboard', { p_date: selectedDate })
      setLeaderboard((lb as LeaderboardEntry[]) ?? [])
    }
    setAdding(false)
  }

  const goToPrev = () => setSelectedDate(d => format(subDays(parseISO(d), 1), 'yyyy-MM-dd'))
  const goToNext = () => {
    const next = format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd')
    if (next <= todayStr()) setSelectedDate(next)
  }
  const isTodaySelected = selectedDate === todayStr()
  const pct = Math.min(100, myGoal > 0 ? Math.round((displayAmount / myGoal) * 100) : 0)

  // "You" = the person whose data is shown (active member or own account, never pure family)
  const meUserId = activeMemberId ?? currentUserId

  if (hhLoading) return <Spinner />

  // Build 7-day history array (last 7 days, oldest first)
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd')
    const entry = history.find(h => h.date === d)
    return { date: d, amount: entry?.amount_ml ?? 0 }
  })

  const pageTitle = activeMember
    ? `${activeMember.display_name || activeMember.email.split('@')[0]}'s Water`
    : 'Water Intake'

  return (
    <div className="max-w-lg mx-auto px-4 md:px-6 py-8 space-y-8">

      {/* ── Date navigator ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Droplets className="h-5 w-5 text-blue-500" />
          <h1 className="text-xl font-semibold text-gray-900">{pageTitle}</h1>
          {waterStreak > 0 && !lockedToFamily && (
            <span className="text-sm font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-full">
              💧 {waterStreak}-day streak
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={goToPrev} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setSelectedDate(todayStr())}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
              isTodaySelected ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {isTodaySelected ? 'Today' : format(parseISO(selectedDate), 'MMM d')}
          </button>
          <button
            onClick={goToNext}
            disabled={isTodaySelected}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Selected date label ── */}
      {!isTodaySelected && (
        <p className="text-sm text-gray-400 -mt-4">
          {format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}
        </p>
      )}

      {/* ── Personal water sections — hidden for pure family account ── */}
      {!lockedToFamily && (
        <>
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <WaterGlass pct={pct} />
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600 tabular-nums">{displayAmount.toLocaleString()} ml</p>
                <p className="text-sm text-gray-400 mt-0.5">of {myGoal.toLocaleString()} ml goal · {pct}%</p>
              </div>
            </div>
          )}

          {/* ── Add error ── */}
          {addError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {addError}
            </p>
          )}

          {/* ── Quick add ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
              {isTodaySelected ? 'Add water' : `Log for ${format(parseISO(selectedDate), 'MMM d')}`}
            </p>
            <div className="grid grid-cols-4 gap-2">
              {[250, 500, 750, 1000].map(ml => (
                <button
                  key={ml}
                  onClick={() => addWater(ml)}
                  disabled={adding}
                  className="flex flex-col items-center justify-center py-3 rounded-2xl border border-blue-100 bg-blue-50 hover:bg-blue-100 active:scale-95 transition-all disabled:opacity-50"
                >
                  <Droplets className="h-4 w-4 text-blue-400 mb-1" />
                  <span className="text-xs font-semibold text-blue-700">+{ml}ml</span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                type="number" min="1" max="2000" placeholder="Custom ml…"
                value={customMl}
                onChange={e => setCustomMl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { addWater(parseInt(customMl)); setCustomMl('') } }}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm placeholder:text-gray-400 focus:border-blue-400 focus:outline-none"
              />
              <button
                onClick={() => { addWater(parseInt(customMl)); setCustomMl('') }}
                disabled={!customMl || adding}
                className="flex items-center gap-1 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
              <button
                onClick={() => addWater(-250)}
                disabled={adding || myAmount < 250}
                title="Remove 250ml"
                className="p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:text-red-400 hover:border-red-200 disabled:opacity-30 transition-colors"
              >
                <Minus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ── 7-day history strip ── */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Last 7 days</p>
            <div className="grid grid-cols-7 gap-1.5">
              {last7.map(day => {
                const daypct    = myGoal > 0 ? Math.min(100, Math.round((day.amount / myGoal) * 100)) : 0
                const isSelected = day.date === selectedDate
                const isTodayDay = isToday(parseISO(day.date))
                return (
                  <button
                    key={day.date}
                    onClick={() => setSelectedDate(day.date)}
                    className={`flex flex-col items-center gap-1.5 py-2 rounded-xl border transition-colors ${
                      isSelected ? 'border-blue-300 bg-blue-50' : 'border-gray-100 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <span className={`text-xs font-medium ${
                      isSelected ? 'text-blue-600' : isTodayDay ? 'text-gray-900' : 'text-gray-400'
                    }`}>
                      {format(parseISO(day.date), 'EEE')[0]}
                    </span>
                    <div className="w-5 h-8 rounded-full bg-gray-100 overflow-hidden flex items-end">
                      <div
                        className={`w-full rounded-full transition-all duration-500 ${
                          daypct >= 100 ? 'bg-green-400' : daypct > 50 ? 'bg-blue-400' : daypct > 0 ? 'bg-blue-200' : 'bg-gray-100'
                        }`}
                        style={{ height: `${Math.max(0, daypct)}%` }}
                      />
                    </div>
                    <span className={`text-xs tabular-nums ${isSelected ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>
                      {daypct}%
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        </>
      )}

      {/* ── Family leaderboard ── */}
      {leaderboard.length > 0 && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Family {isTodaySelected ? 'today' : format(parseISO(selectedDate), 'MMM d')} 🏆
          </p>
          <div className="space-y-2">
            {leaderboard.map((entry, rank) => {
              const isMe = !lockedToFamily && entry.user_id === meUserId
              const name = isMe ? 'You' : entry.email.split('@')[0]
              return (
                <div
                  key={entry.user_id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors ${
                    isMe ? 'border-blue-200 bg-blue-50/50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <span className="text-sm font-bold text-gray-300 w-4 flex-shrink-0">{rank + 1}</span>
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${avatarColor(entry.user_id)}`}>
                    {entry.email[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-medium ${isMe ? 'text-blue-700' : 'text-gray-800'}`}>{name}</span>
                      <span className="text-xs text-gray-500 tabular-nums flex-shrink-0 ml-2">
                        {entry.amount_ml.toLocaleString()} / {entry.goal_ml.toLocaleString()} ml
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          entry.pct >= 100 ? 'bg-green-500' : isMe ? 'bg-blue-500' : 'bg-blue-300'
                        }`}
                        style={{ width: `${entry.pct}%` }}
                      />
                    </div>
                  </div>
                  <span className={`text-xs font-semibold flex-shrink-0 ${entry.pct >= 100 ? 'text-green-600' : 'text-gray-400'}`}>
                    {entry.pct}%
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Animated water glass ─────────────────────────────────────

function WaterGlass({ pct }: { pct: number }) {
  return (
    <>
      <style>{`
        @keyframes wave-flow {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .wave-flow { animation: wave-flow 2.5s linear infinite; }
      `}</style>
      <div className="relative" style={{ width: 120, height: 180 }}>
        <div
          className="absolute inset-0 overflow-hidden bg-blue-50 border-4 border-blue-200"
          style={{ borderRadius: '12px 12px 24px 24px' }}
        >
          <div
            className="absolute bottom-0 left-0 right-0 transition-all duration-1000 ease-out"
            style={{ height: `${pct}%` }}
          >
            <div className="absolute inset-0 bg-blue-400 opacity-70" />
            <svg
              className="absolute wave-flow"
              style={{ top: -8, left: 0, width: '200%', height: 16 }}
              viewBox="0 0 200 16" preserveAspectRatio="none"
            >
              <path d="M0,8 C25,16 75,0 100,8 C125,16 175,0 200,8 L200,16 L0,16 Z" fill="#60a5fa" />
            </svg>
          </div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className={`text-lg font-bold tabular-nums ${pct > 45 ? 'text-white' : 'text-blue-600'}`}>
            {pct}%
          </span>
        </div>
        {[25, 50, 75].map(mark => (
          <div key={mark} className="absolute right-2 w-2 h-px bg-blue-200 opacity-60" style={{ bottom: `${mark}%` }} />
        ))}
      </div>
    </>
  )
}

function Spinner() {
  return (
    <div className="flex flex-1 items-center justify-center h-full">
      <div className="h-6 w-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  )
}
