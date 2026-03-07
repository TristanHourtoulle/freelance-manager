"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { UsersIcon, CheckCircleIcon } from "@heroicons/react/24/outline"
import { NAV_ITEMS, ACTION_ITEMS } from "@/lib/navigation"
import { fuzzyFilter } from "@/lib/fuzzy-match"
import type { NavItem, ActionItem } from "@/lib/navigation"

export type CommandItemType = "page" | "action" | "client" | "task"

export interface CommandItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  type: CommandItemType
  href?: string
  apiCall?: string
  comingSoon?: boolean
}

export interface CommandSection {
  title: string
  items: CommandItem[]
}

interface SearchResults {
  clients: Array<{
    id: string
    name: string
    company: string | null
    category: string
  }>
  tasks: Array<{ id: string; identifier: string; title: string; url: string }>
}

function navToCommand(item: NavItem): CommandItem {
  return {
    id: `page-${item.href}`,
    label: item.label,
    icon: item.icon,
    type: "page",
    href: item.href,
  }
}

function actionToCommand(item: ActionItem): CommandItem {
  return {
    id: `action-${item.id}`,
    label: item.label,
    icon: item.icon,
    type: "action",
    href: item.href,
    apiCall: item.apiCall,
    comingSoon: item.comingSoon,
  }
}

export function useCommandPalette() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const [searchResults, setSearchResults] = useState<SearchResults>({
    clients: [],
    tasks: [],
  })
  const [isSyncing, setIsSyncing] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)

  const open = useCallback(() => {
    setIsOpen(true)
    setQuery("")
    setActiveIndex(0)
    setSearchResults({ clients: [], tasks: [] })
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setQuery("")
    setActiveIndex(0)
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setIsOpen((prev) => {
          if (prev) {
            setQuery("")
            setActiveIndex(0)
            return false
          }
          setSearchResults({ clients: [], tasks: [] })
          return true
        })
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    if (!isOpen) return

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (query.length < 2) {
      setSearchResults({ clients: [], tasks: [] })
      return
    }

    const currentRequestId = ++requestIdRef.current

    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) {
        abortRef.current.abort()
      }

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        )
        if (!response.ok) throw new Error("Search failed")

        const data: SearchResults = await response.json()

        if (currentRequestId === requestIdRef.current) {
          setSearchResults(data)
          setActiveIndex(0)
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }
      }
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, isOpen])

  const sections = useMemo((): CommandSection[] => {
    const result: CommandSection[] = []

    const filteredPages = fuzzyFilter(query, NAV_ITEMS, (item) => item.label)
    if (filteredPages.length > 0) {
      result.push({
        title: "Pages",
        items: filteredPages.map(navToCommand),
      })
    }

    const filteredActions = fuzzyFilter(
      query,
      ACTION_ITEMS,
      (item) => item.label,
    )
    if (filteredActions.length > 0) {
      result.push({
        title: "Actions",
        items: filteredActions.map(actionToCommand),
      })
    }

    if (searchResults.clients.length > 0) {
      result.push({
        title: "Clients",
        items: searchResults.clients.map((client) => ({
          id: `client-${client.id}`,
          label: client.company
            ? `${client.name} (${client.company})`
            : client.name,
          icon: UsersIcon,
          type: "client" as const,
          href: `/clients/${client.id}`,
        })),
      })
    }

    if (searchResults.tasks.length > 0) {
      result.push({
        title: "Tasks",
        items: searchResults.tasks.map((task) => ({
          id: `task-${task.id}`,
          label: `${task.identifier} - ${task.title}`,
          icon: CheckCircleIcon,
          type: "task" as const,
          href: task.url,
        })),
      })
    }

    return result
  }, [query, searchResults])

  const allItems = useMemo(() => sections.flatMap((s) => s.items), [sections])

  const executeItem = useCallback(
    async (item: CommandItem) => {
      close()

      if (item.comingSoon) {
        return
      }

      if (item.href) {
        if (item.type === "task" && item.href.startsWith("http")) {
          window.open(item.href, "_blank", "noopener,noreferrer")
        } else {
          router.push(item.href)
        }
        return
      }

      if (item.apiCall) {
        setIsSyncing(true)
        try {
          await fetch(item.apiCall, { method: "POST" })
        } finally {
          setIsSyncing(false)
        }
      }
    },
    [close, router],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveIndex((prev) => (prev < allItems.length - 1 ? prev + 1 : 0))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : allItems.length - 1))
      } else if (e.key === "Enter") {
        e.preventDefault()
        const item = allItems[activeIndex]
        if (item) {
          void executeItem(item)
        }
      } else if (e.key === "Escape") {
        e.preventDefault()
        close()
      }
    },
    [allItems, activeIndex, executeItem, close],
  )

  return {
    isOpen,
    open,
    close,
    query,
    setQuery,
    sections,
    allItems,
    activeIndex,
    setActiveIndex,
    executeItem,
    handleKeyDown,
    inputRef,
    isSyncing,
  }
}
