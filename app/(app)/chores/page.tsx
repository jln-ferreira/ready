'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useHousehold } from '@/hooks/useHousehold'
import { ListChecks, Plus, Trash2, CheckCircle2, Circle } from 'lucide-react'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface Chore {
  id: string
  household_id: string
  title: string
  emoji: string | null
  recurrence: 'daily' | 'weekly'
  day_of_week: number | null
  created_at: string
}

interface ChoreLog {
  id: string
  chore_id: string
  done_by: string
  done_date: string
}

interface Member {
  user_id: string
  email: string
}

export default function ChoresPage() {
  const { household, loading: householdLoading } = useHousehold()
  const supabase = createClient()

  const [chores, setChores]   = useState<Chore[]>([])
  const [logs, setLogs]       = useState<ChoreLog[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Add chore form
  const [showForm, setShowForm] = useState(false)
  const [newTitle, setNewTitle]           = useState('')
  const [newEmoji, setNewEmoji]           = useState('')
  const [newRecurrence, setNewRecurrence] = useState<'daily' | 'weekly'>('weekly')
  const [newDayOfWeek, setNewDayOfWeek]   = useState<number>(1) // Monday
  const [saving, setSaving] = useState(false)

  const today = format(new Date(), 'yyyy-MM-dd')
  const todayDow = new Date().getDay()

  useEffect(() => {
    if (!household) return
    loadAll()
  }, [household]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id ?? null)

    const [choreRes, logRes, memberRes] = await Promise.all([
      supabase.from('chores').select('*').eq('household_id', household!.id).order('created_at'),
      supabase.from('chore_logs').select('*').eq('household_id', household!.id).eq('done_date', today),
      supabase.rpc('get_household_members'),
    ])

    setChores((choreRes.data as Chore[]) ?? [])
    setLogs((logRes.data as ChoreLog[]) ?? [])
    setMembers((memberRes.data as Member[]) ?? [])
    setLoading(false)
  }

  async function toggleDone(chore: Chore) {
    const existingLog = logs.find(l => l.chore_id === chore.id)

    if (existingLog) {
      // Undo
      const { error } = await supabase.from('chore_logs').delete().eq('id', existingLog.id)
      if (!error) setLogs(prev => prev.filter(l => l.id !== existingLog.id))
    } else {
      // Mark done — upsert to handle race conditions
      if (!currentUserId) return
      const { data, error } = await supabase
        .from('chore_logs')
        .upsert(
          { chore_id: chore.id, household_id: household!.id, done_by: currentUserId, done_date: today },
          { onConflict: 'chore_id,done_date' }
        )
        .select().single()
      if (!error && data) setLogs(prev => [...prev.filter(l => l.chore_id !== chore.id), data as ChoreLog])
    }
  }

  async function addChore() {
    if (!newTitle.trim() || !household) return
    setSaving(true)
    const { data, error } = await supabase
      .from('chores')
      .insert({
        household_id: household.id,
        title: newTitle.trim(),
        emoji: newEmoji.trim() || null,
        recurrence: newRecurrence,
        day_of_week: newRecurrence === 'weekly' ? newDayOfWeek : null,
      })
      .select().single()
    if (!error && data) {
      setChores(prev => [...prev, data as Chore])
      setNewTitle(''); setNewEmoji(''); setNewRecurrence('weekly'); setNewDayOfWeek(1)
      setShowForm(false)
    }
    setSaving(false)
  }

  async function deleteChore(id: string) {
    const { error } = await supabase.from('chores').delete().eq('id', id)
    if (!error) {
      setChores(prev => prev.filter(c => c.id !== id))
      setLogs(prev => prev.filter(l => l.chore_id !== id))
    }
  }

  function memberName(userId: string) {
    const m = members.find(m => m.user_id === userId)
    if (!m) return 'Someone'
    return userId === currentUserId ? 'You' : m.email.split('@')[0]
  }

  const dueToday = chores.filter(c =>
    c.recurrence === 'daily' || (c.recurrence === 'weekly' && c.day_of_week === todayDow)
  )

  if (householdLoading) return <Spinner />

  return (
    <div className="max-w-lg mx-auto px-4 md:px-6 py-8 space-y-8">

      {/* Header */}
      <div className="flex items-center gap-2">
        <ListChecks className="h-5 w-5 text-blue-600" />
        <h1 className="text-xl font-semibold text-gray-900">Chores</h1>
        <span className="text-sm text-gray-400">{format(new Date(), 'EEEE, MMM d')}</span>
      </div>

      {/* Due Today */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Due Today</h2>
        {loading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : dueToday.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No chores scheduled for today.</p>
        ) : (
          <div className="space-y-2">
            {dueToday.map(chore => {
              const log = logs.find(l => l.chore_id === chore.id)
              return (
                <div
                  key={chore.id}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-colors ${
                    log ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                  }`}
                >
                  <button onClick={() => toggleDone(chore)} className="flex-shrink-0">
                    {log
                      ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                      : <Circle className="h-5 w-5 text-gray-300 hover:text-blue-400 transition-colors" />
                    }
                  </button>
                  <span className="text-sm mr-0.5">{chore.emoji}</span>
                  <span className={`flex-1 text-sm font-medium ${log ? 'text-green-700 line-through' : 'text-gray-900'}`}>
                    {chore.title}
                  </span>
                  {log && (
                    <span className="text-xs text-green-600 font-medium flex-shrink-0">
                      {memberName(log.done_by)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* All Chores */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">All Chores</h2>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Chore
          </button>
        </div>

        {showForm && (
          <div className="mb-3 p-4 rounded-2xl border border-blue-100 bg-blue-50/40 space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Emoji (optional)"
                value={newEmoji}
                onChange={e => setNewEmoji(e.target.value)}
                maxLength={2}
                className="w-16 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-center focus:border-blue-400 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Chore name…"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addChore()}
                className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm placeholder:text-gray-400 focus:border-blue-400 focus:outline-none"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {(['daily', 'weekly'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setNewRecurrence(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                    newRecurrence === r ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'
                  }`}
                >
                  {r}
                </button>
              ))}
              {newRecurrence === 'weekly' && DAYS.map((d, i) => (
                <button
                  key={d}
                  onClick={() => setNewDayOfWeek(i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    newDayOfWeek === i ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">
                Cancel
              </button>
              <button
                onClick={addChore}
                disabled={!newTitle.trim() || saving}
                className="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {!loading && chores.length === 0 && !showForm && (
          <p className="text-sm text-gray-400 py-4 text-center">No chores yet. Add one above.</p>
        )}

        <div className="space-y-1.5">
          {chores.map(chore => (
            <div key={chore.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-gray-100">
              <span className="text-sm w-5 text-center">{chore.emoji ?? '•'}</span>
              <span className="flex-1 text-sm text-gray-800">{chore.title}</span>
              <span className="text-xs text-gray-400 flex-shrink-0">
                {chore.recurrence === 'daily' ? 'Daily' : `Every ${DAYS[chore.day_of_week ?? 1]}`}
              </span>
              <button
                onClick={() => deleteChore(chore.id)}
                className="p-1 text-gray-300 hover:text-red-400 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>
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
