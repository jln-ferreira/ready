'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, Lock, Palette, KeyRound, Bell, BellOff, Moon, Plus, ChevronDown } from 'lucide-react'
import { useActiveMembers } from '@/contexts/ActiveMemberContext'
import { useHousehold } from '@/hooks/useHousehold'
import { useStreakAndBadges } from '@/hooks/useStreakAndBadges'
import { useStreakFavicon } from '@/hooks/useStreakFavicon'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { KidModal, DeleteKidConfirm, KidRow } from '@/components/KidModal'
import type { Kid } from '@/components/KidModal'

// ─── colour palette ───────────────────────────────────────────────────────────
export const SIDEBAR_COLORS: Record<string, { label: string; hex: string }> = {
  blue:   { label: 'Blue',   hex: '#2563eb' },
  purple: { label: 'Purple', hex: '#7c3aed' },
  green:  { label: 'Green',  hex: '#16a34a' },
  rose:   { label: 'Rose',   hex: '#e11d48' },
  orange: { label: 'Orange', hex: '#ea580c' },
  teal:   { label: 'Teal',   hex: '#0d9488' },
  amber:  { label: 'Amber',  hex: '#d97706' },
  pink:   { label: 'Pink',   hex: '#db2777' },
}

// ─── fitness types ────────────────────────────────────────────────────────────
type Sex           = 'male' | 'female' | 'other'
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active'

interface FitnessProfile {
  weight_kg:      number | null
  height_cm:      number | null
  age:            number | null
  sex:            Sex | null
  activity_level: ActivityLevel
}

const ACTIVITY_LABELS: Record<ActivityLevel, { label: string; desc: string }> = {
  sedentary: { label: 'Sedentary', desc: 'Little or no exercise' },
  light:     { label: 'Light',     desc: 'Exercise 1–3 days/week' },
  moderate:  { label: 'Moderate',  desc: 'Exercise 3–5 days/week' },
  active:    { label: 'Active',    desc: 'Daily exercise or physical job' },
}
const WATER_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.0, light: 1.1, moderate: 1.2, active: 1.4,
}
const TDEE_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725,
}

function calcWaterGoal(p: Partial<FitnessProfile>): number {
  const weight = p.weight_kg ?? 70
  const mult   = WATER_MULTIPLIERS[p.activity_level ?? 'moderate']
  return Math.min(4000, Math.max(1500, Math.round((weight * 35 * mult) / 100) * 100))
}
function calcTDEE(p: Partial<FitnessProfile>): { bmr: number | null; tdee: number | null } {
  const { weight_kg, height_cm, age, sex, activity_level } = p
  if (!weight_kg || !height_cm || !age || !sex || sex === 'other') return { bmr: null, tdee: null }
  const bmr = sex === 'male'
    ? (10 * weight_kg) + (6.25 * height_cm) - (5 * age) + 5
    : (10 * weight_kg) + (6.25 * height_cm) - (5 * age) - 161
  const mult = TDEE_MULTIPLIERS[activity_level ?? 'moderate']
  return { bmr: Math.round(bmr), tdee: Math.round(bmr * mult) }
}

const blankFitness: FitnessProfile = {
  weight_kg: null, height_cm: null, age: null, sex: null, activity_level: 'moderate',
}

export default function ProfilePage() {
  const supabase = createClient()
  const { accountType, activeMemberId, activeMember, updateMemberColor } = useActiveMembers()
  const { household, loading: householdLoading } = useHousehold()

  // When the family account has a member selected, edit that member's profile
  const isMemberView    = accountType === 'family' && !!activeMemberId
  const lockedToFamily  = accountType === 'family' && !activeMemberId
  const targetUserId    = activeMemberId   // null when not in member view

  const [ownUserId, setOwnUserId] = useState<string | null>(null)
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setOwnUserId(user?.id ?? null))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Badges are per-member: use the viewed member's ID when in member view
  const badgeUserId = isMemberView && targetUserId ? targetUserId : ownUserId
  const { streak: ownStreak, longestStreak: ownLongestStreak, badges, loading: streakLoading } =
    useStreakAndBadges(badgeUserId, household?.id)

  // When viewing a member, fetch their streak via service-role API (bypasses RLS)
  const [memberStreak, setMemberStreak] = useState<{ current: number; longest: number } | null>(null)
  const [memberStreakLoading, setMemberStreakLoading] = useState(false)
  useEffect(() => {
    if (!isMemberView || !targetUserId) { setMemberStreak(null); return }
    let cancelled = false
    setMemberStreakLoading(true)
    fetch(`/api/member/streak?memberId=${targetUserId}`)
      .then(r => r.ok ? r.json() : null)
      .then(json => { if (!cancelled && json) setMemberStreak({ current: json.current, longest: json.longest }) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setMemberStreakLoading(false) })
    return () => { cancelled = true }
  }, [isMemberView, targetUserId])

  const streak        = isMemberView ? (memberStreak?.current  ?? 0) : ownStreak
  const longestStreak = isMemberView ? (memberStreak?.longest  ?? 0) : ownLongestStreak

  // Update favicon based on own streak (not the member being viewed)
  useStreakFavicon(ownStreak)

  // Household comparison chips — family account uses service-role API to read member activity
  type HouseholdStreakEntry = { userId: string; name: string; color: string; streak: number; longestStreak: number }
  const [householdStreaks, setHouseholdStreaks] = useState<HouseholdStreakEntry[]>([])
  const [householdStreaksLoading, setHouseholdStreaksLoading] = useState(false)
  useEffect(() => {
    if (!household?.id) return
    // Family account: fetch via service-role API so RLS doesn't block reading member activity
    if (accountType === 'family') {
      let cancelled = false
      setHouseholdStreaksLoading(true)
      fetch(`/api/household/streaks?householdId=${household.id}`)
        .then(r => r.ok ? r.json() : [])
        .then(json => { if (!cancelled) setHouseholdStreaks(json) })
        .catch(() => {})
        .finally(() => { if (!cancelled) setHouseholdStreaksLoading(false) })
      return () => { cancelled = true }
    }
  }, [accountType, household?.id])

  const isStreakLoading = householdLoading || !ownUserId || streakLoading || (isMemberView && memberStreakLoading) || householdStreaksLoading

  // Push notifications — only for the current user's own profile
  const push = usePushNotifications(household?.id)

  // Kids management
  const [kids,        setKids]        = useState<Kid[]>([])
  const [kidsLoading, setKidsLoading] = useState(false)
  const [kidModal,    setKidModal]    = useState<Partial<Kid> | null>(null)
  const [modalSaving, setModalSaving] = useState(false)
  const [deleteKid,   setDeleteKid]   = useState<Kid | null>(null)
  const [deletingKid, setDeletingKid] = useState(false)

  const loadKids = useCallback(async () => {
    if (!household?.id) return
    setKidsLoading(true)
    const { data } = await supabase.from('kids').select('*').eq('household_id', household.id).order('created_at', { ascending: true })
    setKids((data ?? []) as Kid[])
    setKidsLoading(false)
  }, [household?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadKids() }, [loadKids])

  const handleSaveKid = async (data: { name: string; date_of_birth: string | null; daily_sleep_goal_min: number }) => {
    if (!household?.id) return
    setModalSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (kidModal?.id) {
      await supabase.from('kids').update(data).eq('id', kidModal.id)
    } else {
      await supabase.from('kids').insert({ ...data, household_id: household.id, created_by: user?.id ?? null })
    }
    setKidModal(null)
    setModalSaving(false)
    await loadKids()
  }

  const handleDeleteKid = async () => {
    if (!deleteKid) return
    setDeletingKid(true)
    await supabase.from('kids').delete().eq('id', deleteKid.id)
    setDeleteKid(null)
    setDeletingKid(false)
    await loadKids()
  }

  // Seed display name and color from context immediately — API fetch will overwrite with fresh data
  const [displayName,  setDisplayName]  = useState(activeMember?.display_name ?? '')
  const [sidebarColor, setSidebarColor] = useState(activeMember?.sidebar_color ?? 'blue')
  const [fitness, setFitness] = useState<FitnessProfile>(blankFitness)

  const [fitnessOpen, setFitnessOpen] = useState(false)
  const [loading,   setLoading]   = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // PIN state
  const [hasPin,       setHasPin]       = useState(false)
  const [pinFormOpen,  setPinFormOpen]  = useState(false)
  const [newPin,       setNewPin]       = useState('')
  const [confirmPin,   setConfirmPin]   = useState('')
  const [pinSaving,    setPinSaving]    = useState(false)
  const [pinError,     setPinError]     = useState<string | null>(null)
  const [pinSaved,     setPinSaved]     = useState(false)

  useEffect(() => {
    // Reset — use context values as starting point so something shows while the API loads
    setDisplayName(activeMember?.display_name ?? '')
    setSidebarColor(activeMember?.sidebar_color ?? 'blue')
    setFitness(blankFitness)
    setHasPin(activeMember?.has_pin ?? false)
    setPinFormOpen(false)
    setNewPin('')
    setConfirmPin('')
    setPinError(null)

    // Cancellation flag — prevents a slow fetch from overwriting a faster subsequent one
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    const load = async () => {
      if (cancelled) return

      try {
        if (isMemberView && targetUserId) {
          // Use the service-role API to bypass RLS for family account reading member data
          const res = await fetch(`/api/member/profile?memberId=${targetUserId}`)
          if (cancelled) return
          if (res.ok) {
            const json = await res.json()
            setDisplayName(json.profile?.display_name ?? activeMember?.display_name ?? '')
            setSidebarColor(json.profile?.sidebar_color ?? activeMember?.sidebar_color ?? 'blue')
            setHasPin(activeMember?.has_pin ?? false)
            setFitness(json.fitness ? (json.fitness as FitnessProfile) : blankFitness)
          } else {
            // API failed — context data already seeded above, show fitness load error only
            const json = await res.json().catch(() => ({}))
            setLoadError(json.error ?? `Could not load fitness data (${res.status})`)
          }
        } else {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user || cancelled) return

          const [{ data: profile }, { data: fp }] = await Promise.all([
            supabase.from('user_profiles')
              .select('display_name, sidebar_color, pin_hash').eq('user_id', user.id).single(),
            supabase.from('fitness_profiles')
              .select('weight_kg, height_cm, age, sex, activity_level').eq('user_id', user.id).single(),
          ])

          if (cancelled) return
          setDisplayName(profile?.display_name ?? '')
          setSidebarColor(profile?.sidebar_color ?? 'blue')
          setHasPin(!!profile?.pin_hash)
          setFitness(fp ? (fp as FitnessProfile) : blankFitness)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [activeMemberId, isMemberView]) // eslint-disable-line react-hooks/exhaustive-deps

  const setFit = <K extends keyof FitnessProfile>(k: K, v: FitnessProfile[K]) =>
    setFitness(prev => ({ ...prev, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    if (isMemberView && targetUserId) {
      // Family account saving a member's profile via API route
      const res = await fetch('/api/member/profile', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId:    targetUserId,
          sidebarColor,
          displayName,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setSaveError(json.error ?? 'Failed to save.')
        setSaving(false)
        return
      }
      // Also update fitness profile via service route (family can write member fitness)
      await fetch('/api/member/fitness', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: targetUserId, fitness }),
      }).catch(() => {}) // best-effort

      // Update sidebar immediately
      updateMemberColor(targetUserId, sidebarColor)
    } else {
      // Individual account saving own profile
      await Promise.all([
        supabase.from('user_profiles').upsert(
          { user_id: user.id, display_name: displayName, sidebar_color: sidebarColor, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        ),
        supabase.from('fitness_profiles').upsert(
          { user_id: user.id, ...fitness, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        ),
      ])
      // Notify sidebar
      window.dispatchEvent(new CustomEvent('sidebar-color-changed', { detail: { color: sidebarColor } }))
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleSavePin = async () => {
    setPinError(null)
    if (!/^\d{4}$/.test(newPin)) { setPinError('PIN must be exactly 4 digits.'); return }
    if (newPin !== confirmPin)   { setPinError('PINs do not match.'); return }

    setPinSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPinSaving(false); return }

    const targetId = (isMemberView && targetUserId) ? targetUserId : user.id

    const res = await fetch('/api/member/pin', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ targetUserId: targetId, pin: newPin }),
    })

    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setPinError(json.error ?? 'Could not save PIN. Please try again.')
    } else {
      setHasPin(true)
      setPinFormOpen(false)
      setNewPin('')
      setConfirmPin('')
      setPinSaved(true)
      setTimeout(() => setPinSaved(false), 3000)
    }
    setPinSaving(false)
  }

  if (lockedToFamily) return (
    <div className="flex flex-1 items-center justify-center h-full px-6">
      <div className="text-center">
        <User className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-500">Select a family member to view their profile</p>
      </div>
    </div>
  )

  if (loading) return <Spinner />

  const waterGoal = calcWaterGoal(fitness)
  const { bmr, tdee } = calcTDEE(fitness)
  const previewHex = SIDEBAR_COLORS[sidebarColor]?.hex ?? '#2563eb'

  return (
    <div className="max-w-lg mx-auto px-4 md:px-6 py-8 space-y-6">

      {/* PIN saved toast */}
      {pinSaved && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 rounded-2xl bg-green-600 px-5 py-3 text-sm font-medium text-white shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          PIN updated successfully
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <User className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">
            {isMemberView ? `${displayName || 'Member'}'s Profile` : 'My Profile'}
          </h1>
        </div>
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <Lock className="h-3 w-3" />
          Private — only visible to you
        </p>
      </div>

      {/* Streak card — only shown once the user has a streak worth celebrating */}
      {!isStreakLoading && streak >= 1 && (
        <div className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔥</span>
              <div>
                <p className="text-2xl font-bold text-orange-700 leading-none">{streak}</p>
                <p className="text-xs text-orange-400 mt-0.5">
                  day login streak
                  {longestStreak > streak && longestStreak > 0 && ` · best: ${longestStreak}`}
                </p>
              </div>
            </div>
          </div>

          {/* Household streak comparison — exclude the member currently being viewed */}
          {householdStreaks.filter(m => !isMemberView || m.userId !== targetUserId).length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1 border-t border-orange-100">
              {householdStreaks.filter(m => !isMemberView || m.userId !== targetUserId).map(m => (
                <div key={m.userId} className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: m.color }}
                  />
                  <span className="text-xs text-gray-600 font-medium">{m.name}</span>
                  <span className="text-xs font-bold text-orange-600">{m.streak}🔥</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Identity */}
      <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
        <div className="flex items-center px-4 py-3.5 gap-4">
          <span className="text-sm text-gray-600 w-28 flex-shrink-0">Display name</span>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Sidebar colour */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Palette className="h-4 w-4 text-gray-500" />
          <p className="text-sm font-medium text-gray-700">Sidebar colour</p>
          <span
            className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full text-white"
            style={{ backgroundColor: previewHex }}
          >
            {SIDEBAR_COLORS[sidebarColor]?.label}
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          {Object.entries(SIDEBAR_COLORS).map(([key, { hex, label }]) => (
            <button
              key={key}
              onClick={() => setSidebarColor(key)}
              title={label}
              className="w-8 h-8 rounded-full transition-all focus:outline-none"
              style={{
                backgroundColor: hex,
                boxShadow: sidebarColor === key
                  ? `0 0 0 2px white, 0 0 0 4px ${hex}`
                  : undefined,
              }}
            />
          ))}
        </div>
      </div>

      {/* PIN */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <KeyRound className="h-4 w-4 text-gray-500" />
          <p className="text-sm font-medium text-gray-700">Switch PIN</p>
          <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
            hasPin ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {hasPin ? 'Set' : 'Not set'}
          </span>
        </div>

        {!pinFormOpen ? (
          <button
            onClick={() => { setPinFormOpen(true); setPinError(null) }}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors text-left"
          >
            {hasPin ? 'Change PIN…' : 'Set a 4-digit PIN…'}
          </button>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">New PIN</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={4}
                  value={newPin}
                  onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm tracking-widest text-center focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Confirm PIN</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={4}
                  value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm tracking-widest text-center focus:border-blue-400 focus:outline-none"
                />
              </div>
            </div>
            {pinError && (
              <p className="text-xs text-red-600">{pinError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSavePin}
                disabled={pinSaving || newPin.length < 4 || confirmPin.length < 4}
                className="flex-1 rounded-xl bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {pinSaving ? 'Saving…' : 'Save PIN'}
              </button>
              <button
                onClick={() => { setPinFormOpen(false); setNewPin(''); setConfirmPin(''); setPinError(null) }}
                className="px-4 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Push notifications — own profile only */}
      {!isMemberView && push.isSupported && push.permission !== 'denied' && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            {push.isSubscribed
              ? <Bell className="h-4 w-4 text-blue-500" />
              : <BellOff className="h-4 w-4 text-gray-400" />
            }
            <p className="text-sm font-medium text-gray-700">Smart Nudges</p>
            <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
              push.isSubscribed ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {push.isSubscribed ? 'On' : 'Off'}
            </span>
          </div>
          <button
            onClick={push.isSubscribed ? push.unsubscribe : push.subscribe}
            disabled={push.loading}
            className={`w-full rounded-xl border px-4 py-2.5 text-sm text-left transition-colors disabled:opacity-50 ${
              push.isSubscribed
                ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {push.loading
              ? 'Working…'
              : push.isSubscribed
                ? 'Disable — streak alerts, point reminders, overdue chores'
                : 'Enable — get nudged before losing a streak or falling behind'}
          </button>
        </div>
      )}

      {!isMemberView && push.isSupported && push.permission === 'denied' && (
        <p className="text-xs text-gray-400 flex items-center gap-1.5">
          <BellOff className="h-3.5 w-3.5" />
          Notifications blocked in browser settings — enable them there to use smart nudges.
        </p>
      )}

      {/* Fitness — collapsible */}
      <div>
        <button
          onClick={() => setFitnessOpen(o => !o)}
          className="border-t border-gray-100 pt-2 w-full flex items-center justify-between"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Fitness</p>
          <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${fitnessOpen ? 'rotate-180' : ''}`} />
        </button>

        {fitnessOpen && (
          <div className="mt-4 space-y-4">
            {/* Fitness fields */}
            <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
              <div className="flex items-center px-4 py-3.5 gap-4">
                <span className="text-sm text-gray-600 w-28 flex-shrink-0">Weight</span>
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="number" min="30" max="300" step="0.1"
                    value={fitness.weight_kg ?? ''}
                    onChange={e => setFit('weight_kg', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="70"
                    className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-sm text-right tabular-nums focus:border-blue-400 focus:outline-none"
                  />
                  <span className="text-sm text-gray-400">kg</span>
                </div>
              </div>
              <div className="flex items-center px-4 py-3.5 gap-4">
                <span className="text-sm text-gray-600 w-28 flex-shrink-0">Height</span>
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="number" min="100" max="250"
                    value={fitness.height_cm ?? ''}
                    onChange={e => setFit('height_cm', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="170"
                    className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-sm text-right tabular-nums focus:border-blue-400 focus:outline-none"
                  />
                  <span className="text-sm text-gray-400">cm</span>
                </div>
              </div>
              <div className="flex items-center px-4 py-3.5 gap-4">
                <span className="text-sm text-gray-600 w-28 flex-shrink-0">Age</span>
                <input
                  type="number" min="1" max="120"
                  value={fitness.age ?? ''}
                  onChange={e => setFit('age', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="30"
                  className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-sm text-right tabular-nums focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div className="flex items-center px-4 py-3.5 gap-4">
                <span className="text-sm text-gray-600 w-28 flex-shrink-0">Sex</span>
                <div className="flex gap-2">
                  {(['male', 'female', 'other'] as Sex[]).map(s => (
                    <button
                      key={s}
                      onClick={() => setFit('sex', s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                        fitness.sex === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Activity Level */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Activity Level</p>
              <div className="space-y-2">
                {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map(level => (
                  <button
                    key={level}
                    onClick={() => setFit('activity_level', level)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-colors ${
                      fitness.activity_level === level
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div>
                      <p className={`text-sm font-medium ${fitness.activity_level === level ? 'text-blue-700' : 'text-gray-800'}`}>
                        {ACTIVITY_LABELS[level].label}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{ACTIVITY_LABELS[level].desc}</p>
                    </div>
                    {fitness.activity_level === level && (
                      <span className="text-blue-600 text-sm font-bold">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Water goal */}
            <div className="rounded-2xl bg-blue-50 border border-blue-100 px-4 py-4">
              <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-1">
                Your calculated daily water goal
              </p>
              <p className="text-2xl font-bold text-blue-700">{waterGoal.toLocaleString()} ml</p>
              <p className="text-xs text-blue-400 mt-0.5">
                {(waterGoal / 250).toFixed(0)} glasses of 250ml
                {fitness.weight_kg
                  ? ` · based on ${fitness.weight_kg}kg · ${ACTIVITY_LABELS[fitness.activity_level].label.toLowerCase()} activity`
                  : ' · update your weight for a precise goal'}
              </p>
            </div>

            {/* TDEE */}
            <div className="rounded-2xl bg-orange-50 border border-orange-100 px-4 py-4">
              <p className="text-xs font-semibold text-orange-500 uppercase tracking-wide mb-1">
                Average daily calories burned (TDEE)
              </p>
              {tdee ? (
                <>
                  <p className="text-2xl font-bold text-orange-700">{tdee.toLocaleString()} kcal</p>
                  <p className="text-xs text-orange-400 mt-0.5">
                    BMR at rest: {bmr?.toLocaleString()} kcal · {ACTIVITY_LABELS[fitness.activity_level].label.toLowerCase()} activity ×{TDEE_MULTIPLIERS[fitness.activity_level]}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-orange-300">— kcal</p>
                  <p className="text-xs text-orange-400 mt-0.5">
                    {fitness.sex === 'other'
                      ? 'TDEE calculation uses biological sex — select male or female for a precise estimate'
                      : 'Fill in weight, height, age, and sex for a precise estimate'}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Achievements — shown for individual accounts and when viewing a member */}
      {!isStreakLoading && (accountType === 'individual' || isMemberView) && (
        <AchievementsSection badges={badges} />
      )}

      {/* Kids */}
      {household?.id && (
        <div>
          <div className="border-t border-gray-100 pt-2 flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <Moon className="h-3.5 w-3.5" />
              Crianças
            </p>
            <button
              onClick={() => setKidModal({})}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </button>
          </div>
          {kidsLoading ? (
            <div className="h-12 animate-pulse bg-gray-100 rounded-xl" />
          ) : kids.length === 0 ? (
            <button
              onClick={() => setKidModal({})}
              className="w-full py-3 rounded-xl border border-dashed border-gray-200 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
            >
              Nenhuma criança cadastrada — toque para adicionar
            </button>
          ) : (
            <div className="space-y-2">
              {kids.map(kid => (
                <KidRow
                  key={kid.id}
                  kid={kid}
                  onEdit={k => setKidModal(k)}
                  onDelete={k => setDeleteKid(k)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {loadError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load profile: {loadError}
        </p>
      )}

      {saveError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {saveError}
        </p>
      )}

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${
          saved
            ? 'bg-green-500 text-white'
            : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
        }`}
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Profile'}
      </button>

      {/* Kid modals */}
      {kidModal !== null && (
        <KidModal initial={kidModal} onSave={handleSaveKid} onCancel={() => setKidModal(null)} saving={modalSaving} />
      )}
      {deleteKid && (
        <DeleteKidConfirm kid={deleteKid} onDelete={handleDeleteKid} onCancel={() => setDeleteKid(null)} deleting={deletingKid} />
      )}
    </div>
  )
}

function AchievementsSection({ badges }: { badges: import('@/hooks/useStreakAndBadges').BadgeResult[] }) {
  const [open, setOpen] = useState(false)
  const earned = badges.filter(b => b.earned).length

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="border-t border-gray-100 pt-2 mb-3 w-full flex items-center justify-between"
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Achievements
          {earned > 0 && (
            <span className="ml-2 text-amber-500">{earned}/{badges.length}</span>
          )}
        </p>
        <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {badges.map(badge => (
            <div
              key={badge.id}
              title={badge.desc}
              className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-center transition-colors ${
                badge.earned
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-gray-100 bg-gray-50 opacity-40'
              }`}
            >
              <span className="text-2xl leading-none">{badge.emoji}</span>
              <span className={`text-xs font-semibold leading-tight ${badge.earned ? 'text-amber-800' : 'text-gray-400'}`}>
                {badge.name}
              </span>
              <span className={`text-[10px] leading-tight ${badge.earned ? 'text-amber-600' : 'text-gray-400'}`}>
                {badge.desc}
              </span>
            </div>
          ))}
        </div>
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
