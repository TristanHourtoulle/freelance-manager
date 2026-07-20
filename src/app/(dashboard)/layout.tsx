import { Suspense } from "react"
import { AppBootSkeleton } from "@/components/ui/app-boot-skeleton"
import { ProtectedDashboardShell } from "./_protected-shell"
import { LinearSyncWatcher } from "./_linear-sync-watcher"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={<AppBootSkeleton />}>
      <ProtectedDashboardShell>
        <LinearSyncWatcher />
        {children}
      </ProtectedDashboardShell>
    </Suspense>
  )
}
