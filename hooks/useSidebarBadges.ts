'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'

export function useSidebarBadges(householdId: string | undefined) {
  const [choresPending, setChoresPending] = useState(0)
  const supabase = createClient()

  const checkBadges = useCallback(async () => {
    if (!householdId) return

    const today = format(new Date(), 'yyyy-MM-dd')

    // Load logs for last 14 days — enough to detect overdue weekly chores
    const fourteenDaysAgo = format(new Date(Date.now() - 14 * 86400_000), 'yyyy-MM-dd')

    const [choresRes, logsRes] = await Promise.all([
      supabase.from('chores').select('id, recurrence, day_of_week, created_at').eq('household_id', householdId),
      supabase.from('chore_logs').select('chore_id, done_date').eq('household_id', householdId).gte('done_date', fourteenDaysAgo),
    ])

    type ChoreRow = { id: string; recurrence: string; day_of_week: number | null; created_at: string }
    type LogRow   = { chore_id: string; done_date: string }
    const chores = (choresRes.data ?? []) as ChoreRow[]
    const logs   = (logsRes.data ?? []) as LogRow[]

    function getLastDueDateStr(c: ChoreRow): string {
      if (c.recurrence === 'daily') return today
      const todayDow = new Date().getDay()
      const choreDow = c.day_of_week ?? 0
      const daysAgo  = (todayDow - choreDow + 7) % 7
      const d = new Date()
      d.setDate(d.getDate() - daysAgo)
      return format(d, 'yyyy-MM-dd')
    }

    const pending = chores.filter(c => {
      const lastDue   = getLastDueDateStr(c)
      const createdAt = format(new Date(c.created_at), 'yyyy-MM-dd')
      if (createdAt > lastDue) return false
      return !logs.some(l => l.chore_id === c.id && l.done_date >= lastDue)
    }).length

    setChoresPending(pending)
  }, [householdId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { checkBadges() }, [checkBadges])

  useEffect(() => {
    window.addEventListener('chore-toggled', checkBadges)
    return () => { window.removeEventListener('chore-toggled', checkBadges) }
  }, [checkBadges])

  return { choresPending }
}
