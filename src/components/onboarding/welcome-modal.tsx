"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import {
  UserGroupIcon,
  ClipboardDocumentCheckIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { WelcomeSlide } from "./welcome-slide"

const SLIDE_ICONS = [
  UserGroupIcon,
  ClipboardDocumentCheckIcon,
  BanknotesIcon,
] as const

const SLIDE_KEYS = [
  { titleKey: "slide1Title", descKey: "slide1Desc" },
  { titleKey: "slide2Title", descKey: "slide2Desc" },
  { titleKey: "slide3Title", descKey: "slide3Desc" },
] as const

const SESSION_KEY = "fm:welcome-session-dismissed"
const PERMANENT_KEY = "fm:welcome-permanently-dismissed"

interface WelcomeModalProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Full-screen welcome modal with multi-slide onboarding carousel.
 * Shown on first visit and dismissed via localStorage.
 *
 * @param isOpen - Whether the modal is visible
 * @param onClose - Callback to close and dismiss the modal
 */
export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const overlayRef = useRef<HTMLDivElement>(null)
  const isLastSlide = currentSlide === SLIDE_KEYS.length - 1
  const t = useTranslations("welcome")

  const handleDismissSession = useCallback(() => {
    sessionStorage.setItem(SESSION_KEY, "1")
    onClose()
  }, [onClose])

  const handleDismissPermanent = useCallback(() => {
    localStorage.setItem(PERMANENT_KEY, "1")
    onClose()
  }, [onClose])

  const handleNext = useCallback(() => {
    if (isLastSlide) {
      handleDismissSession()
    } else {
      setCurrentSlide((s) => s + 1)
    }
  }, [isLastSlide, handleDismissSession])

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleDismissSession()
    }

    document.addEventListener("keydown", handleKeyDown)
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [isOpen, handleDismissSession])

  if (!isOpen) return null

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) {
      handleDismissSession()
    }
  }

  const currentKey = SLIDE_KEYS[currentSlide]!

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
    >
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-lg">
        <WelcomeSlide
          icon={SLIDE_ICONS[currentSlide]!}
          title={t(currentKey.titleKey)}
          description={t(currentKey.descKey)}
        />

        {/* Dot indicators */}
        <div className="mt-4 flex items-center justify-center gap-2">
          {SLIDE_KEYS.map((_, index) => (
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
          <div className="flex items-center gap-4">
            <button
              onClick={handleDismissSession}
              className="text-sm text-text-muted hover:text-text-secondary transition-colors"
            >
              {t("skip")}
            </button>
            <button
              onClick={handleDismissPermanent}
              className="text-xs text-text-muted/60 hover:text-text-secondary transition-colors"
            >
              {t("dontShowAgain")}
            </button>
          </div>
          <Button onClick={handleNext}>
            {isLastSlide ? t("getStarted") : t("next")}
          </Button>
        </div>
      </div>
    </div>
  )
}
