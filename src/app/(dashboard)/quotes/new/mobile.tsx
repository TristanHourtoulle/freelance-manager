"use client"

import { useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { MobileTopbar } from "@/components/mobile/mobile-topbar"
import { MobileQuoteForm } from "@/components/quotes/mobile-quote-form"
import { useQuoteForm } from "@/features/quotes/use-quote-form"

/**
 * Mobile twin of the quote create page: a single scrolling screen (no
 * builder wizard needed, unlike the invoice one — a devis has no drag & drop
 * task picking) with a sticky "Créer le devis" call to action.
 */
export function MobileQuoteNewPage() {
  const router = useRouter()
  const search = useSearchParams()

  const initialClientId = search.get("clientId") ?? ""
  const taskIdsParam = search.get("taskIds") ?? ""
  const preselectedTaskIds = useMemo(
    () => taskIdsParam.split(",").filter(Boolean),
    [taskIdsParam],
  )

  const form = useQuoteForm({
    mode: "create",
    initialClientId,
    preselectedTaskIds,
  })

  return (
    <div className="m-screen">
      <MobileTopbar title="Nouveau devis" back={() => router.push("/quotes")} />

      <div className="m-content">
        <MobileQuoteForm form={form} />
      </div>

      <div className="sticky-cta">
        <button
          type="button"
          className="btn btn-primary grow"
          style={{ justifyContent: "center" }}
          disabled={!form.canSubmit || form.isPending}
          onClick={form.submit}
        >
          Créer le devis
        </button>
      </div>
    </div>
  )
}
