import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/service'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

// Reminder windows: how many hours before the event each type fires.
// The cron runs every hour so we use a ±1 h window around the target.
const WINDOWS = [
  { type: 'at_time',       minH: 0,  maxH: 1  },
  { type: '1_day_before',  minH: 23, maxH: 25 },
  { type: '2_days_before', minH: 47, maxH: 49 },
] as const

const REMINDER_LABEL: Record<string, string> = {
  at_time:       'is starting now',
  '1_day_before':  'is tomorrow',
  '2_days_before': 'is in 2 days',
}

export async function GET(req: NextRequest) {
  // Vercel cron jobs automatically attach Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now      = new Date()
  const sent: string[] = []
  const errors: string[] = []

  for (const window of WINDOWS) {
    const minTime = new Date(now.getTime() + window.minH * 3_600_000).toISOString()
    const maxTime = new Date(now.getTime() + window.maxH * 3_600_000).toISOString()

    // Events whose reminder window falls within this hour
    const { data: events, error: evErr } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('reminder', window.type)
      .gte('start_datetime', minTime)
      .lt('start_datetime',  maxTime)

    if (evErr || !events?.length) continue

    // Filter out events already sent (dedup)
    const { data: alreadySent } = await supabase
      .from('calendar_reminder_logs')
      .select('event_id')
      .in('event_id', events.map(e => e.id))
      .eq('reminder_type', window.type)

    const sentIds = new Set((alreadySent ?? []).map(r => r.event_id))
    const due = events.filter(e => !sentIds.has(e.id))

    for (const event of due) {
      // Get all individual members of this household
      const { data: members } = await supabase
        .from('user_households')
        .select('user_id')
        .eq('household_id', event.household_id)

      if (!members?.length) continue

      // Fetch each member's email via admin API; skip family.* accounts
      const emailResults = await Promise.all(
        members.map(m => supabase.auth.admin.getUserById(m.user_id))
      )
      const emails = emailResults
        .flatMap(r => r.data?.user?.email ? [r.data.user.email] : [])
        .filter(e => !/^family\..+@ready\.app$/.test(e))

      if (!emails.length) continue

      // Format date/time
      const start    = new Date(event.start_datetime)
      const dateStr  = start.toLocaleDateString('en-AU', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
      const timeStr  = event.all_day
        ? 'All day'
        : start.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })

      const label = REMINDER_LABEL[window.type] ?? ''

      const { error: emailErr } = await resend.emails.send({
        from:    FROM,
        to:      emails,
        subject: `📅 ${event.title} ${label}`,
        html:    buildEmail({ event, dateStr, timeStr, label }),
      })

      if (emailErr) {
        errors.push(`${event.id}: ${emailErr.message}`)
        continue
      }

      // Mark as sent so it won't fire again
      await supabase
        .from('calendar_reminder_logs')
        .insert({ event_id: event.id, reminder_type: window.type })

      sent.push(`${event.title} (${window.type})`)
    }
  }

  return NextResponse.json({ ok: true, sent, errors })
}

// ── Email template ─────────────────────────────────────────────────────────────

interface EmailProps {
  event:    Record<string, string | boolean | null>
  dateStr:  string
  timeStr:  string
  label:    string
}

function buildEmail({ event, dateStr, timeStr, label }: EmailProps): string {
  const title    = String(event.title ?? '')
  const location = event.location ? `<p style="margin:4px 0;color:#6b7280;font-size:14px;">📍 ${event.location}</p>` : ''
  const notes    = event.description
    ? `<div style="margin-top:16px;padding:12px 16px;background:#f9fafb;border-radius:8px;font-size:14px;color:#374151;line-height:1.6;">${String(event.description).replace(/\n/g, '<br>')}</div>`
    : ''

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

        <!-- Header -->
        <tr><td style="background:#2563eb;padding:24px 28px;">
          <p style="margin:0;color:rgba(255,255,255,0.8);font-size:13px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">Event Reminder</p>
          <h1 style="margin:6px 0 0;color:#ffffff;font-size:22px;font-weight:700;line-height:1.3;">${title}</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.9);font-size:15px;">${title} ${label}</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:24px 28px;">
          <p style="margin:0 0 4px;color:#111827;font-size:15px;font-weight:600;">📆 ${dateStr}</p>
          <p style="margin:0 0 4px;color:#6b7280;font-size:14px;">🕐 ${timeStr}</p>
          ${location}
          ${notes}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:0 28px 28px;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">
            You received this because you are a member of this household in Ready.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
