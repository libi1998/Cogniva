import type { FrameKind, NodeShape, WireKind } from "@/lib/types"
import type { ItemSpec } from "@/lib/items"

type DrawMode = "pen" | "highlighter" | "eraser"

export type Tool =
  | { t: "select" }
  | { t: "hand" }
  | { t: "connect" }
  | { t: "shape"; shape: NodeShape }
  | { t: "frame"; frame: FrameKind }
  | { t: "section" }
  | { t: "table" }
  | { t: "chart" }
  | { t: "icon"; icon: string }
  | { t: "wire"; wire: WireKind }
  | { t: "draw"; mode: DrawMode }

/** Gli strumenti che piazzano un elemento con un clic o un trascinamento */
export function placementSpec(tool: Tool): ItemSpec | null {
  switch (tool.t) {
    case "shape":
      return { kind: "shape", shape: tool.shape }
    case "frame":
      return { kind: "frame", frame: tool.frame }
    case "section":
      return { kind: "section" }
    case "table":
      return { kind: "table" }
    case "chart":
      return { kind: "chart" }
    case "icon":
      return { kind: "icon", icon: tool.icon }
    case "wire":
      return { kind: "wire", wire: tool.wire }
    default:
      return null
  }
}

export function toolKey(tool: Tool) {
  switch (tool.t) {
    case "shape":
      return `shape:${tool.shape}`
    case "frame":
      return `frame:${tool.frame}`
    case "icon":
      return `icon:${tool.icon}`
    case "wire":
      return `wire:${tool.wire}`
    case "draw":
      return `draw:${tool.mode}`
    default:
      return tool.t
  }
}
