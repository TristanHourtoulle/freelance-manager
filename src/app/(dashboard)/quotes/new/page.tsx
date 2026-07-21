"use client"

import { Suspense, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { QuoteForm } from "@/components/quotes/quote-form"
import { useQuoteForm } from "@/features/quotes/use-quote-form"
import { PageSkeleton } from "@/components/ui/page-skeleton"

export default function NewQuotePage() {
  return (
    <Suspense fallback={<PageSkeleton kpis={0} rows={6} title="Nouveau devis" />}>
      <NewQuoteView />
    </Suspense>
  )
}

function NewQuoteView() {
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
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Nouveau devis</h1>
          <div className="page-sub">
            Suivi commercial · le document est émis depuis Abby, cette page ne
            fait que le tracer.
          </div>
        </div>
      </div>

      <QuoteForm form={form} />

      <div
        className="row gap-8"
        style={{ marginTop: 20, justifyContent: "flex-end" }}
      >
        <button className="btn btn-secondary" onClick={() => router.back()}>
          Annuler
        </button>
        <button
          className="btn btn-primary"
          onClick={form.submit}
          disabled={!form.canSubmit || form.isPending}
        >
          Créer le devis
        </button>
      </div>
    </div>
  )
}
