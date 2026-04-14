'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AppLogo } from '@/components/AppLogo'

export default function SignupPage() {
  const searchParams = useSearchParams()
  const inviteCode = searchParams.get('invite') ?? ''

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const isJoining = inviteCode.length > 0

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
        data: isJoining
          ? { invite_code: inviteCode.toUpperCase() }
          : { household_name: householdName || 'My Household' },
      },
    })

    if (err) {
      setError(err.message)
    } else {
      setDone(true)
    }
    setLoading(false)
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Check your email</h2>
          <p className="mt-2 text-sm text-gray-500">
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your
            account, then{' '}
            <Link href="/auth/login" className="text-blue-600 hover:underline">
              sign in
            </Link>
            .
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex items-center gap-2">
            <AppLogo size={32} />
            <span className="text-2xl font-bold text-gray-900">Ready</span>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="mb-1 text-lg font-semibold text-gray-900">
            {isJoining ? 'Join your family' : 'Create your account'}
          </h1>
          {isJoining && (
            <p className="mb-5 text-sm text-gray-500">
              You&apos;re joining via invite code{' '}
              <span className="font-mono font-semibold text-gray-700">{inviteCode.toUpperCase()}</span>
            </p>
          )}

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            {!isJoining && (
              <div>
                <label className="block text-xs font-medium text-gray-700">Family Name</label>
                <input
                  type="text"
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. The Ferreira Family"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-700">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Password</label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Min. 8 characters"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {loading
                ? isJoining ? 'Joining…' : 'Creating account…'
                : isJoining ? 'Join Family' : 'Create Account'}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-gray-500">
            Already have an account?{' '}
            <Link href="/auth/login" className="font-medium text-blue-600 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
