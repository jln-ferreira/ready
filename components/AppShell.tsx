'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import { AppLogo } from './AppLogo'
import { ActiveMemberProvider } from '@/contexts/ActiveMemberContext'
import ActivityTracker from './ActivityTracker'
import { restoreStreakFavicon } from '@/hooks/useStreakFavicon'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  // Restore streak favicon from localStorage on every page load
  useState(() => { restoreStreakFavicon() })

  return (
    <ActiveMemberProvider>
      <ActivityTracker />
      <div className="flex h-full">
        {/* Mobile backdrop */}
        {open && (
          <div
            className="fixed inset-0 z-20 bg-black/40 lg:hidden"
            onClick={() => setOpen(false)}
          />
        )}

        {/* Sidebar — always visible on lg+, drawer on mobile */}
        <div
          className={`fixed inset-y-0 left-0 z-30 transition-transform duration-200 lg:relative lg:translate-x-0 ${
            open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <Sidebar onClose={() => setOpen(false)} />
        </div>

        {/* Main content */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar */}
          <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
            <button
              onClick={() => setOpen(true)}
              className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <AppLogo size={22} />
              <span className="font-bold text-gray-900">Ready</span>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </ActiveMemberProvider>
  )
}
