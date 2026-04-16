/**
 * Links existing Supabase users to the vilelaferreira family household.
 * Run:  npx tsx scripts/add-members.ts
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL     = 'https://zdbxzirovmyseuauuhom.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const FAMILY_EMAIL     = 'family.vilelaferreira@ready.app'

const MEMBER_EMAILS = [
  'joselucasn.ferreira@gmail.com',
  'm.vilela33@gmail.com',
]

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── 1. Get all users ────────────────────────────────────────
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (listErr) throw listErr

  // ── 2. Find family account + household ──────────────────────
  const familyUser = users.find(u => u.email === FAMILY_EMAIL)
  if (!familyUser) throw new Error(`Family account not found: ${FAMILY_EMAIL}`)

  const { data: hhRow, error: hhErr } = await supabase
    .from('user_households')
    .select('household_id')
    .eq('user_id', familyUser.id)
    .single()
  if (hhErr || !hhRow) throw new Error('Could not find household for family account')

  const householdId = hhRow.household_id
  console.log(`\nFamily household: ${householdId}\n`)

  // ── 3. Link each member ─────────────────────────────────────
  for (const email of MEMBER_EMAILS) {
    console.log(`Processing: ${email}`)

    const user = users.find(u => u.email === email)
    if (!user) { console.error(`  ✗ Not found in auth`); continue }
    console.log(`  User ID: ${user.id}`)

    // Link to family household (ignore if already linked)
    const { error: linkErr } = await supabase
      .from('user_households')
      .upsert({ user_id: user.id, household_id: householdId }, { onConflict: 'user_id,household_id' })

    if (linkErr) {
      console.error(`  ✗ Link error: ${linkErr.message}`)
    } else {
      console.log(`  Linked to household ✓`)
    }

    // Ensure profile exists with individual type
    const { error: profileErr } = await supabase
      .from('user_profiles')
      .upsert({ user_id: user.id, account_type: 'individual' }, { onConflict: 'user_id' })

    if (profileErr) {
      console.error(`  ✗ Profile error: ${profileErr.message}`)
    } else {
      console.log(`  Profile ensured ✓`)
    }

    console.log()
  }

  console.log('Done. Both accounts are now under the vilelaferreira family.')
}

main().catch(err => { console.error('\nFatal:', err.message); process.exit(1) })
