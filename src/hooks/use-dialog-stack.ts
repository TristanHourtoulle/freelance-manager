"use client"

import type { RefObject } from "react"
import { useEffect } from "react"

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

const dialogStack: HTMLElement[] = []

let scrollLockCount = 0
let previousBodyOverflow = ""

function registerDialog(element: HTMLElement) {
  const nestedIndex = dialogStack.findIndex((entry) => element.contains(entry))
  if (nestedIndex === -1) {
    dialogStack.push(element)
    return
  }
  dialogStack.splice(nestedIndex, 0, element)
}

function unregisterDialog(element: HTMLElement) {
  const index = dialogStack.indexOf(element)
  if (index !== -1) {
    dialogStack.splice(index, 1)
  }
}

function isTopmostDialog(element: HTMLElement) {
  return dialogStack[dialogStack.length - 1] === element
}

function lockBodyScroll() {
  if (scrollLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
  }
  scrollLockCount += 1
}

function releaseBodyScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1)
  if (scrollLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow
  }
}

/**
 * Shared modal-dialog behaviour: body scroll lock (reference-counted across
 * stacked dialogs), initial focus inside the dialog, focus restoration to the
 * trigger on unmount, and a Tab focus trap. Escape and the Tab trap are only
 * honoured by the topmost dialog of the stack, so nested modals and sheets
 * coexist without fighting each other.
 *
 * @param ref Ref pointing at the element carrying `role="dialog"`.
 * @param onClose Called when the topmost dialog receives Escape.
 */
export function useDialogStack(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  useEffect(() => {
    lockBodyScroll()
    return releaseBodyScroll
  }, [])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    registerDialog(dialog)
    return () => {
      unregisterDialog(dialog)
    }
  }, [ref])

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    const dialog = ref.current
    const firstFocusable =
      dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    if (firstFocusable) {
      firstFocusable.focus()
    } else {
      dialog?.focus()
    }

    return () => {
      previouslyFocused?.focus()
    }
  }, [ref])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const dialog = ref.current
      if (!dialog || !isTopmostDialog(dialog)) return
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== "Tab") return
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      )
      if (focusables.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (!first || !last) return
      const activeElement = document.activeElement
      if (event.shiftKey) {
        if (activeElement === first || !dialog.contains(activeElement)) {
          event.preventDefault()
          last.focus()
        }
      } else if (activeElement === last || !dialog.contains(activeElement)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [ref, onClose])
}
