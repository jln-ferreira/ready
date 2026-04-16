'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { X, MapPin, Clock, RotateCcw, Pencil, Trash2, AlertCircle, Bell } from 'lucide-react'
import type { CalendarEvent, EventInput, EventReminder } from '@/types/calendar'
import { CATEGORIES, CATEGORY_COLORS, REMINDER_LABELS } from '@/types/calendar'

type ModalMode = 'view' | 'edit' | 'add'

interface Props {
  mode: ModalMode
  event?: CalendarEvent
  defaultDate?: Date
  onClose: () => void
  onSave: (input: EventInput) => Promise<{ error: string | null }>
  onDelete?: (id: string) => Promise<{ error: string | null }>
}

const blankForm = (date?: Date): EventInput => {
  const base = date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  return {
    title: '',
    description: null,
    start_datetime: `${base}T09:00:00`,
    end_datetime: `${base}T10:00:00`,
    all_day: false,
    location: null,
    category: 'Personal',
    recurrence: 'none',
    reminder: 'none',
  }
}

const eventToForm = (event: CalendarEvent): EventInput => ({
  title: event.title,
  description: event.description,
  start_datetime: event.start_datetime,
  end_datetime: event.end_datetime,
  all_day: event.all_day,
  location: event.location,
  category: event.category,
  recurrence: event.recurrence,
  reminder: event.reminder ?? 'none',
})

export function EventModal({ mode: initialMode, event, defaultDate, onClose, onSave, onDelete }: Props) {
  const [mode, setMode] = useState<ModalMode>(initialMode)
  const [form, setForm] = useState<EventInput>(event ? eventToForm(event) : blankForm(defaultDate))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (event) setForm(eventToForm(event))
  }, [event])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const set = <K extends keyof EventInput>(key: K, value: EventInput[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required'); return }
    if (!form.start_datetime) { setError('Start time is required'); return }
    if (!form.end_datetime) { setError('End time is required'); return }
    if (form.end_datetime < form.start_datetime) { setError('End must be after start'); return }

    setSaving(true)
    setError(null)
    const { error: err } = await onSave(form)
    if (err) { setError(err); setSaving(false); return }
    onClose()
  }

  const handleDelete = async () => {
    if (!event || !onDelete) return
    setDeleting(true)
    const { error: err } = await onDelete(event.id)
    if (err) { setError(err); setDeleting(false); return }
    onClose()
  }

  const datetimeToInput = (iso: string, allDay: boolean) =>
    allDay ? iso.slice(0, 10) : iso.slice(0, 16)

  const inputToDatetime = (val: string, allDay: boolean, isEnd: boolean) =>
    allDay ? `${val}T${isEnd ? '23:59:59' : '00:00:00'}` : `${val}:00`

  const colors = CATEGORY_COLORS[mode === 'view' && event ? event.category : form.category]

  const cardContent = (
    <>
      {/* Drag handle — mobile only */}
      <div className="sm:hidden flex justify-center pt-2.5 pb-0 flex-shrink-0">
        <div className="h-1 w-8 rounded-full bg-gray-200" />
      </div>

      {/* Header */}
      <div className={`px-5 pt-4 sm:pt-6 pb-3 flex-shrink-0 ${mode === 'view' ? `${colors.bg} rounded-t-3xl sm:rounded-t-2xl` : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {mode === 'view' && (
              <span className={`h-2.5 w-2.5 rounded-full ${colors.dot} flex-shrink-0 mt-0.5`} />
            )}
            <h2 className={`text-base sm:text-lg font-semibold truncate ${mode === 'view' ? colors.text : 'text-gray-900'}`}>
              {mode === 'add' ? 'New Event' : mode === 'edit' ? 'Edit Event' : event?.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-black/10 transition-colors flex-shrink-0"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        {mode === 'view' && event && (
          <p className={`mt-0.5 text-xs font-medium ${colors.text} opacity-75`}>{event.category}</p>
        )}
      </div>

      {/* Body */}
      <div className="px-5 pb-6 sm:pb-6 overflow-y-auto flex-1">

        {/* ── VIEW MODE ── */}
        {mode === 'view' && event && (
          <div className="space-y-4 mt-2">
            <div className="flex items-start gap-3 text-sm text-gray-700">
              <Clock className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p>{format(new Date(event.start_datetime), 'EEEE, MMMM d, yyyy')}</p>
                {event.all_day ? (
                  <p className="text-gray-400 text-xs mt-0.5">All day</p>
                ) : (
                  <p className="text-gray-400 text-xs mt-0.5">
                    {format(new Date(event.start_datetime), 'h:mm a')}
                    {' – '}
                    {format(new Date(event.end_datetime), 'h:mm a')}
                  </p>
                )}
              </div>
            </div>

            {event.location && (
              <div className="flex items-start gap-3 text-sm text-gray-700">
                <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <p>{event.location}</p>
              </div>
            )}

            {event.recurrence !== 'none' && (
              <div className="flex items-start gap-3 text-sm text-gray-700">
                <RotateCcw className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <p className="capitalize">Repeats {event.recurrence}</p>
              </div>
            )}

            {event.reminder && event.reminder !== 'none' && (
              <div className="flex items-start gap-3 text-sm text-gray-700">
                <Bell className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <p>Reminder: {REMINDER_LABELS[event.reminder]}</p>
              </div>
            )}

            {event.description && (
              <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 leading-relaxed whitespace-pre-wrap">
                {event.description}
              </p>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
            )}

            {confirmDelete ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-center gap-2 text-red-700 text-sm font-medium mb-3">
                  <AlertCircle className="h-4 w-4" />
                  Delete this event?
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setMode('edit')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── FORM MODE ── */}
        {(mode === 'add' || mode === 'edit') && (
          <div className="space-y-4 mt-2">
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={e => set('title', e.target.value)}
                placeholder="Event title"
                autoFocus
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.all_day}
                onChange={e => set('all_day', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">All day</span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Start *</label>
                <input
                  type={form.all_day ? 'date' : 'datetime-local'}
                  value={datetimeToInput(form.start_datetime, form.all_day)}
                  onChange={e => set('start_datetime', inputToDatetime(e.target.value, form.all_day, false))}
                  className="w-full rounded-xl border border-gray-200 px-2.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">End *</label>
                <input
                  type={form.all_day ? 'date' : 'datetime-local'}
                  value={datetimeToInput(form.end_datetime, form.all_day)}
                  onChange={e => set('end_datetime', inputToDatetime(e.target.value, form.all_day, true))}
                  className="w-full rounded-xl border border-gray-200 px-2.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Category</label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map(cat => {
                  const c = CATEGORY_COLORS[cat]
                  const selected = form.category === cat
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => set('category', cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        selected
                          ? `${c.bg} ${c.text} ring-2 ring-offset-1 ${c.dot.replace('bg-', 'ring-')}`
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {cat}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
              <input
                type="text"
                value={form.location ?? ''}
                onChange={e => set('location', e.target.value || null)}
                placeholder="Add location"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Repeat</label>
              <select
                value={form.recurrence}
                onChange={e => set('recurrence', e.target.value as EventInput['recurrence'])}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="none">Never</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Reminder</label>
              <select
                value={form.reminder}
                onChange={e => set('reminder', e.target.value as EventReminder)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="none">None</option>
                <option value="at_time">At time of event</option>
                <option value="1_day_before">1 day before</option>
                <option value="2_days_before">2 days before</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={form.description ?? ''}
                onChange={e => set('description', e.target.value || null)}
                placeholder="Add notes…"
                rows={3}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-3 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : mode === 'add' ? 'Add Event' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Mobile: bottom sheet */}
      <div className="absolute bottom-0 left-0 right-0 sm:hidden bg-white rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col">
        {cardContent}
      </div>

      {/* Desktop: centered modal */}
      <div className="hidden sm:flex absolute inset-0 items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
          {cardContent}
        </div>
      </div>
    </div>
  )
}
