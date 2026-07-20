"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Icon } from "@/components/ui/icon"
import { useSettings, useUpdateSettings } from "@/hooks/use-settings"

const MAX_PAYMENT_DAYS = 180
const MAX_RATE = 100_000

/**
 * Settings card for the billing defaults (`defaultPaymentDays`, `defaultRate`).
 *
 * The currency is rendered as a disabled EUR field: the whole app formats money
 * through `fmtEUR`, so the value is informational and never sent in the PATCH.
 */
export function BillingDefaultsCard() {
  const fieldId = useId()
  const { data: settings, isPending } = useSettings()
  const update = useUpdateSettings()
  const hydratedRef = useRef(false)
  const [paymentDays, setPaymentDays] = useState(30)
  const [rate, setRate] = useState(0)

  useEffect(() => {
    if (hydratedRef.current || !settings) return
    hydratedRef.current = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPaymentDays(settings.defaultPaymentDays)
    setRate(settings.defaultRate)
  }, [settings])

  const isValid =
    Number.isInteger(paymentDays) &&
    paymentDays >= 0 &&
    paymentDays <= MAX_PAYMENT_DAYS &&
    rate >= 0 &&
    rate <= MAX_RATE

  const isDirty =
    settings != null &&
    (paymentDays !== settings.defaultPaymentDays ||
      rate !== settings.defaultRate)

  function handleSave() {
    if (!isValid || !isDirty) return
    update.mutate({ defaultPaymentDays: paymentDays, defaultRate: rate })
  }

  return (
    <div className="card">
      <div className="row gap-12" style={{ marginBottom: 16 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 9,
            background: "var(--accent-soft)",
            display: "grid",
            placeItems: "center",
            color: "var(--accent)",
          }}
        >
          <Icon name="euro" size={18} />
        </div>
        <div className="grow">
          <div className="card-h2">Facturation par défaut</div>
          <div className="muted small" style={{ marginTop: 2 }}>
            Valeurs pré-remplies à la création d&apos;une facture ou d&apos;un
            client.
          </div>
        </div>
      </div>

      <div className="field-grid-2">
        <div className="field">
          <label className="field-label" htmlFor={`${fieldId}-payment-days`}>
            Délai de paiement (jours)
          </label>
          <input
            id={`${fieldId}-payment-days`}
            className="input num"
            type="number"
            min={0}
            max={MAX_PAYMENT_DAYS}
            step={1}
            disabled={isPending}
            value={paymentDays}
            onChange={(e) => setPaymentDays(Math.trunc(Number(e.target.value)))}
          />
          <div className="field-hint">
            Utilisé pour calculer l&apos;échéance d&apos;une nouvelle facture.
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor={`${fieldId}-rate`}>
            Taux par défaut (€)
          </label>
          <input
            id={`${fieldId}-rate`}
            className="input num"
            type="number"
            min={0}
            max={MAX_RATE}
            disabled={isPending}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
          />
          <div className="field-hint">
            Pré-remplit le taux d&apos;un nouveau client. 0 = désactivé.
          </div>
        </div>
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label className="field-label" htmlFor={`${fieldId}-currency`}>
          Devise
        </label>
        <input
          id={`${fieldId}-currency`}
          className="input"
          value="EUR"
          disabled
          readOnly
          style={{ opacity: 0.6, cursor: "not-allowed" }}
        />
        <div className="field-hint">
          L&apos;app est en euros uniquement pour le moment.
        </div>
      </div>

      <div
        className="row"
        style={{
          justifyContent: "flex-end",
          marginTop: 16,
          paddingTop: 16,
          borderTop: "1px solid var(--border)",
        }}
      >
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={!isValid || !isDirty || update.isPending}
        >
          <Icon name="check" size={14} />
          {update.isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  )
}
