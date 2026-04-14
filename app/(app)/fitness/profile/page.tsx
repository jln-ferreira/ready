'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, Lock } from 'lucide-react'

type Sex = 'male' | 'female' | 'other'
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active'

interface Profile {
  weight_kg:      number | null
  height_cm:      number | null
  age:            number | null
  sex:            Sex | null
  activity_level: ActivityLevel
}

const ACTIVITY_LABELS: Record<ActivityLevel, { label: string; desc: string }> = {
  sedentary: { label: 'Sedentary',  desc: 'Little or no exercise' },
  light:     { label: 'Light',      desc: 'Exercise 1–3 days/week' },
  moderate:  { label: 'Moderate',   desc: 'Exercise 3–5 days/week' },
  active:    { label: 'Active',     desc: 'Daily exercise or physical job' },
}

const WATER_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.0, light: 1.1, moderate: 1.2, active: 1.4,
}

function calcWaterGoal(profile: Partial<Profile>): number {
  const weight = profile.weight_kg ?? 70
  const mult   = WATER_MULTIPLIERS[profile.activity_level ?? 'moderate']
  return Math.min(4000, Math.max(1500, Math.round((weight * 35 * mult) / 100) * 100))
}

const blank: Profile = { weight_kg: null, height_cm: null, age: null, sex: null, activity_level: 'moderate' }

export default function FitnessProfilePage() {
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile>(blank)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('fitness_profiles')
        .select('weight_kg, height_cm, age, sex, activity_level')
        .eq('user_id', user.id)
        .single()
      if (data) setProfile(data as Profile)
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setProfile(prev => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    await supabase.from('fitness_profiles').upsert(
      { user_id: user.id, ...profile, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <Spinner />

  const waterGoal = calcWaterGoal(profile)

  return (
    <div className="max-w-lg mx-auto px-4 md:px-6 py-8 space-y-6">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <User className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">Fitness Profile</h1>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Lock className="h-3 w-3" />
          Private — only visible to you
        </div>
      </div>

      {/* Fields */}
      <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">

        {/* Weight */}
        <div className="flex items-center px-4 py-3.5 gap-4">
          <span className="text-sm text-gray-600 w-28 flex-shrink-0">Weight</span>
          <div className="flex items-center gap-2 flex-1">
            <input
              type="number" min="30" max="300" step="0.1"
              value={profile.weight_kg ?? ''}
              onChange={e => set('weight_kg', e.target.value ? parseFloat(e.target.value) : null)}
              placeholder="70"
              className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-sm text-right tabular-nums focus:border-blue-400 focus:outline-none"
            />
            <span className="text-sm text-gray-400">kg</span>
          </div>
        </div>

        {/* Height */}
        <div className="flex items-center px-4 py-3.5 gap-4">
          <span className="text-sm text-gray-600 w-28 flex-shrink-0">Height</span>
          <div className="flex items-center gap-2 flex-1">
            <input
              type="number" min="100" max="250"
              value={profile.height_cm ?? ''}
              onChange={e => set('height_cm', e.target.value ? parseInt(e.target.value) : null)}
              placeholder="170"
              className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-sm text-right tabular-nums focus:border-blue-400 focus:outline-none"
            />
            <span className="text-sm text-gray-400">cm</span>
          </div>
        </div>

        {/* Age */}
        <div className="flex items-center px-4 py-3.5 gap-4">
          <span className="text-sm text-gray-600 w-28 flex-shrink-0">Age</span>
          <input
            type="number" min="1" max="120"
            value={profile.age ?? ''}
            onChange={e => set('age', e.target.value ? parseInt(e.target.value) : null)}
            placeholder="30"
            className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-sm text-right tabular-nums focus:border-blue-400 focus:outline-none"
          />
        </div>

        {/* Sex */}
        <div className="flex items-center px-4 py-3.5 gap-4">
          <span className="text-sm text-gray-600 w-28 flex-shrink-0">Sex</span>
          <div className="flex gap-2">
            {(['male', 'female', 'other'] as Sex[]).map(s => (
              <button
                key={s}
                onClick={() => set('sex', s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                  profile.sex === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
              onClick={() => set('activity_level', level)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-colors ${
                profile.activity_level === level
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <div>
                <p className={`text-sm font-medium ${profile.activity_level === level ? 'text-blue-700' : 'text-gray-800'}`}>
                  {ACTIVITY_LABELS[level].label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{ACTIVITY_LABELS[level].desc}</p>
              </div>
              {profile.activity_level === level && (
                <span className="text-blue-600 text-sm font-bold">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Water goal preview */}
      <div className="rounded-2xl bg-blue-50 border border-blue-100 px-4 py-4">
        <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-1">
          Your calculated daily water goal
        </p>
        <p className="text-2xl font-bold text-blue-700">{waterGoal.toLocaleString()} ml</p>
        <p className="text-xs text-blue-400 mt-0.5">
          {(waterGoal / 250).toFixed(0)} glasses of 250ml
          {profile.weight_kg ? ` · based on ${profile.weight_kg}kg · ${ACTIVITY_LABELS[profile.activity_level].label.toLowerCase()} activity` : ' · update your weight for a precise goal'}
        </p>
      </div>

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
