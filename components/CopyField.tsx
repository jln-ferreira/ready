'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { formatCAD } from '@/utils/format'

interface CopyFieldProps {
  label: string
  value: number
  description?: string
}

export default function CopyField({ label, value, description }: CopyFieldProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value.toFixed(2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
        {description && <p className="text-xs text-gray-400">{description}</p>}
        <p className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900">
          {formatCAD(value)}
        </p>
      </div>
      <button
        onClick={handleCopy}
        className="ml-4 flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900"
        title="Copy value"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-green-500" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            Copy
          </>
        )}
      </button>
    </div>
  )
}
