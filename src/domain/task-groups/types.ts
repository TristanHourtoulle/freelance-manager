export interface TaskGroupTaskDTO {
  id: string
  linearIdentifier: string
  linearUrl: string | null
  title: string
  estimate: number | null
  clientId: string
  projectId: string
}

export interface TaskGroupDTO {
  id: string
  name: string
  clientId: string
  invoiceId: string | null
  invoiceNumber: string | null
  createdAt: string
  updatedAt: string
  tasks: TaskGroupTaskDTO[]
}
