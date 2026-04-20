'use client'

import { useState, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { Download, Plus, Check, ExternalLink, AlertCircle, RefreshCw } from 'lucide-react'
import type { CalendarEvent, EventInput } from '@/types/calendar'
import { CATEGORY_COLORS } from '@/types/calendar'
import type { ImportedEvent } from '@/app/api/events/import/route'

function normalizeTitle(t: string) {
  return t.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

function isAlreadyAdded(
  event: ImportedEvent,
  existingEvents: CalendarEvent[],
  sessionAdded: Set<string>,
): boolean {
  if (sessionAdded.has(event.sourceUrl)) return true
  return existingEvents.some(e => {
    if (e.description?.includes(event.sourceUrl)) return true
    return (
      normalizeTitle(e.title) === normalizeTitle(event.title) &&
      e.start_datetime.slice(0, 10) === event.start_datetime.slice(0, 10)
    )
  })
}

interface Props {
  existingEvents: CalendarEvent[]
  createEvent: (input: EventInput) => Promise<{ error: string | null }>
}

export function ImportedEventsList({ existingEvents, createEvent }: Props) {
  const [events, setEvents] = useState<ImportedEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sessionAdded, setSessionAdded] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState<Set<string>>(new Set())
  const [visible, setVisible] = useState(false)

  const handleFetch = async () => {
    setLoading(true)
    setErrors({})
    try {
      const res = await fetch('/api/events/import')
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data = await res.json()
      setEvents(data.events ?? [])
      setErrors(data.errors ?? {})
      setVisible(true)
    } catch (e) {
      setErrors({ network: e instanceof Error ? e.message : 'Failed to fetch events' })
    } finally {
      setLoading(false)
    }
  }

  // Deduplicate imported list by sourceUrl
  const dedupedEvents = useMemo(() => {
    const seen = new Set<string>()
    return events.filter(e => {
      if (seen.has(e.sourceUrl)) return false
      seen.add(e.sourceUrl)
      return true
    })
  }, [events])

  const dhEvents  = dedupedEvents.filter(e => e.source === 'dailyhive')
  const koaEvents = dedupedEvents.filter(e => e.source === 'kidsoutandabout')

  const handleAdd = async (event: ImportedEvent) => {
    setAdding(prev => new Set(prev).add(event.sourceUrl))
    const input: EventInput = {
      title:          event.title,
      description:    event.description,
      start_datetime: event.start_datetime,
      end_datetime:   event.end_datetime,
      all_day:        event.all_day,
      location:       event.location,
      category:       event.category,
      recurrence:     'none',
      reminder:       'none',
    }
    const { error } = await createEvent(input)
    if (!error) {
      setSessionAdded(prev => new Set(prev).add(event.sourceUrl))
    }
    setAdding(prev => { const n = new Set(prev); n.delete(event.sourceUrl); return n })
  }

  const renderRow = (event: ImportedEvent) => {
    const added    = isAlreadyAdded(event, existingEvents, sessionAdded)
    const isAdding = adding.has(event.sourceUrl)
    const c        = CATEGORY_COLORS[event.category]
    const start    = parseISO(event.start_datetime)
    const end      = parseISO(event.end_datetime)
    const sameDay  = event.start_datetime.slice(0, 10) === event.end_datetime.slice(0, 10)

    let dateLabel: string
    if (event.all_day) {
      dateLabel = format(start, 'MMM d') + (sameDay ? '' : ` – ${format(end, 'MMM d')}`)
    } else {
      dateLabel = format(start, 'MMM d, h:mm a') + (sameDay ? '' : ` – ${format(end, 'MMM d')}`)
    }

    return (
      <div
        key={event.sourceUrl}
        className={`flex items-start gap-3 px-4 py-3 border-b border-gray-100 last:border-0 transition-opacity ${added ? 'opacity-40' : ''}`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900 truncate">{event.title}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${c.bg} ${c.text}`}>
              {event.category}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{dateLabel}</p>
          {event.location && (
            <p className="text-xs text-gray-400 truncate mt-0.5">{event.location}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
          <a
            href={event.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-300 hover:text-gray-500 transition-colors"
            title="View original"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          {added ? (
            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
              <Check className="h-3.5 w-3.5" />
              Added
            </span>
          ) : (
            <button
              onClick={() => handleAdd(event)}
              disabled={isAdding}
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              {isAdding
                ? <span className="h-3 w-3 rounded-full border border-blue-500 border-t-transparent animate-spin" />
                : <Plus className="h-3 w-3" />
              }
              Add
            </button>
          )}
        </div>
      </div>
    )
  }

  const hasErrors = Object.keys(errors).length > 0

  return (
    <div className="mt-4 flex-shrink-0">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">Vancouver Events</h3>
        <button
          onClick={handleFetch}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {loading
            ? <span className="h-3 w-3 rounded-full border border-gray-400 border-t-transparent animate-spin" />
            : visible
              ? <RefreshCw className="h-3 w-3" />
              : <Download className="h-3 w-3" />
          }
          {loading ? 'Fetching…' : visible ? 'Refresh' : 'Import Events'}
        </button>
      </div>

      {hasErrors && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 mb-2">
          <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700 space-y-0.5">
            {Object.entries(errors).map(([src, msg]) => (
              <p key={src}><span className="font-medium capitalize">{src}</span>: {msg}</p>
            ))}
          </div>
        </div>
      )}

      {visible && (
        <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
          {dhEvents.length > 0 && (
            <section>
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  Daily Hive · {dhEvents.length} event{dhEvents.length !== 1 ? 's' : ''}
                </span>
              </div>
              {dhEvents.map(renderRow)}
            </section>
          )}

          {koaEvents.length > 0 && (
            <section>
              <div className={`px-4 py-2 bg-gray-50 border-b border-gray-100 ${dhEvents.length > 0 ? 'border-t' : ''}`}>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  Kids Out and About · {koaEvents.length} event{koaEvents.length !== 1 ? 's' : ''}
                </span>
              </div>
              {koaEvents.map(renderRow)}
            </section>
          )}

          {dedupedEvents.length === 0 && !hasErrors && (
            <p className="px-4 py-8 text-sm text-center text-gray-400">No events found</p>
          )}
        </div>
      )}
    </div>
  )
}
