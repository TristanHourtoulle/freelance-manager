"use client"

import { useCallback, useState } from "react"
import { ImageUpload } from "@/components/ui/image-upload"
import { useToast } from "@/components/providers/toast-provider"
import { useUserImage } from "@/components/providers/user-provider"

export function ProfilePhotoForm() {
  const { toast } = useToast()
  const { image, setImage } = useUserImage()
  const [isSaving, setIsSaving] = useState(false)

  const handleChange = useCallback(
    async (value: string | null) => {
      // Update context immediately — sidebar reflects change instantly
      setImage(value)
      setIsSaving(true)

      const res = await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: value }),
      })

      setIsSaving(false)

      if (res.ok) {
        toast({
          variant: "success",
          title: value ? "Photo updated" : "Photo removed",
        })
      } else {
        toast({ variant: "error", title: "Failed to update photo" })
      }
    },
    [setImage, toast],
  )

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-base font-semibold text-foreground">Profile Photo</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload a profile photo. PNG, JPEG, or WebP — max 5MB (auto-compressed).
      </p>
      <div className="mt-4">
        <ImageUpload
          value={image}
          onChange={handleChange}
          size="lg"
          shape="circle"
        />
      </div>
      {isSaving && (
        <p className="mt-2 text-xs text-muted-foreground">Saving...</p>
      )}
    </div>
  )
}
