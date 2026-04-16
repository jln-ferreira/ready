'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'

const NOTICEBOARD_KEY = 'noticeboard-last-seen'

export function useSidebarBadges(householdId: string | undefined) {
  const [choresPending, setChoresPending] = useState(0)
  const [noticeboardUnread, setNoticeboardUnread] = useState(false)
  const supabase = createClient()

  const checkBadges = useCallback(async () => {
    if (!householdId) { console.debug('[badges] no householdId, skipping'); return }

    const today    = format(new Date(), 'yyyy-MM-dd')
    const todayDow = new Date().getDay()
    console.debug('[badges] checking — householdId:', householdId, 'todayDow:', todayDow)

    const [choresRes, logsRes, latestRes] = await Promise.all([
      supabase.from('chores').select('id, recurrence, day_of_week').eq('household_id', householdId),
      supabase.from('chore_logs').select('chore_id').eq('household_id', householdId).eq('done_date', today),
      supabase.from('notices').select('created_at').eq('household_id', householdId)
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])

    console.debug('[badges] chores:', choresRes.data, 'err:', choresRes.error)
    console.debug('[badges] logs:', logsRes.data,   'err:', logsRes.error)

    // Chores badge — count due today that are not yet completed
    const chores  = (choresRes.data ?? []) as { id: string; recurrence: string; day_of_week: number | null }[]
    const doneIds = new Set((logsRes.data ?? []).map((l: { chore_id: string }) => l.chore_id))
    const pending = chores.filter(c =>
      (c.recurrence === 'daily' || (c.recurrence === 'weekly' && c.day_of_week === todayDow))
      && !doneIds.has(c.id)
    ).length
    console.debug('[badges] pending chores:', pending)
    setChoresPending(pending)

    // Noticeboard badge — unread if latest notice is newer than last-seen timestamp
    const lastSeen = localStorage.getItem(NOTICEBOARD_KEY)
    if (latestRes.data?.created_at) {
      setNoticeboardUnread(!lastSeen || latestRes.data.created_at > lastSeen)
    }
  }, [householdId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Initial fetch
  useEffect(() => { checkBadges() }, [checkBadges])

  // Re-check when a chore is toggled (dispatched from chores page)
  // Clear noticeboard badge when user visits that page
  useEffect(() => {
    const clearBoard = () => setNoticeboardUnread(false)
    window.addEventListener('chore-toggled',       checkBadges)
    window.addEventListener('noticeboard-visited', clearBoard)
    return () => {
      window.removeEventListener('chore-toggled',       checkBadges)
      window.removeEventListener('noticeboard-visited', clearBoard)
    }
  }, [checkBadges])

  return { choresPending, noticeboardUnread }
}

/** Call from any page that should mark the noticeboard as read. */
export function markNoticeboardSeen() {
  localStorage.setItem(NOTICEBOARD_KEY, new Date().toISOString())
  window.dispatchEvent(new Event('noticeboard-visited'))
}
