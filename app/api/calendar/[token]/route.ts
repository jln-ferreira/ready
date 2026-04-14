import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { CalendarEvent } from '@/types/calendar'

// iCal text escaping per RFC 5545
function esc(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
}

// Format a UTC ISO string to iCal datetime: 20260413T090000Z
function icalDt(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

// Format a UTC ISO string to iCal date-only: 20260413
function icalDate(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
}

// Add one day to a date string (for all-day DTEND)
function nextDay(iso: string): string {
  const d = new Date(iso)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString()
}

function buildVEvent(event: CalendarEvent, dtstamp: string): string {
  const lines: string[] = ['BEGIN:VEVENT']

  lines.push(`UID:${event.id}@ready-app`)
  lines.push(`DTSTAMP:${dtstamp}`)
  lines.push(`SUMMARY:${esc(event.title)}`)

  if (event.all_day) {
    lines.push(`DTSTART;VALUE=DATE:${icalDate(event.start_datetime)}`)
    lines.push(`DTEND;VALUE=DATE:${icalDate(nextDay(event.end_datetime))}`)
  } else {
    lines.push(`DTSTART:${icalDt(event.start_datetime)}`)
    lines.push(`DTEND:${icalDt(event.end_datetime)}`)
  }

  if (event.description) lines.push(`DESCRIPTION:${esc(event.description)}`)
  if (event.location)    lines.push(`LOCATION:${esc(event.location)}`)

  if (event.recurrence !== 'none') {
    const freq: Record<string, string> = {
      daily: 'DAILY',
      weekly: 'WEEKLY',
      monthly: 'MONTHLY',
    }
    lines.push(`RRULE:FREQ=${freq[event.recurrence]}`)
  }

  lines.push('END:VEVENT')
  return lines.join('\r\n')
}

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/calendar/[token]'>) {
  const { token } = await ctx.params

  const supabase = createServiceClient()

  // Resolve household from token
  const { data: household, error: hhErr } = await supabase
    .from('households')
    .select('id, name')
    .eq('calendar_token', token)
    .single()

  if (hhErr || !household) {
    return new Response('Not found', { status: 404 })
  }

  // Fetch events — rolling window: 6 months back, 2 years ahead
  const from = new Date()
  from.setMonth(from.getMonth() - 6)
  const to = new Date()
  to.setFullYear(to.getFullYear() + 2)

  const { data: events } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('household_id', household.id)
    .gte('start_datetime', from.toISOString())
    .lte('start_datetime', to.toISOString())
    .order('start_datetime')

  const dtstamp = icalDt(new Date().toISOString())

  const vevents = (events as CalendarEvent[] ?? [])
    .map(e => buildVEvent(e, dtstamp))
    .join('\r\n')

  const calName = esc(household.name)
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ready App//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calName}`,
    `X-WR-CALDESC:${calName} calendar`,
    ...(vevents ? [vevents] : []),
    'END:VCALENDAR',
  ].join('\r\n')

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="calendar.ics"',
      'Cache-Control': 'no-cache, no-store',
    },
  })
}
