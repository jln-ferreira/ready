'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AppLogo } from '@/components/AppLogo'

export default function SignupPage() {
  const searchParams = useSearchParams()
  const inviteCode   = searchParams.get('invite') ?? ''

  // true  → joining an existing family via invite link (member account)
  // false → creating a new admin account
  const isJoining = inviteCode.length > 0

  // Admin account fields
  const [loginName, setLoginName] = useState('')

  // Member account fields
  const [email, setEmail] = useState('')
  const [pin,   setPin]   = useState('')

  // Shared
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  const router   = useRouter()
  const supabase = createClient()

  // ── Admin account creation ────────────────────────────────────
  const handleAdminSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res  = await fetch('/api/family/signup', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ loginName, password }),
      })

      let json: { error?: string } = {}
      try { json = await res.json() } catch { /* non-JSON */ }

      if (!res.ok) {
        setError(json.error ?? `Server error (${res.status}). Please try again.`)
        setLoading(false)
        return
      }

      // Auto sign-in after creation
      const sanitized = loginName.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '')
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email:    `family.${sanitized}@ready.app`,
        password,
      })

      if (signInErr) {
        setError('Account created — please sign in from the login page.')
        router.push('/auth/login')
      } else {
        router.push('/home')
        router.refresh()
      }
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    }

    setLoading(false)
  }

  // ── Member account creation (invite only) ────────────────────
  const handleMemberSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (pin && !/^\d{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits.')
      return
    }

    setLoading(true)

    try {
      const res  = await fetch('/api/member/signup', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password, inviteCode, pin: pin || undefined }),
      })

      let json: { error?: string } = {}
      try { json = await res.json() } catch { /* non-JSON */ }

      if (!res.ok) {
        setError(json.error ?? `Server error (${res.status}). Please try again.`)
        setLoading(false)
        return
      }

      // Auto sign-in (account is auto-confirmed server-side)
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr) {
        setError('Account created — please sign in from the login page.')
        router.push('/auth/login')
      } else {
        router.push('/home')
        router.refresh()
      }
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    }

    setLoading(false)
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
            {isJoining ? 'Join your family' : 'Create a Family Account'}
          </h1>

          {isJoining ? (
            <p className="mb-5 text-sm text-gray-500">
              Joining via invite code{' '}
              <span className="font-mono font-semibold text-gray-700">{inviteCode.toUpperCase()}</span>
            </p>
          ) : (
            <p className="mb-5 rounded-lg bg-purple-50 border border-purple-100 px-3 py-2.5 text-xs text-purple-700 leading-relaxed">
              This creates the shared family account. Once inside, generate invite links to add each family member.
            </p>
          )}

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* ── Admin signup form ── */}
          {!isJoining && (
            <form onSubmit={handleAdminSignup} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700">Family Login Name</label>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={loginName}
                  onChange={e => setLoginName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  placeholder="e.g. smiths or the-ferreiras"
                />
                <p className="mt-1 text-[11px] text-gray-400">
                  Letters, numbers, hyphens only. This is how you&apos;ll log in.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  placeholder="Min. 8 characters"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-purple-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
              >
                {loading ? 'Creating…' : 'Create Family Account'}
              </button>
            </form>
          )}

          {/* ── Member signup form (invite only) ── */}
          {isJoining && (
            <form onSubmit={handleMemberSignup} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
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
                  onChange={e => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Min. 8 characters"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  4-Digit PIN <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  autoComplete="off"
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm tracking-widest focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="••••"
                />
                <p className="mt-1 text-[11px] text-gray-400">
                  Used to switch to your account from the family view.
                </p>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Joining…' : 'Join Family'}
              </button>
            </form>
          )}

          <p className="mt-4 text-center text-xs text-gray-500">
            Already have an account?{' '}
            <Link href="/auth/login" className={`font-medium hover:underline ${isJoining ? 'text-blue-600' : 'text-purple-600'}`}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
