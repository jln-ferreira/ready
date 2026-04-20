import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/service'
import { cookies } from 'next/headers'

async function getAuthUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// POST /api/push/subscribe — save a push subscription
export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subscription } = await req.json() as {
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
  }

  const admin = createServiceClient()

  // Get the user's preferred household
  const { data: hhRows } = await admin
    .from('user_households')
    .select('household_id')
    .eq('user_id', user.id)
    .limit(1)

  const householdId = hhRows?.[0]?.household_id ?? null

  const { error } = await admin
    .from('push_subscriptions')
    .upsert(
      {
        user_id:      user.id,
        household_id: householdId,
        endpoint:     subscription.endpoint,
        p256dh:       subscription.keys.p256dh,
        auth_key:     subscription.keys.auth,
      },
      { onConflict: 'user_id,endpoint' },
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/push/subscribe — remove a push subscription
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { endpoint } = await req.json() as { endpoint: string }
  const admin = createServiceClient()

  await admin
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)

  return NextResponse.json({ ok: true })
}
