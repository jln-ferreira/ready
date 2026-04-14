'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useHousehold } from '@/hooks/useHousehold'
import { StickyNote, Pin, PinOff, Trash2, Send } from 'lucide-react'

interface Notice {
  id: string
  household_id: string
  created_by: string
  content: string
  pinned: boolean
  created_at: string
}

interface Member {
  user_id: string
  email: string
}

// Stable pastel color from user id (for avatar circles)
function avatarColor(userId: string): string {
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-green-100 text-green-700',
    'bg-purple-100 text-purple-700',
    'bg-orange-100 text-orange-700',
    'bg-pink-100 text-pink-700',
    'bg-teal-100 text-teal-700',
  ]
  const hash = userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return colors[hash % colors.length]
}

export default function NoticeboardPage() {
  const { household, loading: householdLoading } = useHousehold()
  const supabase = createClient()

  const [notices, setNotices]   = useState<Notice[]>([])
  const [members, setMembers]   = useState<Member[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)
  const [content, setContent]   = useState('')
  const [posting, setPosting]   = useState(false)

  useEffect(() => {
    if (!household) return
    loadAll()
  }, [household]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id ?? null)

    const [noticeRes, memberRes] = await Promise.all([
      supabase
        .from('notices')
        .select('*')
        .eq('household_id', household!.id)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.rpc('get_household_members'),
    ])

    setNotices((noticeRes.data as Notice[]) ?? [])
    setMembers((memberRes.data as Member[]) ?? [])
    setLoading(false)
  }

  async function postNotice() {
    if (!content.trim() || !household) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setPosting(true)
    const { data, error } = await supabase
      .from('notices')
      .insert({ household_id: household.id, created_by: user.id, content: content.trim() })
      .select().single()
    if (!error && data) {
      setNotices(prev => [data as Notice, ...prev])
      setContent('')
    }
    setPosting(false)
  }

  async function togglePin(notice: Notice) {
    const { data, error } = await supabase
      .from('notices')
      .update({ pinned: !notice.pinned })
      .eq('id', notice.id)
      .select().single()
    if (!error && data) {
      setNotices(prev =>
        [...prev.filter(n => n.id !== notice.id), data as Notice].sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
      )
    }
  }

  async function deleteNotice(id: string) {
    const { error } = await supabase.from('notices').delete().eq('id', id)
    if (!error) setNotices(prev => prev.filter(n => n.id !== id))
  }

  function memberInitial(userId: string): string {
    const m = members.find(m => m.user_id === userId)
    if (!m) return '?'
    return m.email[0].toUpperCase()
  }

  function memberName(userId: string): string {
    const m = members.find(m => m.user_id === userId)
    if (!m) return 'Someone'
    return userId === currentUserId ? 'You' : m.email.split('@')[0]
  }

  if (householdLoading) return <Spinner />

  return (
    <div className="max-w-lg mx-auto px-4 md:px-6 py-8">

      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <StickyNote className="h-5 w-5 text-blue-600" />
        <h1 className="text-xl font-semibold text-gray-900">Noticeboard</h1>
      </div>

      {/* Post a note */}
      <div className="mb-6 flex gap-2">
        <textarea
          placeholder="Post a note for the family…"
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postNotice() } }}
          rows={2}
          className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
        />
        <button
          onClick={postNotice}
          disabled={!content.trim() || posting}
          className="flex-shrink-0 self-end flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Send className="h-4 w-4" />
          Post
        </button>
      </div>

      {/* Notices */}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : notices.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <StickyNote className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Nothing posted yet. Leave a note for the family.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notices.map(notice => (
            <div
              key={notice.id}
              className={`rounded-2xl border p-4 transition-colors ${
                notice.pinned
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${avatarColor(notice.created_by)}`}>
                  {memberInitial(notice.created_by)}
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-gray-700">
                      {memberName(notice.created_by)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {format(new Date(notice.created_at), 'MMM d, h:mm a')}
                    </span>
                    {notice.pinned && (
                      <span className="text-xs font-medium text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded-full">
                        Pinned
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{notice.content}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                  <button
                    onClick={() => togglePin(notice)}
                    title={notice.pinned ? 'Unpin' : 'Pin'}
                    className={`p-1.5 rounded-lg transition-colors ${
                      notice.pinned
                        ? 'text-yellow-500 hover:bg-yellow-100'
                        : 'text-gray-300 hover:text-yellow-500 hover:bg-gray-100'
                    }`}
                  >
                    {notice.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => deleteNotice(notice.id)}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-gray-100 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex flex-1 items-center justify-center h-full">
      <div className="h-6 w-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  )
}
