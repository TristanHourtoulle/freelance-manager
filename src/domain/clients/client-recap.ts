export interface ClientRecapProject {
  name: string
  tasks: { identifier: string; title: string; completedAt: string }[]
}

export interface ClientRecapMeeting {
  title: string
  heldAt: string
  durationMinutes: number
}

export interface ClientRecapNextStep {
  title: string
  dueDate: string | null
  waiting: boolean
}

export interface ClientFacingRecap {
  clientName: string
  periodStart: string
  periodEnd: string
  issuedAt: string
  projects: ClientRecapProject[]
  meetings: ClientRecapMeeting[]
  nextSteps: ClientRecapNextStep[]
}

export interface BuildClientFacingRecapInput {
  clientName: string
  periodStart: Date
  periodEnd: Date
  issuedAt: Date
  completedTasks: {
    identifier: string
    title: string
    completedAt: Date
    projectName: string
  }[]
  heldMeetings: {
    title: string
    heldAt: Date
    durationMinutes: number
  }[]
  openActions: {
    title: string
    dueDate: Date | null
    status: string
  }[]
}

/**
 * Compose the client-facing recap from already-loaded rows.
 *
 * @param input - Client display name, period bounds, completed tasks with their project, held meetings and open actions.
 * @returns A payload containing only information the client is entitled to see.
 */
export function buildClientFacingRecap(
  input: BuildClientFacingRecapInput,
): ClientFacingRecap {
  const startMs = input.periodStart.getTime()
  const endMs = input.periodEnd.getTime()

  const grouped = new Map<string, ClientRecapProject["tasks"]>()
  for (const task of input.completedTasks) {
    const at = task.completedAt.getTime()
    if (at < startMs || at > endMs) continue
    const bucket = grouped.get(task.projectName) ?? []
    bucket.push({
      identifier: task.identifier,
      title: task.title,
      completedAt: task.completedAt.toISOString(),
    })
    grouped.set(task.projectName, bucket)
  }

  const projects: ClientRecapProject[] = [...grouped.entries()]
    .filter(([, tasks]) => tasks.length > 0)
    .map(([name, tasks]) => ({
      name,
      tasks: tasks
        .slice()
        .sort((a, b) => a.completedAt.localeCompare(b.completedAt)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"))

  const meetings: ClientRecapMeeting[] = input.heldMeetings
    .filter((m) => {
      const at = m.heldAt.getTime()
      return at >= startMs && at <= endMs
    })
    .map((m) => ({
      title: m.title,
      heldAt: m.heldAt.toISOString(),
      durationMinutes: m.durationMinutes,
    }))
    .sort((a, b) => a.heldAt.localeCompare(b.heldAt))

  const nextSteps: ClientRecapNextStep[] = input.openActions.map((a) => ({
    title: a.title,
    dueDate: a.dueDate ? a.dueDate.toISOString() : null,
    waiting: a.status === "WAITING",
  }))

  return {
    clientName: input.clientName,
    periodStart: input.periodStart.toISOString(),
    periodEnd: input.periodEnd.toISOString(),
    issuedAt: input.issuedAt.toISOString(),
    projects,
    meetings,
    nextSteps,
  }
}
