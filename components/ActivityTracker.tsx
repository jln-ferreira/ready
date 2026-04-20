'use client'

import { useEffect } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useActiveMembers } from '@/contexts/ActiveMemberContext'

/**
 * Silently records today's activity on every app open.
 * For family accounts, also records activity for whichever member is selected —
 * switching from Jose → Marina counts as a login day for Marina.
 */
export default function ActivityTracker() {
  const supabase = createClient()
  const { members, activeMemberId } = useActiveMembers()

  // Record activity for the logged-in user (runs once on mount)
  useEffect(() => {
    const track = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase
        .from('user_activity')
        .upsert(
          { user_id: user.id, activity_date: format(new Date(), 'yyyy-MM-dd') },
          { onConflict: 'user_id,activity_date' },
        )
      if (error) console.error('[ActivityTracker] own activity upsert failed:', error.message)
    }
    track()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // For family accounts: record activity for the selected member whenever they switch.
  // Use members.length > 0 instead of accountType to avoid the race where accountType
  // is still 'individual' before the context async load completes.
  useEffect(() => {
    if (!activeMemberId || members.length === 0) return
    fetch('/api/member/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: activeMemberId }),
    })
      .then(async r => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}))
          console.error('[ActivityTracker] member activity POST failed:', r.status, body)
        }
      })
      .catch(err => console.error('[ActivityTracker] member activity fetch error:', err))
  }, [activeMemberId, members.length])

  return null
}
