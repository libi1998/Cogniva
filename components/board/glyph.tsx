"use client"

import * as React from "react"
import { ICONS } from "@/lib/icon-library"

export function Glyph({
  name,
  size = 24,
  color = "currentColor",
  strokeWidth = 2,
  className,
  style,
}: {
  name: string
  size?: number | string
  color?: string
  strokeWidth?: number
  className?: string
  style?: React.CSSProperties
}) {
  const node = ICONS[name] ?? ICONS.square ?? []
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      {node.map(([tag, attrs], i) =>
        React.createElement(tag, {
          key: i,
          ...(attrs as Record<string, string>),
        })
      )}
    </svg>
  )
}
