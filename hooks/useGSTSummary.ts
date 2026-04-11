'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { GSTSummary, GSTEntry, Transaction } from '@/types'

export function useGSTSummary(householdId: string | undefined, year: number) {
  const [summary, setSummary] = useState<GSTSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    if (!householdId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('transactions')
        .select('id, gst_entry:gst_entries(*)')
        .eq('household_id', householdId)
        .gte('date', `${year}-01-01`)
        .lte('date', `${year}-12-31`)

      if (err) throw err

      let gst_collected = 0
      let gst_paid = 0

      for (const tx of (data as unknown as (Transaction & { gst_entry: GSTEntry | null })[]) ?? []) {
        const entry = tx.gst_entry
        if (!entry) continue
        if (entry.gst_type === 'collected') {
          gst_collected += entry.gst_amount
        } else {
          gst_paid += entry.gst_amount
        }
      }

      setSummary({
        gst_collected,
        gst_paid,
        net_gst_payable: gst_collected - gst_paid,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load GST summary')
    } finally {
      setLoading(false)
    }
  }, [householdId, year]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch()
  }, [fetch])

  return { summary, loading, error, refetch: fetch }
}
