import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"
import { useTranslations } from "next-intl"
import type { CommentDTO } from "@/components/tasks/types"
import { formatDate } from "./utils"

export function CommentCard({ comment }: { comment: CommentDTO }) {
  const t = useTranslations("taskDetail")

  return (
    <div className="rounded-lg border border-border/50 p-3.5">
      <div className="flex items-center gap-2 mb-2">
        {comment.user?.avatarUrl ? (
          <img
            src={comment.user.avatarUrl}
            alt={comment.user.name}
            className="h-6 w-6 rounded-full"
          />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
            {comment.user?.name?.charAt(0) ?? "?"}
          </div>
        )}
        <span className="text-sm font-medium text-text-primary">
          {comment.user?.name ?? t("unknown")}
        </span>
        <span className="text-xs text-text-muted">
          {formatDate(comment.createdAt)}
        </span>
      </div>
      <div className="linear-markdown text-[0.85rem]">
        <Markdown remarkPlugins={[remarkGfm, remarkBreaks]}>
          {comment.body}
        </Markdown>
      </div>
    </div>
  )
}
