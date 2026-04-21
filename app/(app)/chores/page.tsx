'use client'

import { useState, useEffect, useMemo } from 'react'
import { format, subMonths, parseISO, differenceInDays, subDays } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useHousehold } from '@/hooks/useHousehold'
import { useActiveMembers } from '@/contexts/ActiveMemberContext'
import { ListChecks, Plus, Trash2, Circle, Trophy } from 'lucide-react'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface Chore {
  id: string
  household_id: string
  title: string
  emoji: string | null
  recurrence: 'daily' | 'weekly'
  day_of_week: number | null
  points: number
  created_at: string
}

interface ChoreLog {
  id: string
  chore_id: string | null
  done_by: string
  done_date: string
  points_earned: number | null
}

interface MemberProfile {
  user_id: string
  email: string
  display_name?: string
}

// Most recent date this chore was supposed to be done (today or earlier)
function getLastDueDateStr(chore: Chore): string {
  const today = new Date()
  if (chore.recurrence === 'daily') return format(today, 'yyyy-MM-dd')
  const todayDow = today.getDay()
  const choreDow = chore.day_of_week ?? 0
  const daysAgo = (todayDow - choreDow + 7) % 7
  const lastDue = new Date(today)
  lastDue.setDate(today.getDate() - daysAgo)
  return format(lastDue, 'yyyy-MM-dd')
}

// Open = not yet closed since last due date (and chore existed when it was due)
function isChoreOpen(chore: Chore, logs: ChoreLog[]): boolean {
  const lastDueStr = getLastDueDateStr(chore)
  const createdStr = format(new Date(chore.created_at), 'yyyy-MM-dd')
  if (createdStr > lastDueStr) return false
  return !logs.some(l => l.chore_id === chore.id && l.done_date >= lastDueStr)
}

export default function ChoresPage() {
  const { household, loading: householdLoading } = useHousehold()
  const { effectiveUserId, accountType, activeMemberId } = useActiveMembers()
  const isReadOnly = accountType === 'family' && !activeMemberId
  const supabase = createClient()

  const [chores, setChores] = useState<Chore[]>([])
  const [logs, setLogs] = useState<ChoreLog[]>([])
  const [members, setMembers] = useState<MemberProfile[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState<string | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newEmoji, setNewEmoji] = useState('')
  const [newRecurrence, setNewRecurrence] = useState<'daily' | 'weekly'>('weekly')
  const [newDayOfWeek, setNewDayOfWeek] = useState(1)
  const [newPoints, setNewPoints] = useState(10)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!household) return
    loadAll()
  }, [household]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-suggest points when recurrence changes
  useEffect(() => {
    setNewPoints(newRecurrence === 'daily' ? 5 : 10)
  }, [newRecurrence])

  async function loadAll() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id ?? null)

    const since = format(subMonths(new Date(), 12), 'yyyy-MM-dd')

    const [choreRes, logRes] = await Promise.all([
      supabase.from('chores').select('*').eq('household_id', household!.id).order('created_at'),
      supabase.from('chore_logs').select('*').eq('household_id', household!.id)
        .gte('done_date', since).order('done_date', { ascending: false }),
    ])

    // Try profiles RPC, fall back to basic members
    const { data: profileData, error: profileErr } = await supabase.rpc('get_household_members_with_profiles')
    let memberData: MemberProfile[]
    if (!profileErr && profileData) {
      memberData = profileData as MemberProfile[]
    } else {
      const { data: basicData } = await supabase.rpc('get_household_members')
      memberData = (basicData ?? []) as MemberProfile[]
    }

    setChores((choreRes.data as Chore[]) ?? [])
    setLogs((logRes.data as ChoreLog[]) ?? [])
    setMembers(memberData)
    setLoading(false)
  }

  async function markDone(chore: Chore) {
    // Use effectiveUserId (member when family+member selected) or fall back to the page-level user
    const doneBy = effectiveUserId ?? currentUserId
    if (!doneBy || closing) return
    setClosing(chore.id)
    const today  = format(new Date(), 'yyyy-MM-dd')
    const points = chore.points ?? 10

    // Try insert first; if unique conflict (same chore already done today) fall back to update
    let logData: ChoreLog | null = null
    const { data: insertData, error: insertErr } = await supabase
      .from('chore_logs')
      .insert({ chore_id: chore.id, household_id: household!.id, done_by: doneBy, done_date: today, points_earned: points })
      .select()
      .single()

    if (!insertErr && insertData) {
      logData = { ...(insertData as ChoreLog), points_earned: points }
    } else if (insertErr?.code === '23505') {
      // Unique conflict — update the existing row for today
      const { data: updateData } = await supabase
        .from('chore_logs')
        .update({ done_by: doneBy, points_earned: points })
        .eq('chore_id', chore.id)
        .eq('done_date', today)
        .select()
        .single()
      if (updateData) logData = { ...(updateData as ChoreLog), points_earned: points }
    }

    if (logData) {
      setLogs(prev => [logData!, ...prev.filter(l => !(l.chore_id === chore.id && l.done_date === today))])
      window.dispatchEvent(new Event('chore-toggled'))
    }
    setClosing(null)
  }

  async function addChore() {
    if (!newTitle.trim() || !household) return
    setSaving(true)
    const { data, error } = await supabase
      .from('chores')
      .insert({
        household_id: household.id,
        title: newTitle.trim(),
        emoji: newEmoji.trim() || null,
        recurrence: newRecurrence,
        day_of_week: newRecurrence === 'weekly' ? newDayOfWeek : null,
        points: newPoints,
      })
      .select()
      .single()
    if (!error && data) {
      setChores(prev => [...prev, data as Chore])
      setNewTitle(''); setNewEmoji(''); setNewRecurrence('weekly'); setNewDayOfWeek(1); setNewPoints(10)
      setShowForm(false)
    }
    setSaving(false)
  }

  async function deleteChore(id: string) {
    const { error } = await supabase.from('chores').delete().eq('id', id)
    if (!error) {
      setChores(prev => prev.filter(c => c.id !== id))
      // Keep logs in local state — historical points must survive chore deletion
      // (DB now uses ON DELETE SET NULL via preserve_chore_log_history.sql migration)
      window.dispatchEvent(new Event('chore-toggled'))
    }
  }

  function memberName(userId: string) {
    const m = members.find(m => m.user_id === userId)
    if (!m) return 'Someone'
    if (userId === currentUserId) return 'You'
    return m.display_name || m.email.split('@')[0]
  }

  const openChores = useMemo(
    () => chores.filter(c => isChoreOpen(c, logs)),
    [chores, logs]
  )

  // Consecutive days the current user closed at least one chore
  const choreStreak = useMemo(() => {
    const dates = [...new Set(
      logs.filter(l => l.done_by === currentUserId).map(l => l.done_date)
    )].sort().reverse()
    if (!dates.length) return 0
    const today     = format(new Date(), 'yyyy-MM-dd')
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
    if (dates[0] !== today && dates[0] !== yesterday) return 0
    let streak = 1
    for (let i = 1; i < dates.length; i++) {
      if (differenceInDays(parseISO(dates[i - 1]), parseISO(dates[i])) === 1) streak++
      else break
    }
    return streak
  }, [logs, currentUserId])

  // Monthly leaderboard: last 6 months with data, sorted newest first
  const leaderboard = useMemo(() => {
    const adminId = accountType === 'family' ? currentUserId : null
    const monthMap: Record<string, Record<string, number>> = {}
    for (const log of logs) {
      if (log.points_earned == null) continue
      if (adminId && log.done_by === adminId) continue
      const month = log.done_date.slice(0, 7)
      if (!monthMap[month]) monthMap[month] = {}
      monthMap[month][log.done_by] = (monthMap[month][log.done_by] ?? 0) + log.points_earned
    }
    return Object.keys(monthMap)
      .sort()
      .reverse()
      .slice(0, 6)
      .map(month => {
        const byMember = monthMap[month]
        // Object.entries keys are unique by definition, but deduplicate defensively
        const seen = new Set<string>()
        const sorted = Object.entries(byMember)
          .filter(([uid]) => { if (seen.has(uid)) return false; seen.add(uid); return true })
          .sort((a, b) => b[1] - a[1])
        const max = sorted[0]?.[1] ?? 1
        return {
          month,
          label: format(parseISO(`${month}-01`), 'MMMM yyyy'),
          winner: sorted[0]?.[0] ?? null,
          max,
          sorted,
        }
      })
  }, [logs, accountType, currentUserId])

  if (householdLoading) return <Spinner />

  return (
    <div className="max-w-lg mx-auto px-4 md:px-6 py-8 space-y-8">

      {/* Header */}
      <div className="flex items-center gap-2">
        <ListChecks className="h-5 w-5 text-blue-600" />
        <h1 className="text-xl font-semibold text-gray-900">Chores</h1>
        <span className="text-sm text-gray-400">{format(new Date(), 'EEEE, MMM d')}</span>
        {choreStreak > 0 && (
          <span className="ml-auto text-sm font-semibold text-orange-600 bg-orange-50 border border-orange-100 px-2.5 py-0.5 rounded-full">
            🔥 {choreStreak}-day streak
          </span>
        )}
      </div>

      {/* Open Tasks */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
          Open Tasks
          {openChores.length > 0 && (
            <span className="ml-1.5 text-blue-500">({openChores.length})</span>
          )}
        </h2>
        {loading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : openChores.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">All caught up! 🎉</p>
        ) : (
          <div className="space-y-2">
            {openChores.map(chore => (
              <div
                key={chore.id}
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl border bg-white border-gray-200"
              >
                <button
                  onClick={() => markDone(chore)}
                  disabled={isReadOnly || closing === chore.id}
                  className="flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Circle className="h-5 w-5 text-gray-300 hover:text-green-400 transition-colors" />
                </button>
                <span className="text-sm">{chore.emoji}</span>
                <span className="flex-1 text-sm font-medium text-gray-900">{chore.title}</span>
                <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex-shrink-0">
                  +{chore.points} pts
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* All Chores (management) */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">All Chores</h2>
          {!isReadOnly && (
            <button
              onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Chore
            </button>
          )}
        </div>

        {showForm && (
          <div className="mb-3 p-4 rounded-2xl border border-blue-100 bg-blue-50/40 space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Emoji"
                value={newEmoji}
                onChange={e => setNewEmoji(e.target.value)}
                maxLength={2}
                className="w-16 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-center focus:border-blue-400 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Chore name…"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addChore()}
                className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm placeholder:text-gray-400 focus:border-blue-400 focus:outline-none"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {(['daily', 'weekly'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setNewRecurrence(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                    newRecurrence === r ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'
                  }`}
                >
                  {r}
                </button>
              ))}
              {newRecurrence === 'weekly' && DAYS.map((d, i) => (
                <button
                  key={d}
                  onClick={() => setNewDayOfWeek(i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    newDayOfWeek === i ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-500 flex-shrink-0">Points</label>
              <input
                type="number"
                min={1}
                max={999}
                value={newPoints}
                onChange={e => setNewPoints(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-center focus:border-blue-400 focus:outline-none"
              />
              <span className="text-xs text-gray-400">auto-suggested, override freely</span>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">
                Cancel
              </button>
              <button
                onClick={addChore}
                disabled={!newTitle.trim() || saving}
                className="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {!loading && chores.length === 0 && !showForm && (
          <p className="text-sm text-gray-400 py-4 text-center">No chores yet. Add one above.</p>
        )}

        <div className="space-y-1.5">
          {chores.map(chore => (
            <div key={chore.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-gray-100">
              <span className="text-sm w-5 text-center">{chore.emoji ?? '•'}</span>
              <span className="flex-1 text-sm text-gray-800">{chore.title}</span>
              <span className="text-xs font-medium text-amber-600">{chore.points} pts</span>
              <span className="text-xs text-gray-400 flex-shrink-0">
                {chore.recurrence === 'daily' ? 'Daily' : `Every ${DAYS[chore.day_of_week ?? 1]}`}
              </span>
              {!isReadOnly && (
                <button
                  onClick={() => deleteChore(chore.id)}
                  className="p-1 text-gray-300 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

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
                          className="h-full bg-blue-500 rounded-full"
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
