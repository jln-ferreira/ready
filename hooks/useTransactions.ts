'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Transaction, TransactionFormData } from '@/types'

interface UseTransactionsOptions {
  householdId?: string
  year?: number
  month?: number
}

export function useTransactions(options: UseTransactionsOptions = {}) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    // Wait for household to be available before fetching
    if (!options.householdId) {
      setTransactions([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('transactions')
        .select(`
          *,
          account:accounts(*),
          category:categories(*),
          gst_entry:gst_entries(*),
          income_detail:income_details(*)
        `)
        .order('date', { ascending: false })

      if (options.householdId) {
        query = query.eq('household_id', options.householdId)
      }

      if (options.year) {
        query = query
          .gte('date', `${options.year}-01-01`)
          .lte('date', `${options.year}-12-31`)
      }

      if (options.month && options.year) {
        const pad = String(options.month).padStart(2, '0')
        const lastDay = new Date(options.year, options.month, 0).getDate()
        query = query
          .gte('date', `${options.year}-${pad}-01`)
          .lte('date', `${options.year}-${pad}-${lastDay}`)
      }

      const { data, error: err } = await query
      if (err) throw err
      setTransactions((data as Transaction[]) ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }, [options.householdId, options.year, options.month]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch()
  }, [fetch])

  const addTransaction = async (
    form: TransactionFormData,
    householdId: string
  ): Promise<{ error: string | null }> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: tx, error: txErr } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          household_id: householdId,
          account_id: form.account_id || null,
          date: form.date,
          amount: parseFloat(form.amount),
          type: form.type,
          category_id: form.category_id || null,
          description: form.description || null,
        })
        .select()
        .single()

      if (txErr) throw txErr

      if (form.has_gst && parseFloat(form.gst_amount) > 0) {
        const { error: gstErr } = await supabase.from('gst_entries').insert({
          transaction_id: tx.id,
          gst_amount: parseFloat(form.gst_amount),
          gst_type: form.gst_type,
        })
        if (gstErr) throw gstErr
      }

      if (form.type === 'income' && form.is_income_detail) {
        const { error: incErr } = await supabase.from('income_details').insert({
          transaction_id: tx.id,
          income_type: form.income_type,
          dividend_type: form.income_type === 'dividend' ? form.dividend_type : null,
        })
        if (incErr) throw incErr
      }

      await fetch()
      return { error: null }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add transaction'
      return { error: msg }
    }
  }

  const updateTransaction = async (
    id: string,
    form: TransactionFormData
  ): Promise<{ error: string | null }> => {
    try {
      const { error: txErr } = await supabase
        .from('transactions')
        .update({
          date: form.date,
          amount: parseFloat(form.amount),
          type: form.type,
          account_id: form.account_id || null,
          category_id: form.category_id || null,
          description: form.description || null,
        })
        .eq('id', id)
      if (txErr) throw txErr

      // GST — upsert or delete
      if (form.has_gst && parseFloat(form.gst_amount) > 0) {
        const { error: gstErr } = await supabase.from('gst_entries').upsert(
          { transaction_id: id, gst_amount: parseFloat(form.gst_amount), gst_type: form.gst_type },
          { onConflict: 'transaction_id' }
        )
        if (gstErr) throw gstErr
      } else {
        await supabase.from('gst_entries').delete().eq('transaction_id', id)
      }

      // Income detail — upsert or delete
      if (form.type === 'income' && form.is_income_detail) {
        const { error: incErr } = await supabase.from('income_details').upsert(
          {
            transaction_id: id,
            income_type: form.income_type,
            dividend_type: form.income_type === 'dividend' ? form.dividend_type : null,
          },
          { onConflict: 'transaction_id' }
        )
        if (incErr) throw incErr
      } else {
        await supabase.from('income_details').delete().eq('transaction_id', id)
      }

      await fetch()
      return { error: null }
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Failed to update transaction' }
    }
  }

  const deleteTransaction = async (id: string): Promise<{ error: string | null }> => {
    try {
      const { error: err } = await supabase.from('transactions').delete().eq('id', id)
      if (err) throw err
      await fetch()
      return { error: null }
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Failed to delete' }
    }
  }

  return { transactions, loading, error, refetch: fetch, addTransaction, updateTransaction, deleteTransaction }
}
