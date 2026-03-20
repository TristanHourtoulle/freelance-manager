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

/** Lightweight issue representation returned by search queries. */
export interface LinearIssueSearchResult {
  id: string
  identifier: string
  title: string
  url: string
}
