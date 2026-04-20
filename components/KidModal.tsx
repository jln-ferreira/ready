'use client'

import { useState } from 'react'
import { differenceInMonths, differenceInYears, parseISO } from 'date-fns'
import { X, Pencil, Trash2 } from 'lucide-react'
import { format } from 'date-fns'

export interface Kid {
  id:                   string
  household_id:         string
  name:                 string
  date_of_birth:        string | null
  daily_sleep_goal_min: number
  created_at:           string
}

export const KID_COLORS = [
  '#2563eb','#7c3aed','#16a34a','#e11d48','#ea580c','#0d9488','#d97706','#db2777',
]

export function kidColor(id: string): string {
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return KID_COLORS[hash % KID_COLORS.length]
}

export function kidInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

export function calcAge(dob: string | null): string | null {
  if (!dob) return null
  const months = differenceInMonths(new Date(), parseISO(dob))
  const years  = differenceInYears(new Date(), parseISO(dob))
  if (years === 0) return `${months} ${months === 1 ? 'mês' : 'meses'}`
  return `${years} ${years === 1 ? 'ano' : 'anos'}`
}

const GOAL_OPTIONS = [8, 9, 10, 11, 12, 13, 14, 15, 16].map(h => ({
  label: `${h}h`,
  value: h * 60,
}))

function todayStr() { return format(new Date(), 'yyyy-MM-dd') }

// ── Add / Edit modal ──────────────────────────────────────────────────────────

interface KidModalProps {
  initial:  Partial<Kid> | null
  onSave:   (data: { name: string; date_of_birth: string | null; daily_sleep_goal_min: number }) => void
  onCancel: () => void
  saving:   boolean
}

export function KidModal({ initial, onSave, onCancel, saving }: KidModalProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [dob,  setDob]  = useState(initial?.date_of_birth ?? '')
  const [goal, setGoal] = useState(initial?.daily_sleep_goal_min ?? 660)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {initial?.id ? 'Editar criança' : 'Adicionar criança'}
          </h2>
          <button onClick={onCancel} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Nome</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nome da criança"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm placeholder:text-gray-400 focus:border-blue-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Data de nascimento</label>
            <input
              type="date"
              value={dob}
              onChange={e => setDob(e.target.value)}
              max={todayStr()}
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Meta de sono diário</label>
            <div className="grid grid-cols-5 gap-1.5">
              {GOAL_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setGoal(opt.value)}
                  className={`py-2 rounded-xl text-xs font-semibold transition-colors ${
                    goal === opt.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave({ name: name.trim(), date_of_birth: dob || null, daily_sleep_goal_min: goal })}
            disabled={!name.trim() || saving}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete confirm ────────────────────────────────────────────────────────────

interface DeleteConfirmProps {
  kid:      Kid
  onDelete: () => void
  onCancel: () => void
  deleting: boolean
}

export function DeleteKidConfirm({ kid, onDelete, onCancel, deleting }: DeleteConfirmProps) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-5 space-y-4">
        <p className="text-sm text-gray-700">
          Remover <strong>{kid.name}</strong>? O histórico de sono será apagado permanentemente.
        </p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={onDelete} disabled={deleting} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
            {deleting ? 'Removendo…' : 'Remover'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Kid row (reusable in lists) ───────────────────────────────────────────────

interface KidRowProps {
  kid:      Kid
  onEdit:   (kid: Kid) => void
  onDelete: (kid: Kid) => void
}

export function KidRow({ kid, onEdit, onDelete }: KidRowProps) {
  const color = kidColor(kid.id)
  const age   = calcAge(kid.date_of_birth)

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 bg-white">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        {kidInitials(kid.name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{kid.name}</p>
        {age && <p className="text-xs text-gray-400">{age}</p>}
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button
          onClick={() => onEdit(kid)}
          className="p-1.5 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onDelete(kid)}
          className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
