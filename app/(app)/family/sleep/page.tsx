'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { format, addDays, subDays, parseISO, differenceInMinutes, isToday } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useHousehold } from '@/hooks/useHousehold'
import { Moon, Sun, Plus, ChevronLeft, ChevronRight, BarChart2 } from 'lucide-react'
import { KidModal, DeleteKidConfirm, kidColor, kidInitials, calcAge } from '@/components/KidModal'
import type { Kid } from '@/components/KidModal'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SleepLog {
  id:         string
  kid_id:     string
  started_at: string
  ended_at:   string | null
  sleep_type: 'soneca' | 'sono_noturno'
  log_date:   string
}

interface KidSleepState {
  logs:   SleepLog[]
  acting: boolean
  error:  string | null
}

interface DayData {
  date:         string
  total_mins:   number
  soneca_mins:  number
  noturno_mins: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() { return format(new Date(), 'yyyy-MM-dd') }

function fmtMins(mins: number): string {
  if (mins <= 0) return '0min'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

function formatElapsed(startedAt: string) {
  return fmtMins(Math.max(0, differenceInMinutes(new Date(), new Date(startedAt))))
}

function calcLogDuration(log: { started_at: string; ended_at: string | null }): number {
  const end = log.ended_at ? new Date(log.ended_at) : new Date()
  return Math.max(0, differenceInMinutes(end, new Date(log.started_at)))
}

function sleepSummary(logs: SleepLog[], date: string) {
  const dayStart = new Date(date + 'T00:00:00')
  const dayEnd   = new Date(date + 'T23:59:59')
  const now      = new Date()
  let soneca = 0, noturno = 0

  for (const log of logs) {
    const s0 = new Date(log.started_at)
    const e0 = log.ended_at ? new Date(log.ended_at) : (isToday(dayStart) ? now : dayEnd)
    const s  = s0 < dayStart ? dayStart : s0
    const e  = e0 > dayEnd   ? dayEnd   : e0
    if (e <= s) continue
    const m = differenceInMinutes(e, s)
    if (log.sleep_type === 'soneca') soneca += m; else noturno += m
  }
  return { soneca, noturno, total: soneca + noturno }
}

// ── 24-hour timeline ──────────────────────────────────────────────────────────

interface Pill { id: string; leftPct: number; widthPct: number; type: 'soneca'|'sono_noturno'; active: boolean }

function SleepTimeline({ logs, date, goalMins }: { logs: SleepLog[]; date: string; goalMins: number }) {
  const [, setTick] = useState(0)
  const timerRef   = useRef<ReturnType<typeof setInterval>|null>(null)
  const hasActive  = logs.some(l => !l.ended_at)

  useEffect(() => {
    if (!hasActive) return
    timerRef.current = setInterval(() => setTick(t => t + 1), 60_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [hasActive])

  const TOTAL = 24 * 60
  const dStart = new Date(date + 'T00:00:00')
  const dEnd   = new Date(date + 'T23:59:59')
  const now    = new Date()

  const pills: Pill[] = logs.flatMap(log => {
    const s0 = new Date(log.started_at)
    const e0 = log.ended_at ? new Date(log.ended_at) : (isToday(dStart) ? now : dEnd)
    const s  = s0 < dStart ? dStart : s0
    const e  = e0 > dEnd   ? dEnd   : e0
    if (e <= s) return []
    return [{
      id:       log.id,
      leftPct:  (differenceInMinutes(s, dStart) / TOTAL) * 100,
      widthPct: Math.max((differenceInMinutes(e, s) / TOTAL) * 100, 0.5),
      type:     log.sleep_type,
      active:   !log.ended_at,
    }]
  })

  const { total } = sleepSummary(logs, date)
  const goalPct   = goalMins > 0 ? Math.min(100, Math.round((total / goalMins) * 100)) : 0

  return (
    <div className="space-y-2">
      {/* Scrollable 24h bar */}
      <div className="overflow-x-auto -mx-1 pb-0.5">
        <div style={{ minWidth: 480 }}>
          <div className="flex mb-1">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="flex-1 text-center text-[8px] leading-none text-gray-400 tabular-nums">
                {String(h).padStart(2, '0')}
              </div>
            ))}
          </div>
          <div className="relative h-6 bg-gray-100 rounded-lg overflow-hidden">
            {Array.from({ length: 23 }, (_, i) => i + 1).map(h => (
              <div key={h} className="absolute top-0 bottom-0 w-px bg-white/60" style={{ left: `${(h / 24) * 100}%` }} />
            ))}
            {pills.map(p => (
              <div
                key={p.id}
                className={`absolute top-0 bottom-0 transition-all duration-300 ${p.type === 'soneca' ? 'bg-amber-400' : 'bg-blue-500'}`}
                style={{ left: `${p.leftPct}%`, width: `${p.widthPct}%`, opacity: p.active ? 1 : 0.85 }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Goal progress + sleep summary */}
      {total > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${goalPct >= 100 ? 'bg-green-400' : 'bg-blue-400'}`}
                style={{ width: `${goalPct}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-400 tabular-nums flex-shrink-0">
              {fmtMins(total)} / {fmtMins(goalMins)} ({goalPct}%)
            </span>
          </div>
          {/* Per-type breakdown */}
          <div className="flex gap-3 text-[10px] text-gray-400">
            {logs.some(l => l.sleep_type === 'sono_noturno') && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 inline-block" />
                Noturno: {fmtMins(sleepSummary(logs, date).noturno)}
              </span>
            )}
            {logs.some(l => l.sleep_type === 'soneca') && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 inline-block" />
                Soneca: {fmtMins(sleepSummary(logs, date).soneca)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── SVG Line Chart ────────────────────────────────────────────────────────────

function SleepLineChart({ data, goalMins, color }: { data: DayData[]; goalMins: number; color: string }) {
  if (data.length < 2) return <p className="text-xs text-gray-400 text-center py-4">Dados insuficientes.</p>

  const W = 500, H = 150
  const PAD = { t: 14, r: 12, b: 28, l: 34 }
  const cW  = W - PAD.l - PAD.r
  const cH  = H - PAD.t - PAD.b

  const maxMins = Math.max(goalMins, ...data.map(d => d.total_mins), 60)
  const maxH    = Math.ceil(maxMins / 60) + 1

  const xp = (i: number) => PAD.l + (i / (data.length - 1)) * cW
  const yp = (m: number) => PAD.t + (1 - m / (maxH * 60)) * cH

  const path = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${xp(i).toFixed(1)},${yp(v).toFixed(1)}`).join(' ')

  // Y ticks: ~4 evenly spaced
  const step = Math.max(1, Math.ceil(maxH / 4))
  const yTicks = Array.from({ length: Math.ceil(maxH / step) + 1 }, (_, i) => i * step).filter(h => h <= maxH)

  // X labels: show every Nth to avoid crowding
  const xStep = data.length <= 7 ? 1 : data.length <= 14 ? 2 : 5

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 280, width: '100%', display: 'block' }}>
        {/* Grid + Y axis labels */}
        {yTicks.map(h => (
          <g key={h}>
            <line x1={PAD.l} x2={W - PAD.r} y1={yp(h * 60)} y2={yp(h * 60)} stroke="#f1f5f9" strokeWidth={1} />
            <text x={PAD.l - 4} y={yp(h * 60)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#94a3b8">
              {h}h
            </text>
          </g>
        ))}

        {/* Goal line */}
        <line x1={PAD.l} x2={W - PAD.r} y1={yp(goalMins)} y2={yp(goalMins)}
          stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5,4" />
        <text x={W - PAD.r + 2} y={yp(goalMins)} dominantBaseline="middle" fontSize={9} fill="#94a3b8">Meta</text>

        {/* Sono Noturno line */}
        {data.some(d => d.noturno_mins > 0) && (
          <path d={path(data.map(d => d.noturno_mins))} fill="none" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4,2" strokeLinejoin="round" />
        )}

        {/* Soneca line */}
        {data.some(d => d.soneca_mins > 0) && (
          <path d={path(data.map(d => d.soneca_mins))} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4,2" strokeLinejoin="round" />
        )}

        {/* Total line */}
        <path d={path(data.map(d => d.total_mins))} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />

        {/* Dots on total */}
        {data.map((d, i) => (
          <circle key={d.date} cx={xp(i)} cy={yp(d.total_mins)} r={3} fill={color} />
        ))}

        {/* X labels */}
        {data.map((d, i) => {
          if (i % xStep !== 0 && i !== data.length - 1) return null
          return (
            <text key={d.date} x={xp(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="#94a3b8">
              {format(parseISO(d.date), 'd/M')}
            </text>
          )
        })}

        {/* Axes */}
        <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={H - PAD.b} stroke="#e2e8f0" strokeWidth={1} />
        <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="#e2e8f0" strokeWidth={1} />
      </svg>
    </div>
  )
}

// ── Kid Card ──────────────────────────────────────────────────────────────────

interface KidCardProps {
  kid: Kid; state: KidSleepState; date: string
  onStart: (id: string, type: 'soneca'|'sono_noturno') => void
  onStop:  (id: string) => void
  onEdit:  (k: Kid) => void
  onDelete:(k: Kid) => void
}

function KidCard({ kid, state, date, onStart, onStop, onEdit, onDelete }: KidCardProps) {
  const color     = kidColor(kid.id)
  const activeLog = state.logs.find(l => !l.ended_at) ?? null

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ backgroundColor: color }}>
          {kidInitials(kid.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{kid.name}</p>
          {calcAge(kid.date_of_birth) && <p className="text-xs text-gray-400">{calcAge(kid.date_of_birth)}</p>}
        </div>
        {activeLog && (
          <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-full flex-shrink-0 tabular-nums">
            {formatElapsed(activeLog.started_at)}
          </span>
        )}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button onClick={() => onEdit(kid)} className="p-1.5 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-colors">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </button>
          <button onClick={() => onDelete(kid)} className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </div>

      <SleepTimeline logs={state.logs} date={date} goalMins={kid.daily_sleep_goal_min} />

      {state.error && (
        <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-1.5">{state.error}</p>
      )}

      <div className="flex items-center gap-2">
        {activeLog ? (
          <>
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              {activeLog.sleep_type === 'sono_noturno'
                ? <Moon className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                : <Sun  className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
              }
              <span className="text-xs text-gray-400 truncate">
                {activeLog.sleep_type === 'sono_noturno' ? 'Sono Noturno' : 'Soneca'} desde {format(new Date(activeLog.started_at), 'HH:mm')}
              </span>
            </div>
            <button onClick={() => onStop(kid.id)} disabled={state.acting}
              className="px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 active:scale-95 transition-all disabled:opacity-50 flex-shrink-0">
              {state.acting ? '…' : 'Acordou'}
            </button>
          </>
        ) : (
          <>
            <button onClick={() => onStart(kid.id, 'sono_noturno')} disabled={state.acting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-60">
              <Moon className="h-3.5 w-3.5" />
              {state.acting ? 'Salvando…' : 'Sono Noturno'}
            </button>
            <button onClick={() => onStart(kid.id, 'soneca')} disabled={state.acting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 active:scale-95 transition-all disabled:opacity-60">
              <Sun className="h-3.5 w-3.5" />
              {state.acting ? 'Salvando…' : 'Soneca'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Report section ────────────────────────────────────────────────────────────

function ReportSection({ kids, reportData, reportRange, setReportRange, loading }: {
  kids:           Kid[]
  reportData:     Record<string, DayData[]>
  reportRange:    7 | 14 | 30
  setReportRange: (r: 7 | 14 | 30) => void
  loading:        boolean
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700">Relatório de Sono</h2>
        </div>
        <div className="flex gap-1">
          {([7, 14, 30] as const).map(r => (
            <button key={r} onClick={() => setReportRange(r)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${reportRange === r ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
              {r}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-5 w-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {kids.map(kid => {
            const data  = reportData[kid.id] ?? []
            const color = kidColor(kid.id)
            const avg   = data.length > 0 ? Math.round(data.reduce((a, d) => a + d.total_mins, 0) / data.filter(d => d.total_mins > 0).length || 0) : 0
            const days  = data.filter(d => d.total_mins > 0).length

            return (
              <div key={kid.id} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3 shadow-sm">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: color }}>
                    {kidInitials(kid.name)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{kid.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Média</p>
                    <p className="text-sm font-semibold tabular-nums" style={{ color }}>{fmtMins(avg)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Dias</p>
                    <p className="text-sm font-semibold text-gray-700 tabular-nums">{days}/{reportRange}</p>
                  </div>
                </div>

                {/* Chart */}
                <SleepLineChart data={data} goalMins={kid.daily_sleep_goal_min} color={color} />

                {/* Legend */}
                <div className="flex flex-wrap gap-3 text-[10px] text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <svg width="16" height="6"><line x1="0" y1="3" x2="16" y2="3" stroke={color} strokeWidth="2.5" /></svg>
                    Total
                  </span>
                  <span className="flex items-center gap-1.5">
                    <svg width="16" height="6"><line x1="0" y1="3" x2="16" y2="3" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="4,2" /></svg>
                    Sono Noturno
                  </span>
                  <span className="flex items-center gap-1.5">
                    <svg width="16" height="6"><line x1="0" y1="3" x2="16" y2="3" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4,2" /></svg>
                    Soneca
                  </span>
                  <span className="flex items-center gap-1.5">
                    <svg width="16" height="6"><line x1="0" y1="3" x2="16" y2="3" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="5,4" /></svg>
                    Meta ({fmtMins(kid.daily_sleep_goal_min)})
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SleepTrackerPage() {
  const { household, loading: hhLoading } = useHousehold()
  const supabase = createClient()

  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [kids,         setKids]         = useState<Kid[]>([])
  const [kidsLoading,  setKidsLoading]  = useState(true)
  const [sleepStates,  setSleepStates]  = useState<Record<string, KidSleepState>>({})

  const [reportRange,   setReportRange]   = useState<7|14|30>(14)
  const [reportData,    setReportData]    = useState<Record<string, DayData[]>>({})
  const [reportLoading, setReportLoading] = useState(false)

  const [kidModal,     setKidModal]     = useState<Partial<Kid>|null>(null)
  const [modalSaving,  setModalSaving]  = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Kid|null>(null)
  const [deleting,     setDeleting]     = useState(false)

  const isTodaySelected = selectedDate === todayStr()

  // ── Load kids ──────────────────────────────────────────────────────────────
  const loadKids = useCallback(async () => {
    if (!household) return
    setKidsLoading(true)
    const { data } = await supabase.from('kids').select('*').eq('household_id', household.id).order('created_at', { ascending: true })
    setKids((data ?? []) as Kid[])
    setKidsLoading(false)
  }, [household]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load today's sleep logs (two simple queries) ───────────────────────────
  const loadSleep = useCallback(async (date: string, kidList: Kid[]) => {
    if (!kidList.length) return
    const ids = kidList.map(k => k.id)

    const [{ data: dayData }, { data: activeData }] = await Promise.all([
      supabase.from('sleep_logs').select('id,kid_id,started_at,ended_at,sleep_type,log_date')
        .in('kid_id', ids).eq('log_date', date).order('started_at', { ascending: true }),
      supabase.from('sleep_logs').select('id,kid_id,started_at,ended_at,sleep_type,log_date')
        .in('kid_id', ids).is('ended_at', null).neq('log_date', date),
    ])

    const seen = new Set<string>()
    const merged: SleepLog[] = []
    for (const l of [...(dayData ?? []), ...(activeData ?? [])] as SleepLog[]) {
      if (!seen.has(l.id)) { seen.add(l.id); merged.push(l) }
    }
    merged.sort((a, b) => a.started_at.localeCompare(b.started_at))

    const grouped: Record<string, SleepLog[]> = {}
    for (const k of kidList) grouped[k.id] = []
    for (const l of merged) grouped[l.kid_id]?.push(l)

    setSleepStates(prev => {
      const next = { ...prev }
      for (const k of kidList) {
        next[k.id] = { logs: grouped[k.id] ?? [], acting: prev[k.id]?.acting ?? false, error: prev[k.id]?.error ?? null }
      }
      return next
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load report data ───────────────────────────────────────────────────────
  const loadReport = useCallback(async (days: number, kidList: Kid[]) => {
    if (!kidList.length) return
    setReportLoading(true)
    const from = format(subDays(new Date(), days - 1), 'yyyy-MM-dd')

    const { data } = await supabase
      .from('sleep_logs')
      .select('kid_id, log_date, started_at, ended_at, sleep_type')
      .in('kid_id', kidList.map(k => k.id))
      .gte('log_date', from)
      .order('log_date', { ascending: true })

    const dates = Array.from({ length: days }, (_, i) => format(subDays(new Date(), days - 1 - i), 'yyyy-MM-dd'))
    const result: Record<string, DayData[]> = {}

    for (const kid of kidList) {
      const kidLogs = ((data ?? []) as SleepLog[]).filter(l => l.kid_id === kid.id)
      result[kid.id] = dates.map(date => {
        const dl      = kidLogs.filter(l => l.log_date === date)
        const total   = dl.reduce((a, l) => a + calcLogDuration(l), 0)
        const soneca  = dl.filter(l => l.sleep_type === 'soneca').reduce((a, l) => a + calcLogDuration(l), 0)
        const noturno = dl.filter(l => l.sleep_type === 'sono_noturno').reduce((a, l) => a + calcLogDuration(l), 0)
        return { date, total_mins: total, soneca_mins: soneca, noturno_mins: noturno }
      })
    }

    setReportData(result)
    setReportLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadKids() }, [loadKids])
  useEffect(() => { if (kids.length) { loadSleep(selectedDate, kids); loadReport(reportRange, kids) } }, [selectedDate, kids]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (kids.length) loadReport(reportRange, kids) }, [reportRange]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start sleep ────────────────────────────────────────────────────────────
  const handleStart = useCallback(async (kidId: string, type: 'soneca'|'sono_noturno') => {
    if (!household) return
    const prev = sleepStates[kidId]
    const opt: SleepLog = { id: 'opt-' + Date.now(), kid_id: kidId, started_at: new Date().toISOString(), ended_at: null, sleep_type: type, log_date: todayStr() }

    setSleepStates(s => ({
      ...s,
      [kidId]: {
        logs:   [...(s[kidId]?.logs ?? []).map(l => l.ended_at === null ? { ...l, ended_at: new Date().toISOString() } : l), opt],
        acting: true, error: null,
      },
    }))

    try {
      const now = new Date().toISOString()
      const { data: { user } } = await supabase.auth.getUser()
      const { error: e1 } = await supabase.from('sleep_logs').update({ ended_at: now }).eq('kid_id', kidId).is('ended_at', null)
      if (e1) throw new Error(e1.message)
      const { error: e2 } = await supabase.from('sleep_logs').insert({ kid_id: kidId, household_id: household.id, started_at: now, sleep_type: type, log_date: todayStr(), created_by: user?.id ?? null })
      if (e2) throw new Error(e2.message)
      await loadSleep(selectedDate, kids)
    } catch (err) {
      setSleepStates(s => ({ ...s, [kidId]: { logs: prev?.logs ?? [], acting: false, error: (err as Error).message } }))
      return
    }
    setSleepStates(s => ({ ...s, [kidId]: { ...s[kidId], acting: false, error: null } }))
  }, [household, selectedDate, kids, sleepStates, loadSleep]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stop sleep ─────────────────────────────────────────────────────────────
  const handleStop = useCallback(async (kidId: string) => {
    const prev = sleepStates[kidId]
    const at   = new Date().toISOString()
    setSleepStates(s => ({ ...s, [kidId]: { logs: (s[kidId]?.logs ?? []).map(l => l.ended_at === null ? { ...l, ended_at: at } : l), acting: true, error: null } }))

    try {
      const { error } = await supabase.from('sleep_logs').update({ ended_at: at }).eq('kid_id', kidId).is('ended_at', null)
      if (error) throw new Error(error.message)
      await loadSleep(selectedDate, kids)
      await loadReport(reportRange, kids)
    } catch (err) {
      setSleepStates(s => ({ ...s, [kidId]: { logs: prev?.logs ?? [], acting: false, error: (err as Error).message } }))
      return
    }
    setSleepStates(s => ({ ...s, [kidId]: { ...s[kidId], acting: false, error: null } }))
  }, [sleepStates, selectedDate, kids, reportRange, loadSleep, loadReport]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save / Delete kid ──────────────────────────────────────────────────────
  const handleSaveKid = async (d: { name: string; date_of_birth: string|null; daily_sleep_goal_min: number }) => {
    if (!household) return
    setModalSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (kidModal?.id) await supabase.from('kids').update(d).eq('id', kidModal.id)
    else              await supabase.from('kids').insert({ ...d, household_id: household.id, created_by: user?.id ?? null })
    setKidModal(null); setModalSaving(false)
    await loadKids()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    await supabase.from('kids').delete().eq('id', deleteTarget.id)
    setDeleteTarget(null); setDeleting(false)
    await loadKids()
  }

  const goToPrev = () => setSelectedDate(d => format(addDays(parseISO(d), -1), 'yyyy-MM-dd'))
  const goToNext = () => { const n = format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'); if (n <= todayStr()) setSelectedDate(n) }

  if (hhLoading) return <Spinner />

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Moon className="h-5 w-5 text-blue-500" />
            <h1 className="text-xl font-semibold text-gray-900">Sono das Crianças</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              <button onClick={goToPrev} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={() => setSelectedDate(todayStr())}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${isTodaySelected ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                {isTodaySelected ? 'Hoje' : format(parseISO(selectedDate), 'd MMM')}
              </button>
              <button onClick={goToNext} disabled={isTodaySelected} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition-colors"><ChevronRight className="h-4 w-4" /></button>
            </div>
            <button onClick={() => setKidModal({})}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 active:scale-95 transition-all">
              <Plus className="h-3.5 w-3.5" /> Criança
            </button>
          </div>
        </div>

        {!isTodaySelected && <p className="text-sm text-gray-400 -mt-4">{format(parseISO(selectedDate), "EEEE, d 'de' MMMM")}</p>}

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1.5"><span className="w-4 h-2.5 rounded-full bg-blue-500 inline-block" /> Sono Noturno</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-2.5 rounded-full bg-amber-400 inline-block" /> Soneca</span>
        </div>

        {/* Kid cards */}
        {kidsLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : kids.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Moon className="h-12 w-12 mx-auto text-gray-200" />
            <div>
              <p className="text-sm font-medium text-gray-500">Nenhuma criança cadastrada</p>
              <p className="text-xs text-gray-400 mt-1">Adicione as crianças para rastrear o sono.</p>
            </div>
            <button onClick={() => setKidModal({})}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
              <Plus className="h-4 w-4" /> Adicionar criança
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {kids.map(kid => (
              <KidCard key={kid.id} kid={kid} state={sleepStates[kid.id] ?? { logs: [], acting: false, error: null }}
                date={selectedDate} onStart={handleStart} onStop={handleStop}
                onEdit={k => setKidModal(k)} onDelete={k => setDeleteTarget(k)} />
            ))}
          </div>
        )}

        {/* Divider */}
        {kids.length > 0 && <div className="border-t border-gray-100" />}

        {/* Report */}
        {kids.length > 0 && (
          <ReportSection kids={kids} reportData={reportData} reportRange={reportRange} setReportRange={setReportRange} loading={reportLoading} />
        )}
      </div>

      {kidModal !== null && (
        <KidModal initial={kidModal} onSave={handleSaveKid} onCancel={() => setKidModal(null)} saving={modalSaving} />
      )}
      {deleteTarget && (
        <DeleteKidConfirm kid={deleteTarget} onDelete={handleDelete} onCancel={() => setDeleteTarget(null)} deleting={deleting} />
      )}
    </>
  )
}

function Spinner() {
  return <div className="flex flex-1 items-center justify-center h-full py-16"><div className="h-6 w-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" /></div>
}
