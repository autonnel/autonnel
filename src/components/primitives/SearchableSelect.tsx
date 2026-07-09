
import * as React from "react"
import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { createPortal } from "react-dom"
import { ChevronDown, Search, X } from "lucide-react"
import { Label } from "./Label"
import { cn } from "@/lib/utils"
import { dsFieldClass, dsFieldErrorClass, dsFieldLabelClass, dsFieldErrorTextClass } from "./field-styles"

export interface SearchableSelectOption {
  value: string
  label: string
  description?: string
}

interface SearchableSelectProps {
  label?: string
  placeholder?: string
  value: string
  options: SearchableSelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
  error?: string
}

interface PanelPosition {
  left: number
  width: number
  top?: number
  bottom?: number
  maxHeight: number
}

const VIEWPORT_MARGIN = 8
const PANEL_GAP = 4
const PANEL_MAX_HEIGHT = 320

export function SearchableSelect({
  label,
  placeholder = "Select...",
  value,
  options,
  onChange,
  disabled = false,
  error,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [pos, setPos] = useState<PanelPosition | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(o => o.value === value)

  const filtered = useMemo(() => {
    if (!search) return options
    const q = search.toLowerCase()
    return options.filter(
      o => o.label.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q)
    )
  }, [options, search])

  // Render the panel in a body portal with fixed positioning so it escapes any
  // scroll container (e.g. the Dialog's overflow-y-auto body) instead of growing it.
  const computePosition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN
    const spaceAbove = rect.top - VIEWPORT_MARGIN
    const openUp = spaceBelow < Math.min(PANEL_MAX_HEIGHT, 200) && spaceAbove > spaceBelow
    const available = (openUp ? spaceAbove : spaceBelow) - PANEL_GAP
    setPos({
      left: rect.left,
      width: rect.width,
      top: openUp ? undefined : rect.bottom + PANEL_GAP,
      bottom: openUp ? window.innerHeight - rect.top + PANEL_GAP : undefined,
      maxHeight: Math.max(160, Math.min(PANEL_MAX_HEIGHT, available)),
    })
  }, [])

  useEffect(() => {
    if (!isOpen) return
    computePosition()
    const onReflow = () => computePosition()
    window.addEventListener("resize", onReflow)
    window.addEventListener("scroll", onReflow, true)
    return () => {
      window.removeEventListener("resize", onReflow)
      window.removeEventListener("scroll", onReflow, true)
    }
  }, [isOpen, computePosition])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (containerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setIsOpen(false)
      setSearch("")
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // The panel is portaled out of the Dialog's focus scope; Radix would otherwise
  // yank focus back to the dialog on focusin/out. Intercept in the capture phase
  // (before Radix's bubble-phase document listeners) for events touching the panel.
  useEffect(() => {
    if (!isOpen) return
    const guard = (e: FocusEvent) => {
      const panel = panelRef.current
      if (!panel) return
      const t = e.target as Node | null
      const rt = e.relatedTarget as Node | null
      if ((t && panel.contains(t)) || (rt && panel.contains(rt))) {
        e.stopImmediatePropagation()
      }
    }
    document.addEventListener("focusin", guard, true)
    document.addEventListener("focusout", guard, true)
    return () => {
      document.removeEventListener("focusin", guard, true)
      document.removeEventListener("focusout", guard, true)
    }
  }, [isOpen])

  const handleSelect = (val: string) => {
    onChange(val)
    setIsOpen(false)
    setSearch("")
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange("")
    setSearch("")
  }

  const selectId = label?.toLowerCase().replace(/\s+/g, "-")

  return (
    <div className="w-full min-w-0" ref={containerRef}>
      {label && (
        <Label htmlFor={selectId} className={dsFieldLabelClass}>
          {label}
        </Label>
      )}
      <button
        id={selectId}
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setIsOpen(!isOpen) }}
        className={cn(
          dsFieldClass,
          "min-w-0 overflow-hidden items-center justify-between text-left",
          error && dsFieldErrorClass,
          isOpen && "border-ds-accent ring-2 ring-ds-accent/25"
        )}
      >
        <span className={cn("truncate min-w-0", !selectedOption && "text-ds-faint")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="flex items-center gap-1 ml-2 shrink-0">
          {value && !disabled && (
            <X className="h-4 w-4 text-ds-muted hover:text-ds-ink" onClick={handleClear} />
          )}
          <ChevronDown className={cn("h-4 w-4 text-ds-muted transition-transform", isOpen && "rotate-180")} />
        </span>
      </button>

      {isOpen && pos && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[1000] pointer-events-auto flex flex-col rounded-[8px] border border-ds-line bg-ds-card shadow-lg overflow-hidden"
            style={{
              left: pos.left,
              width: pos.width,
              top: pos.top,
              bottom: pos.bottom,
              maxHeight: pos.maxHeight,
            }}
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-ds-line shrink-0">
              <Search className="h-4 w-4 text-ds-muted shrink-0" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full bg-transparent text-sm text-ds-ink outline-none placeholder:text-ds-faint"
                onKeyDown={e => {
                  if (e.key === "Escape") {
                    setIsOpen(false)
                    setSearch("")
                  }
                  if (e.key === "Enter" && filtered.length > 0) {
                    handleSelect(filtered[0].value)
                  }
                }}
              />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-sm text-ds-muted text-center">
                  No results found
                </div>
              ) : (
                filtered.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      "flex flex-col w-full text-left rounded-[5px] px-3 py-2 text-sm cursor-pointer transition-colors text-ds-ink",
                      "hover:bg-ds-surface2",
                      option.value === value && "bg-ds-surface2"
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {option.description && (
                      <span className="text-xs text-ds-muted truncate">{option.description}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body
        )}

      {error && <p className={dsFieldErrorTextClass}>{error}</p>}
    </div>
  )
}
