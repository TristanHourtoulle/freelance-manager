"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { useToast } from "@/components/providers/toast-provider"
import {
  CommandPalette,
  type CommandItem,
} from "@/components/cmdk/command-palette"
import { useCommandPalette } from "@/components/cmdk/use-command-palette"

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
  const { open, setOpen } = useCommandPalette()
  const router = useRouter()
  const { toast } = useToast()

  const commands = useMemo<CommandItem[]>(
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
        keywords: ["clients", "customer"],
        run: () => router.push("/clients"),
      },
      {
        id: "go-projects",
        group: "Navigation",
        label: "Aller aux projets",
        icon: "folder",
        keywords: ["projects", "linear"],
        run: () => router.push("/projects"),
      },
      {
        id: "go-tasks",
        group: "Navigation",
        label: "Aller aux tasks",
        icon: "check-square",
        keywords: ["tasks", "todo", "linear"],
        run: () => router.push("/tasks"),
      },
      {
        id: "go-billing",
        group: "Navigation",
        label: "Aller aux factures",
        icon: "invoice",
        keywords: ["billing", "facture", "invoice"],
        run: () => router.push("/billing"),
      },
      {
        id: "go-analytics",
        group: "Navigation",
        label: "Aller aux analytics",
        icon: "chart",
        keywords: ["statistiques", "rapport", "performance"],
        run: () => router.push("/analytics"),
      },
      {
        id: "go-settings",
        group: "Navigation",
        label: "Aller aux réglages",
        icon: "settings",
        keywords: ["preferences", "linear", "token"],
        run: () => router.push("/settings"),
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
        run: async () => {
          try {
            const res = await fetch("/api/linear/refresh", {
              method: "POST",
              credentials: "include",
            })
            if (!res.ok) throw new Error(await res.text())
            const data = (await res.json()) as {
              tasks: number
              projects: number
            }
            toast({
              variant: "success",
              title: "Sync Linear terminée",
              description: `${data.tasks} tasks · ${data.projects} projets`,
            })
          } catch (e) {
            toast({
              variant: "error",
              title: "Sync échouée",
              description: e instanceof Error ? e.message : String(e),
            })
          }
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
    [router, toast],
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
