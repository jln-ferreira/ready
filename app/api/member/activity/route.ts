/**
 * POST /api/member/activity
 * Records today's activity for a household member.
 * Only callable by family accounts — uses service role to bypass RLS.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/service'
import { cookies } from 'next/headers'
import { format } from 'date-fns'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { memberId } = body as { memberId?: string }
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })

  const cookieStore = await cookies()
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only family accounts may write activity on behalf of members
  const { data: profile } = await supabaseAuth
    .from('user_profiles')
    .select('account_type')
    .eq('user_id', user.id)
    .single()

  const isFamilyAccount =
    profile?.account_type === 'family' || /^family\./i.test(user.email ?? '')
  if (!isFamilyAccount) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createServiceClient()
  await admin
    .from('user_activity')
    .upsert(
      { user_id: memberId, activity_date: format(new Date(), 'yyyy-MM-dd') },
      { onConflict: 'user_id,activity_date' },
    )

  return NextResponse.json({ ok: true })
}
