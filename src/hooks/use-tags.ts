"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

import type { CreateTagInput, UpdateTagInput } from "@/lib/schemas/tag"

interface SerializedTag {
  id: string
  userId: string
  name: string
  color: string
  createdAt: string
}

interface TagsResponse {
  items: SerializedTag[]
}

export type { SerializedTag }

/**
 * Fetches all tags for the current user. Cached for 10 minutes.
 */
export function useTags() {
  return useQuery<TagsResponse>({
    queryKey: ["tags"],
    queryFn: async () => {
      const res = await fetch("/api/tags")
      if (!res.ok) throw new Error("Failed to fetch tags")
      return res.json()
    },
    staleTime: 10 * 60 * 1000,
  })
}

/**
 * Creates a new tag. Invalidates the tags cache on success.
 */
export function useCreateTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateTagInput) => {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to create tag")
      return res.json() as Promise<SerializedTag>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] })
    },
  })
}

/**
 * Updates an existing tag. Invalidates the tags cache on success.
 */
export function useUpdateTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTagInput }) => {
      const res = await fetch(`/api/tags/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to update tag")
      return res.json() as Promise<SerializedTag>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] })
    },
  })
}

/**
 * Deletes a tag. Invalidates the tags cache on success.
 */
export function useDeleteTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tags/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete tag")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] })
    },
  })
}
