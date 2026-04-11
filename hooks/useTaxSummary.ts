'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TaxSummary, Transaction, GSTEntry, IncomeDetail } from '@/types'

export function useTaxSummary(householdId: string | undefined, year: number) {
  const [summary, setSummary] = useState<TaxSummary | null>(null)
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
        .select(`
          id, amount, type,
          account:accounts(type),
          gst_entry:gst_entries(*),
          income_detail:income_details(*)
        `)
        .eq('household_id', householdId)
        .gte('date', `${year}-01-01`)
        .lte('date', `${year}-12-31`)

      if (err) throw err

      // Business (T2125)
      let gross_income = 0
      let total_expenses = 0

      // Personal (T4 / T5 / other)
      let employment_income = 0
      let eligible_dividends_actual = 0
      let non_eligible_dividends_actual = 0
      let other_income = 0

      // GST (GST34)
      let gst_collected = 0
      let gst_paid = 0

      for (const raw of data ?? []) {
        const tx = raw as unknown as Transaction & {
          gst_entry: GSTEntry | null
          income_detail: IncomeDetail | null
        }

        const isBusiness = tx.account?.type === 'business'
        const id = tx.income_detail

        if (tx.type === 'income') {
          if (id) {
            // Classified income → T4 or T5 (account type doesn't matter)
            if (id.income_type === 'salary') {
              employment_income += tx.amount
            } else if (id.income_type === 'dividend') {
              if (id.dividend_type === 'eligible') {
                eligible_dividends_actual += tx.amount
              } else {
                non_eligible_dividends_actual += tx.amount
              }
            }
          } else if (isBusiness) {
            // Unclassified business revenue → T2125
            gross_income += tx.amount
          } else {
            // Unclassified personal income → Line 13000
            other_income += tx.amount
          }
        } else if (tx.type === 'expense') {
          if (isBusiness) total_expenses += tx.amount
        }

        const gst = tx.gst_entry
        if (gst) {
          if (gst.gst_type === 'collected') gst_collected += gst.gst_amount
          else gst_paid += gst.gst_amount
        }
      }

      // Dividend gross-up (CRA rules)
      const eligible_dividends_grossed = Math.round(eligible_dividends_actual * 1.38 * 100) / 100
      const non_eligible_dividends_grossed = Math.round(non_eligible_dividends_actual * 1.15 * 100) / 100
      const total_taxable_dividends = eligible_dividends_grossed + non_eligible_dividends_grossed

      const total_income = employment_income + total_taxable_dividends + other_income

      setSummary({
        year,
        personal: {
          employment_income,
          eligible_dividends_actual,
          eligible_dividends_grossed,
          non_eligible_dividends_actual,
          non_eligible_dividends_grossed,
          total_taxable_dividends,
          other_income,
          total_income,
        },
        business: {
          gross_income,
          total_expenses,
          net_income: gross_income - total_expenses,
        },
        gst: {
          gst_collected,
          gst_paid,
          net_gst_payable: gst_collected - gst_paid,
        },
        generated_at: new Date().toISOString(),
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to compute tax summary')
    } finally {
      setLoading(false)
    }
  }, [householdId, year]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch()
  }, [fetch])

  return { summary, loading, error, refetch: fetch }
}
