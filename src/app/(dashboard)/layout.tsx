import { Suspense } from "react"
import { ProtectedDashboardShell } from "./_protected-shell"
import { LinearSyncWatcher } from "./_linear-sync-watcher"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={<div className="empty">Chargement…</div>}>
      <ProtectedDashboardShell>
        <LinearSyncWatcher />
        {children}
      </ProtectedDashboardShell>
    </Suspense>
  )
}
