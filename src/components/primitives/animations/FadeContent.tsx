import type { HTMLAttributes, ReactNode } from "react"

interface FadeContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode

  delay?: number

  duration?: number

  direction?: "up" | "down" | "left" | "right" | "none"

  distance?: number
}

export function FadeContent({
  children,
  className = "",
  delay: _delay,
  duration: _duration,
  direction: _direction,
  distance: _distance,
  ...props
}: FadeContentProps) {
  return (
    <div className={className} data-autonnel-animation="fade-content" {...props}>
      {children}
    </div>
  )
}

export default FadeContent
