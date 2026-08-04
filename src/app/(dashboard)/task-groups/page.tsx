"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Icon } from "@/components/ui/icon"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToast } from "@/components/providers/toast-provider"
import { useClients } from "@/hooks/use-clients"
import { useTasks, type TaskDTO } from "@/hooks/use-tasks"
import {
  useCreateTaskGroup,
  useDeleteTaskGroup,
  useTaskGroups,
  useUpdateTaskGroup,
  type TaskGroupDTO,
} from "@/hooks/use-task-groups"

function displayClient(client: {
  firstName: string
  lastName: string
  company?: string | null
}) {
  return client.company ?? `${client.firstName} ${client.lastName}`
}

function TaskGroupEditor({
  clientId,
  tasks,
  group,
  onClose,
}: {
  clientId: string
  tasks: TaskDTO[]
  group?: TaskGroupDTO
  onClose: () => void
}) {
  const { toast } = useToast()
  const create = useCreateTaskGroup()
  const update = useUpdateTaskGroup(group?.id ?? "new")
  const [name, setName] = useState(group?.name ?? "")
  const [selected, setSelected] = useState(
    () => new Set(group?.tasks.map((task) => task.id) ?? []),
  )

  const available = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.clientId === clientId &&
          task.status === "PENDING_INVOICE" &&
          task.billable &&
          !task.invoiceId &&
          (!task.taskGroupId || task.taskGroupId === group?.id),
      ),
    [clientId, group?.id, tasks],
  )
  const isPending = create.isPending || update.isPending
  const valid = name.trim().length > 0 && selected.size > 0 && !isPending

  function submit() {
    if (!valid) return
    const input = { name: name.trim(), taskIds: [...selected] }
    const callbacks = {
      onSuccess: () => {
        toast({
          variant: "success" as const,
          title: group ? "Groupe mis à jour" : "Groupe créé",
        })
        onClose()
      },
      onError: (error: unknown) =>
        toast({
          variant: "error" as const,
          title: "Le groupe n'a pas été enregistré",
          description: error instanceof Error ? error.message : String(error),
        }),
    }
    if (group) update.mutate(input, callbacks)
    else create.mutate({ clientId, ...input }, callbacks)
  }

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="row gap-8" style={{ marginBottom: 14 }}>
        <div>
          <div className="card-h2">
            {group ? `Modifier · ${group.name}` : "Nouveau groupe"}
          </div>
          <div className="xs muted" style={{ marginTop: 3 }}>
            Ce groupe est propre à cette facture : ce n&apos;est pas un
            template.
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ marginLeft: "auto" }}
          onClick={onClose}
        >
          Fermer
        </button>
      </div>

      <div className="field" style={{ maxWidth: 520, marginBottom: 14 }}>
        <label className="field-label" htmlFor="task-group-name">
          Nom du groupe
        </label>
        <input
          id="task-group-name"
          className="input"
          placeholder="Ex. Bucket & CDN"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />
      </div>

      <div className="field-label">Tasks à inclure · {selected.size}</div>
      {available.length === 0 ? (
        <div className="empty" style={{ minHeight: 100 }}>
          <div className="empty-title">Aucune task disponible</div>
          <div>
            Une task doit être facturable, en attente de facture et libre de
            tout autre groupe.
          </div>
        </div>
      ) : (
        <div
          className="col gap-6"
          style={{ maxHeight: 340, overflowY: "auto", marginTop: 8 }}
        >
          {available.map((task) => (
            <label
              key={task.id}
              className="task-pickable"
              style={{ cursor: "pointer" }}
            >
              <input
                type="checkbox"
                aria-label={`${task.linearIdentifier} ${task.title}`}
                checked={selected.has(task.id)}
                onChange={() =>
                  setSelected((current) => {
                    const next = new Set(current)
                    if (next.has(task.id)) next.delete(task.id)
                    else next.add(task.id)
                    return next
                  })
                }
              />
              <span className="task-id">{task.linearIdentifier}</span>
              <span className="small strong grow">{task.title}</span>
              <span className="xs muted">{task.estimate ?? "—"}j</span>
            </label>
          ))}
        </div>
      )}

      <div
        className="row gap-8"
        style={{ justifyContent: "flex-end", marginTop: 16 }}
      >
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Annuler
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!valid}
          onClick={submit}
        >
          {group ? "Enregistrer" : "Créer le groupe"}
        </button>
      </div>
    </div>
  )
}

export default function TaskGroupsPage() {
  const { toast } = useToast()
  const { data: clients = [] } = useClients()
  const [clientId, setClientId] = useState("")
  const [editor, setEditor] = useState<"new" | TaskGroupDTO | null>(null)
  const [groupToDelete, setGroupToDelete] = useState<TaskGroupDTO | null>(null)
  const { data: tasks = [], isPending: tasksPending } = useTasks(
    {
      clientIds: clientId ? [clientId] : [],
      status: "PENDING_INVOICE",
      billable: true,
    },
    { enabled: Boolean(clientId) },
  )
  const { data: groups = [], isPending: groupsPending } = useTaskGroups({
    clientId: clientId || undefined,
    status: "all",
    enabled: Boolean(clientId),
  })
  const remove = useDeleteTaskGroup()

  const pending = groups.filter((group) => !group.invoiceId)
  const invoiced = groups.filter((group) => group.invoiceId)
  const client = clients.find((entry) => entry.id === clientId)
  const loading = tasksPending || groupsPending

  function deleteGroup() {
    if (!groupToDelete) return
    remove.mutate(groupToDelete.id, {
      onSuccess: () => {
        toast({ variant: "success", title: "Groupe supprimé" })
        setGroupToDelete(null)
      },
      onError: (error) =>
        toast({
          variant: "error",
          title: "Le groupe n'a pas été supprimé",
          description: error instanceof Error ? error.message : String(error),
        }),
    })
  }

  return (
    <div className="page task-groups-page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Groupes de tasks</h1>
          <div className="page-sub">
            Prépare des lots de travail ad hoc, puis ajoute-les à une facture en
            un clic.
          </div>
        </div>
        <div className="task-groups-header-tools">
          <div className="task-groups-header-controls">
            <div className="field task-groups-client-control">
              <label className="field-label" htmlFor="task-group-client">
                Client
              </label>
              <select
                id="task-group-client"
                className="select"
                value={clientId}
                onChange={(event) => {
                  setClientId(event.target.value)
                  setEditor(null)
                }}
              >
                <option value="">Choisir un client…</option>
                {clients.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {displayClient(entry)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!clientId || editor !== null}
              onClick={() => setEditor("new")}
            >
              <Icon name="plus" size={14} />
              Nouveau groupe
            </button>
          </div>
          <div className="xs muted task-groups-guardrails">
            Un seul client par groupe · une task dans un seul groupe ·
            verrouillé après facturation
          </div>
        </div>
      </div>

      {clientId && editor && (
        <TaskGroupEditor
          key={editor === "new" ? "new" : editor.id}
          clientId={clientId}
          tasks={tasks}
          group={editor === "new" ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}

      {!clientId ? (
        <div className="card">
          <div className="empty">
            <Icon name="folder" size={24} className="muted" />
            <div className="empty-title">Choisis d&apos;abord un client</div>
            <div>Les groupes ne peuvent jamais mélanger plusieurs clients.</div>
          </div>
        </div>
      ) : loading ? (
        <div className="card muted">Chargement des groupes…</div>
      ) : (
        <div className="col gap-18">
          <section>
            <div className="row" style={{ marginBottom: 10 }}>
              <div>
                <div className="card-title">À préparer · {pending.length}</div>
                <div className="xs muted">
                  Modifiables jusqu&apos;à leur facturation
                </div>
              </div>
            </div>
            {pending.length === 0 ? (
              <div className="card task-groups-empty-card">
                <div className="empty" style={{ minHeight: 130 }}>
                  <div className="empty-title">Aucun groupe en attente</div>
                  <div>
                    Crée un groupe pour{" "}
                    {client ? displayClient(client) : "ce client"}.
                  </div>
                </div>
              </div>
            ) : (
              <div className="col gap-10">
                {pending.map((group) => (
                  <div key={group.id} className="card card-tight">
                    <div className="task-group-card-row">
                      <div className="row gap-10 grow" style={{ minWidth: 0 }}>
                        <Icon name="folder" size={18} className="muted" />
                        <div className="grow" style={{ minWidth: 0 }}>
                          <div className="strong truncate">{group.name}</div>
                          <div className="xs muted truncate">
                            {group.tasks.length} task
                            {group.tasks.length > 1 ? "s" : ""} ·{" "}
                            {group.tasks
                              .map((task) => task.linearIdentifier)
                              .join(", ")}
                          </div>
                        </div>
                      </div>
                      <div className="task-group-card-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setEditor(group)}
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={remove.isPending}
                          onClick={() => setGroupToDelete(group)}
                        >
                          Supprimer
                        </button>
                        <Link
                          className="btn btn-primary btn-sm"
                          href={`/billing/new?clientId=${group.clientId}&groupIds=${group.id}`}
                        >
                          Facturer
                          <Icon name="chevron-right" size={12} />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {invoiced.length > 0 && (
            <section>
              <div className="card-title" style={{ marginBottom: 10 }}>
                Déjà facturés · {invoiced.length}
              </div>
              <div className="col gap-8">
                {invoiced.map((group) => (
                  <div key={group.id} className="card card-tight">
                    <div className="task-group-card-row">
                      <Icon name="lock" size={15} className="muted" />
                      <div className="grow">
                        <div className="strong small">{group.name}</div>
                        <div className="xs muted">
                          {group.tasks.length} task
                          {group.tasks.length > 1 ? "s" : ""}
                        </div>
                      </div>
                      {group.invoiceId && (
                        <Link
                          className="btn btn-ghost btn-sm"
                          href={`/billing?invoiceId=${group.invoiceId}`}
                        >
                          {group.invoiceNumber ?? "Voir la facture"}
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {groupToDelete && (
        <ConfirmDialog
          title={`Supprimer « ${groupToDelete.name} » ?`}
          description="Les tasks seront libérées et pourront rejoindre un autre groupe."
          confirmLabel="Supprimer le groupe"
          danger
          isPending={remove.isPending}
          icon="trash"
          onCancel={() => setGroupToDelete(null)}
          onConfirm={deleteGroup}
        />
      )}
    </div>
  )
}
