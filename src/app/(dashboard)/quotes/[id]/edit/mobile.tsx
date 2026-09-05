"use client"

import { useRouter } from "next/navigation"
import { MobileTopbar } from "@/components/mobile/mobile-topbar"
import { MobileQuoteForm } from "@/components/quotes/mobile-quote-form"
import { useQuoteForm } from "@/features/quotes/use-quote-form"
import type { QuoteDetail } from "@/hooks/use-quotes"

/**
 * Mobile twin of the quote edit page: a single scrolling screen (the client
 * is already fixed, so no client picker) with a sticky "Enregistrer" call to
 * action.
 *
 * @param quote - The quote being edited.
 */
export function MobileEditQuotePage({ quote }: { quote: QuoteDetail }) {
  const router = useRouter()
  const form = useQuoteForm({ mode: "edit", quote })

  return (
    <div className="m-screen">
      <MobileTopbar
        title={`Modifier ${quote.number}`}
        back={() => router.push(`/quotes?openId=${quote.id}`)}
      />

      <div className="m-content">
        <MobileQuoteForm form={form} />
      </div>

      <div className="sticky-cta">
        <button
          type="button"
          className="btn btn-primary grow"
          style={{ justifyContent: "center" }}
          disabled={!form.canSubmit || form.isPending}
          onClick={form.save}
        >
          Enregistrer
        </button>
      </div>
    </div>
  )
}
