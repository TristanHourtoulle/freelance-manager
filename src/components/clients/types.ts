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
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}
