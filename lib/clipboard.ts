import { STORAGE } from "./storage"
import type { BoardEdge, BoardNode, BoardTheme } from "./types"

const CLIP_MARK = "cogniva/items:v1:"
/** elementi copiati con la versione precedente dell'app */
const LEGACY_MARK = "whimsy/items:v1:"

export type ClipPayload = {
  nodes: BoardNode[]
  edges: BoardEdge[]
  /** riquadro degli elementi copiati, serve per incollarli relativi al cursore */
  bounds: { x: number; y: number; w: number; h: number }
  /** tema della board d'origine: serve a ridisegnare gli elementi altrove */
  theme?: BoardTheme
  /** titolo della board d'origine, usato dall'incolla nei documenti */
  source?: string
  sourceId?: string
}

let memory: ClipPayload | null = null

export function boundsOf(nodes: BoardNode[]) {
  if (!nodes.length) return { x: 0, y: 0, w: 0, h: 0 }
  const minX = Math.min(...nodes.map((n) => n.x))
  const minY = Math.min(...nodes.map((n) => n.y))
  const maxX = Math.max(...nodes.map((n) => n.x + n.w))
  const maxY = Math.max(...nodes.map((n) => n.y + n.h))
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

function serializeClip(p: ClipPayload) {
  return CLIP_MARK + JSON.stringify(p)
}

export function parseClip(text: string): ClipPayload | null {
  if (!text) return null
  const mark = text.includes(CLIP_MARK) ? CLIP_MARK : LEGACY_MARK
  const i = text.indexOf(mark)
  if (i < 0) return null
  try {
    return JSON.parse(text.slice(i + mark.length)) as ClipPayload
  } catch {
    return null
  }
}

export function writeClip(p: ClipPayload) {
  memory = p
  const text = serializeClip(p)
  try {
    void navigator.clipboard?.writeText(text)
  } catch {
    /* il fallback in memoria basta */
  }
  try {
    localStorage.setItem(STORAGE.clipboard, text)
  } catch {
    /* ignora */
  }
}

export function readClipFallback(): ClipPayload | null {
  if (memory) return memory
  try {
    const raw = localStorage.getItem(STORAGE.clipboard)
    return raw ? parseClip(raw) : null
  } catch {
    return null
  }
}
