"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ClickTooltipProps {
  content: string
  children: React.ReactNode
  className?: string
}

const tooltipAutoCloseMs = 3000

export function ClickTooltip({ content, children, className }: ClickTooltipProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLSpanElement>(null)
  const tooltipRef = React.useRef<HTMLDivElement>(null)

  const closeTooltip = React.useCallback(() => setIsOpen(false), [])
  const toggleTooltip = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation()
    setIsOpen((open) => !open)
  }, [])

  React.useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(target)
      ) {
        closeTooltip()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeTooltip()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [closeTooltip, isOpen])

  React.useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(closeTooltip, tooltipAutoCloseMs)
    return () => clearTimeout(timer)
  }, [closeTooltip, isOpen])

  return (
    <span
      ref={triggerRef}
      className={cn("relative inline-flex cursor-pointer", className)}
      data-autonnel-ui="click-tooltip-trigger"
      onClick={toggleTooltip}
    >
      {children}
      {isOpen && (
        <div
          ref={tooltipRef}
          className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 px-3 py-2 text-xs bg-popover text-popover-foreground border border-border rounded-md shadow-lg whitespace-nowrap animate-in fade-in-0 zoom-in-95"
          data-autonnel-ui="click-tooltip"
        >
          {content}
          <div
            className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-popover border-l border-t border-border rotate-45"
            data-autonnel-ui="click-tooltip-arrow"
          />
        </div>
      )}
    </span>
  )
}
