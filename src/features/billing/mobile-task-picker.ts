interface TaskRow {
  id: string
}

interface LineRef {
  taskId: string | null
}

/**
 * The set of task ids currently materialized as invoice lines.
 *
 * @param lines - Current builder lines.
 * @returns Task ids bound to at least one line.
 */
export function selectedTaskIds(lines: readonly LineRef[]): Set<string> {
  return new Set(
    lines.map((l) => l.taskId).filter((x): x is string => Boolean(x)),
  )
}

/**
 * Merges the still-eligible tasks with the ones already added as lines.
 *
 * `filterEligibleTasks` drops a task as soon as it becomes a line, which would
 * make a tapped row disappear on mobile. Re-adding the selected tasks in the
 * original `tasks` order keeps every row in place so a second tap can remove
 * it.
 *
 * @param tasks - The full task list (defines the display order).
 * @param eligible - Tasks that can still be added.
 * @param lines - Current builder lines.
 * @returns The tappable task list, in stable order.
 */
export function mergePickableTasks<T extends TaskRow>(
  tasks: readonly T[],
  eligible: readonly T[],
  lines: readonly LineRef[],
): T[] {
  const eligibleIds = new Set(eligible.map((t) => t.id))
  const picked = selectedTaskIds(lines)
  return tasks.filter((t) => eligibleIds.has(t.id) || picked.has(t.id))
}
