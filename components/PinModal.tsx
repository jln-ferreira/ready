'use client'

import { useState, useEffect, useCallback } from 'react'
import { Delete, X } from 'lucide-react'

interface PinModalProps {
  memberName: string
  memberColor: string   // hex colour string e.g. '#2563eb'
  onSuccess: () => void
  onCancel: () => void
  /** Called with the entered PIN — should return true if correct */
  onVerify: (pin: string) => Promise<boolean>
}

const NUMPAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', 'back'],
]

export default function PinModal({ memberName, memberColor, onSuccess, onCancel, onVerify }: PinModalProps) {
  const [digits,  setDigits]  = useState<string[]>([])
  const [error,   setError]   = useState(false)
  const [loading, setLoading] = useState(false)

  const push = useCallback((d: string) => {
    if (loading) return
    setError(false)
    setDigits(prev => prev.length < 4 ? [...prev, d] : prev)
  }, [loading])

  const pop = useCallback(() => {
    if (loading) return
    setError(false)
    setDigits(prev => prev.slice(0, -1))
  }, [loading])

  // Verify as soon as 4 digits are entered
  useEffect(() => {
    if (digits.length !== 4) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const ok = await onVerify(digits.join(''))
      if (cancelled) return
      if (ok) {
        onSuccess()
      } else {
        setError(true)
        setDigits([])
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [digits, onVerify, onSuccess])

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') { push(e.key); return }
      if (e.key === 'Backspace' || e.key === 'Delete') { pop(); return }
      if (e.key === 'Escape') { onCancel() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [push, pop, onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-72 rounded-3xl bg-white shadow-2xl overflow-hidden">

        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="px-6 pt-8 pb-6 text-center">
          {/* Avatar circle */}
          <div
            className="mx-auto mb-3 h-14 w-14 rounded-full flex items-center justify-center text-xl font-bold text-white"
            style={{ backgroundColor: memberColor }}
          >
            {memberName.slice(0, 1).toUpperCase()}
          </div>
          <p className="text-sm font-semibold text-gray-900">{memberName}</p>
          <p className="mt-1 text-xs text-gray-400">Enter 4-digit PIN</p>
        </div>

        {/* PIN dots */}
        <div className="flex justify-center gap-4 pb-4">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`h-3 w-3 rounded-full transition-all duration-150 ${
                digits.length > i
                  ? error ? 'bg-red-500' : 'bg-gray-900'
                  : 'border-2 border-gray-300'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-center text-xs text-red-500 pb-2 -mt-2">
            Incorrect PIN. Try again.
          </p>
        )}

        {/* Numpad */}
        <div className="px-5 pb-8 grid grid-cols-3 gap-3">
          {NUMPAD.flat().map((key, i) => {
            if (key === '') return <div key={i} />

            if (key === 'back') {
              return (
                <button
                  key={i}
                  onClick={pop}
                  disabled={loading}
                  className="flex h-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 active:scale-95 disabled:opacity-40"
                >
                  <Delete className="h-5 w-5" />
                </button>
              )
            }

            return (
              <button
                key={i}
                onClick={() => push(key)}
                disabled={loading || digits.length === 4}
                className="flex h-14 items-center justify-center rounded-2xl bg-gray-100 text-xl font-semibold text-gray-900 transition-colors hover:bg-gray-200 active:scale-95 disabled:opacity-40"
              >
                {key}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
