import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { AppShell } from "@/components/layout/app-shell"

/**
 * Server Component that resolves the current session and renders the
 * dashboard chrome. Lives in its own file so the parent layout can wrap
 * it in `<Suspense>` — without that boundary, every dashboard page
 * bails the cacheComponents prerender with "Uncached data accessed
 * outside of <Suspense>" because the auth call reads `headers()`.
 */
export async function ProtectedDashboardShell({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/auth/login")

  return (
    <AppShell
      user={{ name: session.user.name, email: session.user.email }}
      crumbs={["FreelanceManager"]}
    >
      {children}
    </AppShell>
  )
}
