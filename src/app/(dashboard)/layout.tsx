import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"

import type { ThemeOption } from "@/lib/schemas/settings"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect("/auth/login")
  }

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.id },
    select: { theme: true, accentColor: true },
  })

  return (
    <AppShell
      userName={session.user.name}
      userEmail={session.user.email}
      userImage={session.user.image ?? null}
      userTheme={(settings?.theme as ThemeOption) ?? "system"}
      userAccentColor={settings?.accentColor ?? "#2563eb"}
    >
      {children}
    </AppShell>
  )
}
