"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import {
  UserGroupIcon,
  ClipboardDocumentCheckIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import { WelcomeSlide } from "./welcome-slide"

const SLIDES = [
  {
    icon: UserGroupIcon,
    title: "Track your clients",
    description:
      "Manage clients, set rates, and organize projects in one place.",
  },
  {
    icon: ClipboardDocumentCheckIcon,
    title: "Import tasks from Linear",
    description:
      "Connect your Linear projects and track billable work automatically.",
  },
  {
    icon: BanknotesIcon,
    title: "Invoice with confidence",
    description: "Mark tasks as invoiced and track your monthly revenue.",
  },
]

const STORAGE_KEY = "fm:welcome-dismissed"

interface WelcomeModalProps {
  isOpen: boolean
  onClose: () => void
}

export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const overlayRef = useRef<HTMLDivElement>(null)
  const isLastSlide = currentSlide === SLIDES.length - 1

  const handleDismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "1")
    onClose()
  }, [onClose])

  const handleNext = useCallback(() => {
    if (isLastSlide) {
      handleDismiss()
    } else {
      setCurrentSlide((s) => s + 1)
    }
  }, [isLastSlide, handleDismiss])

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleDismiss()
    }

    document.addEventListener("keydown", handleKeyDown)
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [isOpen, handleDismiss])

  if (!isOpen) return null

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) {
      handleDismiss()
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
    >
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-lg">
        <WelcomeSlide {...SLIDES[currentSlide]!} />

        {/* Dot indicators */}
        <div className="mt-4 flex items-center justify-center gap-2">
          {SLIDES.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`h-2 w-2 rounded-full transition-colors ${
                index === currentSlide ? "bg-primary" : "bg-surface-muted"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={handleDismiss}
            className="text-sm text-text-muted hover:text-text-secondary transition-colors"
          >
            Skip
          </button>
          <Button onClick={handleNext}>
            {isLastSlide ? "Get Started" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  )
}
