'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AppLogo } from '@/components/AppLogo'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (err) {
      setError(err.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mb-8 flex flex-col items-center gap-2">
            <AppLogo size={32} />
            <span className="text-2xl font-bold text-gray-900">Ready</span>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <h1 className="text-lg font-semibold text-gray-900 mb-2">Check your email</h1>
            <p className="text-sm text-gray-500">
              We sent a password reset link to <strong>{email}</strong>.
              Check your inbox and spam folder.
            </p>
            <Link href="/auth/login" className="mt-6 block text-sm text-blue-600 hover:underline">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <AppLogo size={32} />
            <span className="text-2xl font-bold text-gray-900">Ready</span>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="mb-2 text-lg font-semibold text-gray-900">Reset your password</h1>
          <p className="mb-6 text-sm text-gray-500">Enter the email address on the account and we&apos;ll send a reset link.</p>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>

          <Link href="/auth/login" className="mt-4 block text-center text-sm text-gray-500 hover:text-gray-700">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
