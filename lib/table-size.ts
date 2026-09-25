import type { Editor } from "@tiptap/core"
import type { Node as PMNode } from "@tiptap/pm/model"
import type { EditorState } from "@tiptap/pm/state"
import { closeHistory } from "@tiptap/pm/history"
import { TableMap } from "@tiptap/pm/tables"
import type { EditorView } from "@tiptap/pm/view"
import { MIN_COLUMN } from "./table-format"

/**
 * Larghezza e altezza di una tabella intera, come la maniglia nell'angolo
 * delle tabelle di Word: le colonne si allargano o si stringono tutte nella
 * stessa proporzione, le righe si allungano insieme.
 *
 * Le misure vengono dal foglio (in pixel senza zoom): una tabella appena
 * inserita non ha larghezze sue, prende quella del foglio.
 */

/** una riga non scende sotto questa altezza, anche vuota */
const MIN_ROW = 16

export type TableBox = {
  /** posizione del nodo tabella nel documento */
  pos: number
  columns: number[]
  rows: number[]
  width: number
  height: number
  /** quanto la tabella è più larga delle sue colonne: il bordo esterno */
  border: number
  /** quanto è più alta delle sue righe */
  borderY: number
}

/** La tabella che contiene il cursore: posizione e nodo */
export function selectedTable(state: EditorState) {
  const { $from } = state.selection
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (node.type.name === "table") return { pos: $from.before(depth), node }
  }
  // la tabella selezionata intera, con la maniglia ✥
  const picked = (state.selection as { node?: PMNode }).node
  if (picked?.type.name === "table") return { pos: $from.pos, node: picked }
  return null
}

/** Il `<table>` disegnato per il nodo in `pos` (dentro il suo contenitore) */
export function tableElement(view: EditorView, pos: number) {
  const dom = view.nodeDOM(pos)
  if (!(dom instanceof HTMLElement)) return null
  return dom instanceof HTMLTableElement ? dom : dom.querySelector("table")
}

/** Colonne e righe della tabella in `pos`, misurate sul foglio */
export function measureTable(view: EditorView, pos: number): TableBox | null {
  const node = view.state.doc.nodeAt(pos)
  const table = tableElement(view, pos)
  if (node?.type.name !== "table" || !table) return null
  const box = table.getBoundingClientRect()
  // con lo zoom il foglio è disegnato più grande dei suoi pixel
  const scale = box.width / (table.offsetWidth || 1) || 1
  const map = TableMap.get(node)
  const start = pos + 1
  const cellWidth = (cellPos: number) => {
    const dom = view.nodeDOM(start + cellPos)
    return dom instanceof HTMLElement
      ? dom.getBoundingClientRect().width / scale
      : 0
  }

  const columns: number[] = []
  for (let col = 0; col < map.width; col += 1) {
    // una cella che copre solo questa colonna, se c'è
    let width = 0
    for (let row = 0; row < map.height && !width; row += 1) {
      const cellPos = map.map[row * map.width + col]
      const cell = map.findCell(cellPos)
      if (cell.right - cell.left === 1) width = cellWidth(cellPos)
    }
    if (!width) {
      const cellPos = map.map[col]
      const cell = map.findCell(cellPos)
      width = cellWidth(cellPos) / (cell.right - cell.left)
    }
    columns.push(width || MIN_COLUMN)
  }

  const rows: number[] = []
  node.forEach((_row, offset) => {
    const dom = view.nodeDOM(start + offset)
    rows.push(
      dom instanceof HTMLElement
        ? dom.getBoundingClientRect().height / scale
        : 0
    )
  })

  const width = box.width / scale
  const height = box.height / scale
  return {
    pos,
    columns,
    rows,
    width,
    height,
    border: Math.max(0, width - columns.reduce((s, w) => s + w, 0)),
    borderY: Math.max(0, height - rows.reduce((s, h) => s + h, 0)),
  }
}

/** Le colonne scalate per arrivare a `width`, nelle stesse proporzioni */
export function scaleColumns(columns: number[], width: number) {
  const total = columns.reduce((s, w) => s + w, 0) || 1
  const narrowest = Math.max(1, Math.min(...columns))
  // la colonna più stretta non scende sotto il minimo: le altre si fermano
  // con lei, così le proporzioni restano quelle di prima
  const least = (total * MIN_COLUMN) / narrowest
  const factor = Math.max(width, least) / total
  return columns.map((w) => w * factor)
}

/** Le righe scalate per arrivare a `height`, nelle stesse proporzioni */
export function scaleRows(rows: number[], height: number) {
  const total = rows.reduce((s, h) => s + h, 0) || 1
  const factor = Math.max(height, rows.length * MIN_ROW) / total
  return rows.map((h) => Math.max(MIN_ROW, h * factor))
}

/**
 * Porta la tabella in `pos` alla larghezza e/o all'altezza date (pixel del
 * foglio), in un solo passo da annullare.
 */
export function resizeTable(
  editor: Editor,
  pos: number,
  size: { width?: number; height?: number },
  measured?: TableBox | null
) {
  const box = measured ?? measureTable(editor.view, pos)
  if (!box) return false
  // un passo a sé da annullare: non si unisce a quello che c'era prima
  let chain = editor.chain().command(({ tr }) => {
    closeHistory(tr)
    return true
  })
  if (size.width !== undefined && Math.abs(size.width - box.width) >= 0.5) {
    chain = chain.setTableColumnWidths(
      pos,
      scaleColumns(box.columns, size.width - box.border)
    )
  }
  if (size.height !== undefined && Math.abs(size.height - box.height) >= 0.5) {
    chain = chain.setTableRowHeights(
      pos,
      scaleRows(box.rows, size.height - box.borderY)
    )
  }
  return chain.run()
}
