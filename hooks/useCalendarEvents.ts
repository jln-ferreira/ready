'use client'

import { useState, useEffect, useCallback } from 'react'
import { startOfMonth, endOfMonth } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { CalendarEvent, EventInput } from '@/types/calendar'

export function useCalendarEvents(currentMonth: Date, householdId: string | undefined) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchEvents = useCallback(async () => {
    if (!householdId) { setEvents([]); setLoading(false); return }

    setLoading(true)
    const start = startOfMonth(currentMonth).toISOString()
    const end = endOfMonth(currentMonth).toISOString()

    const { data } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('household_id', householdId)
      .lte('start_datetime', end)
      .or(`start_datetime.gte.${start},recurrence.neq.none`)
      .order('start_datetime')

    setEvents((data as CalendarEvent[]) ?? [])
    setLoading(false)
  }, [currentMonth, householdId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const createEvent = async (input: EventInput): Promise<{ error: string | null }> => {
    if (!householdId) return { error: 'No household' }
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('calendar_events')
        .insert({ ...input, user_id: user.id, household_id: householdId })
        .select()
        .single()

      if (error) throw error
      setEvents(prev =>
        [...prev, data as CalendarEvent].sort(
          (a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()
        )
      )
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to create event' }
    }
  }

  const updateEvent = async (id: string, input: Partial<EventInput>): Promise<{ error: string | null }> => {
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      setEvents(prev => prev.map(e => e.id === id ? data as CalendarEvent : e))
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to update event' }
    }
  }

  const deleteEvent = async (id: string): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.from('calendar_events').delete().eq('id', id)
      if (error) throw error
      setEvents(prev => prev.filter(e => e.id !== id))
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to delete event' }
    }
  }

  return { events, loading, createEvent, updateEvent, deleteEvent }
}
