"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { QuoteForm } from "@/components/quotes/quote-form"
import { useQuoteForm } from "@/features/quotes/use-quote-form"
import { useQuote, type QuoteDetail } from "@/hooks/use-quotes"
import { PageSkeleton } from "@/components/ui/page-skeleton"

interface PageProps {
  params: Promise<{ id: string }>
}

export default function EditQuotePage({ params }: PageProps) {
  const { id } = use(params)
  const { data: quote, isLoading } = useQuote(id)

  if (isLoading || !quote) {
    return <PageSkeleton kpis={0} rows={6} title="Modifier le devis" />
  }

  return <EditQuoteView quote={quote} />
}

function EditQuoteView({ quote }: { quote: QuoteDetail }) {
  const router = useRouter()
  const form = useQuoteForm({ mode: "edit", quote })

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Modifier le devis</h1>
          <div className="page-sub">
            <span className="mono">{quote.number}</span> · le document reste
            géré depuis Abby.
          </div>
        </div>
      </div>

      <QuoteForm form={form} />

      <div
        className="row gap-8"
        style={{ marginTop: 20, justifyContent: "flex-end" }}
      >
        <button
          className="btn btn-secondary"
          onClick={() => router.push(`/quotes?openId=${quote.id}`)}
        >
          Annuler
        </button>
        <button
          className="btn btn-primary"
          onClick={form.save}
          disabled={!form.canSubmit || form.isPending}
        >
          Enregistrer
        </button>
      </div>
    </div>
  )
}
