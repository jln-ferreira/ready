import { NextResponse } from 'next/server'
import { load } from 'cheerio'
import type { EventCategory } from '@/types/calendar'

export const dynamic = 'force-dynamic'

export interface ImportedEvent {
  source: 'dailyhive' | 'kidsoutandabout'
  title: string
  start_datetime: string
  end_datetime: string
  all_day: boolean
  location: string | null
  description: string | null
  category: EventCategory
  sourceUrl: string
}

// ── Daily Hive ────────────────────────────────────────────────────
// Events are embedded in __NEXT_DATA__ JSON — no HTML parsing needed.

const DH_CATEGORY_MAP: Record<string, EventCategory> = {
  'community':   'Personal',
  'food-drink':  'Personal',
  'arts-theatre': 'Other',
  'concerts':    'Other',
  'comedy':      'Other',
  'shows-expos': 'Other',
}

function mapDhCategory(cats: string[]): EventCategory {
  for (const c of cats) {
    if (DH_CATEGORY_MAP[c]) return DH_CATEGORY_MAP[c]
  }
  return 'Other'
}

function dhLocation(venue: Record<string, string> | undefined): string | null {
  if (!venue) return null
  const parts = [venue.name, venue.address, venue.city, venue.province].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

async function fetchDailyHiveEvents(): Promise<ImportedEvent[]> {
  const res = await fetch('https://dailyhive.com/vancouver/listed', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ReadyApp/1.0; +https://readyapp.ca)' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()

  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match) throw new Error('No __NEXT_DATA__ found')

  const pageData = JSON.parse(match[1])
  const events: unknown[] = pageData?.props?.pageProps?.events?.events ?? []

  return events.map((ev: unknown) => {
    const e = ev as {
      id: number
      title: string
      slug: string
      start_datetime: string
      end_datetime: string
      venue_details?: Record<string, string>
      categories?: string[]
      summary?: string
      price_from?: string
    }
    const sourceUrl = `https://dailyhive.com/vancouver/listed/events/${e.id}/${e.slug}`
    const priceNote = e.price_from && e.price_from !== '0' ? ` · From $${e.price_from}` : ''
    const description = e.summary ? `${e.summary}${priceNote}\n${sourceUrl}` : sourceUrl

    return {
      source: 'dailyhive' as const,
      title: e.title,
      start_datetime: e.start_datetime,
      end_datetime: e.end_datetime ?? e.start_datetime,
      all_day: false,
      location: dhLocation(e.venue_details),
      description,
      category: mapDhCategory(e.categories ?? []),
      sourceUrl,
    }
  })
}

// ── Kids Out and About ────────────────────────────────────────────
// Drupal-based site with structured field classes.

function toHour(h: number, ampm: string): number {
  if (ampm === 'pm' && h !== 12) return h + 12
  if (ampm === 'am' && h === 12) return 0
  return h
}

function parseTime12(s: string): { h: number; m: number } | null {
  const m = s.trim().toLowerCase().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/)
  if (!m) return null
  return { h: toHour(+m[1], m[3]), m: +(m[2] ?? 0) }
}

function parseTimeRange(s: string): { start: { h: number; m: number } | null; end: { h: number; m: number } | null } {
  const t = s.toLowerCase().replace(/\s+/g, ' ').trim()

  // "H:MM am/pm – H:MM am/pm" or "H am – H pm"
  const full = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/)
  if (full) {
    return {
      start: { h: toHour(+full[1], full[3]), m: +(full[2] ?? 0) },
      end:   { h: toHour(+full[4], full[6]), m: +(full[5] ?? 0) },
    }
  }

  // "H–H pm" — both share the same am/pm
  const simple = t.match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})\s*(am|pm)/)
  if (simple) {
    return {
      start: { h: toHour(+simple[1], simple[3]), m: 0 },
      end:   { h: toHour(+simple[2], simple[3]), m: 0 },
    }
  }

  const single = parseTime12(t)
  return { start: single, end: single }
}

function parseKoaDate(s: string): Date | null {
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  return new Date(+m[3], +m[1] - 1, +m[2])
}

function buildIso(date: Date, time: { h: number; m: number } | null): string {
  const d = new Date(date)
  d.setHours(time?.h ?? 0, time?.m ?? 0, 0, 0)
  return d.toISOString()
}

async function fetchKidsOutAndAboutEvents(): Promise<ImportedEvent[]> {
  const res = await fetch('https://vancouver.kidsoutandabout.com/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ReadyApp/1.0; +https://readyapp.ca)' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()
  const $ = load(html)
  const events: ImportedEvent[] = []
  const seen = new Set<string>()

  // Each event is a Drupal node with an `about` attribute pointing to its /content/ URL
  $('[about^="/content/"]').each((_, el) => {
    const $node = $(el)
    const href = $node.attr('about') ?? ''
    if (seen.has(href)) return
    seen.add(href)

    const sourceUrl = `https://vancouver.kidsoutandabout.com${href}`

    // Title is in the second h2 (inside .group-activity-details), not the first (empty)
    const title = $node.find('.group-activity-details h2 a').first().text().trim()
      || $node.find('h2 a').last().text().trim()
    if (!title || title.length < 3) return

    // Date: span.date-display-single → "MM/DD/YYYY"
    const dateTexts = $node.find('span.date-display-single').map((_, d) => $(d).text().trim()).get()
    if (!dateTexts.length) return
    const startDate = parseKoaDate(dateTexts[0])
    if (!startDate) return
    const endDate = dateTexts[1] ? parseKoaDate(dateTexts[1]) ?? startDate : startDate

    // Time: .field-name-field-time .field-item
    const timeRaw = $node.find('.field-name-field-time .field-item').first().text().trim()
    const { start: startTime, end: endTime } = timeRaw ? parseTimeRange(timeRaw) : { start: null, end: null }

    // Location: first div inside .field-name-field-venue-places-api .field-item
    const location = $node.find('.field-name-field-venue-places-api .field-item > div').first().text().trim().replace(/\s+/g, ' ') || null

    events.push({
      source: 'kidsoutandabout',
      title,
      start_datetime: buildIso(startDate, startTime),
      end_datetime:   buildIso(endDate, endTime ?? startTime),
      all_day: !startTime,
      location,
      description: sourceUrl,
      category: 'Personal',
      sourceUrl,
    })
  })

  return events
}

// ── Handler ───────────────────────────────────────────────────────
export async function GET() {
  const [dhResult, koaResult] = await Promise.allSettled([
    fetchDailyHiveEvents(),
    fetchKidsOutAndAboutEvents(),
  ])

  const events: ImportedEvent[] = []
  const errors: Record<string, string> = {}

  if (dhResult.status === 'fulfilled') events.push(...dhResult.value)
  else errors.dailyhive = String(dhResult.reason)

  if (koaResult.status === 'fulfilled') events.push(...koaResult.value)
  else errors.kidsoutandabout = String(koaResult.reason)

  events.sort((a, b) => a.start_datetime.localeCompare(b.start_datetime))

  return NextResponse.json({ events, errors })
}
