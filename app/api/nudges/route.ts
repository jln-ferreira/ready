/**
 * GET /api/nudges — daily smart nudge cron (runs at 18:00 UTC via Vercel cron)
 *
 * For each user with a push subscription, picks the highest-priority nudge:
 *   1. Streak at risk  — had activity yesterday, none today
 *   2. Falling behind  — someone in the household has more monthly chore points
 *   3. Idle reminder   — no activity at all today
 *
 * At most 1 notification per user per run. The cron fires once a day so
 * there is no need for a separate dedup log.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { format, subDays } from 'date-fns'
import webpush, { type PushSubscription } from 'web-push'

// ─── VAPID setup ──────────────────────────────────────────────────────────────

function initVapid(): boolean {
  const { VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env
  if (!VAPID_SUBJECT || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  return true
}

// ─── types ────────────────────────────────────────────────────────────────────

interface PushSub {
  user_id:      string
  household_id: string | null
  endpoint:     string
  p256dh:       string
  auth_key:     string
}

interface Nudge {
  title: string
  body:  string
  url:   string
}

// ─── helper — send one push, remove subscription if it expired ────────────────

async function sendPush(sub: PushSub, nudge: Nudge, admin: ReturnType<typeof createServiceClient>) {
  const pushSub: PushSubscription = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.p256dh, auth: sub.auth_key },
  }
  try {
    await webpush.sendNotification(pushSub, JSON.stringify(nudge))
    return true
  } catch (err: unknown) {
    // 410 Gone = subscription expired; clean it up
    if (typeof err === 'object' && err !== null && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
      await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    }
    return false
  }
}

// ─── cron handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!initVapid()) {
    return NextResponse.json(
      { error: 'VAPID env vars not set. Run: npx web-push generate-vapid-keys and add VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY to Vercel env.' },
      { status: 500 },
    )
  }

  const admin  = createServiceClient()
  const today  = format(new Date(), 'yyyy-MM-dd')
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const monthStart = `${today.slice(0, 7)}-01`

  // 1. Load all subscriptions
  const { data: subs } = await admin.from('push_subscriptions').select('*')
  if (!subs?.length) return NextResponse.json({ ok: true, sent: 0 })

  const userIds      = [...new Set(subs.map((s: PushSub) => s.user_id))]
  const householdIds = [...new Set(subs.map((s: PushSub) => s.household_id).filter(Boolean))] as string[]

  // 2. Batch-load everything needed to decide nudges
  const [
    choreYesterdayRes,
    choreTodayRes,
    waterYesterdayRes,
    waterTodayRes,
    monthlyLogsRes,
    memberNamesRes,
  ] = await Promise.all([
    admin.from('chore_logs').select('done_by').in('done_by', userIds).eq('done_date', yesterday),
    admin.from('chore_logs').select('done_by').in('done_by', userIds).eq('done_date', today),
    admin.from('water_logs').select('user_id').in('user_id', userIds).eq('log_date', yesterday).gt('amount_ml', 0),
    admin.from('water_logs').select('user_id').in('user_id', userIds).eq('log_date', today).gt('amount_ml', 0),
    admin.from('chore_logs')
      .select('done_by, household_id, points_earned')
      .in('household_id', householdIds)
      .gte('done_date', monthStart),
    admin.from('user_profiles').select('user_id, display_name').in('user_id', userIds),
  ])

  // Build helper sets / maps
  const hadYesterday = new Set([
    ...(choreYesterdayRes.data ?? []).map((l: { done_by: string }) => l.done_by),
    ...(waterYesterdayRes.data ?? []).map((l: { user_id: string }) => l.user_id),
  ])
  const hadToday = new Set([
    ...(choreTodayRes.data ?? []).map((l: { done_by: string }) => l.done_by),
    ...(waterTodayRes.data ?? []).map((l: { user_id: string }) => l.user_id),
  ])

  // Monthly points per household → per user
  const monthlyPoints: Record<string, Record<string, number>> = {}
  for (const l of (monthlyLogsRes.data ?? []) as { done_by: string; household_id: string; points_earned: number | null }[]) {
    if (!monthlyPoints[l.household_id]) monthlyPoints[l.household_id] = {}
    monthlyPoints[l.household_id][l.done_by] =
      (monthlyPoints[l.household_id][l.done_by] ?? 0) + (l.points_earned ?? 0)
  }

  // Display name lookup
  const displayNames: Record<string, string> = {}
  for (const p of (memberNamesRes.data ?? []) as { user_id: string; display_name: string | null }[]) {
    displayNames[p.user_id] = p.display_name || p.user_id.slice(0, 6)
  }

  // 3. Send nudges
  let sent = 0
  const errors: string[] = []

  for (const sub of subs as PushSub[]) {
    const { user_id: uid, household_id: hid } = sub
    let nudge: Nudge | null = null

    // Priority 1: streak at risk
    if (hadYesterday.has(uid) && !hadToday.has(uid)) {
      nudge = {
        title: '🔥 Streak at risk!',
        body:  "You were active yesterday — close a chore or log water before midnight to keep your streak alive.",
        url:   '/chores',
      }
    }

    // Priority 2: falling behind on points this month
    if (!nudge && hid && monthlyPoints[hid]) {
      const pts = monthlyPoints[hid]
      const myPts = pts[uid] ?? 0
      const leader = Object.entries(pts)
        .filter(([id]) => id !== uid)
        .sort((a, b) => b[1] - a[1])[0]

      if (leader && leader[1] > myPts) {
        const diff = leader[1] - myPts
        const name = displayNames[leader[0]] || 'Someone'
        nudge = {
          title: '📊 You\'re falling behind',
          body:  `${name} is leading by ${diff} point${diff === 1 ? '' : 's'} this month. Close a chore to catch up!`,
          url:   '/chores',
        }
      }
    }

    // Priority 3: no activity at all today — gentle general reminder
    if (!nudge && !hadToday.has(uid)) {
      nudge = {
        title: '🏠 Ready',
        body:  "Your household has open tasks. Jump in before end of day!",
        url:   '/chores',
      }
    }

    if (!nudge) continue

    const ok = await sendPush(sub, nudge, admin)
    if (ok) sent++
    else errors.push(uid)
  }

  return NextResponse.json({ ok: true, sent, errors })
}
