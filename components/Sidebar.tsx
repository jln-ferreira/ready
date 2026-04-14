'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeftRight,
  BarChart2,
  FileText,
  Home,
  LogOut,
  Landmark,
  Users,
  X,
  ShoppingCart,
  ListChecks,
  Utensils,
  StickyNote,
} from 'lucide-react'

const financeItems = [
  { href: '/reports', label: 'Reports', icon: BarChart2 },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/tax', label: 'Tax Report', icon: FileText },
]

interface SidebarProps {
  onClose?: () => void
}

export default function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside className="flex h-screen w-52 flex-col border-r border-gray-200 bg-white px-3 py-6">
      {/* Logo + mobile close */}
      <div className="mb-8 flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <Landmark className="h-6 w-6 text-blue-600" />
          <span className="text-lg font-bold tracking-tight text-gray-900" style={{ fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif", letterSpacing: '-0.02em' }}>Ready</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1">
        <Link
          href="/home"
          onClick={onClose}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            pathname === '/home'
              ? 'bg-blue-50 text-blue-700'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <Home className="h-4 w-4 flex-shrink-0" />
          Home
        </Link>

        <p className="mt-4 mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Family
        </p>

        {([
          { href: '/family',       label: 'Members',     icon: Users },
          { href: '/shopping',     label: 'Shopping',    icon: ShoppingCart },
          { href: '/chores',       label: 'Chores',      icon: ListChecks },
          { href: '/meals',        label: 'Meals',       icon: Utensils },
          { href: '/noticeboard',  label: 'Noticeboard', icon: StickyNote },
        ] as const).map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              pathname === href
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {label}
          </Link>
        ))}

        <p className="mt-4 mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Finance
        </p>

        {financeItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
      >
        <LogOut className="h-4 w-4" />
        Sign Out
      </button>
    </aside>
  )
}
