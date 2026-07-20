"use client"

import type { CSSProperties } from "react"
import { Icon } from "@/components/ui/icon"
import { useToast } from "@/components/providers/toast-provider"
import { useRelanceInvoice } from "@/hooks/use-actions"

interface RelanceButtonProps {
  invoiceId: string
  clientId: string
  className?: string
  style?: CSSProperties
}

/**
 * Queues the follow-up action of an overdue invoice from a dashboard alert.
 *
 * Shared by the desktop and mobile dashboards so both twins behave the same.
 * The call is idempotent: a second click reports the already-planned relance,
 * and an invoice settled in the meantime yields a neutral notice instead of
 * an error toast.
 */
export function RelanceButton({
  invoiceId,
  clientId,
  className = "btn btn-sm btn-secondary",
  style,
}: RelanceButtonProps) {
  const { toast } = useToast()
  const relance = useRelanceInvoice()

  function handleClick() {
    relance.mutate(
      { invoiceId, clientId },
      {
        onSuccess: (data) => {
          if (data.settled) {
            toast({ variant: "info", title: "Facture déjà réglée" })
            return
          }
          toast({
            variant: "success",
            title: data.created
              ? "Relance ajoutée au suivi"
              : "Relance déjà planifiée",
          })
        },
        onError: () => {
          toast({ variant: "error", title: "Échec de la relance" })
        },
      },
    )
  }

  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={handleClick}
      disabled={relance.isPending}
    >
      <Icon name="mail" size={12} />
      Relancer
    </button>
  )
}
