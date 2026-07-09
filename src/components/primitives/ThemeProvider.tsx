"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"


export type ColorScheme = "blue" | "green" | "purple" | "orange" | "teal" | "rose"

export const COLOR_SCHEMES: { value: ColorScheme; label: string; color: string }[] = [
  { value: "blue", label: "Blue", color: "#3b82f6" },
  { value: "green", label: "Green", color: "#22c55e" },
  { value: "purple", label: "Purple", color: "#a855f7" },
  { value: "orange", label: "Orange", color: "#f97316" },
  { value: "teal", label: "Teal", color: "#14b8a6" },
  { value: "rose", label: "Rose", color: "#f43f5e" },
]

interface ThemeProviderState {
  colorScheme: ColorScheme
  setColorScheme: (scheme: ColorScheme) => void
}

const initialState: ThemeProviderState = {
  colorScheme: "blue",
  setColorScheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

const defaultStorageKey = "autonnel-color-scheme"
const fallbackScheme: ColorScheme = "blue"

export interface ThemeProviderProps {
  children: ReactNode

  defaultColorScheme?: ColorScheme

  storageKey?: string
}

function isColorScheme(value: string | null): value is ColorScheme {
  return Boolean(value && COLOR_SCHEMES.some((scheme) => scheme.value === value))
}

function readDomColorScheme() {
  const root = document.documentElement
  return COLOR_SCHEMES.find((scheme) =>
    root.classList.contains(`scheme-${scheme.value}`)
  )?.value
}

function removeSchemeClasses(root: HTMLElement) {
  COLOR_SCHEMES.forEach((scheme) => {
    root.classList.remove(`scheme-${scheme.value}`)
  })
}

export function ThemeProvider({
  children,
  defaultColorScheme,
  storageKey = defaultStorageKey,
}: ThemeProviderProps) {
  const [colorScheme, setColorScheme] = useState<ColorScheme>(() => {
    if (typeof window === "undefined") {
      return defaultColorScheme || fallbackScheme
    }

    const stored = localStorage.getItem(storageKey)
    if (isColorScheme(stored)) {
      return stored
    }

    return readDomColorScheme() || defaultColorScheme || fallbackScheme
  })

  useEffect(() => {
    const root = window.document.documentElement
    removeSchemeClasses(root)
    root.classList.add(`scheme-${colorScheme}`)
  }, [colorScheme])

  const value: ThemeProviderState = {
    colorScheme,
    setColorScheme: (newScheme: ColorScheme) => {
      localStorage.setItem(storageKey, newScheme)
      setColorScheme(newScheme)
    },
  }

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeProviderContext)

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }

  return context
}

export default ThemeProvider
