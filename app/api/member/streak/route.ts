/**
 * GET /api/member/streak?memberId=<uuid>
 * Returns the login streak for a household member, readable by the family account.
 * Uses service role to bypass RLS.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/service'
import { cookies } from 'next/headers'
import { format, parseISO, differenceInDays, subDays } from 'date-fns'

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

  let longest = unique.length ? 1 : 0
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
  const memberId = req.nextUrl.searchParams.get('memberId')
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })

  // Verify caller is authenticated
  const cookieStore = await cookies()
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceClient()
  const since = format(subDays(new Date(), 365), 'yyyy-MM-dd')

  // Fetch login activity for the member
  const { data: activityRows } = await admin
    .from('user_activity')
    .select('activity_date')
    .eq('user_id', memberId)
    .gte('activity_date', since)

  const loginDates = (activityRows ?? []).map((r: { activity_date: string }) => r.activity_date)
  const { current, longest } = computeStreak(loginDates)

  return NextResponse.json({ current, longest })
}
