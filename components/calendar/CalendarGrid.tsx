'use client'

import { useMemo, useState } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import type { CalendarEvent } from '@/types/calendar'
import { CATEGORY_COLORS } from '@/types/calendar'

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEK_DAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MAX_PER_CELL = 3

interface Props {
  events: CalendarEvent[]
  currentMonth: Date
  onMonthChange: (month: Date) => void
  onAddEvent: (date?: Date) => void
  onSelectEvent: (event: CalendarEvent) => void
}

export function CalendarGrid({ events, currentMonth, onMonthChange, onAddEvent, onSelectEvent }: Props) {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      const key = format(new Date(event.start_datetime), 'yyyy-MM-dd')
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(event)
    }
    return map
  }, [events])

  const selectedDayEvents = selectedDay
    ? (eventsByDay.get(format(selectedDay, 'yyyy-MM-dd')) ?? [])
    : []

  const handleDayClick = (day: Date) => {
    // Desktop (sm+): open add modal immediately
    // Mobile: select day and show panel below
    if (window.innerWidth >= 640) {
      onAddEvent(day)
    } else {
      setSelectedDay(prev => (prev && isSameDay(prev, day) ? null : day))
    }
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between mb-3 sm:mb-6 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-xl font-semibold text-gray-900">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => { onMonthChange(subMonths(currentMonth, 1)); setSelectedDay(null) }}
              aria-label="Previous month"
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => { onMonthChange(new Date()); setSelectedDay(null) }}
              className="px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => { onMonthChange(addMonths(currentMonth, 1)); setSelectedDay(null) }}
              aria-label="Next month"
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <button
          onClick={() => onAddEvent(selectedDay ?? undefined)}
          className="flex items-center gap-1.5 px-3 py-2 sm:px-4 bg-blue-600 text-white text-xs sm:text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Add Event</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* ── Day-of-week headers ── */}
      <div className="grid grid-cols-7 flex-shrink-0">
        {WEEK_DAYS.map((d, i) => (
          <div key={d} className="py-1 text-center">
            <span className="hidden sm:inline text-xs font-semibold text-gray-400 uppercase tracking-widest">{d}</span>
            <span className="sm:hidden text-xs font-semibold text-gray-400">{WEEK_DAYS_SHORT[i]}</span>
          </div>
        ))}
      </div>

      {/* ── Grid ── */}
      <div className="grid grid-cols-7 border-t border-l border-gray-200 flex-shrink-0">
        {days.map(day => {
          const key = format(day, 'yyyy-MM-dd')
          const dayEvents = eventsByDay.get(key) ?? []
          const inMonth = isSameMonth(day, currentMonth)
          const today = isToday(day)
          const isSelected = selectedDay ? isSameDay(day, selectedDay) : false
          const overflow = dayEvents.length - MAX_PER_CELL

          return (
            <div
              key={key}
              onClick={() => handleDayClick(day)}
              className={`border-b border-r border-gray-200 cursor-pointer transition-colors
                min-h-[48px] sm:min-h-[90px]
                ${inMonth
                  ? isSelected
                    ? 'bg-blue-50/70'
                    : 'bg-white hover:bg-gray-50/80'
                  : 'bg-gray-50/50'
                }
              `}
            >
              {/* Day number */}
              <div className="flex justify-end p-1 sm:p-1.5">
                <span className={`h-6 w-6 sm:h-7 sm:w-7 flex items-center justify-center rounded-full text-xs sm:text-sm font-medium ${
                  today ? 'bg-blue-600 text-white'
                  : isSelected ? 'bg-blue-100 text-blue-700'
                  : inMonth ? 'text-gray-900'
                  : 'text-gray-300'
                }`}>
                  {format(day, 'd')}
                </span>
              </div>

              {/* Desktop: full event pills */}
              <div className="hidden sm:block px-1 pb-1 space-y-0.5">
                {dayEvents.slice(0, MAX_PER_CELL).map(event => {
                  const c = CATEGORY_COLORS[event.category]
                  return (
                    <button
                      key={event.id}
                      onClick={e => { e.stopPropagation(); onSelectEvent(event) }}
                      title={event.title}
                      className={`w-full text-left px-1.5 py-0.5 rounded text-xs font-medium truncate ${c.bg} ${c.text} hover:opacity-75 transition-opacity`}
                    >
                      {!event.all_day && (
                        <span className="opacity-60 mr-1">
                          {format(new Date(event.start_datetime), 'h:mma')}
                        </span>
                      )}
                      {event.title}
                    </button>
                  )
                })}
                {overflow > 0 && (
                  <p className="text-xs text-gray-400 px-1.5">+{overflow} more</p>
                )}
              </div>

              {/* Mobile: colored dots */}
              {dayEvents.length > 0 && (
                <div className="sm:hidden flex justify-center gap-0.5 pb-1">
                  {dayEvents.slice(0, 3).map(event => {
                    const c = CATEGORY_COLORS[event.category]
                    return <span key={event.id} className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                  })}
                  {dayEvents.length > 3 && (
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Mobile: selected day panel ── */}
      {selectedDay && (
        <div className="sm:hidden mt-4 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900">
              {format(selectedDay, 'EEEE, MMMM d')}
            </h3>
            <button
              onClick={() => setSelectedDay(null)}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            {selectedDayEvents.length === 0 ? (
              <button
                onClick={() => onAddEvent(selectedDay)}
                className="w-full text-left px-4 py-3.5 rounded-xl border border-dashed border-gray-300 text-sm text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
              >
                No events — tap to add one
              </button>
            ) : (
              <>
                {selectedDayEvents.map(event => {
                  const c = CATEGORY_COLORS[event.category]
                  return (
                    <button
                      key={event.id}
                      onClick={() => onSelectEvent(event)}
                      className={`w-full text-left px-4 py-3 rounded-xl ${c.bg} hover:opacity-80 transition-opacity`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${c.dot} flex-shrink-0`} />
                        <span className={`text-sm font-semibold ${c.text} truncate`}>{event.title}</span>
                      </div>
                      {!event.all_day && (
                        <p className={`text-xs mt-0.5 ml-4 ${c.text} opacity-70`}>
                          {format(new Date(event.start_datetime), 'h:mm a')}
                          {' – '}
                          {format(new Date(event.end_datetime), 'h:mm a')}
                        </p>
                      )}
                      {event.location && (
                        <p className={`text-xs mt-0.5 ml-4 ${c.text} opacity-60 truncate`}>{event.location}</p>
                      )}
                    </button>
                  )
                })}
                <button
                  onClick={() => onAddEvent(selectedDay)}
                  className="w-full text-left px-4 py-3 rounded-xl border border-dashed border-gray-300 text-sm text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
                >
                  + Add another event
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
