"use client"

import { useState } from "react"
import { SparklesIcon } from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/providers/toast-provider"

interface DemoDataButtonProps {
  onSeeded?: () => void
}

/**
 * Button that seeds demo data for new users.
 * Calls POST /api/demo/seed, then triggers the onSeeded callback on success.
 */
export function DemoDataButton({ onSeeded }: DemoDataButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  async function handleSeed() {
    setIsLoading(true)
    try {
      const response = await fetch("/api/demo/seed", { method: "POST" })
      const data = await response.json()

      if (!response.ok) {
        toast({
          variant: "error",
          title: data.error?.message ?? "Failed to load demo data",
        })
        return
      }

      toast({
        variant: "success",
        title: `Demo data loaded: ${data.created.clients} clients, ${data.created.expenses} expenses, ${data.created.invoices} invoices`,
      })
      onSeeded?.()
    } catch {
      toast({ variant: "error", title: "Failed to load demo data" })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      shape="pill"
      size="lg"
      onClick={handleSeed}
      disabled={isLoading}
    >
      <SparklesIcon className="size-4" />
      {isLoading ? "Loading..." : "Load demo data"}
    </Button>
  )
}
