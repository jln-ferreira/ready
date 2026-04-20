'use client'

import { useState, useCallback } from 'react'
import { CalendarGrid } from '@/components/calendar/CalendarGrid'
import { EventModal } from '@/components/calendar/EventModal'
import { useCalendarEvents } from '@/hooks/useCalendarEvents'
import { useHousehold } from '@/hooks/useHousehold'
import type { CalendarEvent, EventInput } from '@/types/calendar'
import { Link2, Check } from 'lucide-react'
import { ImportedEventsList } from '@/components/calendar/ImportedEventsList'

type ModalState =
  | { type: 'closed' }
  | { type: 'add'; defaultDate?: Date }
  | { type: 'view'; event: CalendarEvent }

export default function HomePage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [modal, setModal] = useState<ModalState>({ type: 'closed' })
  const [copied, setCopied] = useState(false)

  const { household, loading: householdLoading } = useHousehold()
  const { events, createEvent, updateEvent, deleteEvent } = useCalendarEvents(
    currentMonth,
    household?.id
  )

  const handleSave = useCallback(async (input: EventInput) => {
    if (modal.type === 'view') return updateEvent(modal.event.id, input)
    return createEvent(input)
  }, [modal, createEvent, updateEvent])

  const handleDelete = useCallback(async (id: string) => {
    return deleteEvent(id)
  }, [deleteEvent])

  const subscribeUrl = household?.calendar_token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/api/calendar/${household.calendar_token}`
    : null

  const webcalUrl = subscribeUrl?.replace(/^https?:\/\//, 'webcal://')

  const handleCopy = async () => {
    if (!subscribeUrl) return
    await navigator.clipboard.writeText(subscribeUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (householdLoading) {
    return (
      <div className="flex flex-1 items-center justify-center h-full">
        <div className="h-6 w-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-4 md:p-6">
      <CalendarGrid
        events={events}
        currentMonth={currentMonth}
        onMonthChange={setCurrentMonth}
        onAddEvent={date => setModal({ type: 'add', defaultDate: date })}
        onSelectEvent={event => setModal({ type: 'view', event })}
      />

      {subscribeUrl && (
        <div className="mt-4 flex-shrink-0 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200">
          <Link2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span className="text-xs text-gray-500 flex-1 truncate hidden sm:block">{subscribeUrl}</span>
          <span className="text-xs text-gray-500 flex-1 truncate sm:hidden">Subscribe on your phone</span>
          <a
            href={webcalUrl ?? '#'}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 flex-shrink-0"
          >
            Open
          </a>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 flex-shrink-0 transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Link2 className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}

      <ImportedEventsList
        existingEvents={events}
        createEvent={createEvent}
      />

      {modal.type !== 'closed' && (
        <EventModal
          mode={modal.type === 'add' ? 'add' : 'view'}
          event={modal.type === 'view' ? modal.event : undefined}
          defaultDate={modal.type === 'add' ? modal.defaultDate : undefined}
          onClose={() => setModal({ type: 'closed' })}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
