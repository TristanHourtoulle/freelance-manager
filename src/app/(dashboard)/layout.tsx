import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { AppShell } from "@/components/layout/app-shell"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/auth/login")

  // Crumbs are filled per-page via the breadcrumbs slot. The shell only needs
  // a sensible default ("FreelanceManager") so the topbar isn't empty.
  return (
    <AppShell
      user={{ name: session.user.name, email: session.user.email }}
      crumbs={["FreelanceManager"]}
    >
      {children}
    </AppShell>
  )
}
