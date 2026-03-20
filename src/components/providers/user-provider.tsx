"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

interface UserContextValue {
  image: string | null
  setImage: (image: string | null) => void
}

const UserContext = createContext<UserContextValue | null>(null)

interface UserProviderProps {
  initialImage: string | null
  children: React.ReactNode
}

export function UserProvider({ initialImage, children }: UserProviderProps) {
  const [image, setImageState] = useState<string | null>(initialImage)

  const setImage = useCallback((value: string | null) => {
    setImageState(value)
  }, [])

  const value = useMemo(() => ({ image, setImage }), [image, setImage])

  return <UserContext value={value}>{children}</UserContext>
}

export function useUserImage() {
  const ctx = useContext(UserContext)
  if (!ctx) {
    throw new Error("useUserImage must be used within a UserProvider")
  }
  return ctx
}
