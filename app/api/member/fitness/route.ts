/**
 * PATCH /api/member/fitness
 * Allows a family account to update a household member's fitness profile.
 */
import { createServiceClient } from '@/lib/supabase/service'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest) {
  const { memberId, fitness } = await req.json()
  if (!memberId || !fitness) {
    return NextResponse.json({ error: 'memberId and fitness are required' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createServiceClient()

  // Verify caller is family account (check profile + auth metadata fallback)
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
    return NextResponse.json({ error: 'Only family accounts can update member profiles' }, { status: 403 })
  }

  const [{ data: callerHHs }, { data: memberHHs }] = await Promise.all([
    admin.from('user_households').select('household_id').eq('user_id', user.id),
    admin.from('user_households').select('household_id').eq('user_id', memberId),
  ])
  const callerIds = new Set((callerHHs ?? []).map(h => h.household_id))
  const sharesHousehold = (memberHHs ?? []).some(h => callerIds.has(h.household_id))

  if (!sharesHousehold) {
    return NextResponse.json({ error: 'Member is not in your household' }, { status: 403 })
  }

  const { error } = await admin.from('fitness_profiles').upsert(
    { user_id: memberId, ...fitness, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
