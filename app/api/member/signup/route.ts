import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { email, password, inviteCode, pin } = await req.json()

  if (!email?.trim() || !password || !inviteCode?.trim()) {
    return NextResponse.json(
      { error: 'Email, password, and invite code are required.' },
      { status: 400 }
    )
  }

  if (pin && !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN must be exactly 4 digits.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Create user via admin API — auto-confirmed, invite code in metadata
  const { data, error } = await supabase.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: {
      account_type: 'individual',
      invite_code:  inviteCode.trim().toUpperCase(),
    },
  })

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('already registered') || msg.includes('already been registered')) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Set PIN if provided
  if (pin && data.user) {
    const { error: pinErr } = await supabase.rpc('set_member_pin', {
      p_user_id: data.user.id,
      p_pin:     pin,
    })
    if (pinErr) {
      console.error('[member/signup] set_member_pin failed:', pinErr.message)
      // Non-fatal: account was created, PIN can be set later
    }
  }

  return NextResponse.json({ success: true })
}
