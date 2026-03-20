"use client"

import { useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowPathIcon } from "@heroicons/react/24/outline"

const THRESHOLD = 80

interface PullToRefreshProps {
  children: React.ReactNode
}

export function PullToRefresh({ children }: PullToRefreshProps) {
  const router = useRouter()
  const startYRef = useRef(0)
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const isPullingRef = useRef(false)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY > 0) return
    const touch = e.touches[0]
    if (!touch) return
    startYRef.current = touch.clientY
    isPullingRef.current = true
  }, [])

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isPullingRef.current || isRefreshing) return
      const touch = e.touches[0]
      if (!touch) return
      const distance = Math.max(0, touch.clientY - startYRef.current)
      setPullDistance(Math.min(distance * 0.4, THRESHOLD * 1.5))
    },
    [isRefreshing],
  )

  const handleTouchEnd = useCallback(() => {
    if (!isPullingRef.current) return
    isPullingRef.current = false

    if (pullDistance >= THRESHOLD && !isRefreshing) {
      setIsRefreshing(true)
      router.refresh()
      setTimeout(() => {
        setIsRefreshing(false)
        setPullDistance(0)
      }, 1000)
    } else {
      setPullDistance(0)
    }
  }, [pullDistance, isRefreshing, router])

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {pullDistance > 0 && (
        <div
          className="flex items-center justify-center overflow-hidden transition-[height] duration-150"
          style={{ height: pullDistance }}
        >
          <ArrowPathIcon
            className={`size-5 text-text-secondary transition-transform ${
              isRefreshing ? "animate-spin" : ""
            }`}
            style={{
              transform: isRefreshing
                ? undefined
                : `rotate(${(pullDistance / THRESHOLD) * 360}deg)`,
              opacity: Math.min(pullDistance / THRESHOLD, 1),
            }}
          />
        </div>
      )}
      {children}
    </div>
  )
}
