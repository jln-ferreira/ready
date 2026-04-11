'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import CopyField from './CopyField'
import { formatCAD } from '@/utils/format'

interface Field {
  label: string
  value: number
  description?: string
}

interface TaxSectionProps {
  title: string
  subtitle?: string
  fields: Field[]
}

export default function TaxSection({ title, subtitle, fields }: TaxSectionProps) {
  const [allCopied, setAllCopied] = useState(false)

  const handleCopyAll = async () => {
    const text = fields
      .map((f) => `${f.label}: ${formatCAD(f.value)}`)
      .join('\n')
    await navigator.clipboard.writeText(text)
    setAllCopied(true)
    setTimeout(() => setAllCopied(false), 2000)
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
        </div>
        <button
          onClick={handleCopyAll}
          className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
        >
          {allCopied ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-500" />
              Copied All
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy All
            </>
          )}
        </button>
      </div>
      <div className="flex flex-col gap-2 p-4">
        {fields.map((f) => (
          <CopyField key={f.label} label={f.label} value={f.value} description={f.description} />
        ))}
      </div>
    </div>
  )
}
