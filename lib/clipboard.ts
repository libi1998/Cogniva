import { STORAGE } from "./storage"
import { normalizeNode } from "./types"
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
  // un giro solo, senza `Math.min(...)`: quattro array in meno e nessun limite
  // di argomenti su una board con migliaia di elementi
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of nodes) {
    if (n.x < minX) minX = n.x
    if (n.y < minY) minY = n.y
    if (n.x + n.w > maxX) maxX = n.x + n.w
    if (n.y + n.h > maxY) maxY = n.y + n.h
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

function serializeClip(p: ClipPayload) {
  return CLIP_MARK + JSON.stringify(p)
}

/**
 * Il testo degli appunti può essere qualunque cosa: si accetta solo quello che
 * ha davvero la forma di un blocco di elementi copiati, altrimenti un incolla
 * fatto da un'altra app romperebbe la board.
 */
export function parseClip(text: string): ClipPayload | null {
  if (!text) return null
  const mark = text.includes(CLIP_MARK) ? CLIP_MARK : LEGACY_MARK
  const i = text.indexOf(mark)
  if (i < 0) return null
  try {
    const raw: unknown = JSON.parse(text.slice(i + mark.length))
    if (!raw || typeof raw !== "object") return null
    const clip = raw as Partial<ClipPayload>
    if (!Array.isArray(clip.nodes)) return null
    const nodes = clip.nodes
      .filter((n) => n && typeof n.id === "string")
      .map((n) => normalizeNode(n))
    const edges = Array.isArray(clip.edges)
      ? clip.edges.filter(
          (e) =>
            e &&
            typeof e.id === "string" &&
            typeof e.from === "string" &&
            typeof e.to === "string"
        )
      : []
    const bounds =
      clip.bounds && typeof clip.bounds === "object"
        ? clip.bounds
        : boundsOf(nodes)
    return {
      ...clip,
      nodes,
      edges,
      bounds: {
        x: Number(bounds.x) || 0,
        y: Number(bounds.y) || 0,
        w: Number(bounds.w) || 0,
        h: Number(bounds.h) || 0,
      },
    }
  } catch {
    return null
  }
}

/**
 * Gli appunti del sistema hanno ricevuto l'ultima copia. Solo se la scrittura
 * non è riuscita (permesso negato, pagina non in primo piano) conta la copia
 * in memoria: altrimenti un testo copiato dopo, da un'altra app, è la cosa da
 * incollare, e non gli elementi copiati prima.
 */
let systemMissed = false

export function writeClip(p: ClipPayload) {
  memory = p
  const text = serializeClip(p)
  const missed = () => {
    if (memory === p) systemMissed = true
  }
  systemMissed = false
  try {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(missed)
    } else missed()
  } catch {
    // il fallback in memoria basta
    missed()
  }
  try {
    localStorage.setItem(STORAGE.clipboard, text)
  } catch {
    /* ignora */
  }
}

/**
 * Cosa incollare dato il testo degli appunti del sistema: gli elementi che
 * contiene; se è vuoto, l'ultima copia di Cogniva; se è un testo qualunque,
 * il testo (`null`), a meno che l'ultima copia non sia mai arrivata agli
 * appunti. Prima vinceva sempre la copia in memoria (o quella di un'altra
 * sessione): un testo copiato da un'altra app non si incollava più.
 */
export function clipForPaste(text: string): ClipPayload | null {
  const clip = parseClip(text)
  if (clip) return clip
  if (!text.trim()) return readClipFallback()
  return systemMissed ? memory : null
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
