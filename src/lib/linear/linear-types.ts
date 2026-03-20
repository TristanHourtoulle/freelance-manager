/** Normalized representation of a Linear team. */
export interface LinearTeamDTO {
  id: string
  name: string
  key: string
  description: string | undefined
  color: string | undefined
  icon: string | undefined
}

/** Normalized representation of a Linear project. */
export interface LinearProjectDTO {
  id: string
  name: string
  description: string
  state: string
  progress: number
  startDate: string | undefined
  targetDate: string | undefined
  color: string
  icon: string | undefined
}

/** Normalized representation of a Linear issue workflow status. */
export interface LinearIssueStatusDTO {
  id: string
  name: string
  type: string
  color: string
}

/** Normalized representation of a Linear issue assignee. */
export interface LinearIssueAssigneeDTO {
  id: string
  name: string
  email: string | undefined
}

/** Normalized representation of a Linear issue label. */
export interface LinearIssueLabelDTO {
  id: string
  name: string
  color: string
}

/** Normalized representation of a Linear issue with status, assignee, and labels. */
export interface LinearIssueDTO {
  id: string
  identifier: string
  title: string
  estimate: number | undefined
  completedAt: string | undefined
  createdAt: string
  url: string
  priority: number
  priorityLabel: string
  status: LinearIssueStatusDTO | undefined
  assignee: LinearIssueAssigneeDTO | undefined
  labels: LinearIssueLabelDTO[]
  projectId: string | undefined
  projectName: string | undefined
  teamId: string | undefined
}

/** Extended issue DTO with description, dates, and project name for the detail view. */
export interface LinearIssueDetailDTO extends LinearIssueDTO {
  description: string | undefined
  updatedAt: string
  dueDate: string | undefined
  projectName: string | undefined
  comments: LinearCommentDTO[]
  attachments: LinearAttachmentDTO[]
  history: LinearHistoryEntryDTO[]
}

/** Normalized team member for assignment. */
export interface LinearMemberDTO {
  id: string
  name: string
  email: string | undefined
}

/** Normalized workflow state for status selection. */
export interface LinearWorkflowStateDTO {
  id: string
  name: string
  type: string
  color: string
}

/** A comment on a Linear issue. */
export interface LinearCommentDTO {
  id: string
  body: string
  createdAt: string
  updatedAt: string
  user:
    | {
        id: string
        name: string
        avatarUrl: string | undefined
      }
    | undefined
}

/** An attachment on a Linear issue. */
export interface LinearAttachmentDTO {
  id: string
  title: string
  url: string
  subtitle: string | undefined
  createdAt: string
}

/** A history entry on a Linear issue. */
export interface LinearHistoryEntryDTO {
  id: string
  createdAt: string
  fromState: { name: string; color: string } | undefined
  toState: { name: string; color: string } | undefined
  fromAssignee: { name: string } | undefined
  toAssignee: { name: string } | undefined
  fromPriority: number | undefined
  toPriority: number | undefined
  actor: { name: string } | undefined
}

/** Lightweight issue representation returned by search queries. */
export interface LinearIssueSearchResult {
  id: string
  identifier: string
  title: string
  url: string
}
