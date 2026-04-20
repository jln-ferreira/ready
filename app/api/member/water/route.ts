/**
 * GET  /api/member/water?memberId=&date=  → { day_amount_ml, history }
 * POST /api/member/water                  → { memberId, amountMl, date } → { amount_ml }
 *
 * Allows a family account to read/log water for a household member via the service role.
 */
import { createServiceClient } from '@/lib/supabase/service'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { format, subDays, differenceInDays, parseISO } from 'date-fns'

function computeWaterStreak(dates: string[]): number {
  const unique = [...new Set(dates)].sort().reverse()
  if (!unique.length) return 0
  const today     = format(new Date(), 'yyyy-MM-dd')
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  if (unique[0] !== today && unique[0] !== yesterday) return 0
  let streak = 1
  for (let i = 1; i < unique.length; i++) {
    if (differenceInDays(parseISO(unique[i - 1]), parseISO(unique[i])) === 1) streak++
    else break
  }
  return streak
}

async function getCallerAndVerify(memberId: string) {
  const cookieStore = await cookies()
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return { error: 'Not authenticated', status: 401 } as const

  const admin = createServiceClient()

  // Check user_profiles first; fall back to auth metadata (handles mis-backfilled rows)
  const [{ data: callerProfile }, { data: authUser }] = await Promise.all([
    admin.from('user_profiles').select('account_type').eq('user_id', user.id).single(),
    admin.auth.admin.getUserById(user.id),
  ])
  const isFamilyAccount =
    callerProfile?.account_type === 'family' ||
    (authUser as { user?: { user_metadata?: { account_type?: string } } })
      ?.user?.user_metadata?.account_type === 'family' ||
    /^family\./.test(user.email ?? '')
  if (!isFamilyAccount) {
    return { error: 'Only family accounts can access member water data', status: 403 } as const
  }

  const [{ data: callerHHs }, { data: memberHHs }] = await Promise.all([
    admin.from('user_households').select('household_id').eq('user_id', user.id),
    admin.from('user_households').select('household_id').eq('user_id', memberId),
  ])
  const callerIds = new Set((callerHHs ?? []).map((h: { household_id: string }) => h.household_id))
  // Find the household the family account and member share
  const sharedHouseholdId = (memberHHs ?? []).find(
    (h: { household_id: string }) => callerIds.has(h.household_id)
  )?.household_id ?? null

  if (!sharedHouseholdId) {
    return { error: 'Member is not in your household', status: 403 } as const
  }

  return { admin, userId: user.id, sharedHouseholdId }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const memberId = searchParams.get('memberId')
  const date     = searchParams.get('date')

  if (!memberId || !date) {
    return NextResponse.json({ error: 'memberId and date are required' }, { status: 400 })
  }

  const result = await getCallerAndVerify(memberId)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  const { admin } = result

  const from      = format(subDays(new Date(date), 6), 'yyyy-MM-dd')
  const since60   = format(subDays(new Date(), 60), 'yyyy-MM-dd')

  const [{ data: dayLog }, { data: historyData }, { data: streakData }] = await Promise.all([
    admin.from('water_logs').select('amount_ml').eq('user_id', memberId).eq('log_date', date).single(),
    admin.from('water_logs')
      .select('log_date, amount_ml')
      .eq('user_id', memberId)
      .gte('log_date', from)
      .lte('log_date', date),
    admin.from('water_logs')
      .select('log_date')
      .eq('user_id', memberId)
      .gte('log_date', since60)
      .gt('amount_ml', 0),
  ])

  const waterStreak = computeWaterStreak(
    (streakData ?? []).map((r: { log_date: string }) => r.log_date)
  )

  return NextResponse.json({
    day_amount_ml: dayLog?.amount_ml ?? 0,
    water_streak:  waterStreak,
    history: (historyData ?? []).map((r: { log_date: string; amount_ml: number }) => ({
      date: r.log_date,
      amount_ml: r.amount_ml,
    })),
  })
}

export async function POST(req: NextRequest) {
  const { memberId, amountMl, date } = await req.json()

  if (!memberId || amountMl == null || !date) {
    return NextResponse.json({ error: 'memberId, amountMl, and date are required' }, { status: 400 })
  }

  const result = await getCallerAndVerify(memberId)
  console.log('[water POST] verify result:', 'error' in result ? result : { sharedHouseholdId: result.sharedHouseholdId })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  const { admin, sharedHouseholdId } = result

  // Guard: sharedHouseholdId should always be set if verify passed, but protect the upsert
  if (!sharedHouseholdId) {
    return NextResponse.json({ error: 'Could not determine shared household' }, { status: 500 })
  }

  // Read current value, then add delta — avoids any ON CONFLICT upsert issues
  const { data: existing } = await admin
    .from('water_logs').select('amount_ml, id').eq('user_id', memberId).eq('log_date', date).maybeSingle()

  const newAmount = Math.max(0, (existing?.amount_ml ?? 0) + amountMl)

  let error: { message: string } | null = null
  if (existing) {
    // Row exists — only update amount_ml, leave household_id untouched
    const { error: upErr } = await admin
      .from('water_logs').update({ amount_ml: newAmount, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    error = upErr
  } else {
    // First log for this date — insert fresh
    const { error: insErr } = await admin
      .from('water_logs').insert({ user_id: memberId, household_id: sharedHouseholdId, log_date: date, amount_ml: newAmount })
    error = insErr
  }

  if (error) {
    console.error('[water POST] write error:', error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ amount_ml: newAmount })
}
