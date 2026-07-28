/**
 * Deduplicated union of explicitly selected task ids and the task ids carried
 * by invoice lines, so every task referenced by a line is marked as invoiced.
 *
 * @param taskIds - Task ids explicitly selected for invoicing, if any.
 * @param lines - Invoice lines whose optional taskId also binds a task.
 * @returns Unique task ids to attach to the invoice.
 */
export function collectInvoicedTaskIds(
  taskIds: readonly string[] | undefined,
  lines: ReadonlyArray<{ taskId?: string | null }>,
): string[] {
  const ids = new Set<string>(taskIds ?? [])
  for (const line of lines) {
    if (line.taskId) ids.add(line.taskId)
  }
  return [...ids]
}
