/**
 * GET /api/household/streaks?householdId=<uuid>
 * Returns login streaks for all non-family members in a household.
 * Uses service role to bypass RLS — safe because we verify the caller
 * belongs to the same household first.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/service'
import { cookies } from 'next/headers'
import { format, subDays, parseISO, differenceInDays } from 'date-fns'

const SIDEBAR_HEX: Record<string, string> = {
  blue: '#2563eb', purple: '#7c3aed', green: '#16a34a', rose: '#e11d48',
  orange: '#ea580c', teal: '#0d9488', amber: '#d97706', pink: '#db2777',
}

function computeStreak(dates: string[]): { current: number; longest: number } {
  if (!dates.length) return { current: 0, longest: 0 }
  const unique = [...new Set(dates)].sort().reverse()
  const today     = format(new Date(), 'yyyy-MM-dd')
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')

  let current = 0
  if (unique[0] === today || unique[0] === yesterday) {
    current = 1
    for (let i = 1; i < unique.length; i++) {
      if (differenceInDays(parseISO(unique[i - 1]), parseISO(unique[i])) === 1) current++
      else break
    }
  }

  let longest = unique.length > 0 ? 1 : 0
  let run = 1
  for (let i = 1; i < unique.length; i++) {
    if (differenceInDays(parseISO(unique[i - 1]), parseISO(unique[i])) === 1) {
      run++
      if (run > longest) longest = run
    } else {
      run = 1
    }
  }
  return { current, longest: Math.max(longest, current) }
}

export async function GET(req: NextRequest) {
  const householdId = req.nextUrl.searchParams.get('householdId')
  if (!householdId) return NextResponse.json({ error: 'householdId required' }, { status: 400 })

  // Verify caller is authenticated and belongs to this household
  const cookieStore = await cookies()
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceClient()

  // Confirm caller is in the household
  const { data: membership } = await admin
    .from('user_households')
    .select('household_id')
    .eq('user_id', user.id)
    .eq('household_id', householdId)
    .maybeSingle()
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Get all members of this household with profiles
  const { data: hhMembers } = await admin
    .from('user_households')
    .select('user_id')
    .eq('household_id', householdId)

  const memberIds = (hhMembers ?? []).map((r: { user_id: string }) => r.user_id)
  if (!memberIds.length) return NextResponse.json([])

  // Fetch profiles and activity in parallel
  const since = format(subDays(new Date(), 365), 'yyyy-MM-dd')
  const [{ data: profiles }, { data: activityRows }] = await Promise.all([
    admin
      .from('user_profiles')
      .select('user_id, display_name, sidebar_color, account_type')
      .in('user_id', memberIds),
    admin
      .from('user_activity')
      .select('user_id, activity_date')
      .in('user_id', memberIds)
      .gte('activity_date', since),
  ])

  // Also get emails for members who might not have profiles yet
  const { data: authUsers } = await admin.auth.admin.listUsers()
  const emailMap: Record<string, string> = {}
  for (const u of authUsers?.users ?? []) {
    emailMap[u.id] = u.email ?? ''
  }

  // Group activity by user
  const activityByUser: Record<string, string[]> = {}
  for (const row of (activityRows ?? []) as { user_id: string; activity_date: string }[]) {
    if (!activityByUser[row.user_id]) activityByUser[row.user_id] = []
    activityByUser[row.user_id].push(row.activity_date)
  }

  const profileMap: Record<string, { display_name?: string; sidebar_color?: string; account_type?: string }> = {}
  for (const p of (profiles ?? []) as { user_id: string; display_name?: string; sidebar_color?: string; account_type?: string }[]) {
    profileMap[p.user_id] = p
  }

  const result = memberIds
    .filter(uid => {
      const p = profileMap[uid]
      const email = emailMap[uid] ?? ''
      // Exclude family admin accounts from competition
      if (p?.account_type === 'family') return false
      if (/^family\./i.test(email)) return false
      return true
    })
    .map(uid => {
      const p = profileMap[uid] ?? {}
      const email = emailMap[uid] ?? ''
      const name = (p as { display_name?: string }).display_name || email.split('@')[0] || uid.slice(0, 8)
      const color = SIDEBAR_HEX[(p as { sidebar_color?: string }).sidebar_color ?? 'blue'] ?? '#2563eb'
      const { current, longest } = computeStreak(activityByUser[uid] ?? [])
      return { userId: uid, name, color, streak: current, longestStreak: longest }
    })
    .sort((a, b) => b.streak - a.streak)

  return NextResponse.json(result)
}
