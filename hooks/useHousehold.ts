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

        // Get household via join table
        const { data: uh, error: uhErr } = await supabase
          .from('user_households')
          .select('household_id')
          .eq('user_id', user.id)
          .limit(1)
          .single()

        if (uhErr || !uh) {
          setError('No household found. Please contact support.')
          return
        }

        const { data: hh, error: hhErr } = await supabase
          .from('households')
          .select('*')
          .eq('id', uh.household_id)
          .single()

        if (hhErr) throw hhErr
        setHousehold(hh)

        const [{ data: accts }, { data: cats }] = await Promise.all([
          supabase.from('accounts').select('*').eq('household_id', uh.household_id),
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
