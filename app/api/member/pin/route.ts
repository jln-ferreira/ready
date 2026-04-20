import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { targetUserId, pin } = body
    console.log('[pin] called — targetUserId:', targetUserId, 'pin length:', pin?.length)

    if (!targetUserId || !pin) {
      return NextResponse.json({ error: 'targetUserId and pin are required.' }, { status: 400 })
    }

    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN must be exactly 4 digits.' }, { status: 400 })
    }

    // Verify the caller is authenticated
    console.log('[pin] creating auth client')
    const authClient = await createClient()
    console.log('[pin] getting user')
    const { data: { user }, error: authErr } = await authClient.auth.getUser()
    console.log('[pin] user:', user?.id, 'authErr:', authErr?.message)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const service = createServiceClient()

    // If not setting own PIN, verify caller shares a household with the target
    if (targetUserId !== user.id) {
      console.log('[pin] checking household membership')
      const { data: callerHouseholds, error: hhErr } = await service
        .from('user_households')
        .select('household_id')
        .eq('user_id', user.id)
      console.log('[pin] callerHouseholds:', callerHouseholds, 'err:', hhErr?.message)

      const householdIds = (callerHouseholds ?? []).map((r: { household_id: string }) => r.household_id)

      if (householdIds.length > 0) {
        const { data: shared, error: sharedErr } = await service
          .from('user_households')
          .select('household_id')
          .eq('user_id', targetUserId)
          .in('household_id', householdIds)
          .limit(1)
          .maybeSingle()
        console.log('[pin] shared:', shared, 'err:', sharedErr?.message)

        if (!shared) {
          return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
        }
      } else {
        return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
      }
    }

    console.log('[pin] calling set_member_pin RPC')
    const { error } = await service.rpc('set_member_pin', {
      p_user_id: targetUserId,
      p_pin:     pin,
    })
    console.log('[pin] rpc result error:', error)

    if (error) {
      console.error('[pin] set_member_pin failed:', error.message, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (e) {
    console.error('[pin] uncaught exception:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
