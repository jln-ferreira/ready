'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useHousehold } from '@/hooks/useHousehold'
import { ShoppingCart, Plus, Trash2 } from 'lucide-react'

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

export default function ShoppingPage() {
  const { household, loading: householdLoading } = useHousehold()
  const supabase = createClient()

  const [items, setItems] = useState<ShoppingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<Category>('Other')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!household) return
    load()
  }, [household]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('shopping_items')
      .select('*')
      .eq('household_id', household!.id)
      .order('checked', { ascending: true })
      .order('created_at', { ascending: false })
    setItems((data as ShoppingItem[]) ?? [])
    setLoading(false)
  }

  async function addItem() {
    if (!title.trim() || !household) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setAdding(true)
    const { data, error } = await supabase
      .from('shopping_items')
      .insert({ household_id: household.id, created_by: user.id, title: title.trim(), category })
      .select().single()
    if (!error && data) {
      setItems(prev => [data as ShoppingItem, ...prev])
      setTitle('')
    }
    setAdding(false)
  }

  async function toggleItem(item: ShoppingItem) {
    const { data: { user } } = await supabase.auth.getUser()
    const updates = item.checked
      ? { checked: false, checked_by: null, checked_at: null }
      : { checked: true, checked_by: user?.id ?? null, checked_at: new Date().toISOString() }
    const { data, error } = await supabase
      .from('shopping_items').update(updates).eq('id', item.id).select().single()
    if (!error && data) {
      setItems(prev =>
        [...prev.filter(i => i.id !== item.id), data as ShoppingItem].sort((a, b) => {
          if (a.checked !== b.checked) return a.checked ? 1 : -1
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
      )
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
  }

  if (householdLoading) return <Spinner />

  const unchecked = items.filter(i => !i.checked)
  const checked   = items.filter(i => i.checked)

  return (
    <div className="max-w-lg mx-auto px-4 md:px-6 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">Shopping List</h1>
          {!loading && items.length > 0 && (
            <span className="text-xs text-gray-400 font-normal">
              {unchecked.length} left
            </span>
          )}
        </div>
        {checked.length > 0 && (
          <button onClick={clearChecked} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
            Clear done ({checked.length})
          </button>
        )}
      </div>

      {/* Add form */}
      <div className="mb-6 space-y-2">
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
            <ItemRow key={item.id} item={item} onToggle={toggleItem} onDelete={deleteItem} />
          ))}
          {unchecked.length > 0 && checked.length > 0 && (
            <div className="border-t border-gray-100 pt-1" />
          )}
          {checked.map(item => (
            <ItemRow key={item.id} item={item} onToggle={toggleItem} onDelete={deleteItem} />
          ))}
        </div>
      )}
    </div>
  )
}

function ItemRow({
  item,
  onToggle,
  onDelete,
}: {
  item: ShoppingItem
  onToggle: (item: ShoppingItem) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
      item.checked ? 'bg-gray-50' : 'bg-white border border-gray-100 shadow-sm'
    }`}>
      <button
        onClick={() => onToggle(item)}
        className={`h-5 w-5 rounded-full flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
          item.checked ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-blue-400'
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
      <button
        onClick={() => onDelete(item.id)}
        className="p-1 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
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
