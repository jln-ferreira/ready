'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeftRight, BarChart2, FileText, Home, LogOut,
  Users, X, ShoppingCart, ListChecks, Utensils,
  Target, Droplets, User, ChevronDown, Moon,
} from 'lucide-react'
import { AppLogo } from './AppLogo'
import { useActiveMembers } from '@/contexts/ActiveMemberContext'
import { useHousehold } from '@/hooks/useHousehold'
import { useSidebarBadges } from '@/hooks/useSidebarBadges'
import PinModal from './PinModal'
import type { MemberProfile } from '@/contexts/ActiveMemberContext'

// ─── colour palette ───────────────────────────────────────────────────────────
const HEX: Record<string, string> = {
  blue:   '#2563eb',
  purple: '#7c3aed',
  green:  '#16a34a',
  rose:   '#e11d48',
  orange: '#ea580c',
  teal:   '#0d9488',
  amber:  '#d97706',
  pink:   '#db2777',
}

function toRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

function initials(name: string, email: string): string {
  if (name.trim()) {
    const parts = name.trim().split(/\s+/)
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

// ─── nav definitions ──────────────────────────────────────────────────────────
interface NavItem { href: string; label: string; icon: React.ElementType }

const FAMILY_ITEMS: NavItem[] = [
  { href: '/family',        label: 'Members',  icon: Users },
  { href: '/shopping',      label: 'Shopping', icon: ShoppingCart },
  { href: '/chores',        label: 'Chores',   icon: ListChecks },
  { href: '/meals',         label: 'Meals',    icon: Utensils },
  { href: '/family/sleep',  label: 'Sono',     icon: Moon },
]

const FINANCE_INDIVIDUAL: NavItem[] = [
  { href: '/goals',        label: 'Goals',        icon: Target },
  { href: '/reports',      label: 'Reports',      icon: BarChart2 },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/tax',          label: 'Tax Report',   icon: FileText },
]

const FINANCE_FAMILY: NavItem[] = [
  { href: '/goals?scope=family', label: 'Goals',   icon: Target },
  { href: '/reports',            label: 'Reports', icon: BarChart2 },
]

const FITNESS_ITEMS: NavItem[] = [
  { href: '/fitness/water', label: 'Water Intake', icon: Droplets },
]

const SECTIONS_INDIVIDUAL = [
  { key: 'family',  label: 'Family',  items: FAMILY_ITEMS },
  { key: 'finance', label: 'Finance', items: FINANCE_INDIVIDUAL },
  { key: 'fitness', label: 'Fitness', items: FITNESS_ITEMS },
]

const SECTIONS_FAMILY = [
  { key: 'family',  label: 'Family',  items: FAMILY_ITEMS },
  { key: 'finance', label: 'Finance', items: FINANCE_FAMILY },
]

const DEFAULT_OPEN: Record<string, boolean> = { family: true, finance: true, fitness: true }

function readStorage(): Record<string, boolean> {
  if (typeof window === 'undefined') return DEFAULT_OPEN
  try { return JSON.parse(localStorage.getItem('sidebar-open') ?? 'null') ?? DEFAULT_OPEN }
  catch { return DEFAULT_OPEN }
}

interface SidebarProps { onClose?: () => void }

export default function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  const [open, setOpen] = useState<Record<string, boolean>>(DEFAULT_OPEN)
  useEffect(() => { setOpen(readStorage()) }, [])

  // PIN modal state
  const [pinTarget, setPinTarget] = useState<MemberProfile | null>(null)

  const {
    accountType, ownColorKey, members,
    activeMemberId, activeMember,
    setActiveMemberId,
  } = useActiveMembers()

  const { household } = useHousehold()
  const { choresPending } = useSidebarBadges(household?.id)

  // Active color: member's color when one is selected, else own color
  const colorHex    = HEX[activeMember?.sidebar_color ?? ownColorKey] ?? HEX.blue
  const activeStyle = { backgroundColor: toRgba(colorHex, 0.09), color: colorHex }

  const handleMemberClick = (m: MemberProfile) => {
    const isSelected = m.user_id === activeMemberId
    if (isSelected) {
      // Deselect — no PIN needed
      setActiveMemberId(null)
      return
    }
    if (m.has_pin) {
      setPinTarget(m)
    } else {
      setActiveMemberId(m.user_id)
    }
  }

  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    if (!pinTarget) return false
    const { data } = await supabase.rpc('verify_member_pin', {
      p_user_id: pinTarget.user_id,
      p_pin:     pin,
    })
    return data === true
  }, [pinTarget, supabase])

  const onPinSuccess = () => {
    if (!pinTarget) return
    setActiveMemberId(pinTarget.user_id)
    setPinTarget(null)
  }

  const toggleSection = (key: string) => {
    setOpen(prev => {
      const next = { ...prev, [key]: !prev[key] }
      try { localStorage.setItem('sidebar-open', JSON.stringify(next)) } catch {}
      return next
    })
  }

  const handleSignOut = async () => {
    setActiveMemberId(null)
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  // When a member is active inside the family account, show their full individual nav
  const sections = (accountType === 'family' && !activeMemberId) ? SECTIONS_FAMILY : SECTIONS_INDIVIDUAL

  const isActive = (href: string) => {
    const path = href.split('?')[0]
    if (path === '/transactions') return pathname.startsWith('/transactions')
    return pathname === path
  }

  const navLink = (href: string, label: string, Icon: React.ElementType, badge?: number | 'dot') => {
    const active = isActive(href)
    return (
      <Link
        key={href}
        href={href}
        onClick={onClose}
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
          active ? '' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`}
        style={active ? activeStyle : undefined}
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1">{label}</span>
        {badge === 'dot' && (
          <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
        )}
        {typeof badge === 'number' && badge > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold leading-none text-white flex-shrink-0">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </Link>
    )
  }

  return (
    <aside className="flex h-screen w-52 flex-col border-r border-gray-200 bg-white px-3 py-6 overflow-y-auto">

      {/* Logo + mobile close */}
      <div className="mb-5 flex items-center justify-between px-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <AppLogo size={28} />
          <span className="text-lg font-bold tracking-tight text-gray-900" style={{ letterSpacing: '-0.02em' }}>
            Ready
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Family member switcher */}
      {accountType === 'family' && members.length > 0 && (
        <div className="mb-4 px-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2 px-2">
            Who&apos;s here?
          </p>
          <div className="flex flex-wrap gap-2 px-2">
            {members.map(m => {
              const mColor   = HEX[m.sidebar_color] ?? HEX.blue
              const selected = m.user_id === activeMemberId
              return (
                <button
                  key={m.user_id}
                  onClick={() => handleMemberClick(m)}
                  title={m.display_name || m.email}
                  className="w-9 h-9 rounded-full text-xs font-bold text-white transition-all focus:outline-none flex-shrink-0"
                  style={{
                    backgroundColor: mColor,
                    boxShadow: selected ? `0 0 0 2px white, 0 0 0 4px ${mColor}` : undefined,
                    opacity: !activeMemberId || selected ? 1 : 0.4,
                  }}
                >
                  {initials(m.display_name, m.email)}
                </button>
              )
            })}
          </div>
          {activeMember && (
            <p className="text-xs text-gray-500 mt-2 px-2 truncate">
              {activeMember.display_name || activeMember.email.split('@')[0]}
            </p>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5">

        {navLink('/home', 'Home', Home)}

        {/* My Profile — individual accounts, or family account with a member active */}
        {(accountType === 'individual' || (accountType === 'family' && activeMemberId)) &&
          navLink('/profile', 'My Profile', User)}

        {/* Collapsible sections */}
        {sections.map(section => {
          const isOpen    = open[section.key] ?? true
          const hasActive = section.items.some(item => isActive(item.href))

          return (
            <div key={section.key} className="mt-2">
              <button
                onClick={() => toggleSection(section.key)}
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                style={hasActive && !isOpen ? { color: colorHex } : undefined}
              >
                <span className="text-xs font-semibold uppercase tracking-wider">{section.label}</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
              </button>

              <div
                className="overflow-hidden transition-all duration-200 ease-out"
                style={{ maxHeight: isOpen ? `${section.items.length * 48}px` : '0px' }}
              >
                <div className="mt-0.5 space-y-0.5 pb-1">
                  {section.items.map(({ href, label, icon: Icon }) => {
                    const badge =
                      href === '/chores' ? (choresPending > 0 ? choresPending : undefined) :
                      undefined
                    return navLink(href, label, Icon, badge as number | 'dot' | undefined)
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

      {/* PIN modal — rendered outside <aside> scroll container */}
      {pinTarget && (
        <PinModal
          memberName={pinTarget.display_name || pinTarget.email.split('@')[0]}
          memberColor={HEX[pinTarget.sidebar_color] ?? HEX.blue}
          onVerify={verifyPin}
          onSuccess={onPinSuccess}
          onCancel={() => setPinTarget(null)}
        />
      )}
    </aside>
  )
}
