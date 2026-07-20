"use client"

import { useId, useMemo, useState } from "react"
import { useToast } from "@/components/providers/toast-provider"
import { useClients } from "@/hooks/use-clients"
import { useCreateAction } from "@/hooks/use-actions"
import { quickDueOptions, toDateInputValue } from "@/lib/quick-capture"

type DueChoice = "none" | "today" | "tomorrow" | "monday"

interface QuickCaptureFormProps {
  onDone: () => void
}

/**
 * Minimal capture body: a title, an optional due-date chip and an optional
 * client. No client is required — unclassified actions land in the "Non
 * classé" bucket and are triaged later.
 *
 * @param onDone - Called once the action has been created.
 */
export function QuickCaptureForm({ onDone }: QuickCaptureFormProps) {
  const fieldId = useId()
  const { toast } = useToast()
  const { data: clients } = useClients()
  const create = useCreateAction()

  const [title, setTitle] = useState("")
  const [due, setDue] = useState<DueChoice>("none")
  const [clientId, setClientId] = useState("")

  const dueOptions = useMemo(() => quickDueOptions(new Date()), [])
  const isValid = title.trim().length > 0

  function handleSubmit() {
    if (!isValid) return
    const chosen = dueOptions.find((o) => o.id === due)
    create.mutate(
      {
        type: "OTHER",
        title: title.trim(),
        dueDate: chosen ? toDateInputValue(chosen.date) : null,
        clientId: clientId || null,
      },
      {
        onSuccess: () => {
          toast({ variant: "success", title: "Action créée" })
          onDone()
        },
        onError: (e) =>
          toast({ variant: "error", title: "Erreur", description: e.message }),
      },
    )
  }

  return (
    <>
      <div className="field" style={{ marginBottom: 12 }}>
        <label className="field-label" htmlFor={`${fieldId}-intitule`}>
          Intitulé
        </label>
        <input
          id={`${fieldId}-intitule`}
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Le client a appelé à propos de…"
          autoFocus
        />
      </div>

      <div className="chip-row" style={{ marginBottom: 12 }}>
        {dueOptions.map((o) => (
          <button
            key={o.id}
            type="button"
            className={"chip" + (due === o.id ? " active" : "")}
            onClick={() => setDue(o.id)}
          >
            {o.label}
          </button>
        ))}
        <button
          type="button"
          className={"chip" + (due === "none" ? " active" : "")}
          onClick={() => setDue("none")}
        >
          Sans échéance
        </button>
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <label className="field-label" htmlFor={`${fieldId}-client`}>
          Client
        </label>
        <select
          id={`${fieldId}-client`}
          className="select"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        >
          <option value="">Non classé</option>
          {(clients ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.company || `${c.firstName} ${c.lastName}`}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        className="btn btn-primary"
        disabled={!isValid || create.isPending}
        onClick={handleSubmit}
      >
        {create.isPending ? "…" : "Créer"}
      </button>
    </>
  )
}
