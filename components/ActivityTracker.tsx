'use client'

import { useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useActiveMembers } from '@/contexts/ActiveMemberContext'

/**
 * Silently records today's activity on every app open.
 * For family accounts, records activity for ALL members when they load —
 * so every member's streak advances whenever the family account opens the app.
 * Also records again when switching to a specific member via PIN.
 */
export default function ActivityTracker() {
  const supabase = createClient()
  const { members, activeMemberId } = useActiveMembers()
  const recordedForAll = useRef(false)

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

  // For family accounts: record activity for ALL members once they load.
  // Every member's streak advances whenever the family account opens the app.
  useEffect(() => {
    if (members.length === 0 || recordedForAll.current) return
    recordedForAll.current = true
    members.forEach(m => {
      fetch('/api/member/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: m.user_id }),
      }).catch(() => {})
    })
  }, [members.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Also record individually when a specific member is selected via PIN
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
