'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeftRight, BarChart2, FileText, Home, LogOut, Landmark,
  Users, X, ShoppingCart, ListChecks, Utensils, StickyNote,
  Target, Droplets, User, ChevronDown, Dumbbell,
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
}

const SECTIONS: { key: string; label: string; items: NavItem[] }[] = [
  {
    key: 'family',
    label: 'Family',
    items: [
      { href: '/family',      label: 'Members',     icon: Users },
      { href: '/shopping',    label: 'Shopping',    icon: ShoppingCart },
      { href: '/chores',      label: 'Chores',      icon: ListChecks },
      { href: '/meals',       label: 'Meals',       icon: Utensils },
      { href: '/noticeboard', label: 'Noticeboard', icon: StickyNote },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    items: [
      { href: '/goals',        label: 'Goals',       icon: Target },
      { href: '/reports',      label: 'Reports',     icon: BarChart2 },
      { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
      { href: '/tax',          label: 'Tax Report',  icon: FileText },
    ],
  },
  {
    key: 'fitness',
    label: 'Fitness',
    items: [
      { href: '/fitness/water',   label: 'Water Intake', icon: Droplets },
      { href: '/fitness/profile', label: 'My Profile',   icon: User },
    ],
  },
]

const DEFAULT_OPEN: Record<string, boolean> = { family: true, finance: true, fitness: true }

function readStorage(): Record<string, boolean> {
  if (typeof window === 'undefined') return DEFAULT_OPEN
  try {
    return JSON.parse(localStorage.getItem('sidebar-open') ?? 'null') ?? DEFAULT_OPEN
  } catch {
    return DEFAULT_OPEN
  }
}

interface SidebarProps {
  onClose?: () => void
}

export default function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  const [open, setOpen] = useState<Record<string, boolean>>(DEFAULT_OPEN)

  // Hydrate from localStorage after mount
  useEffect(() => { setOpen(readStorage()) }, [])

  const toggleSection = (key: string) => {
    setOpen(prev => {
      const next = { ...prev, [key]: !prev[key] }
      try { localStorage.setItem('sidebar-open', JSON.stringify(next)) } catch {}
      return next
    })
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside className="flex h-screen w-52 flex-col border-r border-gray-200 bg-white px-3 py-6 overflow-y-auto">

      {/* Logo + mobile close */}
      <div className="mb-6 flex items-center justify-between px-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Landmark className="h-6 w-6 text-blue-600" />
          <span
            className="text-lg font-bold tracking-tight text-gray-900"
            style={{ fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif", letterSpacing: '-0.02em' }}
          >
            Ready
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5">

        {/* Home */}
        <Link
          href="/home"
          onClick={onClose}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            pathname === '/home' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <Home className="h-4 w-4 flex-shrink-0" />
          Home
        </Link>

        {/* Collapsible sections */}
        {SECTIONS.map(section => {
          const isOpen = open[section.key] ?? true
          const hasActive = section.items.some(item =>
            item.href === '/transactions'
              ? pathname.startsWith('/transactions')
              : pathname === item.href
          )

          return (
            <div key={section.key} className="mt-2">
              {/* Section header toggle */}
              <button
                onClick={() => toggleSection(section.key)}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors ${
                  hasActive && !isOpen ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <span className="text-xs font-semibold uppercase tracking-wider">
                  {section.label}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
                />
              </button>

              {/* Collapsible children */}
              <div
                className="overflow-hidden transition-all duration-200 ease-out"
                style={{ maxHeight: isOpen ? `${section.items.length * 48}px` : '0px' }}
              >
                <div className="mt-0.5 space-y-0.5 pb-1">
                  {section.items.map(({ href, label, icon: Icon }) => {
                    const active = href === '/transactions'
                      ? pathname.startsWith('/transactions')
                      : pathname === href
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={onClose}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                          active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        {label}
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </nav>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 flex-shrink-0 mt-2"
      >
        <LogOut className="h-4 w-4" />
        Sign Out
      </button>
    </aside>
  )
}
