"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { QuoteForm } from "@/components/quotes/quote-form"
import { useQuoteForm } from "@/features/quotes/use-quote-form"
import { useQuote, type QuoteDetail } from "@/hooks/use-quotes"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { MobilePageSkeleton } from "@/components/mobile/mobile-page-skeleton"

const MobileEditQuotePage = dynamic(
  () => import("./mobile").then((m) => m.MobileEditQuotePage),
  {
    ssr: false,
    loading: () => (
      <MobilePageSkeleton title="Modifier le devis" variant="builder" />
    ),
  },
)

interface PageProps {
  params: Promise<{ id: string }>
}

export default function EditQuotePage({ params }: PageProps) {
  const { id } = use(params)
  const isMobile = useIsMobile()
  const { data: quote, isLoading } = useQuote(id)

  if (isLoading || !quote) {
    return isMobile ? (
      <MobilePageSkeleton title="Modifier le devis" variant="builder" />
    ) : (
      <PageSkeleton kpis={0} rows={6} title="Modifier le devis" />
    )
  }

  return isMobile ? (
    <MobileEditQuotePage quote={quote} />
  ) : (
    <DesktopEditQuoteView quote={quote} />
  )
}

function DesktopEditQuoteView({ quote }: { quote: QuoteDetail }) {
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
