'use client'

import { format, parseISO, subMonths } from 'date-fns'

export interface MonthlyPoint {
  month: string  // 'yyyy-MM'
  points: number
}

/** Build a zero-filled array for the last N months from any log array. */
export function buildMonthlyPoints(
  logs: { date: string; points: number }[],
  months = 6,
): MonthlyPoint[] {
  const result: Record<string, number> = {}
  for (let i = months - 1; i >= 0; i--) {
    result[format(subMonths(new Date(), i), 'yyyy-MM')] = 0
  }
  for (const { date, points } of logs) {
    const m = date.slice(0, 7)
    if (m in result) result[m] += points
  }
  return Object.keys(result).sort().map(month => ({ month, points: result[month] }))
}

const BAR_MAX_H = 56  // px

export default function MonthlyPointsChart({
  data,
  color,
}: {
  data: MonthlyPoint[]
  color: string
}) {
  const max = Math.max(...data.map(d => d.points), 1)

  return (
    <div className="space-y-1">
      <div className="flex items-end gap-1.5" style={{ height: `${BAR_MAX_H + 18}px` }}>
        {data.map(({ month, points }) => (
          <div key={month} className="flex-1 flex flex-col items-center justify-end gap-0.5">
            {points > 0 && (
              <span className="text-[9px] font-semibold text-gray-500 leading-none">{points}</span>
            )}
            <div
              className="w-full rounded-t-sm transition-all"
              style={{
                height: points > 0
                  ? `${Math.max(4, (points / max) * BAR_MAX_H)}px`
                  : '2px',
                backgroundColor: points > 0 ? color : '#e5e7eb',
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        {data.map(({ month }) => (
          <div key={month} className="flex-1 text-center">
            <span className="text-[9px] text-gray-400">
              {format(parseISO(`${month}-01`), 'MMM')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
