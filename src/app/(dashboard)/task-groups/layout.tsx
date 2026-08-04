import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Groupes de tasks",
}

export default function TaskGroupsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
