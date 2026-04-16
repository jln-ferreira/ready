'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Household, Account, Category } from '@/types'

export function useHousehold() {
  const [household, setHousehold] = useState<Household | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Use the security-definer RPC to get the preferred household.
        // It prefers the shared family household over a personal one,
        // and can query across user_households rows (bypasses RLS).
        const { data: householdId, error: rpcErr } = await supabase
          .rpc('my_preferred_household_id')

        if (rpcErr || !householdId) {
          setError('No household found. Please contact support.')
          return
        }

        const { data: hh, error: hhErr } = await supabase
          .from('households')
          .select('*')
          .eq('id', householdId)
          .single()

        if (hhErr) throw hhErr
        setHousehold(hh)

        const [{ data: accts }, { data: cats }] = await Promise.all([
          supabase.from('accounts').select('*').eq('household_id', householdId),
          supabase.from('categories').select('*').order('name'),
        ])

        setAccounts(accts ?? [])
        setCategories(cats ?? [])
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load household')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { household, accounts, categories, loading, error }
}
