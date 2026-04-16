'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, Lock, Palette, KeyRound } from 'lucide-react'
import { useActiveMembers } from '@/contexts/ActiveMemberContext'

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

  // When the family account has a member selected, edit that member's profile
  const isMemberView    = accountType === 'family' && !!activeMemberId
  const lockedToFamily  = accountType === 'family' && !activeMemberId
  const targetUserId    = activeMemberId   // null when not in member view

  // Seed display name and color from context immediately — API fetch will overwrite with fresh data
  const [displayName,  setDisplayName]  = useState(activeMember?.display_name ?? '')
  const [sidebarColor, setSidebarColor] = useState(activeMember?.sidebar_color ?? 'blue')
  const [fitness, setFitness] = useState<FitnessProfile>(blankFitness)

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
    if (!/^\d{4}$/.test(newPin))    { setPinError('PIN must be exactly 4 digits.'); return }
    if (newPin !== confirmPin)       { setPinError('PINs do not match.'); return }

    setPinSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPinSaving(false); return }

    const targetId = (isMemberView && targetUserId) ? targetUserId : user.id
    const { error } = await supabase.rpc('set_member_pin', { p_user_id: targetId, p_pin: newPin })

    if (error) {
      setPinError('Could not save PIN. Please try again.')
    } else {
      setHasPin(true)
      setPinFormOpen(false)
      setNewPin('')
      setConfirmPin('')
      setPinSaved(true)
      setTimeout(() => setPinSaved(false), 2000)
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
            {pinSaved && (
              <p className="text-xs text-green-600">PIN saved ✓</p>
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

      {/* Divider */}
      <div className="border-t border-gray-100 pt-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Fitness</p>
      </div>

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
