import { formatCAD } from '@/utils/format'

interface StatCardProps {
  label: string
  amount: number
  colorClass?: string
  subtitle?: string
}

export default function StatCard({ label, amount, colorClass = 'text-gray-900', subtitle }: StatCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums sm:text-2xl ${colorClass}`}>
        {formatCAD(amount)}
      </p>
      {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
    </div>
  )
}
