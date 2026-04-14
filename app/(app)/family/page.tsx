'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useHousehold } from '@/hooks/useHousehold'
import { Users, Link2, Trash2, Copy, Check, AlertCircle } from 'lucide-react'

interface Member {
  user_id: string
  email: string
  joined_at: string
}

interface Invite {
  id: string
  code: string
  expires_at: string
  used_at: string | null
  used_by: string | null
}

export default function FamilyPage() {
  const { household, loading: householdLoading } = useHousehold()
  const supabase = createClient()

  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!household) return
    loadData()
  }, [household]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id ?? null)

    const [membersRes, invitesRes] = await Promise.all([
      supabase.rpc('get_household_members'),
      supabase
        .from('household_invites')
        .select('id, code, expires_at, used_at, used_by')
        .eq('household_id', household!.id)
        .order('created_at', { ascending: false }),
    ])

    setMembers((membersRes.data as Member[]) ?? [])
    setInvites((invitesRes.data as Invite[]) ?? [])
  }

  async function generateInvite() {
    if (!household) return
    setGenerating(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setGenerating(false); return }

    const { data, error: err } = await supabase
      .from('household_invites')
      .insert({ household_id: household.id, created_by: user.id })
      .select()
      .single()

    if (err) {
      setError('Failed to generate invite')
    } else {
      setInvites(prev => [data as Invite, ...prev])
    }
    setGenerating(false)
  }

  async function deleteInvite(id: string) {
    const { error: err } = await supabase.from('household_invites').delete().eq('id', id)
    if (!err) setInvites(prev => prev.filter(i => i.id !== id))
  }

  function getInviteUrl(code: string) {
    return `${window.location.origin}/auth/signup?invite=${code}`
  }

  async function copyInvite(code: string) {
    await navigator.clipboard.writeText(getInviteUrl(code))
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  function isExpired(invite: Invite) {
    return !invite.used_at && new Date(invite.expires_at) < new Date()
  }

  if (householdLoading) {
    return (
      <div className="flex flex-1 items-center justify-center h-full">
        <div className="h-6 w-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    )
  }

  const activeInvites = invites.filter(i => !i.used_at && !isExpired(i))

  return (
    <div className="max-w-xl mx-auto px-4 md:px-6 py-8 space-y-8">
      {/* Household name */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{household?.name}</h1>
        <p className="text-sm text-gray-500 mt-1">
          Family members share the calendar. Finance data is private to each person.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Members */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Members</h2>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
          {members.map(member => (
            <div key={member.user_id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{member.email}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Joined {new Date(member.joined_at).toLocaleDateString()}
                </p>
              </div>
              {member.user_id === currentUserId && (
                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  You
                </span>
              )}
            </div>
          ))}
          {members.length === 0 && (
            <p className="px-4 py-4 text-sm text-gray-400">No members found</p>
          )}
        </div>
      </section>

      {/* Invite links */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Invite Links</h2>
          </div>
          <button
            onClick={generateInvite}
            disabled={generating}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {generating ? 'Generating…' : '+ New Invite'}
          </button>
        </div>

        <div className="space-y-2">
          {activeInvites.length === 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 text-sm text-gray-400">
              No active invite links. Generate one to invite a family member.
            </div>
          )}
          {activeInvites.map(invite => (
            <div
              key={invite.id}
              className="rounded-2xl border border-gray-200 bg-white px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-mono font-semibold text-gray-900">{invite.code}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Expires {new Date(invite.expires_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => copyInvite(invite.code)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
                  title="Copy invite link"
                >
                  {copiedCode === invite.code
                    ? <Check className="h-4 w-4 text-green-600" />
                    : <Copy className="h-4 w-4" />
                  }
                </button>
                <button
                  onClick={() => deleteInvite(invite.id)}
                  className="p-2 rounded-lg hover:bg-red-50 transition-colors text-gray-400 hover:text-red-500"
                  title="Delete invite"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-3">
          Share the link with your family member. They'll be added to your household when they sign up. Links expire after 7 days.
        </p>
      </section>
    </div>
  )
}
