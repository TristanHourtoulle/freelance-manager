"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

import type {
  CreateClientNoteInput,
  UpdateClientNoteInput,
} from "@/lib/schemas/client-note"

interface ClientNote {
  id: string
  clientId: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

interface ClientNotesResponse {
  items: ClientNote[]
}

export type { ClientNote }

/**
 * Fetches all notes for a client. Cached for 5 minutes.
 */
export function useClientNotes(clientId: string) {
  return useQuery<ClientNotesResponse>({
    queryKey: ["client-notes", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/notes`)
      if (!res.ok) throw new Error("Failed to fetch notes")
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!clientId,
  })
}

/**
 * Creates a new note for a client. Invalidates the notes cache on success.
 */
export function useCreateClientNote(clientId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateClientNoteInput) => {
      const res = await fetch(`/api/clients/${clientId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to create note")
      return res.json() as Promise<ClientNote>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-notes", clientId] })
    },
  })
}

/**
 * Updates an existing note. Invalidates the notes cache on success.
 */
export function useUpdateClientNote(clientId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      noteId,
      data,
    }: {
      noteId: string
      data: UpdateClientNoteInput
    }) => {
      const res = await fetch(`/api/clients/${clientId}/notes/${noteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to update note")
      return res.json() as Promise<ClientNote>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-notes", clientId] })
    },
  })
}

/**
 * Deletes a note with optimistic cache update.
 */
export function useDeleteClientNote(clientId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (noteId: string) => {
      const res = await fetch(`/api/clients/${clientId}/notes/${noteId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete note")
    },
    onMutate: async (noteId) => {
      await queryClient.cancelQueries({
        queryKey: ["client-notes", clientId],
      })
      const previous = queryClient.getQueryData<ClientNotesResponse>([
        "client-notes",
        clientId,
      ])

      queryClient.setQueryData<ClientNotesResponse>(
        ["client-notes", clientId],
        (old) => {
          if (!old) return old
          return {
            ...old,
            items: old.items.filter((item) => item.id !== noteId),
          }
        },
      )

      return { previous }
    },
    onError: (_err, _noteId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["client-notes", clientId], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["client-notes", clientId] })
    },
  })
}
