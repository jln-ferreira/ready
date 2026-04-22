'use client'

import { useEffect } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useActiveMembers } from '@/contexts/ActiveMemberContext'

/**
 * Silently records today's activity on every app open.
 * Each member's streak is independent:
 *   - Admin's own streak advances on every app open.
 *   - A member's streak advances only when their PIN is used to access their account
 *     (either via PIN entry or restoring their saved session on app load).
 */
export default function ActivityTracker() {
  const supabase = createClient()
  const { members, activeMemberId } = useActiveMembers()

  // Record activity for the logged-in admin user (runs once on mount)
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

  // Record activity for a member when their account becomes active.
  // Fires when a PIN is entered, and also on app load if a member session was saved.
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
  }, [activeMemberId, members.length]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
