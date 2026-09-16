import type { PageFormat } from "./types"
import { PAGE_FORMATS } from "./types"

import { tr } from "@/lib/i18n/client"
const MM_TO_PX = 96 / 25.4
const PX_TO_MM = 25.4 / 96

export type Orientation = "portrait" | "landscape"

/** Misure in millimetri del formato, tenendo conto dell'orientamento */
export function formatMm(
  format: PageFormat | "infinite",
  orientation: Orientation
): [number, number] | null {
  if (format === "infinite") return null
  const mm = PAGE_FORMATS[format]?.mm
  if (!mm) return null
  return orientation === "landscape" ? [mm[1], mm[0]] : [mm[0], mm[1]]
}

export function formatPx(
  format: PageFormat | "infinite",
  orientation: Orientation
) {
  const mm = formatMm(format, orientation)
  if (!mm) return null
  return { w: Math.round(mm[0] * MM_TO_PX), h: Math.round(mm[1] * MM_TO_PX) }
}

export function pxToMm(px: number) {
  return px * PX_TO_MM
}

export function formatLabel(
  format: PageFormat | "infinite",
  orientation: Orientation
) {
  if (format === "infinite") return tr("Infinita")
  const mm = formatMm(format, orientation)
  const name = PAGE_FORMATS[format]?.label ?? format
  return mm
    ? tr("{name} · {width}×{height} mm", {
        name,
        width: Math.round(mm[0]),
        height: Math.round(mm[1]),
      })
    : name
}
