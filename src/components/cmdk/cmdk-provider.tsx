"use client"

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { useToast } from "@/components/providers/toast-provider"
import { useSyncLinear } from "@/hooks/use-tasks"
import {
  CommandPalette,
  type CommandItem,
} from "@/components/cmdk/command-palette"
import { useCommandPalette } from "@/components/cmdk/use-command-palette"
import { useCommandSearch } from "@/components/cmdk/use-command-search"
import { useKeySequence } from "@/components/cmdk/use-key-sequence"
import { useOptionalQuickCapture } from "@/components/capture/quick-capture-provider"

interface CmdKContextValue {
  open: () => void
  close: () => void
}

const CmdKContext = createContext<CmdKContextValue | null>(null)

/**
 * Mounts the {@link CommandPalette} once at the app root, wires the
 * default ⌘K / Ctrl+K shortcut, and exposes `useCmdK()` so any child
 * can open/close it (e.g. the topbar search button).
 */
export function CmdKProvider({ children }: { children: ReactNode }) {
  const capture = useOptionalQuickCapture()
  const { open, setOpen } = useCommandPalette(capture?.open)
  const router = useRouter()
  const { toast } = useToast()
  const syncLinear = useSyncLinear()
  const [query, setQuery] = useState("")
  const searchResults = useCommandSearch(query, router, open)

  useKeySequence(
    useMemo(
      () => ({
        gd: () => router.push("/dashboard"),
        gc: () => router.push("/clients"),
        gp: () => router.push("/projects"),
        gt: () => router.push("/tasks"),
        gf: () => router.push("/billing"),
        ga: () => router.push("/analytics"),
        gs: () => router.push("/settings"),
      }),
      [router],
    ),
  )

  const staticCommands = useMemo<CommandItem[]>(
    () => [
      {
        id: "go-dashboard",
        group: "Navigation",
        label: "Aller au dashboard",
        icon: "dashboard",
        shortcut: ["G", "D"],
        keywords: ["accueil", "home", "pilotage"],
        run: () => router.push("/dashboard"),
      },
      {
        id: "go-clients",
        group: "Navigation",
        label: "Aller aux clients",
        icon: "users",
        shortcut: ["G", "C"],
        keywords: ["clients", "customer"],
        run: () => router.push("/clients"),
      },
      {
        id: "go-projects",
        group: "Navigation",
        label: "Aller aux projets",
        icon: "folder",
        shortcut: ["G", "P"],
        keywords: ["projects", "linear"],
        run: () => router.push("/projects"),
      },
      {
        id: "go-tasks",
        group: "Navigation",
        label: "Aller aux tasks",
        icon: "check-square",
        shortcut: ["G", "T"],
        keywords: ["tasks", "todo", "linear"],
        run: () => router.push("/tasks"),
      },
      {
        id: "go-billing",
        group: "Navigation",
        label: "Aller aux factures",
        icon: "invoice",
        shortcut: ["G", "F"],
        keywords: ["billing", "facture", "invoice"],
        run: () => router.push("/billing"),
      },
      {
        id: "go-analytics",
        group: "Navigation",
        label: "Aller aux analytics",
        icon: "chart",
        shortcut: ["G", "A"],
        keywords: ["statistiques", "rapport", "performance"],
        run: () => router.push("/analytics"),
      },
      {
        id: "go-settings",
        group: "Navigation",
        label: "Aller aux réglages",
        icon: "settings",
        shortcut: ["G", "S"],
        keywords: ["preferences", "linear", "token"],
        run: () => router.push("/settings"),
      },
      {
        id: "quick-capture",
        group: "Actions",
        label: "Nouvelle action",
        hint: "Noter quelque chose sans le classer",
        icon: "plus",
        shortcut: ["⌘", "N"],
        keywords: ["capture", "note", "todo", "suivi", "action"],
        run: () => capture?.open(),
      },
      {
        id: "new-invoice",
        group: "Actions",
        label: "Nouvelle facture",
        hint: "Créer une facture (drag & drop ou ligne manuelle)",
        icon: "plus",
        keywords: ["create", "invoice", "facture"],
        run: () => router.push("/billing/new"),
      },
      {
        id: "sync-linear",
        group: "Actions",
        label: "Synchroniser Linear",
        hint: "Tirer les dernières tasks et projets",
        icon: "sync",
        keywords: ["linear", "refresh", "pull"],
        run: () => {
          syncLinear.mutate()
        },
      },
      {
        id: "logout",
        group: "Compte",
        label: "Déconnexion",
        icon: "logout",
        keywords: ["signout", "logout", "exit"],
        run: async () => {
          await authClient.signOut()
          toast({ variant: "success", title: "Déconnecté" })
          router.push("/auth/login")
          router.refresh()
        },
      },
    ],
    [router, toast, syncLinear, capture],
  )

  const commands = useMemo<CommandItem[]>(
    () => [...staticCommands, ...searchResults],
    [staticCommands, searchResults],
  )

  const value = useMemo<CmdKContextValue>(
    () => ({
      open: () => setOpen(true),
      close: () => setOpen(false),
    }),
    [setOpen],
  )

  return (
    <CmdKContext value={value}>
      {children}
      <CommandPalette
        open={open}
        onClose={() => setOpen(false)}
        commands={commands}
        onQueryChange={setQuery}
      />
    </CmdKContext>
  )
}

/**
 * Returns helpers to open/close the global command palette. Throws if
 * called outside a {@link CmdKProvider}.
 */
export function useCmdK(): CmdKContextValue {
  const ctx = useContext(CmdKContext)
  if (!ctx) {
    throw new Error("useCmdK must be used within a CmdKProvider")
  }
  return ctx
}

/**
 * Returns the command-palette controls, or `null` when no provider is
 * mounted.
 *
 * @returns The open/close helpers, or `null` outside a {@link CmdKProvider}.
 */
export function useOptionalCmdK(): CmdKContextValue | null {
  return useContext(CmdKContext)
}
