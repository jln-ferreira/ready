'use client'

import { useState, useEffect } from 'react'
import { format, subMonths, parseISO, differenceInDays, subDays } from 'date-fns'
import { createClient } from '@/lib/supabase/client'

// ─── types ────────────────────────────────────────────────────────────────────

interface ChoreLog {
  chore_id: string | null
  done_by: string
  done_date: string
  points_earned: number | null
}

interface WaterLog {
  log_date: string
  amount_ml: number
}

interface MemberProfile {
  user_id: string
  email: string
  display_name?: string
  sidebar_color?: string
  account_type?: string
}

export interface BadgeResult {
  id: string
  emoji: string
  name: string
  desc: string
  earned: boolean
}

export interface HouseholdStreak {
  userId: string
  name: string
  color: string
  streak: number
  longestStreak: number
}

export interface StreakAndBadges {
  streak: number
  longestStreak: number
  badges: BadgeResult[]
  householdStreaks: HouseholdStreak[]
  choreCount: number
  loading: boolean
}

// ─── badge definitions ────────────────────────────────────────────────────────

export const BADGE_DEFS = [
  { id: 'first_chore',    emoji: '✅', name: 'First Step',       desc: 'Close your first chore' },
  { id: 'chore_10',       emoji: '⚡', name: 'On a Roll',         desc: '10 chores closed' },
  { id: 'chore_50',       emoji: '🏆', name: 'Chore Master',      desc: '50 chores closed' },
  { id: 'chore_100',      emoji: '🎯', name: 'Centurion',         desc: '100 chores closed' },
  { id: 'points_100',     emoji: '💯', name: 'Century Club',      desc: 'Earn 100 total points' },
  { id: 'points_250',     emoji: '💰', name: 'Point Hunter',      desc: 'Earn 250 total points' },
  { id: 'points_500',     emoji: '🚀', name: 'High Scorer',       desc: 'Earn 500 total points' },
  { id: 'points_1000',    emoji: '💎', name: 'Diamond',           desc: 'Earn 1,000 total points' },
  { id: 'streak_3',       emoji: '🔥', name: 'Streak Starter',   desc: '3-day activity streak' },
  { id: 'streak_7',       emoji: '🌟', name: 'On Fire',           desc: '7-day activity streak' },
  { id: 'streak_14',      emoji: '💫', name: 'Fortnight',         desc: '14-day activity streak' },
  { id: 'streak_30',      emoji: '⚡', name: 'Unstoppable',       desc: '30-day activity streak' },
  { id: 'hydration_7',    emoji: '💧', name: 'Hydration Hero',    desc: 'Log water 7 days in a row' },
  { id: 'hydration_14',   emoji: '💦', name: 'Hydration Pro',     desc: 'Log water 14 days in a row' },
  { id: 'water_30',       emoji: '🌊', name: 'Water Warrior',     desc: 'Log water 30 total days' },
  { id: 'month_winner',   emoji: '👑', name: 'Month Winner',      desc: 'Win a monthly chore leaderboard' },
  { id: 'hat_trick',      emoji: '🎩', name: 'Hat Trick',         desc: 'Win the monthly leaderboard 3 times' },
  { id: 'clean_sweep',    emoji: '🧹', name: 'Clean Sweep',       desc: 'Close 5 chores in one day' },
  { id: 'clean_sweep_3',  emoji: '✨', name: 'Spotless',          desc: 'Clean sweep on 3 different days' },
  { id: 'weekend_warrior',emoji: '🏄', name: 'Weekend Warrior',   desc: 'Complete chores on a Saturday and a Sunday' },
  { id: 'variety_5',      emoji: '🎨', name: 'Well Rounded',      desc: 'Complete 5 different types of chore' },
] as const

const SIDEBAR_HEX: Record<string, string> = {
  blue: '#2563eb', purple: '#7c3aed', green: '#16a34a', rose: '#e11d48',
  orange: '#ea580c', teal: '#0d9488', amber: '#d97706', pink: '#db2777',
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function computeStreaks(dates: string[]): { current: number; longest: number } {
  if (dates.length === 0) return { current: 0, longest: 0 }

  const unique = [...new Set(dates)].sort().reverse()
  const today     = format(new Date(), 'yyyy-MM-dd')
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')

  // Current streak — must include today or yesterday to be active
  let current = 0
  if (unique[0] === today || unique[0] === yesterday) {
    current = 1
    for (let i = 1; i < unique.length; i++) {
      if (differenceInDays(parseISO(unique[i - 1]), parseISO(unique[i])) === 1) current++
      else break
    }
  }

  // All-time longest streak
  let longest = unique.length > 0 ? 1 : 0
  let run = 1
  for (let i = 1; i < unique.length; i++) {
    if (differenceInDays(parseISO(unique[i - 1]), parseISO(unique[i])) === 1) {
      run++
      if (run > longest) longest = run
    } else {
      run = 1
    }
  }

  return { current, longest: Math.max(longest, current) }
}

function computeBadges(
  userId: string,
  myLogs: ChoreLog[],
  waterLogs: WaterLog[],
  allHouseholdLogs: ChoreLog[],
  activityDates: string[],
): BadgeResult[] {
  const totalChores = myLogs.length
  const totalPoints = myLogs.reduce((s, l) => s + (l.points_earned ?? 0), 0)
  const { current, longest } = computeStreaks(activityDates)
  const peakStreak = Math.max(current, longest)

  // Water streak
  const waterActiveDates = waterLogs.filter(l => l.amount_ml > 0).map(l => l.log_date)
  const { current: wCur, longest: wLong } = computeStreaks(waterActiveDates)
  const peakWater = Math.max(wCur, wLong)
  const totalWaterDays = waterActiveDates.length

  // Clean sweep: 5+ chores in a single day
  const byDate: Record<string, number> = {}
  for (const l of myLogs) byDate[l.done_date] = (byDate[l.done_date] ?? 0) + 1
  const cleanSweep = Object.values(byDate).some(n => n >= 5)
  const cleanSweep3 = Object.values(byDate).filter(n => n >= 5).length >= 3

  // Weekend warrior: completed chores on at least one Saturday AND one Sunday
  const hasSaturday = myLogs.some(l => parseISO(l.done_date).getDay() === 6)
  const hasSunday   = myLogs.some(l => parseISO(l.done_date).getDay() === 0)
  const weekendWarrior = hasSaturday && hasSunday

  // Variety: completed 5+ distinct chore types
  const uniqueChores = new Set(myLogs.map(l => l.chore_id).filter(Boolean))
  const variety5 = uniqueChores.size >= 5

  // Month winner / hat trick: count months where user had most points vs 1+ other member
  const monthMap: Record<string, Record<string, number>> = {}
  for (const l of allHouseholdLogs) {
    const m = l.done_date.slice(0, 7)
    if (!monthMap[m]) monthMap[m] = {}
    monthMap[m][l.done_by] = (monthMap[m][l.done_by] ?? 0) + (l.points_earned ?? 0)
  }
  let monthWinCount = 0
  for (const members of Object.values(monthMap)) {
    if (Object.keys(members).length < 2) continue
    const sorted = Object.entries(members).sort((a, b) => b[1] - a[1])
    if (sorted[0][0] === userId) monthWinCount++
  }
  const monthWinner = monthWinCount >= 1
  const hatTrick    = monthWinCount >= 3

  return BADGE_DEFS.map(def => {
    let earned = false
    switch (def.id) {
      case 'first_chore':     earned = totalChores >= 1; break
      case 'chore_10':        earned = totalChores >= 10; break
      case 'chore_50':        earned = totalChores >= 50; break
      case 'chore_100':       earned = totalChores >= 100; break
      case 'points_100':      earned = totalPoints >= 100; break
      case 'points_250':      earned = totalPoints >= 250; break
      case 'points_500':      earned = totalPoints >= 500; break
      case 'points_1000':     earned = totalPoints >= 1000; break
      case 'streak_3':        earned = peakStreak >= 3; break
      case 'streak_7':        earned = peakStreak >= 7; break
      case 'streak_14':       earned = peakStreak >= 14; break
      case 'streak_30':       earned = peakStreak >= 30; break
      case 'hydration_7':     earned = peakWater >= 7; break
      case 'hydration_14':    earned = peakWater >= 14; break
      case 'water_30':        earned = totalWaterDays >= 30; break
      case 'month_winner':    earned = monthWinner; break
      case 'hat_trick':       earned = hatTrick; break
      case 'clean_sweep':     earned = cleanSweep; break
      case 'clean_sweep_3':   earned = cleanSweep3; break
      case 'weekend_warrior': earned = weekendWarrior; break
      case 'variety_5':       earned = variety5; break
    }
    return { ...def, earned }
  })
}

// ─── hook ─────────────────────────────────────────────────────────────────────

export function useStreakAndBadges(
  userId: string | null,
  householdId: string | undefined,
): StreakAndBadges {
  const supabase = createClient()
  const [data, setData] = useState<Omit<StreakAndBadges, 'loading'>>({
    streak: 0,
    longestStreak: 0,
    badges: BADGE_DEFS.map(d => ({ ...d, earned: false })),
    householdStreaks: [],
    choreCount: 0,
  })
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const handler = () => setRefreshKey(k => k + 1)
    window.addEventListener('chore-toggled', handler)
    return () => window.removeEventListener('chore-toggled', handler)
  }, [])

  useEffect(() => {
    if (!userId || !householdId) { setLoading(false); return }
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const since = format(subMonths(new Date(), 60), 'yyyy-MM-dd')

        // Use select('*') so queries don't fail if optional columns (points_earned) don't exist yet.
        // myLogs is derived client-side from allChoresRes to avoid RLS issues with done_by-only queries.
        const [myWaterRes, allChoresRes, allWaterRes, myActivityRes, allActivityRes] = await Promise.all([
          supabase.from('water_logs')
            .select('log_date, amount_ml')
            .eq('user_id', userId)
            .gte('log_date', since),
          supabase.from('chore_logs')
            .select('*')
            .eq('done_by', userId)
            .gte('done_date', since),
          // Water logs for all household members — same source as personal streak
          supabase.from('water_logs')
            .select('user_id, log_date, amount_ml')
            .eq('household_id', householdId)
            .gte('log_date', since)
            .gt('amount_ml', 0),
          // Login-based activity for personal streak
          supabase.from('user_activity')
            .select('activity_date')
            .eq('user_id', userId)
            .gte('activity_date', since),
          // Login-based activity for all household members
          supabase.from('user_activity')
            .select('user_id, activity_date')
            .gte('activity_date', since),
        ])

        // Members: try with profiles first, fall back to basic
        let members: MemberProfile[] = []
        const { data: profileData, error: profileErr } = await supabase.rpc('get_household_members_with_profiles')
        if (!profileErr && profileData) {
          members = profileData as MemberProfile[]
        } else {
          const { data: basicData } = await supabase.rpc('get_household_members')
          members = (basicData ?? []) as MemberProfile[]
        }

        if (cancelled) return

        if (allChoresRes.error) console.error('[useStreakAndBadges] chore_logs error:', allChoresRes.error)
        console.log('[useStreakAndBadges] chore_logs rows:', allChoresRes.data?.length, 'userId:', userId)

        const allLogs    = (allChoresRes.data ?? []) as ChoreLog[]
        const myLogs     = allLogs.filter(l => l.done_by === userId)
        const waterLogs  = (myWaterRes.data ?? []) as WaterLog[]
        const allWater   = (allWaterRes.data ?? []) as { user_id: string; log_date: string; amount_ml: number }[]

        // Login streak = only user_activity (opening the app)
        const loginDates    = (myActivityRes.data ?? []).map((r: { activity_date: string }) => r.activity_date)
        const { current, longest } = computeStreaks(loginDates)

        // Badges still use all activity sources for fair computation
        const choreDates    = myLogs.map(l => l.done_date)
        const waterDates    = waterLogs.filter(l => l.amount_ml > 0).map(l => l.log_date)
        const allActivity   = [...new Set([...loginDates, ...choreDates, ...waterDates])]
        const badges = computeBadges(userId, myLogs, waterLogs, allLogs, allActivity)

        // Household comparison = login streak only (user_activity), excluding self
        const memberLoginDates: Record<string, string[]> = {}
        for (const row of (allActivityRes.data ?? []) as { user_id: string; activity_date: string }[]) {
          if (!memberLoginDates[row.user_id]) memberLoginDates[row.user_id] = []
          memberLoginDates[row.user_id].push(row.activity_date)
        }

        // Deduplicate and exclude family admin accounts from the competition
        const seen = new Set<string>()
        const uniqueMembers = members.filter(m => {
          if (seen.has(m.user_id)) return false
          seen.add(m.user_id)
          if (m.account_type === 'family') return false
          if (/^family\./i.test(m.email ?? '')) return false
          return true
        })

        // Show only other members (not self) — user already sees their own at the top
        const householdStreaks: HouseholdStreak[] = uniqueMembers
          .filter(m => m.user_id !== userId)
          .map(m => {
            const { current: s, longest: l } = computeStreaks(memberLoginDates[m.user_id] ?? [])
            return {
              userId: m.user_id,
              name: m.display_name || m.email.split('@')[0],
              color: SIDEBAR_HEX[(m as any).sidebar_color ?? 'blue'] ?? '#2563eb',
              streak: s,
              longestStreak: l,
            }
          })
          .sort((a, b) => b.streak - a.streak)

        if (!cancelled) {
          setData({ streak: current, longestStreak: longest, badges, householdStreaks, choreCount: myLogs.length })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [userId, householdId, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return { ...data, loading }
}
