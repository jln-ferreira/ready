'use client'

import { useState, useEffect, useRef } from 'react'
import {
  format, startOfWeek, addDays, addWeeks, subWeeks, isToday, isSameDay,
} from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useHousehold } from '@/hooks/useHousehold'
import { Utensils, ChevronLeft, ChevronRight, Pencil, X } from 'lucide-react'

interface MealPlan {
  id: string
  household_id: string
  plan_date: string
  title: string
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export default function MealsPage() {
  const { household, loading: householdLoading } = useHousehold()
  const supabase = createClient()

  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }) // Monday
  )
  const [plans, setPlans]               = useState<MealPlan[]>([])
  const [loading, setLoading]           = useState(true)
  const [editingDate, setEditingDate]   = useState<string | null>(null)
  const [draftTitle, setDraftTitle]     = useState('')
  const [draftNotes, setDraftNotes]     = useState('')
  const [saving, setSaving]             = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekFrom = format(weekStart, 'yyyy-MM-dd')
  const weekTo   = format(addDays(weekStart, 6), 'yyyy-MM-dd')

  useEffect(() => {
    if (!household) return
    loadPlans()
  }, [household, weekStart]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadPlans() {
    setLoading(true)
    const { data } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('household_id', household!.id)
      .gte('plan_date', weekFrom)
      .lte('plan_date', weekTo)
    setPlans((data as MealPlan[]) ?? [])
    setLoading(false)
  }

  function openEdit(date: Date, existing?: MealPlan) {
    const d = format(date, 'yyyy-MM-dd')
    setEditingDate(d)
    setDraftTitle(existing?.title ?? '')
    setDraftNotes(existing?.notes ?? '')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function cancelEdit() {
    setEditingDate(null)
    setDraftTitle('')
    setDraftNotes('')
  }

  async function saveMeal() {
    if (!editingDate || !draftTitle.trim() || !household) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const existing = plans.find(p => p.plan_date === editingDate)

    if (existing) {
      const { data, error } = await supabase
        .from('meal_plans')
        .update({ title: draftTitle.trim(), notes: draftNotes.trim() || null, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select().single()
      if (!error && data) setPlans(prev => prev.map(p => p.id === existing.id ? data as MealPlan : p))
    } else {
      const { data, error } = await supabase
        .from('meal_plans')
        .insert({ household_id: household.id, plan_date: editingDate, title: draftTitle.trim(), notes: draftNotes.trim() || null, created_by: user.id })
        .select().single()
      if (!error && data) setPlans(prev => [...prev, data as MealPlan])
    }

    setSaving(false)
    cancelEdit()
  }

  async function deleteMeal(plan: MealPlan) {
    const { error } = await supabase.from('meal_plans').delete().eq('id', plan.id)
    if (!error) setPlans(prev => prev.filter(p => p.id !== plan.id))
  }

  if (householdLoading) return <Spinner />

  return (
    <div className="max-w-xl mx-auto px-4 md:px-6 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Utensils className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">Meal Planner</h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekStart(w => subWeeks(w, 1))}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          >
            This week
          </button>
          <button
            onClick={() => setWeekStart(w => addWeeks(w, 1))}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-400 mb-4">
        {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
      </p>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="space-y-2">
          {days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const plan    = plans.find(p => p.plan_date === dateStr)
            const editing = editingDate === dateStr
            const today   = isToday(day)

            return (
              <div
                key={dateStr}
                className={`rounded-2xl border transition-all ${
                  today ? 'border-blue-200 bg-blue-50/40' : 'border-gray-200 bg-white'
                } ${editing ? 'shadow-md' : ''}`}
              >
                {/* Day label */}
                <div className="flex items-center justify-between px-4 pt-3 pb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold uppercase tracking-wide ${today ? 'text-blue-600' : 'text-gray-400'}`}>
                      {format(day, 'EEE')}
                    </span>
                    <span className={`text-xs ${today ? 'text-blue-500' : 'text-gray-400'}`}>
                      {format(day, 'MMM d')}
                    </span>
                    {today && (
                      <span className="text-xs font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">
                        Today
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {plan && !editing && (
                      <button
                        onClick={() => deleteMeal(plan)}
                        className="p-1 text-gray-300 hover:text-red-400 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {!editing && (
                      <button
                        onClick={() => openEdit(day, plan)}
                        className="p-1 text-gray-300 hover:text-blue-500 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Content */}
                {editing ? (
                  <div className="px-4 pb-3 space-y-2">
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder="What's for dinner?"
                      value={draftTitle}
                      onChange={e => setDraftTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveMeal(); if (e.key === 'Escape') cancelEdit() }}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <input
                      type="text"
                      placeholder="Notes (optional)"
                      value={draftNotes}
                      onChange={e => setDraftNotes(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveMeal(); if (e.key === 'Escape') cancelEdit() }}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-400 focus:outline-none"
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={cancelEdit} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">
                        Cancel
                      </button>
                      <button
                        onClick={saveMeal}
                        disabled={!draftTitle.trim() || saving}
                        className="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : plan ? (
                  <div className="px-4 pb-3">
                    <p className="text-sm font-medium text-gray-900">{plan.title}</p>
                    {plan.notes && <p className="text-xs text-gray-400 mt-0.5">{plan.notes}</p>}
                  </div>
                ) : (
                  <button
                    onClick={() => openEdit(day)}
                    className="w-full text-left px-4 pb-3 text-sm text-gray-300 hover:text-gray-400 transition-colors"
                  >
                    + Plan a meal
                  </button>
                )}
              </div>
            )
          })}
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
