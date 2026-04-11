// Auth pages instantiate the Supabase client — must not be statically rendered
export const dynamic = 'force-dynamic'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
