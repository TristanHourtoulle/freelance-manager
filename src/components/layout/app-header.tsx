"use client"

import { Bars3Icon } from "@heroicons/react/24/outline"

interface AppHeaderProps {
  onMenuToggle: () => void
}

export function AppHeader({ onMenuToggle }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 lg:hidden dark:border-zinc-800 dark:bg-zinc-950">
      <button
        onClick={onMenuToggle}
        className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <Bars3Icon className="h-5 w-5" />
      </button>
      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        FreelanceDash
      </span>
    </header>
  )
}
