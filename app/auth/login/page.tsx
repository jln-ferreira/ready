'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AppLogo } from '@/components/AppLogo'
import { Users, User } from 'lucide-react'

type LoginMode = 'personal' | 'family'

/** Must match the server-side sanitize function in /api/family/signup/route.ts */
function deriveFamilyEmail(loginName: string): string {
  const sanitized = loginName.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '')
  return `family.${sanitized}@ready.app`
}

export default function LoginPage() {
  const [mode, setMode]           = useState<LoginMode>('personal')
  const [email, setEmail]         = useState('')
  const [loginName, setLoginName] = useState('')
  const [password, setPassword]   = useState('')
  const [error, setError]         = useState<string | null>(null)
  const [loading, setLoading]     = useState(false)

  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()
  const wasReset     = searchParams.get('reset') === '1'

  const switchMode = (m: LoginMode) => {
    setMode(m)
    setError(null)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const credential = mode === 'family' ? deriveFamilyEmail(loginName) : email

    if (mode === 'family' && !loginName.trim()) {
      setError('Enter your family login name.')
      setLoading(false)
      return
    }

    const { error: err } = await supabase.auth.signInWithPassword({
      email:    credential,
      password,
    })

    if (err) {
      setError(
        mode === 'family'
          ? 'Family login name or password is incorrect.'
          : err.message
      )
    } else {
      router.push('/home')
      router.refresh()
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

          {/* Mode tabs */}
          <div className="flex rounded-xl border border-gray-200 overflow-hidden mb-6">
            <button
              onClick={() => switchMode('personal')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                mode === 'personal'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <User className="h-4 w-4" />
              Personal
            </button>
            <button
              onClick={() => switchMode('family')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors border-l border-gray-200 ${
                mode === 'family'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Users className="h-4 w-4" />
              Family
            </button>
          </div>

          {mode === 'family' && (
            <p className="mb-5 rounded-lg bg-purple-50 border border-purple-100 px-3 py-2.5 text-xs text-purple-700 leading-relaxed">
              Shared account for everyone at home. Sign in once, then switch between family members without passwords.
            </p>
          )}

          {wasReset && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              Password updated. You can now sign in.
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {mode === 'personal' ? (
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
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-700">Family Login Name</label>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={loginName}
                  onChange={e => setLoginName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  placeholder="e.g. smiths"
                />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-700">Password</label>
                {mode === 'personal' && (
                  <Link href="/auth/forgot-password" className="text-xs text-blue-600 hover:underline">
                    Forgot password?
                  </Link>
                )}
              </div>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={`w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 ${
                  mode === 'family'
                    ? 'focus:border-purple-500 focus:ring-purple-500'
                    : 'focus:border-blue-500 focus:ring-blue-500'
                }`}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
                mode === 'family'
                  ? 'bg-purple-600 hover:bg-purple-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? 'Signing in…' : mode === 'family' ? 'Sign In as Family' : 'Sign In'}
            </button>
          </form>

          {mode === 'personal' && (
            <p className="mt-4 text-center text-xs text-gray-500">
              Don&apos;t have an account?{' '}
              <Link href="/auth/signup" className="font-medium text-blue-600 hover:underline">
                Sign up
              </Link>
            </p>
          )}

          {mode === 'family' && (
            <p className="mt-4 text-center text-xs text-gray-500">
              No family account yet?{' '}
              <Link href="/auth/signup" className="font-medium text-purple-600 hover:underline">
                Create one
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
