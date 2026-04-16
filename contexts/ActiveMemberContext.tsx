'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface MemberProfile {
  user_id: string
  email: string
  display_name: string
  sidebar_color: string
  account_type: string
  has_pin: boolean
}

interface ActiveMemberContextType {
  /** Whether the currently logged-in Supabase user is a family account */
  accountType: 'individual' | 'family'
  /** The logged-in user's own sidebar color key */
  ownColorKey: string
  /** All individual members in the household (for family accounts) */
  members: MemberProfile[]
  /** The user_id of the currently selected member (null = no member selected) */
  activeMemberId: string | null
  /** Full profile of the active member */
  activeMember: MemberProfile | null
  /**
   * The user_id to use for data fetching:
   * – family account + member selected → activeMemberId
   * – otherwise → logged-in user's id
   */
  effectiveUserId: string | null
  setActiveMemberId: (id: string | null) => void
  setOwnColorKey: (key: string) => void
  /** Update a member's color in the in-memory list (after saving via API) */
  updateMemberColor: (memberId: string, color: string) => void
}

const ActiveMemberContext = createContext<ActiveMemberContextType>({
  accountType:      'individual',
  ownColorKey:      'blue',
  members:          [],
  activeMemberId:   null,
  activeMember:     null,
  effectiveUserId:  null,
  setActiveMemberId:  () => {},
  setOwnColorKey:     () => {},
  updateMemberColor:  () => {},
})

export function ActiveMemberProvider({ children }: { children: ReactNode }) {
  const supabase = createClient()

  const [ownUserId,    setOwnUserId]    = useState<string | null>(null)
  const [accountType,  setAccountType]  = useState<'individual' | 'family'>('individual')
  const [ownColorKey,  setOwnColorKey]  = useState('blue')
  const [members,      setMembers]      = useState<MemberProfile[]>([])
  const [activeMemberId, setActiveMemberIdState] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      setOwnUserId(user.id)

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('account_type, sidebar_color')
        .eq('user_id', user.id)
        .single()

      if (cancelled) return
      // Email pattern is the most reliable check — DB row may not have been backfilled
      const type = (
        profile?.account_type === 'family' || /^family\./.test(user.email ?? '')
          ? 'family'
          : 'individual'
      ) as 'individual' | 'family'
      setAccountType(type)
      setOwnColorKey(profile?.sidebar_color ?? 'blue')

      if (type === 'family') {
        const { data: mems } = await supabase.rpc('get_household_members_with_profiles')
        if (!cancelled && mems) {
          const filtered = (mems as MemberProfile[]).filter(m => m.account_type !== 'family')
          setMembers(filtered)
          const saved = localStorage.getItem('activeMemberId')
          if (saved && filtered.some(m => m.user_id === saved)) {
            setActiveMemberIdState(saved)
          }
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for color changes dispatched from the profile save
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ color: string; memberId?: string }>).detail
      if (!detail?.color) return
      if (detail.memberId) {
        setMembers(prev => prev.map(m =>
          m.user_id === detail.memberId ? { ...m, sidebar_color: detail.color } : m
        ))
      } else {
        setOwnColorKey(detail.color)
      }
    }
    window.addEventListener('sidebar-color-changed', handler)
    return () => window.removeEventListener('sidebar-color-changed', handler)
  }, [])

  const setActiveMemberId = (id: string | null) => {
    setActiveMemberIdState(id)
    if (id) localStorage.setItem('activeMemberId', id)
    else    localStorage.removeItem('activeMemberId')
  }

  const updateMemberColor = (memberId: string, color: string) => {
    setMembers(prev => prev.map(m =>
      m.user_id === memberId ? { ...m, sidebar_color: color } : m
    ))
    window.dispatchEvent(
      new CustomEvent('sidebar-color-changed', { detail: { color, memberId } })
    )
  }

  const activeMember    = members.find(m => m.user_id === activeMemberId) ?? null
  const effectiveUserId = activeMemberId ?? ownUserId

  return (
    <ActiveMemberContext.Provider value={{
      accountType, ownColorKey, members,
      activeMemberId, activeMember, effectiveUserId,
      setActiveMemberId, setOwnColorKey, updateMemberColor,
    }}>
      {children}
    </ActiveMemberContext.Provider>
  )
}

export function useActiveMembers() {
  return useContext(ActiveMemberContext)
}
