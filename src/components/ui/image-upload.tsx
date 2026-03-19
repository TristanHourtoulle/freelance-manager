"use client"

import { useCallback, useRef, useState } from "react"
import { CameraIcon, XMarkIcon } from "@heroicons/react/24/outline"
import { cn } from "@/lib/utils"

const MAX_OUTPUT_SIZE = 256 * 1024 // 256KB after compression
const MAX_DIMENSION = 512 // px — resize to fit within this
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"]

/**
 * Compresses and resizes an image file to a base64 data URL.
 * Output is JPEG at progressive quality levels to stay under MAX_OUTPUT_SIZE.
 */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("Canvas context unavailable"))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)

      // Try decreasing quality until under size limit
      const qualities = [0.85, 0.7, 0.5, 0.3]
      for (const q of qualities) {
        const dataUrl = canvas.toDataURL("image/jpeg", q)
        if (dataUrl.length <= MAX_OUTPUT_SIZE * 1.37) {
          // base64 overhead ~37%
          resolve(dataUrl)
          return
        }
      }

      // Fallback: lowest quality
      resolve(canvas.toDataURL("image/jpeg", 0.2))
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Failed to load image"))
    }

    img.src = url
  })
}

interface ImageUploadProps {
  value: string | null | undefined
  onChange: (base64: string | null) => void
  size?: "sm" | "md" | "lg"
  shape?: "circle" | "rounded"
  fallback?: string
  className?: string
}

const SIZE_MAP = {
  sm: "size-10",
  md: "size-16",
  lg: "size-24",
}

export function ImageUpload({
  value,
  onChange,
  size = "md",
  shape = "circle",
  fallback,
  className,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      setError(null)

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError("Only PNG, JPEG, or WebP images are accepted")
        return
      }

      // Allow up to 5MB input — compression will resize + reduce quality
      if (file.size > 5 * 1024 * 1024) {
        setError("Image must be under 5MB")
        return
      }

      setIsCompressing(true)
      try {
        const base64 = await compressImage(file)
        onChange(base64)
      } catch {
        setError("Failed to process image")
      } finally {
        setIsCompressing(false)
      }

      e.target.value = ""
    },
    [onChange],
  )

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      onChange(null)
      setError(null)
    },
    [onChange],
  )

  const shapeClass = shape === "circle" ? "rounded-full" : "rounded-xl"

  return (
    <div className={cn("flex flex-col items-start gap-2", className)}>
      {/* Wrapper with extra padding so the delete button is never clipped */}
      <div className="relative p-1">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isCompressing}
          className={cn(
            "group relative flex shrink-0 cursor-pointer items-center justify-center overflow-hidden border-2 border-dashed border-border transition-colors hover:border-primary/50 disabled:cursor-wait disabled:opacity-60",
            shapeClass,
            SIZE_MAP[size],
          )}
        >
          {value ? (
            <>
              <img
                src={value}
                alt="Upload preview"
                className={cn("size-full object-cover", shapeClass)}
              />
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100",
                  shapeClass,
                )}
              >
                <CameraIcon className="size-5 text-white" />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              {fallback ? (
                <span className="text-sm font-medium">{fallback}</span>
              ) : (
                <CameraIcon className="size-5" />
              )}
            </div>
          )}
        </button>

        {/* Delete button — positioned outside overflow:hidden, above everything */}
        {value && (
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -right-1 -top-1 z-50 flex size-5 items-center justify-center rounded-full bg-destructive text-white shadow-sm transition-colors hover:bg-destructive/80"
          >
            <XMarkIcon className="size-3" />
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={handleFileChange}
        className="hidden"
      />
      {isCompressing && (
        <p className="text-xs text-muted-foreground">Compressing...</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
