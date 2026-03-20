"use client"

import { useState, useCallback, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import type { TaskDetailResponse } from "@/components/tasks/types"

export function AddCommentForm({ issueId }: { issueId: string }) {
  const t = useTranslations("taskDetail")
  const [body, setBody] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const queryClient = useQueryClient()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = body.trim()
      if (!trimmed) return

      setIsSubmitting(true)
      try {
        const res = await fetch(`/api/linear/issues/${issueId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: trimmed }),
        })

        if (!res.ok) throw new Error(t("failedToComment"))

        const newComment = await res.json()

        queryClient.setQueryData<TaskDetailResponse>(
          ["task-detail", issueId],
          (prev) =>
            prev
              ? {
                  ...prev,
                  issue: {
                    ...prev.issue,
                    comments: [...prev.issue.comments, newComment],
                  },
                }
              : prev,
        )

        setBody("")
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto"
        }
      } finally {
        setIsSubmitting(false)
      }
    },
    [body, issueId, queryClient, t],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSubmit(e)
      }
    },
    [handleSubmit],
  )

  const handleInput = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [])

  const modKey =
    typeof navigator !== "undefined" &&
    // @ts-expect-error -- navigator.userAgentData is not yet in all TS lib types
    (navigator.userAgentData?.platform === "macOS" ||
      navigator.platform?.includes("Mac"))
      ? "Cmd"
      : "Ctrl"

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder={t("addComment")}
        rows={2}
        className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">
          {t("sendShortcut", { key: modKey })}
        </span>
        <button
          type="submit"
          disabled={!body.trim() || isSubmitting}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? t("sending") : t("comment")}
        </button>
      </div>
    </form>
  )
}
