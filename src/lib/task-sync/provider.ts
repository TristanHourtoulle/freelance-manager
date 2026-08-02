export interface TaskSyncResult {
  projects: number
  tasks: number
}

export interface TaskSyncProgress {
  doneMappings: number
  currentLabel: string | null
}

export interface TaskSyncContext {
  userId: string
  reportProgress(progress: TaskSyncProgress): Promise<void>
}

/**
 * Boundary implemented by every external task system.
 *
 * Provider-specific authentication, mapping lookup and API translation stay
 * behind this contract. The application only orchestrates progress and run
 * lifecycle through the normalized result.
 */
export interface TaskProvider {
  readonly id: string
  readonly displayName: string
  countMappings(userId: string): Promise<number>
  sync(context: TaskSyncContext): Promise<TaskSyncResult>
  cacheTags?(userId: string): readonly string[]
}
