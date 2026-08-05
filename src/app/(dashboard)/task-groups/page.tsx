"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Icon } from "@/components/ui/icon"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { TaskIdLink } from "@/components/ui/task-id-link"
import { TaskEffortInput } from "@/components/tasks/task-effort-input"
import { useToast } from "@/components/providers/toast-provider"
import { useClients, type ClientDTO } from "@/hooks/use-clients"
import { useTasks, type TaskDTO } from "@/hooks/use-tasks"
import { fmtEUR } from "@/lib/format"
import {
  computeTaskGroupPricing,
  priceForActualDays,
} from "@/domain/task-groups/pricing"
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
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState(
    () => new Set(group?.tasks.map((task) => task.id) ?? []),
  )

  const eligible = useMemo(
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
  const available = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr")
    if (!query) return eligible
    return eligible.filter((task) =>
      `${task.linearIdentifier} ${task.title}`
        .toLocaleLowerCase("fr")
        .includes(query),
    )
  }, [eligible, search])
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

      <div className="task-group-editor-list-header">
        <div className="field-label">Tasks à inclure · {selected.size}</div>
        {eligible.length > 0 && (
          <div className="xs muted">
            {available.length} affichée{available.length > 1 ? "s" : ""}
          </div>
        )}
      </div>
      {eligible.length > 0 && (
        <div className="task-group-editor-search">
          <Icon name="search" size={14} aria-hidden="true" />
          <input
            className="input"
            type="search"
            aria-label="Rechercher une task"
            placeholder="Rechercher par nom ou identifiant, ex. TRI-968"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      )}
      {eligible.length === 0 ? (
        <div className="empty" style={{ minHeight: 100 }}>
          <div className="empty-title">Aucune task disponible</div>
          <div>
            Une task doit être facturable, en attente de facture et libre de
            tout autre groupe.
          </div>
        </div>
      ) : available.length === 0 ? (
        <div className="empty task-group-search-empty">
          <Icon name="search" size={20} className="muted" />
          <div className="empty-title">Aucune task trouvée</div>
          <div>Essaie un autre nom ou identifiant.</div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setSearch("")}
          >
            Effacer la recherche
          </button>
        </div>
      ) : (
        <div
          className="col gap-6"
          style={{ maxHeight: 340, overflowY: "auto", marginTop: 8 }}
        >
          {available.map((task) => (
            <label
              key={task.id}
              className="task-pickable task-group-task-picker"
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
              <span className="small strong task-group-task-title">
                {task.title}
              </span>
              <span className="xs muted task-group-task-estimate">
                {task.estimate != null ? `${task.estimate} j estimé` : "—"}
              </span>
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

function formatDays(days: number) {
  return days.toLocaleString("fr-FR", { maximumFractionDigits: 2 })
}

function PendingTaskGroupCard({
  group,
  client,
  removePending,
  onEdit,
  onDelete,
}: {
  group: TaskGroupDTO
  client: ClientDTO
  removePending: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const billing = { billingMode: client.billingMode, rate: client.rate }
  const pricing = computeTaskGroupPricing(group.tasks, billing)
  const priceLabel =
    client.billingMode === "FIXED"
      ? "Prix à définir sur la facture"
      : fmtEUR(pricing.totalPrice)

  return (
    <div className="card card-tight task-group-card">
      <div className="task-group-card-row">
        <div className="row gap-10 grow" style={{ minWidth: 0 }}>
          <Icon name="folder" size={18} className="muted" />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="strong truncate">{group.name}</div>
            <div className="task-group-summary-line">
              <span>
                {group.tasks.length} task{group.tasks.length > 1 ? "s" : ""}
              </span>
              <span aria-hidden="true">·</span>
              <span>{formatDays(pricing.totalDays)} j saisis</span>
              <span aria-hidden="true">·</span>
              <span className="task-group-summary-price">{priceLabel}</span>
              {pricing.missingTasks > 0 && (
                <span className="task-group-missing-effort">
                  {pricing.missingTasks} temps manquant
                  {pricing.missingTasks > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="xs muted truncate task-group-identifiers">
              {group.tasks.map((task) => task.linearIdentifier).join(", ")}
            </div>
          </div>
        </div>
        <div className="task-group-card-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label={`Temps et prix de ${group.name}`}
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
          >
            <Icon
              name="chevron-down"
              size={12}
              className={expanded ? "task-group-chevron-open" : undefined}
            />
            Temps & prix
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onEdit}
          >
            Modifier
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={removePending}
            onClick={onDelete}
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

      {expanded && (
        <div className="task-group-effort-panel">
          <div className="task-group-pricing-strip">
            <div>
              <div className="xs muted">Temps saisi</div>
              <div className="strong">{formatDays(pricing.totalDays)} j</div>
            </div>
            <div>
              <div className="xs muted">Valeur du groupe</div>
              <div className="strong">{priceLabel}</div>
            </div>
            <div className="task-group-pricing-progress">
              <div className="xs muted">Complétion</div>
              <div className="strong">
                {pricing.capturedTasks}/{group.tasks.length} tasks
              </div>
            </div>
          </div>

          <div className="task-group-effort-list">
            {group.tasks.map((task) => {
              const taskPrice = priceForActualDays(task.actualDays, billing)
              return (
                <div key={task.id} className="task-group-effort-row">
                  <TaskIdLink
                    identifier={task.linearIdentifier}
                    url={task.linearUrl}
                    className="task-id"
                  />
                  <div className="small strong task-group-effort-title">
                    {task.title}
                  </div>
                  <div className="task-group-effort-control">
                    <span className="xs muted">Temps passé</span>
                    <div className="task-group-effort-input-wrap">
                      <TaskEffortInput
                        taskId={task.id}
                        actualDays={task.actualDays}
                        className="task-group-effort-input"
                        ariaLabel={`Temps passé pour ${task.linearIdentifier}, en jours`}
                      />
                      <span className="xs muted">j</span>
                    </div>
                  </div>
                  <div className="task-group-task-price">
                    <div className="xs muted">Montant</div>
                    <div className="strong small">{fmtEUR(taskPrice)}</div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="xs muted task-group-pricing-note">
            {client.billingMode === "HOURLY"
              ? `Calcul : jours saisis × 8 h × ${fmtEUR(client.rate)}/h.`
              : client.billingMode === "DAILY"
                ? `Calcul : jours saisis × ${fmtEUR(client.rate)}/jour.`
                : "Le temps reste visible, mais un forfait ne peut pas être ventilé automatiquement par task."}
          </div>
        </div>
      )}
    </div>
  )
}

export default function TaskGroupsPage() {
  const { toast } = useToast()
  const { data: clients = [] } = useClients()
  const [clientId, setClientId] = useState("")
  const [editor, setEditor] = useState<"new" | TaskGroupDTO | null>(null)
  const [groupToDelete, setGroupToDelete] = useState<TaskGroupDTO | null>(null)
  const {
    data: tasks = [],
    isPending: tasksPending,
    hasNextPage: hasMoreTasks,
    isFetchingNextPage: fetchingMoreTasks,
    fetchNextPage,
  } = useTasks(
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
  const loading =
    tasksPending || groupsPending || fetchingMoreTasks || Boolean(hasMoreTasks)

  useEffect(() => {
    if (!clientId || !hasMoreTasks || fetchingMoreTasks) return
    void fetchNextPage()
  }, [clientId, fetchNextPage, fetchingMoreTasks, hasMoreTasks])

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
    <div className="page task-groups-page">
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
              disabled={!clientId || editor !== null || loading}
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
                {pending.map((group) =>
                  client ? (
                    <PendingTaskGroupCard
                      key={group.id}
                      group={group}
                      client={client}
                      removePending={remove.isPending}
                      onEdit={() => setEditor(group)}
                      onDelete={() => setGroupToDelete(group)}
                    />
                  ) : null,
                )}
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
