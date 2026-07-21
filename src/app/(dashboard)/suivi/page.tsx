"use client"

import dynamic from "next/dynamic"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { SuiviView } from "@/components/suivi/suivi-view"
import { MobilePageSkeleton } from "@/components/mobile/mobile-page-skeleton"

const MobileSuiviPage = dynamic(
  () => import("./mobile").then((m) => m.MobileSuiviPage),
  {
    ssr: false,
    loading: () => <MobilePageSkeleton title="Suivi" variant="list" />,
  },
)

export default function SuiviPage() {
  const isMobile = useIsMobile()
  if (isMobile) return <MobileSuiviPage />
  return <DesktopSuiviPage />
}

function DesktopSuiviPage() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Suivi</h1>
          <div className="page-sub">Actions &amp; réunions client</div>
        </div>
      </div>
      <SuiviView />
    </div>
  )
}
