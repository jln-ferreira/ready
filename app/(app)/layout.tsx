// All protected routes must be dynamic (require auth session)
export const dynamic = 'force-dynamic'

import AppShell from '@/components/AppShell'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
