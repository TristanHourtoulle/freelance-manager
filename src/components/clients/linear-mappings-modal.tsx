"use client"

import { useMemo, useState } from "react"
import { Modal } from "@/components/ui/modal"
import { Icon } from "@/components/ui/icon"
import { useAddLinearMapping, useLinearProjects } from "@/hooks/use-linear"
import { useDeleteProject, useProjects } from "@/hooks/use-projects"
import { useClients } from "@/hooks/use-clients"
import { useToast } from "@/components/providers/toast-provider"
import { initials, avatarColor } from "@/lib/format"

interface LinearMappingsModalProps {
  initialClientId?: string
  onClose: () => void
}

/**
 * Modal to link/unlink Linear projects to a client.
 *
 * The source of truth for "linked" is the local `Project` table — not
 * `LinearMapping`. Linking a project creates the mapping AND immediately
 * pulls the project + its issues from Linear so the row is visible right
 * away. Unlinking deletes the local Project row (which cascades to tasks)
 * and removes any matching LinearMapping so the next sync doesn't
 * recreate it.
 *
 * A given Linear project can only be attached to ONE client. The other
 * clients show "Indisponible · Lié à {client}" and the "Lier" button is
 * hidden.
 */
export function LinearMappingsModal({
  initialClientId,
  onClose,
}: LinearMappingsModalProps) {
  const [clientId, setClientId] = useState(initialClientId ?? "")
  const [search, setSearch] = useState("")
  const { toast } = useToast()

  const { data: clients = [] } = useClients()
  const { data: linearProjects = [], isLoading: loadingProjects } =
    useLinearProjects(Boolean(clientId))
  const { data: localProjects = [] } = useProjects()
  const addMapping = useAddLinearMapping(clientId)
  const deleteProject = useDeleteProject()

  const linkedByLinearId = useMemo(() => {
    const m = new Map<string, { localProjectId: string; clientId: string }>()
    for (const p of localProjects) {
      if (p.linearProjectId) {
        m.set(p.linearProjectId, {
          localProjectId: p.id,
          clientId: p.clientId,
        })
      }
    }
    return m
  }, [localProjects])

  const linkedElsewhereLabels = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of localProjects) {
      if (!p.linearProjectId) continue
      if (p.clientId === clientId) continue
      const label =
        p.client.company ?? `${p.client.firstName} ${p.client.lastName}`
      m.set(p.linearProjectId, label)
    }
    return m
  }, [localProjects, clientId])

  const linkedCount = useMemo(
    () =>
      Array.from(linkedByLinearId.values()).filter(
        (v) => v.clientId === clientId,
      ).length,
    [linkedByLinearId, clientId],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return linearProjects
    return linearProjects.filter((p) =>
      `${p.name} ${p.description ?? ""}`.toLowerCase().includes(q),
    )
  }, [linearProjects, search])

  function link(linearProjectId: string) {
    addMapping.mutate(linearProjectId, {
      onSuccess: () =>
        toast({ variant: "success", title: "Projet lié et synchronisé" }),
      onError: (e) =>
        toast({
          variant: "error",
          title: "Liaison échouée",
          description: e instanceof Error ? e.message : String(e),
        }),
    })
  }

  function unlink(localProjectId: string) {
    deleteProject.mutate(localProjectId, {
      onSuccess: () =>
        toast({
          variant: "success",
          title: "Projet délié",
          description: "Le projet et ses tasks ont été retirés.",
        }),
      onError: (e) =>
        toast({
          variant: "error",
          title: "Suppression échouée",
          description: e instanceof Error ? e.message : String(e),
        }),
    })
  }

  const client = clients.find((c) => c.id === clientId)

  return (
    <Modal
      title="Lier projets Linear"
      onClose={onClose}
      width={680}
      footer={
        <button className="btn btn-primary" onClick={onClose}>
          Fermer
        </button>
      }
    >
      {!initialClientId && (
        <div className="field">
          <label className="field-label">Client</label>
          <select
            className="select"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">— choisir un client —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company ?? `${c.firstName} ${c.lastName}`} · {c.firstName}{" "}
                {c.lastName}
              </option>
            ))}
          </select>
        </div>
      )}

      {client && (
        <div
          className="row gap-12"
          style={{ padding: 12, background: "var(--bg-2)", borderRadius: 8 }}
        >
          <div
            className="av av-sm"
            style={{
              background:
                client.color ??
                avatarColor(`${client.firstName}${client.lastName}`),
            }}
          >
            {initials(`${client.firstName} ${client.lastName}`)}
          </div>
          <div className="grow">
            <div className="strong small">
              {client.firstName} {client.lastName} · {client.company ?? "—"}
            </div>
            <div className="muted xs">
              {linkedCount} projet{linkedCount > 1 ? "s" : ""} Linear lié
              {linkedCount > 1 ? "s" : ""}
            </div>
          </div>
        </div>
      )}

      {clientId && (
        <>
          <div style={{ position: "relative" }}>
            <Icon
              name="search"
              size={14}
              className="muted"
              style={{ position: "absolute", left: 12, top: 10 }}
            />
            <input
              className="input"
              style={{ paddingLeft: 34 }}
              placeholder="Rechercher un projet Linear…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loadingProjects ? (
            <div className="muted small">Chargement des projets Linear…</div>
          ) : filtered.length === 0 ? (
            <div className="muted small">
              Aucun projet Linear ne correspond.
            </div>
          ) : (
            <div className="col gap-4">
              {filtered.map((p) => {
                const linked = linkedByLinearId.get(p.id)
                const isLinkedHere = linked?.clientId === clientId
                const otherClient = linkedElsewhereLabels.get(p.id)
                const lockedByOther = !isLinkedHere && otherClient !== undefined
                const pending = addMapping.isPending || deleteProject.isPending
                return (
                  <div
                    key={p.id}
                    className="row gap-12"
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: isLinkedHere
                        ? "var(--accent-soft)"
                        : lockedByOther
                          ? "var(--bg-1)"
                          : "var(--bg-2)",
                      opacity: lockedByOther ? 0.6 : 1,
                    }}
                  >
                    <Icon
                      name="folder"
                      size={14}
                      className="muted"
                      style={{
                        color: isLinkedHere ? "var(--accent)" : undefined,
                      }}
                    />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="strong small truncate">{p.name}</div>
                      {lockedByOther ? (
                        <div className="muted xs truncate">
                          Lié à {otherClient}
                        </div>
                      ) : p.description ? (
                        <div className="muted xs truncate">{p.description}</div>
                      ) : null}
                    </div>
                    {isLinkedHere && linked ? (
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={pending}
                        onClick={() => unlink(linked.localProjectId)}
                      >
                        <Icon name="x" size={12} />
                        Délier
                      </button>
                    ) : lockedByOther ? (
                      <span
                        className="pill pill-no-dot xs"
                        style={{
                          background: "var(--bg-3)",
                          color: "var(--text-2)",
                        }}
                      >
                        Indisponible
                      </span>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={pending}
                        onClick={() => link(p.id)}
                      >
                        <Icon name="plus" size={12} />
                        Lier
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
