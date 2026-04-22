'use client'

import { useState, useEffect, useMemo } from 'react'
import { format, subMonths, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useHousehold } from '@/hooks/useHousehold'
import { useActiveMembers } from '@/contexts/ActiveMemberContext'
import { ShoppingCart, Plus, Trash2, Trophy, BarChart2 } from 'lucide-react'
import MonthlyPointsChart, { buildMonthlyPoints } from '@/components/MonthlyPointsChart'

const CATEGORIES = ['Produce', 'Dairy', 'Meat', 'Bakery', 'Pantry', 'Other'] as const
type Category = typeof CATEGORIES[number]

const CAT_COLORS: Record<Category, string> = {
  Produce: 'bg-green-100 text-green-700',
  Dairy:   'bg-blue-100 text-blue-700',
  Meat:    'bg-red-100 text-red-700',
  Bakery:  'bg-amber-100 text-amber-700',
  Pantry:  'bg-gray-100 text-gray-600',
  Other:   'bg-slate-100 text-slate-500',
}

interface ShoppingItem {
  id: string
  household_id: string
  created_by: string
  title: string
  category: Category
  checked: boolean
  checked_by: string | null
  checked_at: string | null
  created_at: string
}

interface ShoppingLog {
  user_id: string
  points: number
  log_date: string  // yyyy-MM-dd
}

interface MemberProfile {
  user_id: string
  email: string
  display_name?: string
}

const PTS_ADD   = 3   // adding an item
const PTS_CHECK = 5   // checking one off

export default function ShoppingPage() {
  const { household, loading: householdLoading } = useHousehold()
  const { accountType, activeMemberId, effectiveUserId } = useActiveMembers()
  const isReadOnly = accountType === 'family' && !activeMemberId
  const supabase = createClient()

  const [items,         setItems]         = useState<ShoppingItem[]>([])
  const [loading,       setLoading]       = useState(true)
  const [title,         setTitle]         = useState('')
  const [category,      setCategory]      = useState<Category>('Other')
  const [adding,        setAdding]        = useState(false)
  const [members,       setMembers]       = useState<MemberProfile[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [shoppingLogs,  setShoppingLogs]  = useState<ShoppingLog[]>([])

  useEffect(() => {
    if (!household) return
    load()
  }, [household]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id ?? null)

    const since = format(subMonths(new Date(), 6), 'yyyy-MM-dd')

    const [itemsRes, logsRes] = await Promise.all([
      supabase
        .from('shopping_items')
        .select('*')
        .eq('household_id', household!.id)
        .order('checked', { ascending: true })
        .order('created_at', { ascending: false }),
      supabase
        .from('shopping_logs')
        .select('user_id, points, log_date')
        .eq('household_id', household!.id)
        .gte('log_date', since),
    ])

    const { data: profileData, error: profileErr } = await supabase.rpc('get_household_members_with_profiles')
    let memberData: MemberProfile[]
    if (!profileErr && profileData) {
      memberData = profileData as MemberProfile[]
    } else {
      const { data: basicData } = await supabase.rpc('get_household_members')
      memberData = (basicData ?? []) as MemberProfile[]
    }

    setItems((itemsRes.data as ShoppingItem[]) ?? [])
    setShoppingLogs((logsRes.data as ShoppingLog[]) ?? [])
    setMembers(memberData)
    setLoading(false)
  }

  function actorId(): string | null {
    return effectiveUserId ?? currentUserId
  }

  async function writeLog(action: 'added' | 'checked', userId: string) {
    const points = action === 'added' ? PTS_ADD : PTS_CHECK
    const { data } = await supabase
      .from('shopping_logs')
      .insert({
        household_id: household!.id,
        user_id: userId,
        action,
        points,
        log_date: format(new Date(), 'yyyy-MM-dd'),
      })
      .select('user_id, points, log_date')
      .single()
    if (data) setShoppingLogs(prev => [...prev, data as ShoppingLog])
  }

  async function addItem() {
    if (!title.trim() || !household) return
    const actor = actorId()
    if (!actor) return
    setAdding(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setAdding(false); return }

    const { data, error } = await supabase
      .from('shopping_items')
      .insert({ household_id: household.id, created_by: actor, title: title.trim(), category })
      .select().single()
    if (!error && data) {
      setItems(prev => [data as ShoppingItem, ...prev])
      setTitle('')
      await writeLog('added', actor)
    }
    setAdding(false)
  }

  async function toggleItem(item: ShoppingItem) {
    const actor = actorId()
    const { data: { user } } = await supabase.auth.getUser()
    const userId = actor ?? user?.id ?? null
    const wasChecked = item.checked
    const updates = wasChecked
      ? { checked: false, checked_by: null, checked_at: null }
      : { checked: true, checked_by: userId, checked_at: new Date().toISOString() }
    const { data, error } = await supabase
      .from('shopping_items').update(updates).eq('id', item.id).select().single()
    if (!error && data) {
      setItems(prev =>
        [...prev.filter(i => i.id !== item.id), data as ShoppingItem].sort((a, b) => {
          if (a.checked !== b.checked) return a.checked ? 1 : -1
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
      )
      // Only award points when checking OFF (not unchecking)
      if (!wasChecked && userId) await writeLog('checked', userId)
    }
  }

  async function deleteItem(id: string) {
    const { error } = await supabase.from('shopping_items').delete().eq('id', id)
    if (!error) setItems(prev => prev.filter(i => i.id !== id))
  }

  async function clearChecked() {
    const ids = items.filter(i => i.checked).map(i => i.id)
    if (!ids.length) return
    const { error } = await supabase.from('shopping_items').delete().in('id', ids)
    if (!error) setItems(prev => prev.filter(i => !i.checked))
    // shopping_logs intentionally NOT deleted — history is preserved
  }

  function memberName(userId: string) {
    if (userId === currentUserId) return 'You'
    const m = members.find(m => m.user_id === userId)
    if (!m) return 'Someone'
    return m.display_name || m.email.split('@')[0]
  }

  const myShoppingChart = useMemo(() => {
    const actor = effectiveUserId ?? currentUserId
    if (!actor) return []
    return buildMonthlyPoints(
      shoppingLogs.filter(l => l.user_id === actor)
                  .map(l => ({ date: l.log_date, points: l.points }))
    )
  }, [shoppingLogs, effectiveUserId, currentUserId])

  const leaderboard = useMemo(() => {
    const adminId = accountType === 'family' ? currentUserId : null
    const monthMap: Record<string, Record<string, number>> = {}

    for (const log of shoppingLogs) {
      if (adminId && log.user_id === adminId) continue
      const month = log.log_date.slice(0, 7)
      monthMap[month] ??= {}
      monthMap[month][log.user_id] = (monthMap[month][log.user_id] ?? 0) + log.points
    }

    return Object.keys(monthMap).sort().reverse().slice(0, 6).map(month => {
      const byMember = monthMap[month]
      const sorted = Object.entries(byMember).sort((a, b) => b[1] - a[1])
      const max = sorted[0]?.[1] ?? 1
      return {
        month,
        label: format(parseISO(`${month}-01`), 'MMMM yyyy'),
        winner: sorted[0]?.[0] ?? null,
        max,
        sorted,
      }
    })
  }, [shoppingLogs, accountType, currentUserId])

  if (householdLoading) return <Spinner />

  const unchecked = items.filter(i => !i.checked)
  const checked   = items.filter(i => i.checked)

  return (
    <div className="max-w-lg mx-auto px-4 md:px-6 py-8 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">Shopping List</h1>
          {!loading && items.length > 0 && (
            <span className="text-xs text-gray-400 font-normal">{unchecked.length} left</span>
          )}
        </div>
        {!isReadOnly && checked.length > 0 && (
          <button onClick={clearChecked} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
            Clear done ({checked.length})
          </button>
        )}
      </div>

      {/* Add form */}
      {!isReadOnly && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add an item…"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addItem()}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <button
              onClick={addItem}
              disabled={!title.trim() || adding}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  category === cat
                    ? CAT_COLORS[cat] + ' ring-2 ring-offset-1 ring-current'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 -mt-2">
        +{PTS_ADD} pts for adding · +{PTS_CHECK} pts for checking off
      </p>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Your list is empty. Add something above.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {unchecked.map(item => (
            <ItemRow key={item.id} item={item} onToggle={toggleItem} onDelete={deleteItem} readOnly={isReadOnly} />
          ))}
          {unchecked.length > 0 && checked.length > 0 && (
            <div className="border-t border-gray-100 pt-1" />
          )}
          {checked.map(item => (
            <ItemRow key={item.id} item={item} onToggle={toggleItem} onDelete={deleteItem} readOnly={isReadOnly} />
          ))}
        </div>
      )}

      {/* My Monthly Points */}
      {myShoppingChart.some(d => d.points > 0) && (
        <section className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-green-500" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">My Monthly Points</h2>
          </div>
          <MonthlyPointsChart data={myShoppingChart} color="#22c55e" />
        </section>
      )}

      {/* Monthly Leaderboard */}
      {leaderboard.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-4 w-4 text-amber-500" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Monthly Leaderboard</h2>
          </div>
          <div className="space-y-3">
            {leaderboard.map(({ month, label, winner, max, sorted }) => (
              <div key={month} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">{label}</span>
                  {winner && (
                    <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-0.5 rounded-full">
                      👑 {memberName(winner)}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {sorted.map(([userId, pts]) => (
                    <div key={userId} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-16 truncate flex-shrink-0">
                        {memberName(userId)}
                      </span>
                      <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${(pts / max) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-700 w-14 text-right flex-shrink-0">
                        {pts} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function ItemRow({
  item, onToggle, onDelete, readOnly,
}: {
  item: ShoppingItem
  onToggle: (item: ShoppingItem) => void
  onDelete: (id: string) => void
  readOnly?: boolean
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
      item.checked ? 'bg-gray-50' : 'bg-white border border-gray-100 shadow-sm'
    }`}>
      <button
        onClick={() => !readOnly && onToggle(item)}
        disabled={readOnly}
        className={`h-5 w-5 rounded-full flex-shrink-0 border-2 flex items-center justify-center transition-colors disabled:cursor-default ${
          item.checked ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-blue-400 disabled:hover:border-gray-300'
        }`}
      >
        {item.checked && <span className="text-white text-[10px] font-bold">✓</span>}
      </button>
      <span className={`flex-1 text-sm ${item.checked ? 'line-through text-gray-400' : 'text-gray-800'}`}>
        {item.title}
      </span>
      <span className={`hidden sm:inline text-xs px-2 py-0.5 rounded-full font-medium ${CAT_COLORS[item.category as Category]} ${item.checked ? 'opacity-40' : ''}`}>
        {item.category}
      </span>
      {!readOnly && (
        <button
          onClick={() => onDelete(item.id)}
          className="p-1 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
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
