import { Suspense } from "react"
import { ProtectedDashboardShell } from "./_protected-shell"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={<div className="empty">Chargement…</div>}>
      <ProtectedDashboardShell>{children}</ProtectedDashboardShell>
    </Suspense>
  )
}
