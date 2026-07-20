"use client"

import type { MouseEvent } from "react"

interface TaskIdLinkProps {
  identifier: string
  url?: string | null
  className?: string
  stopPropagation?: boolean
}

/**
 * Linear issue identifier, rendered as a deep link when the issue URL is known.
 *
 * Tasks synced before the `linearUrl` column existed have no URL and render as
 * inert text, exactly as they did before.
 *
 * @param identifier Linear issue identifier, e.g. `TRI-543`.
 * @param url Absolute linear.app issue URL, or null when unknown.
 * @param className Class applied to the rendered element, e.g. `task-id`.
 * @param stopPropagation Keep the click from reaching a clickable parent row.
 * @returns An anchor when `url` is set, a span otherwise.
 */
export function TaskIdLink({
  identifier,
  url,
  className,
  stopPropagation = false,
}: TaskIdLinkProps) {
  if (!url) return <span className={className}>{identifier}</span>

  const onClick = stopPropagation
    ? (event: MouseEvent<HTMLAnchorElement>) => event.stopPropagation()
    : undefined

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      draggable={false}
      className={className ? `${className} task-link` : "task-link"}
      title={`Ouvrir ${identifier} dans Linear`}
      onClick={onClick}
    >
      {identifier}
    </a>
  )
}
