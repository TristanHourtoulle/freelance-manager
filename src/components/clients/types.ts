/** DTO for a Linear team/project mapping attached to a client. */
export interface LinearMappingDTO {
  id: string
  clientId: string
  linearTeamId: string | null
  linearProjectId: string | null
  createdAt: string
  updatedAt: string
}

/** JSON-serializable representation of a client returned by the API. */
export interface SerializedClient {
  id: string
  userId: string
  name: string
  email: string | null
  company: string | null
  billingMode: string
  rate: number
  category: string
  notes: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  totalRevenue: number
  lastActivityAt: string | null
  linearMappings?: LinearMappingDTO[]
}

/** Generic pagination metadata returned alongside paginated API responses. */
export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}
