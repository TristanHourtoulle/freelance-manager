import { NAV_SECTIONS } from "@/lib/navigation"

const ROOT_CRUMB = "FreelanceManager"

const SEGMENT_LABELS = new Map<string, string>(
  NAV_SECTIONS.flatMap((section) =>
    section.items.map(
      (item) => [item.href.replace(/^\//, ""), item.label] as [string, string],
    ),
  ),
)

const NESTED_LABELS = new Map<string, string>([
  ["billing/new", "Nouvelle facture"],
])

const ENTITY_LABELS = new Map<string, string>([
  ["clients", "Fiche client"],
  ["billing", "Facture"],
])

/**
 * Derive the topbar breadcrumb trail from the current pathname.
 *
 * @param pathname Current route path (e.g. `/clients/abc123`).
 * @returns Ordered crumb labels, always starting with the app root. The
 * last entry is styled as the current page by the Topbar.
 */
export function deriveCrumbs(pathname: string): string[] {
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

  const entityLabel = ENTITY_LABELS.get(root)
  if (entityLabel) crumbs.push(entityLabel)

  return crumbs
}
