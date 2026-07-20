import { NAV_SECTIONS } from "@/lib/navigation"

const ROOT_CRUMB = "FreelanceManager"

const SEGMENT_LABELS = new Map<string, string>(
  NAV_SECTIONS.flatMap((section) =>
    section.items.map(
      (item) => [item.href.replace(/^\//, ""), item.label] as [string, string],
    ),
  ),
)

const NESTED_LABELS = new Map<string, string>([["billing/new", "Nouvelle"]])

const ENTITY_LABELS = new Map<string, string>([["billing", "Facture"]])

/**
 * Derive the topbar breadcrumb trail from the current pathname.
 *
 * @param pathname Current route path (e.g. `/clients/abc123`).
 * @param resolvedLabel Human label for the entity segment (e.g. the client
 * full name). When omitted, the trail stops at the id-less parent.
 * @returns Ordered crumb labels, always starting with the app root. The
 * last entry is styled as the current page by the Topbar.
 */
export function deriveCrumbs(
  pathname: string,
  resolvedLabel?: string,
): string[] {
  const segments = pathname.split("/").filter(Boolean)
  const crumbs = [ROOT_CRUMB]

  const root = segments[0]
  if (!root) return crumbs

  const rootLabel = SEGMENT_LABELS.get(root)
  if (!rootLabel) return crumbs
  crumbs.push(rootLabel)

  const child = segments[1]
  if (!child) return crumbs

  const nestedLabel = NESTED_LABELS.get(`${root}/${child}`)
  if (nestedLabel) {
    crumbs.push(nestedLabel)
    return crumbs
  }

  if (resolvedLabel) {
    crumbs.push(resolvedLabel)
    return crumbs
  }

  const entityLabel = ENTITY_LABELS.get(root)
  if (entityLabel) crumbs.push(entityLabel)

  return crumbs
}
