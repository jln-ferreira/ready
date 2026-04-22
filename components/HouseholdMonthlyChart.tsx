'use client'

import { format, parseISO, subMonths } from 'date-fns'

export interface MemberMonthBar {
  userId: string
  name: string
  color: string
  points: number
}

export interface HouseholdMonth {
  month: string
  label: string
  bars: MemberMonthBar[]
  winnerId: string | null
}

const PALETTE = ['#2563eb', '#7c3aed', '#16a34a', '#e11d48', '#ea580c', '#0d9488', '#d97706', '#db2777']
const COLOR_HEX: Record<string, string> = {
  blue: '#2563eb', purple: '#7c3aed', green: '#16a34a', rose: '#e11d48',
  orange: '#ea580c', teal: '#0d9488', amber: '#d97706', pink: '#db2777',
}

export function buildHouseholdMonthlyPoints(
  logs: { date: string; userId: string; points: number }[],
  members: { userId: string; name: string; sidebar_color?: string }[],
  adminId: string | null = null,
  numMonths = 6,
): HouseholdMonth[] {
  const activeMembers = members.filter(m => m.userId !== adminId)

  const months: string[] = []
  for (let i = numMonths - 1; i >= 0; i--) {
    months.push(format(subMonths(new Date(), i), 'yyyy-MM'))
  }

  return months.map(month => {
    const totals: Record<string, number> = {}
    for (const log of logs) {
      if (log.date.slice(0, 7) !== month) continue
      if (adminId && log.userId === adminId) continue
      totals[log.userId] = (totals[log.userId] ?? 0) + log.points
    }

    const bars: MemberMonthBar[] = activeMembers.map((m, i) => ({
      userId: m.userId,
      name: m.name,
      color: COLOR_HEX[m.sidebar_color ?? ''] ?? PALETTE[i % PALETTE.length],
      points: totals[m.userId] ?? 0,
    }))

    const maxPts = Math.max(...bars.map(b => b.points), 0)
    const winners = bars.filter(b => b.points === maxPts && maxPts > 0)
    const winnerId = winners.length === 1 ? winners[0].userId : null

    return {
      month,
      label: format(parseISO(`${month}-01`), 'MMM'),
      bars,
      winnerId,
    }
  })
}

const BAR_AREA_H = 60  // px reserved for bars
const CROWN_H    = 14  // px reserved above bars for crown

export default function HouseholdMonthlyChart({ data }: { data: HouseholdMonth[] }) {
  const allPoints = data.flatMap(d => d.bars.map(b => b.points))
  const max = Math.max(...allPoints, 1)

  // Collect unique active members across all months for the legend
  const seenIds = new Set<string>()
  const legendMembers: { userId: string; name: string; color: string }[] = []
  for (const month of data) {
    for (const bar of month.bars) {
      if (!seenIds.has(bar.userId) && month.bars.some(b => b.userId === bar.userId)) {
        seenIds.add(bar.userId)
        legendMembers.push(bar)
      }
    }
  }

  return (
    <div className="space-y-2">
      {/* Bars */}
      <div className="flex gap-2">
        {data.map(({ month, label, bars, winnerId }) => (
          <div key={month} className="flex-1 flex flex-col items-center gap-1">
            {/* Bar group */}
            <div
              className="w-full flex items-end gap-0.5"
              style={{ height: `${BAR_AREA_H + CROWN_H}px` }}
            >
              {bars.map(bar => {
                const barH = bar.points > 0
                  ? Math.max(3, (bar.points / max) * BAR_AREA_H)
                  : 2
                const isWinner = bar.userId === winnerId

                return (
                  <div
                    key={bar.userId}
                    className="flex-1 flex flex-col items-center justify-end"
                    style={{ height: '100%' }}
                  >
                    {isWinner && (
                      <span
                        className="text-[10px] leading-none"
                        style={{ marginBottom: `${BAR_AREA_H - barH + 2}px` }}
                      >
                        👑
                      </span>
                    )}
                    <div
                      className="w-full rounded-t-sm"
                      style={{
                        height: `${barH}px`,
                        backgroundColor: bar.points > 0 ? bar.color : '#e5e7eb',
                        flexShrink: 0,
                      }}
                    />
                  </div>
                )
              })}
            </div>
            {/* Month label */}
            <span className="text-[9px] text-gray-400">{label}</span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
        {legendMembers.map(m => (
          <div key={m.userId} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
            <span className="text-[10px] text-gray-500">{m.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
