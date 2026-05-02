"use client"

import { useState } from "react"
import { Modal } from "@/components/ui/modal"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Icon } from "@/components/ui/icon"
import { useToast } from "@/components/providers/toast-provider"
import {
  useArchiveClient,
  useUpdateClient,
  type ClientDTO,
} from "@/hooks/use-clients"
import type { ClientDetailDTO } from "@/hooks/use-client-detail"
import type { ClientUpdateInput } from "@/lib/schemas/client"
import { initials, avatarColor } from "@/lib/format"
import { AVATAR_COLORS } from "@/lib/avatar-colors"

interface EditClientModalProps {
  client: ClientDTO | ClientDetailDTO
  onClose: () => void
}

/**
 * Edit modal for a client. Mirrors the design's 4 sections (Identité,
 * Contact, Facturation, Notes) and exposes an "Archiver" shortcut on the
 * left of the footer. Color picker writes the gradient string into
 * `client.color`.
 */
export function EditClientModal({ client, onClose }: EditClientModalProps) {
  const update = useUpdateClient(client.id)
  const archive = useArchiveClient()
  const { toast } = useToast()

  const [firstName, setFirstName] = useState(client.firstName)
  const [lastName, setLastName] = useState(client.lastName)
  const [company, setCompany] = useState(client.company ?? "")
  const [email, setEmail] = useState(client.email ?? "")
  const [phone, setPhone] = useState(client.phone ?? "")
  const [website, setWebsite] = useState(client.website ?? "")
  const [address, setAddress] = useState(client.address ?? "")
  const [notes, setNotes] = useState(client.notes ?? "")
  const [billingMode, setBillingMode] = useState(client.billingMode)
  const [rate, setRate] = useState<number>(client.rate)
  const [fixedPrice, setFixedPrice] = useState<number>(client.fixedPrice ?? 0)
  const [paymentTerms, setPaymentTerms] = useState<number>(
    client.paymentTerms ?? 30,
  )
  const [color, setColor] = useState<string | null>(client.color ?? null)
  const [archiveOpen, setArchiveOpen] = useState(false)

  const previewSeed = `${firstName} ${lastName}`.trim() || client.id
  const previewColor = color ?? avatarColor(previewSeed)
  const previewInitials =
    initials(previewSeed) || initials(company || "?") || "?"
  const isValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    (billingMode === "FIXED" ? Number(fixedPrice) > 0 : true)

  function submit() {
    if (!isValid) return
    const payload: ClientUpdateInput = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      company: company.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      website: website.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
      billingMode,
      rate: billingMode === "FIXED" ? 0 : Number(rate),
      fixedPrice: billingMode === "FIXED" ? Number(fixedPrice) : null,
      paymentTerms: Number(paymentTerms),
      color,
    }
    update.mutate(payload, {
      onSuccess: () => {
        toast({ variant: "success", title: "Client mis à jour" })
        onClose()
      },
      onError: (e) => {
        toast({
          variant: "error",
          title: "Échec de la mise à jour",
          description: e instanceof Error ? e.message : String(e),
        })
      },
    })
  }

  function confirmArchive() {
    archive.mutate(client.id, {
      onSuccess: () => {
        toast({ variant: "success", title: "Client archivé" })
        setArchiveOpen(false)
        onClose()
      },
      onError: (e) => {
        toast({
          variant: "error",
          title: "Échec de l'archivage",
          description: e instanceof Error ? e.message : String(e),
        })
      },
    })
  }

  return (
    <>
      <Modal
        title="Modifier le client"
        subtitle={
          <>
            Mise à jour des informations
            {client.company ? ` · ${client.company}` : ""}
          </>
        }
        onClose={onClose}
        width={640}
        withGlow
        footer={
          <>
            <button
              className="btn btn-danger-ghost"
              style={{ marginRight: "auto" }}
              onClick={() => setArchiveOpen(true)}
              disabled={update.isPending || archive.isPending}
            >
              <Icon name="archive" size={13} />
              Archiver le client
            </button>
            <button
              className="btn btn-ghost"
              onClick={onClose}
              disabled={update.isPending}
            >
              Annuler
            </button>
            <button
              className="btn btn-primary"
              onClick={submit}
              disabled={!isValid || update.isPending}
            >
              <Icon name="check" size={13} />
              {update.isPending ? "Enregistrement…" : "Enregistrer"}
            </button>
          </>
        }
      >
        <div className="modal-section">
          <div className="modal-section-title">Identité</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 14,
              flexWrap: "wrap",
            }}
          >
            <div
              className="hero-av"
              style={{
                background: previewColor,
                width: 56,
                height: 56,
                fontSize: 18,
                borderRadius: 12,
              }}
            >
              {previewInitials}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div className="field-label" style={{ marginBottom: 8 }}>
                Couleur de l&apos;avatar
              </div>
              <div className="color-row">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    aria-label={`Couleur ${c.key}`}
                    className={
                      "color-swatch" + (color === c.value ? " active" : "")
                    }
                    style={{ background: c.value }}
                    onClick={() => setColor(c.value)}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="field-grid-2">
            <div className="field">
              <label className="field-label">
                Prénom <span className="req">*</span>
              </label>
              <input
                className="input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label">
                Nom <span className="req">*</span>
              </label>
              <input
                className="input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label className="field-label">Société</label>
            <input
              className="input"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Quintyss Limited"
            />
          </div>
        </div>

        <div className="modal-section">
          <div className="modal-section-title">Contact</div>
          <div className="field-grid-2">
            <div className="field">
              <label className="field-label">Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@entreprise.com"
              />
            </div>
            <div className="field">
              <label className="field-label">Téléphone</label>
              <input
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+33 6 12 34 56 78"
              />
            </div>
          </div>
          <div className="field">
            <label className="field-label">Site web</label>
            <input
              className="input"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://"
            />
          </div>
          <div className="field">
            <label className="field-label">Adresse</label>
            <input
              className="input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="14 rue de Rivoli, 75001 Paris"
            />
          </div>
        </div>

        <div className="modal-section">
          <div className="modal-section-title">Facturation</div>
          <div className="field">
            <label className="field-label">Type</label>
            <div className="seg">
              <button
                type="button"
                className={billingMode === "DAILY" ? "active" : ""}
                onClick={() => setBillingMode("DAILY")}
              >
                TJM
              </button>
              <button
                type="button"
                className={billingMode === "FIXED" ? "active" : ""}
                onClick={() => setBillingMode("FIXED")}
              >
                Forfait
              </button>
              <button
                type="button"
                className={billingMode === "HOURLY" ? "active" : ""}
                onClick={() => setBillingMode("HOURLY")}
              >
                Horaire
              </button>
            </div>
          </div>
          <div className="field-grid-2">
            {billingMode !== "FIXED" ? (
              <div className="field">
                <label className="field-label">
                  {billingMode === "DAILY" ? "TJM" : "Taux horaire"}
                </label>
                <div className="input-suffix-wrap">
                  <input
                    className="input num"
                    type="number"
                    min={0}
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value))}
                  />
                  <span className="suffix">
                    {billingMode === "DAILY" ? "€/jour" : "€/heure"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="field">
                <label className="field-label">
                  Prix du forfait <span className="req">*</span>
                </label>
                <div className="input-suffix-wrap">
                  <input
                    className="input num"
                    type="number"
                    min={0}
                    value={fixedPrice}
                    onChange={(e) => setFixedPrice(Number(e.target.value))}
                  />
                  <span className="suffix">€</span>
                </div>
              </div>
            )}
            <div className="field">
              <label className="field-label">Délai de paiement</label>
              <div className="input-suffix-wrap">
                <input
                  className="input num"
                  type="number"
                  min={0}
                  max={180}
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(Number(e.target.value))}
                />
                <span className="suffix">jours</span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-section">
          <div className="modal-section-title">Notes internes</div>
          <textarea
            className="textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Préférences, contexte, contacts secondaires..."
            rows={4}
            style={{ minHeight: 96, resize: "vertical" }}
          />
        </div>
      </Modal>
      {archiveOpen && (
        <ConfirmDialog
          title="Archiver le client ?"
          description={`${client.company ?? `${client.firstName} ${client.lastName}`} sera retiré de la liste active. Vous pourrez le restaurer depuis les archives.`}
          confirmLabel="Archiver"
          icon="archive"
          danger
          isPending={archive.isPending}
          onConfirm={confirmArchive}
          onCancel={() => setArchiveOpen(false)}
        />
      )}
    </>
  )
}
