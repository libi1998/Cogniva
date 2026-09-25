import { Extension } from "@tiptap/core"
import type { Node as PMNode } from "@tiptap/pm/model"
import { NodeSelection, type EditorState } from "@tiptap/pm/state"
import {
  CellSelection,
  TableMap,
  selectedRect,
  type Rect,
} from "@tiptap/pm/tables"
import { cssColor, cssValue } from "./css"

/**
 * Formato di ogni cella, come «Bordi e sfondo» e «Proprietà tabella» di
 * Word: bordi lato per lato, margini interni e selezioni di righe, colonne e
 * tabella intera.
 *
 * Un bordo è la linea fra due celle: in una tabella HTML a bordi uniti vince
 * la più marcata delle due, quindi per toglierla o cambiarla va scritta su
 * entrambe. Per questo ogni comando tocca anche la cella vicina, dall'altra
 * parte della linea.
 */

export type BorderSide = "top" | "right" | "bottom" | "left"

export type BorderKind =
  | "all"
  | "outside"
  | "inside"
  | "insideH"
  | "insideV"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "none"
  | "reset"

export type BorderLine = {
  width: number
  style: "solid" | "dashed" | "dotted" | "double"
  color: string
}

const SIDES: BorderSide[] = ["top", "right", "bottom", "left"]
const ATTR: Record<BorderSide, string> = {
  top: "borderTop",
  right: "borderRight",
  bottom: "borderBottom",
  left: "borderLeft",
}
const OPPOSITE: Record<BorderSide, BorderSide> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
}

/** la colonna più stretta, come le celle di Tiptap (`cellMinWidth`) */
export const MIN_COLUMN = 25

/** «1px solid #000», «none» oppure null (quello della tabella) */
export function borderCss(line: BorderLine | null): string {
  if (!line) return "none"
  const color = cssColor(line.color) ?? "currentColor"
  const width = Math.max(0.5, Math.min(12, Number(line.width) || 1))
  // una linea doppia sotto i 3 px non si distingue da una semplice
  const w = line.style === "double" ? Math.max(3, width) : width
  return `${w}px ${line.style} ${color}`
}

/** Un bordo salvato che si può scrivere nel CSS */
function safeBorder(value: unknown): string | null {
  if (value === "none") return "none"
  const clean = cssValue(value)
  if (!clean) return null
  return /^[\d.]+px (solid|dashed|dotted|double) \S+$/.test(clean)
    ? clean
    : null
}

/** Gli attributi in più delle celle, da unire a quelli di Tiptap */
export const cellFormatAttributes = {
  ...Object.fromEntries(
    SIDES.map((side) => [
      ATTR[side],
      {
        default: null as string | null,
        parseHTML: (el: HTMLElement) =>
          el.getAttribute(`data-border-${side}`) || null,
        renderHTML: (attrs: Record<string, unknown>) => {
          const value = safeBorder(attrs[ATTR[side]])
          return value
            ? {
                [`data-border-${side}`]: value,
                style: `border-${side}:${value}`,
              }
            : {}
        },
      },
    ])
  ),
  // altezza minima della riga, come «Altezza riga: almeno» di Word
  minHeight: {
    default: null as number | null,
    parseHTML: (el: HTMLElement) =>
      Number(el.getAttribute("data-min-height")) || null,
    renderHTML: (attrs: Record<string, unknown>) => {
      const n = Number(attrs.minHeight)
      if (!Number.isFinite(n) || n <= 0) return {}
      const v = Math.min(600, n)
      return { "data-min-height": String(v), style: `height:${v}px` }
    },
  },
  padding: {
    default: null as number | null,
    parseHTML: (el: HTMLElement) =>
      Number(el.getAttribute("data-padding")) || null,
    renderHTML: (attrs: Record<string, unknown>) => {
      const n = Number(attrs.padding)
      if (!Number.isFinite(n) || n <= 0) return {}
      const v = Math.min(60, n)
      return {
        "data-padding": String(v),
        style: `padding:${v}px ${Math.round(v * 1.6)}px`,
      }
    },
  },
}

/** La cella vicina di `cell` dall'altra parte del lato, nella mappa */
function neighbours(map: TableMap, cell: Rect, side: BorderSide) {
  const out = new Set<number>()
  const add = (row: number, col: number) => {
    if (row < 0 || col < 0 || row >= map.height || col >= map.width) return
    out.add(map.map[row * map.width + col])
  }
  if (side === "top" || side === "bottom") {
    const row = side === "top" ? cell.top - 1 : cell.bottom
    for (let col = cell.left; col < cell.right; col += 1) add(row, col)
  } else {
    const col = side === "left" ? cell.left - 1 : cell.right
    for (let row = cell.top; row < cell.bottom; row += 1) add(row, col)
  }
  return out
}

/** I lati di una cella che il comando tocca, secondo la selezione */
function sidesFor(kind: BorderKind, cell: Rect, sel: Rect): BorderSide[] {
  const edge: Record<BorderSide, boolean> = {
    top: cell.top === sel.top,
    bottom: cell.bottom === sel.bottom,
    left: cell.left === sel.left,
    right: cell.right === sel.right,
  }
  switch (kind) {
    case "all":
    case "none":
    case "reset":
      return SIDES
    case "outside":
      return SIDES.filter((s) => edge[s])
    case "inside":
      return SIDES.filter((s) => !edge[s])
    case "insideH":
      return (["top", "bottom"] as BorderSide[]).filter((s) => !edge[s])
    case "insideV":
      return (["left", "right"] as BorderSide[]).filter((s) => !edge[s])
    default:
      return edge[kind] ? [kind] : []
  }
}

/** La tabella e il rettangolo di celle della selezione, se c'è */
function tableRect(state: EditorState) {
  try {
    return selectedRect(state)
  } catch {
    return null
  }
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    tableFormat: {
      setCellBorders: (kind: BorderKind, line?: BorderLine) => ReturnType
      setCellPadding: (px: number | null) => ReturnType
      selectTablePart: (part: "cell" | "row" | "column" | "table") => ReturnType
      distributeColumns: () => ReturnType
      setRowHeight: (px: number | null) => ReturnType
      /** larghezza di ogni colonna della tabella in `tablePos`, in pixel */
      setTableColumnWidths: (tablePos: number, widths: number[]) => ReturnType
      /** altezza minima di ogni riga della tabella in `tablePos`, in pixel */
      setTableRowHeights: (
        tablePos: number,
        heights: (number | null)[]
      ) => ReturnType
    }
  }
}

export const TableFormat = Extension.create({
  name: "tableFormat",
  addCommands() {
    return {
      setCellBorders:
        (kind, line) =>
        ({ state, dispatch }) => {
          const rect = tableRect(state)
          if (!rect) return false
          const { map, table, tableStart } = rect
          const value =
            kind === "reset"
              ? null
              : kind === "none"
                ? "none"
                : borderCss(line ?? null)
          // posizione della cella (nella tabella) → attributi da cambiare
          const patch = new Map<number, Record<string, string | null>>()
          const set = (pos: number, side: BorderSide) => {
            const p = patch.get(pos) ?? {}
            p[ATTR[side]] = value
            patch.set(pos, p)
          }
          for (const pos of map.cellsInRect(rect)) {
            const cell = map.findCell(pos)
            for (const side of sidesFor(kind, cell, rect)) {
              set(pos, side)
              for (const other of neighbours(map, cell, side)) {
                if (other !== pos) set(other, OPPOSITE[side])
              }
            }
          }
          if (!patch.size) return false
          if (dispatch) {
            const tr = state.tr
            for (const [pos, attrs] of patch) {
              const node = table.nodeAt(pos)
              if (!node) continue
              tr.setNodeMarkup(tableStart + pos, undefined, {
                ...node.attrs,
                ...attrs,
              })
            }
            dispatch(tr)
          }
          return true
        },
      setCellPadding:
        (px) =>
        ({ commands }) =>
          commands.setCellAttribute(
            "padding",
            px && px > 0 ? Math.round(px) : null
          ),
      setRowHeight:
        (px) =>
        ({ state, dispatch }) => {
          const rect = tableRect(state)
          if (!rect) return false
          if (dispatch) {
            const tr = state.tr
            const { map, table, tableStart } = rect
            for (let row = rect.top; row < rect.bottom; row += 1) {
              for (let col = 0; col < map.width; col += 1) {
                const pos = map.map[row * map.width + col]
                const cell = map.findCell(pos)
                if (cell.top !== row || cell.left !== col) continue
                const node = table.nodeAt(pos)
                if (!node) continue
                tr.setNodeMarkup(tableStart + pos, undefined, {
                  ...node.attrs,
                  minHeight: px && px > 0 ? Math.round(px) : null,
                })
              }
            }
            dispatch(tr)
          }
          return true
        },
      selectTablePart:
        (part) =>
        ({ state, dispatch }) => {
          const rect = tableRect(state)
          if (!rect) return false
          const { map, tableStart } = rect
          if (!dispatch) return true
          if (part === "table") {
            // la tabella intera come oggetto: si sposta, si copia, si elimina
            const $table = state.doc.resolve(tableStart - 1)
            dispatch(
              state.tr.setSelection(NodeSelection.create(state.doc, $table.pos))
            )
            return true
          }
          const first =
            part === "column"
              ? { top: 0, left: rect.left }
              : part === "row"
                ? { top: rect.top, left: 0 }
                : { top: rect.top, left: rect.left }
          const last =
            part === "column"
              ? { top: map.height - 1, left: rect.right - 1 }
              : part === "row"
                ? { top: rect.bottom - 1, left: map.width - 1 }
                : { top: rect.bottom - 1, left: rect.right - 1 }
          const anchor = map.map[first.top * map.width + first.left]
          const head = map.map[last.top * map.width + last.left]
          dispatch(
            state.tr.setSelection(
              CellSelection.create(
                state.doc,
                tableStart + anchor,
                tableStart + head
              )
            )
          )
          return true
        },
      setTableColumnWidths:
        (tablePos, widths) =>
        ({ state, dispatch }) => {
          const table = state.doc.nodeAt(tablePos)
          if (table?.type.name !== "table") return false
          const map = TableMap.get(table)
          if (widths.length !== map.width) return false
          if (dispatch) {
            const tr = state.tr
            const start = tablePos + 1
            // pixel interi che sommati fanno la larghezza chiesta: arrotondate
            // una a una, tre colonne da 126,67 facevano 10,05 cm invece di 10
            let sum = 0
            const whole = widths.map((w) => {
              const before = Math.round(sum)
              sum += w
              return Math.max(MIN_COLUMN, Math.round(sum) - before)
            })
            const seen = new Set<number>()
            for (const pos of map.map) {
              if (seen.has(pos)) continue
              seen.add(pos)
              const node = table.nodeAt(pos)
              if (!node) continue
              const cell = map.findCell(pos)
              // come le colonne trascinate a mano: una larghezza per colonna
              // coperta dalla cella
              const colwidth = whole.slice(cell.left, cell.right)
              tr.setNodeMarkup(start + pos, undefined, {
                ...node.attrs,
                colwidth,
              })
            }
            dispatch(tr)
          }
          return true
        },
      setTableRowHeights:
        (tablePos, heights) =>
        ({ state, dispatch }) => {
          const table = state.doc.nodeAt(tablePos)
          if (table?.type.name !== "table") return false
          const map = TableMap.get(table)
          if (heights.length !== map.height) return false
          if (dispatch) {
            const tr = state.tr
            const start = tablePos + 1
            // pixel interi che sommati fanno l'altezza chiesta, come per le
            // colonne
            let sum = 0
            const whole = heights.map((h) => {
              if (!h || h <= 0) return null
              const before = Math.round(sum)
              sum += h
              return Math.round(sum) - before
            })
            const seen = new Set<number>()
            for (const pos of map.map) {
              if (seen.has(pos)) continue
              seen.add(pos)
              const node = table.nodeAt(pos)
              if (!node) continue
              const cell = map.findCell(pos)
              // una cella su più righe le lascia decidere a loro
              const px = cell.bottom - cell.top === 1 ? whole[cell.top] : null
              tr.setNodeMarkup(start + pos, undefined, {
                ...node.attrs,
                minHeight: px && px > 0 ? Math.min(600, Math.round(px)) : null,
              })
            }
            dispatch(tr)
          }
          return true
        },
      distributeColumns:
        () =>
        ({ state, dispatch }) => {
          const rect = tableRect(state)
          if (!rect) return false
          if (dispatch) {
            // tutte le colonne uguali: la tabella torna larga quanto il foglio
            const tr = state.tr
            const { table, tableStart } = rect
            table.descendants((node: PMNode, pos: number) => {
              if (
                node.type.name !== "tableCell" &&
                node.type.name !== "tableHeader"
              ) {
                return true
              }
              tr.setNodeMarkup(tableStart + pos, undefined, {
                ...node.attrs,
                colwidth: null,
              })
              return false
            })
            dispatch(tr)
          }
          return true
        },
    }
  },
})
