import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'

function sanitizeLoginName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '')
}

export function deriveEmail(loginName: string): string {
  return `family.${sanitizeLoginName(loginName)}@ready.app`
}

export async function POST(req: NextRequest) {
  const { loginName, password } = await req.json()

  if (!loginName?.trim() || !password) {
    return NextResponse.json({ error: 'Login name and password are required.' }, { status: 400 })
  }

  const sanitized = sanitizeLoginName(loginName)
  if (sanitized.length < 2) {
    return NextResponse.json(
      { error: 'Login name must contain at least 2 letters or numbers.' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()
  const email = deriveEmail(loginName)

  // Create the user with admin API — auto-confirmed, no email sent
  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      account_type: 'family',
      family_login_name: loginName.trim(),
      household_name:    `${loginName.trim()}'s Family`,
    },
  })

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('already registered') || msg.includes('already been registered')) {
      return NextResponse.json({ error: 'That family name is already taken. Try another.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
