"use client"

import { useId, useState } from "react"
import { useRouter } from "next/navigation"
import { Modal } from "@/components/ui/modal"
import { useCreateClient } from "@/hooks/use-clients"
import { useToast } from "@/components/providers/toast-provider"
import type { ClientCreateInput } from "@/lib/schemas/client"

interface NewClientModalProps {
  onClose: () => void
}

const BILLING_TYPES = [
  { id: "DAILY", label: "TJM", desc: "Au jour" },
  { id: "HOURLY", label: "Horaire", desc: "À l'heure" },
  { id: "FIXED", label: "Forfait", desc: "Au projet" },
] as const

export function NewClientModal({ onClose }: NewClientModalProps) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [company, setCompany] = useState("")
  const [email, setEmail] = useState("")
  const [billingMode, setBillingMode] =
    useState<ClientCreateInput["billingMode"]>("DAILY")
  const [rate, setRate] = useState<number>(500)
  const [fixedPrice, setFixedPrice] = useState<number>(5000)
  const [deposit, setDeposit] = useState<number>(0)

  const fieldId = useId()

  const createClient = useCreateClient()
  const { toast } = useToast()
  const router = useRouter()

  const isValid = firstName.length > 0 && lastName.length > 0

  function submit() {
    if (!isValid) return
    createClient.mutate(
      {
        firstName,
        lastName,
        company: company || null,
        email: email || null,
        billingMode,
        rate: billingMode === "FIXED" ? 0 : Number(rate),
        fixedPrice: billingMode === "FIXED" ? Number(fixedPrice) : null,
        deposit:
          billingMode === "FIXED" && deposit > 0 ? Number(deposit) : null,
      },
      {
        onSuccess: (created) => {
          toast({
            variant: "success",
            title: `${created.firstName} ${created.lastName} ajouté`,
          })
          onClose()
          router.push(`/clients/${created.id}`)
        },
        onError: (e) => {
          toast({
            variant: "error",
            title: "Erreur",
            description: e instanceof Error ? e.message : String(e),
          })
        },
      },
    )
  }

  return (
    <Modal
      title="Nouveau client"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button
            className="btn btn-primary"
            disabled={!isValid || createClient.isPending}
            onClick={submit}
          >
            {createClient.isPending ? "Création…" : "Créer le client"}
          </button>
        </>
      }
    >
      <div className="row gap-12">
        <div className="field grow">
          <label className="field-label" htmlFor={`${fieldId}-first-name`}>
            Prénom
          </label>
          <input
            id={`${fieldId}-first-name`}
            className="input"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Henri"
          />
        </div>
        <div className="field grow">
          <label className="field-label" htmlFor={`${fieldId}-last-name`}>
            Nom
          </label>
          <input
            id={`${fieldId}-last-name`}
            className="input"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Mistral"
          />
        </div>
      </div>
      <div className="field">
        <label className="field-label" htmlFor={`${fieldId}-company`}>
          Entreprise
        </label>
        <input
          id={`${fieldId}-company`}
          className="input"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Quintyss Limited"
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor={`${fieldId}-email`}>
          Email
        </label>
        <input
          id={`${fieldId}-email`}
          className="input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="contact@entreprise.com"
        />
      </div>

      <div className="field">
        <div className="field-label" id={`${fieldId}-billing-mode`}>
          Type de facturation
        </div>
        <div
          className="row gap-8"
          role="group"
          aria-labelledby={`${fieldId}-billing-mode`}
        >
          {BILLING_TYPES.map((t) => (
            <button
              key={t.id}
              className="btn btn-secondary"
              style={{
                flex: 1,
                padding: "10px 12px",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 2,
                borderColor:
                  billingMode === t.id ? "var(--accent)" : "var(--border)",
                background:
                  billingMode === t.id ? "var(--accent-soft)" : "var(--bg-2)",
              }}
              onClick={() => setBillingMode(t.id)}
            >
              <span
                className="strong"
                style={{
                  color:
                    billingMode === t.id ? "var(--accent)" : "var(--text-0)",
                }}
              >
                {t.label}
              </span>
              <span className="xs muted">{t.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {billingMode !== "FIXED" && (
        <div className="field">
          <label className="field-label" htmlFor={`${fieldId}-rate`}>
            Taux ({billingMode === "DAILY" ? "€/jour" : "€/heure"})
          </label>
          <input
            id={`${fieldId}-rate`}
            className="input num"
            type="number"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
          />
        </div>
      )}
      {billingMode === "FIXED" && (
        <>
          <div className="field">
            <label className="field-label" htmlFor={`${fieldId}-fixed-price`}>
              Prix du projet (€)
            </label>
            <input
              id={`${fieldId}-fixed-price`}
              className="input num"
              type="number"
              value={fixedPrice}
              onChange={(e) => setFixedPrice(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor={`${fieldId}-deposit`}>
              Acompte (€){" "}
              <span className="muted xs">
                — optionnel, créera une facture distincte
              </span>
            </label>
            <input
              id={`${fieldId}-deposit`}
              className="input num"
              type="number"
              value={deposit}
              onChange={(e) => setDeposit(Number(e.target.value))}
            />
          </div>
        </>
      )}
    </Modal>
  )
}
