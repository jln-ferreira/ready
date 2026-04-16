/**
 * GET  /api/member/profile?memberId=  → { profile, fitness }
 * PATCH /api/member/profile           → update member's display_name / sidebar_color / fitness
 *
 * Uses the service role to bypass RLS — verifies the caller is a family account
 * in the same household as the target member.
 */
import { createServiceClient } from '@/lib/supabase/service'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

async function verifyFamilyAccess(memberId: string) {
  const cookieStore = await cookies()
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return { error: 'Not authenticated', status: 401 } as const

  const admin = createServiceClient()

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
    return { error: 'Only family accounts can access member profiles', status: 403 } as const
  }

  const [{ data: callerHHs }, { data: memberHHs }] = await Promise.all([
    admin.from('user_households').select('household_id').eq('user_id', user.id),
    admin.from('user_households').select('household_id').eq('user_id', memberId),
  ])
  const callerIds = new Set((callerHHs ?? []).map((h: { household_id: string }) => h.household_id))
  const sharesHousehold = (memberHHs ?? []).some((h: { household_id: string }) => callerIds.has(h.household_id))
  if (!sharesHousehold) {
    return { error: 'Member is not in your household', status: 403 } as const
  }

  return { admin }
}

export async function GET(req: NextRequest) {
  const memberId = new URL(req.url).searchParams.get('memberId')
  if (!memberId) return NextResponse.json({ error: 'memberId is required' }, { status: 400 })

  const result = await verifyFamilyAccess(memberId)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  const { admin } = result

  const [{ data: profile }, { data: fitness }] = await Promise.all([
    admin.from('user_profiles')
      .select('display_name, sidebar_color')
      .eq('user_id', memberId).single(),
    admin.from('fitness_profiles')
      .select('weight_kg, height_cm, age, sex, activity_level')
      .eq('user_id', memberId).single(),
  ])

  return NextResponse.json({ profile: profile ?? null, fitness: fitness ?? null })
}

export async function PATCH(req: NextRequest) {
  const { memberId, sidebarColor, displayName } = await req.json()

  if (!memberId) {
    return NextResponse.json({ error: 'memberId is required' }, { status: 400 })
  }

  const result = await verifyFamilyAccess(memberId)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  const { admin } = result

  // Build update payload
  const updates: Record<string, string> = { updated_at: new Date().toISOString() }
  if (sidebarColor !== undefined) updates.sidebar_color = sidebarColor
  if (displayName  !== undefined) updates.display_name  = displayName

  const { error } = await admin
    .from('user_profiles')
    .upsert({ user_id: memberId, ...updates }, { onConflict: 'user_id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
