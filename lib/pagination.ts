import { Extension } from "@tiptap/core"
import { NodeSelection, Plugin, PluginKey } from "@tiptap/pm/state"
import type { EditorState } from "@tiptap/pm/state"
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view"
import type { Node as PMNode } from "@tiptap/pm/model"
import { footnoteKey, noteLabel } from "./tiptap-extensions"

import { tr as translate } from "@/lib/i18n/client"
/**
 * Pagine vere, come in Word.
 *
 * Il documento resta un unico flusso modificabile, ma dove una pagina finisce
 * si inserisce uno spaziatore (una decorazione, non un nodo: non finisce nel
 * file) alto quanto il margine inferiore, lo stacco fra i fogli e il margine
 * superiore della pagina dopo. Così ogni pagina ha i suoi margini, le note a
 * piè di pagina hanno il loro spazio e la stampa spezza esattamente dove si
 * vede a schermo.
 *
 * Lo stacco fra i fogli è la variabile CSS `--page-gap`: in stampa e nelle
 * esportazioni vale 0 e le pagine si toccano, alte esattamente come la carta.
 *
 * Il calcolo misura il DOM subito dopo ogni modifica, in un microtask: il
 * browser non ha ancora disegnato, quindi gli spostamenti non si vedono mai a
 * metà. Le misure si fanno "al netto" degli spaziatori già presenti, così il
 * risultato non dipende da quello precedente e converge in uno o due giri.
 */

type PageLayout = {
  /** altezza della pagina in px CSS, esatta (niente arrotondamenti); 0 = off */
  pageHeight: number
  marginTop: number
  marginBottom: number
}

type GapKind = "block" | "inline" | "row"

export type PageGap = {
  pos: number
  kind: GapKind
  /** altezza senza lo stacco fra i fogli: è quella che vale sulla carta */
  base: number
  /** distanza fra l'inizio dello spaziatore e il bordo del foglio */
  edge: number
  /** lo spaziatore sta dentro a un blocco con sfondo: serve la fascia */
  nested: boolean
}

export type PaginationInfo = {
  pages: number
  /** le note a piè di pagina di ogni pagina, come posizioni nel documento */
  notes: number[][]
  /** altezza dell'area delle note di ogni pagina, in px */
  noteHeights: number[]
}

type PaginationState = PaginationInfo & {
  layout: PageLayout
  gaps: PageGap[]
  deco: DecorationSet
}

const paginationKey = new PluginKey<PaginationState>("pagination")

const EMPTY_INFO: PaginationInfo = { pages: 1, notes: [[]], noteHeights: [0] }

export function getPagination(state: EditorState): PaginationInfo {
  return paginationKey.getState(state) ?? EMPTY_INFO
}

/** Il documento è su fogli veri (formato di carta, una colonna) */
export function isPaginated(state: EditorState) {
  return Boolean(paginationKey.getState(state)?.layout.pageHeight)
}

/** La pagina (da 1) su cui cade una posizione: ogni spaziatore è un salto */
export function pageAt(state: EditorState, pos: number) {
  const gaps = paginationKey.getState(state)?.gaps ?? []
  let page = 1
  for (const gap of gaps) if (gap.pos <= pos) page += 1
  return page
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pagination: {
      setPageLayout: (layout: PageLayout) => ReturnType
    }
  }
}

const CONTAINERS = new Set([
  "bulletList",
  "orderedList",
  "taskList",
  "listItem",
  "taskItem",
  "blockquote",
])

/* ------------------------------ decorazioni ------------------------------ */

function gapWidget(gap: PageGap) {
  const style = `calc(${gap.base.toFixed(2)}px + var(--page-gap, 0px))`
  const toDOM = () => {
    if (gap.kind === "row") {
      const tr = document.createElement("tr")
      tr.className = "doc-page-gap doc-page-gap-row"
      tr.setAttribute("data-page-gap", "")
      const td = document.createElement("td")
      td.colSpan = 100
      td.style.height = style
      td.style.setProperty("--gap-edge", `${gap.edge.toFixed(2)}px`)
      tr.appendChild(td)
      return tr
    }
    const el = document.createElement(gap.kind === "inline" ? "span" : "div")
    el.className = gap.nested
      ? "doc-page-gap doc-page-gap-nested"
      : "doc-page-gap"
    el.setAttribute("data-page-gap", "")
    el.contentEditable = "false"
    el.style.height = style
    el.style.setProperty("--gap-edge", `${gap.edge.toFixed(2)}px`)
    return el
  }
  return Decoration.widget(gap.pos, toDOM, {
    side: -1,
    ignoreSelection: true,
    key: `pg:${gap.kind}:${gap.nested ? 1 : 0}:${gap.base.toFixed(1)}:${gap.edge.toFixed(1)}`,
  })
}

function buildDeco(doc: PMNode, gaps: PageGap[]) {
  const max = doc.content.size
  return DecorationSet.create(
    doc,
    gaps.filter((g) => g.pos >= 0 && g.pos <= max).map(gapWidget)
  )
}

/* --------------------------------- misure -------------------------------- */

type Unit = {
  pos: number
  /** null per le righe dell'elenco delle note, che non sono nodi */
  node: PMNode | null
  el: HTMLElement
  /**
   * voce dentro a un blocco disegnato a mano (elenco delle note, bibliografia):
   * quale blocco e quale voce, per gli spaziatori inseriti nel DOM
   */
  item: { host: number; index: number } | null
  gapPos: number
  gapKind: GapKind
  nested: boolean
  keepWithNext: boolean
  forced: boolean
}

type Line = {
  /** coordinate del foglio, al netto degli spaziatori */
  t: number
  b: number
  /** coordinate del client, per chiedere a ProseMirror la posizione */
  left: number
  mid: number
  top: number
}

/** Le righe di un blocco di testo, raggruppando i rettangoli del testo */
export function measureLines(el: HTMLElement, toSheet: (v: number) => number) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  const rects: DOMRect[] = []
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue) continue
    range.selectNodeContents(n)
    for (const r of Array.from(range.getClientRects())) {
      if (r.width > 0 && r.height > 0) rects.push(r)
    }
  }
  rects.sort((a, b) => a.top - b.top || a.left - b.left)
  const lines: Line[] = []
  let last: (Line & { cb: number }) | null = null
  for (const r of rects) {
    // un rettangolo che si sovrappone in verticale all'ultima riga le appartiene
    if (last && r.top < last.cb - 2) {
      if (r.bottom > last.cb) last.cb = r.bottom
      if (r.left < last.left) {
        last.left = r.left
      }
      continue
    }
    last = {
      t: 0,
      b: 0,
      left: r.left,
      mid: 0,
      top: r.top,
      cb: r.bottom,
    }
    lines.push(last)
  }
  for (const l of lines as (Line & { cb: number })[]) {
    l.mid = (l.top + l.cb) / 2
    l.t = toSheet(l.top)
    l.b = toSheet(l.cb)
  }
  return lines
}

/** Il punto del documento dove comincia una riga */
function lineStart(view: EditorView, line: Line, unit: Unit): number | null {
  const hit = view.posAtCoords({ left: line.left + 1, top: line.mid })
  if (!hit) return null
  const from = unit.pos + 1
  if (!unit.node) return null
  const to = unit.pos + unit.node.nodeSize - 1
  let pos = hit.pos
  // posAtCoords a volte risponde con la fine della riga prima
  for (let i = 0; i < 3 && pos < to; i++) {
    const c = view.coordsAtPos(pos, 1)
    if (c.top >= line.top - 2) break
    pos++
  }
  return pos > from && pos < to ? pos : null
}

const noteCache = new Map<string, number>()

/**
 * Altezza di ogni nota e dello spazio fisso dell'area, misurati con lo stesso
 * markup che disegna il foglio.
 */
function noteMeasurer(sheet: HTMLElement, width: number) {
  const cs = getComputedStyle(sheet)
  const prefix = `${width.toFixed(0)}|${cs.fontFamily}|${cs.fontSize}|`
  let box: HTMLElement | null = null
  const ensure = () => {
    if (box) return box
    box = document.createElement("div")
    box.className = "doc-page-notes"
    box.setAttribute("aria-hidden", "true")
    box.style.cssText = `position:absolute;left:0;top:0;width:${width}px;visibility:hidden;pointer-events:none;`
    sheet.appendChild(box)
    return box
  }
  const measure = (key: string, fill: (el: HTMLElement) => void) => {
    const cached = noteCache.get(prefix + key)
    if (cached !== undefined) return cached
    const el = ensure()
    el.replaceChildren()
    fill(el)
    const h = el.getBoundingClientRect().height
    const scale = sheet.getBoundingClientRect().width / sheet.offsetWidth || 1
    const value = h / scale
    if (noteCache.size > 2000) noteCache.clear()
    noteCache.set(prefix + key, value)
    return value
  }
  const pad = measure("|pad", () => {})
  return {
    pad,
    note: (number: number, text: string) =>
      measure(`${number}|${text}`, (el) => {
        el.appendChild(noteItem(number, text))
      }) - pad,
    done: () => box?.remove(),
  }
}

/** Il markup di una nota a piè di pagina, uguale a quello di React */
function noteItem(number: number, text: string) {
  const p = document.createElement("p")
  p.className = "doc-page-note"
  const n = document.createElement("span")
  n.className = "doc-page-note-n"
  n.textContent = String(number)
  p.append(n, document.createTextNode(text || " "))
  return p
}

function unitElement(view: EditorView, node: PMNode, pos: number) {
  const dom = view.nodeDOM(pos)
  if (!(dom instanceof HTMLElement)) return null
  if (node.type.name === "image") {
    // la vista React avvolge l'immagine: conta il riquadro vero, e le immagini
    // libere non occupano spazio nel flusso
    const inner = dom.firstElementChild as HTMLElement | null
    if (!inner || inner.classList.contains("doc-image-free")) return null
    return inner
  }
  return dom
}

function collectUnits(view: EditorView) {
  const units: Unit[] = []
  let forceNext = false
  let hosts = 0

  /** le voci di un blocco senza nodi figli si spezzano fra le pagine una a una */
  const addItems = (host: HTMLElement, gapPos: number, gapKind: GapKind) => {
    const hostIndex = hosts++
    const items = Array.from(
      host.querySelectorAll<HTMLElement>(":scope [data-gap-item]")
    )
    items.forEach((el, index) => {
      units.push({
        pos: -1,
        node: null,
        el,
        item: { host: hostIndex, index },
        // la prima voce si sposta con tutto il blocco
        gapPos: index === 0 ? gapPos : -1,
        gapKind,
        nested: false,
        keepWithNext: index === 0,
        forced: index === 0 && forceNext,
      })
      if (index === 0) forceNext = false
    })
    return items.length > 0
  }

  const add = (
    node: PMNode,
    pos: number,
    gapPos: number,
    gapKind: GapKind,
    nested: boolean
  ) => {
    const el = unitElement(view, node, pos)
    // «Anteponi interruzione di pagina» vale come un salto pagina prima
    const forced = forceNext || node.attrs.breakBefore === true
    forceNext = node.type.name === "pageBreak"
    if (!el) return
    units.push({
      pos,
      node,
      el,
      item: null,
      gapPos,
      gapKind,
      nested,
      // «Mantieni con il successivo»: come un titolo, non resta da solo
      keepWithNext:
        node.type.name === "heading" || node.attrs.keepNext === true,
      forced,
    })
  }

  const visit = (
    node: PMNode,
    pos: number,
    gapPos: number,
    gapKind: GapKind,
    nested: boolean
  ) => {
    const name = node.type.name
    if (CONTAINERS.has(name)) {
      // lo sfondo delle citazioni finirebbe nello stacco fra i fogli
      const inner = nested || name === "blockquote"
      node.forEach((child, offset, index) => {
        const cpos = pos + 1 + offset
        if (index === 0) visit(child, cpos, gapPos, gapKind, nested)
        else visit(child, cpos, cpos, "block", inner)
      })
      return
    }
    if (name === "table") {
      node.forEach((row, offset, index) => {
        const rpos = pos + 1 + offset
        if (index === 0) add(row, rpos, gapPos, gapKind, nested)
        else add(row, rpos, rpos, "row", true)
      })
      return
    }
    if (name === "bibliography") {
      const dom = view.nodeDOM(pos)
      if (dom instanceof HTMLElement && addItems(dom, gapPos, gapKind)) return
    }
    add(node, pos, gapPos, gapKind, nested)
  }

  view.state.doc.forEach((child, offset) =>
    visit(child, offset, offset, "block", false)
  )

  // l'elenco delle note in fondo: il titolo e ogni nota si spostano da soli
  const section = view.dom.querySelector<HTMLElement>(":scope > .doc-notes")
  if (section) addItems(section, -1, "block")
  return { units, endsWithBreak: forceNext }
}

/** Spaziatore dentro a un blocco disegnato a mano, fuori da ProseMirror */
type DomGap = { host: number; index: number; base: number; edge: number }

type Result = PaginationInfo & { gaps: PageGap[]; domGaps: DomGap[] }

function paginate(view: EditorView, layout: PageLayout): Result | null {
  const sheet = view.dom.closest<HTMLElement>(".doc-sheet")
  if (!sheet || !sheet.offsetWidth) return null
  const H = layout.pageHeight
  const mt = layout.marginTop
  const mb = layout.marginBottom
  const G =
    parseFloat(getComputedStyle(sheet).getPropertyValue("--page-gap")) || 0
  const P = H + G
  const box = sheet.getBoundingClientRect()
  const scale = box.width / sheet.offsetWidth || 1
  const toSheet = (v: number) => (v - box.top) / scale

  // spaziatori già a video: le misure si fanno come se non ci fossero
  const existing: { t: number; h: number }[] = []
  view.dom.querySelectorAll<HTMLElement>("[data-page-gap]").forEach((el) => {
    const r = el.getBoundingClientRect()
    if (r.height > 0) existing.push({ t: toSheet(r.top), h: r.height / scale })
  })
  existing.sort((a, b) => a.t - b.t)
  const prefix = [0]
  for (const g of existing) prefix.push(prefix[prefix.length - 1] + g.h)
  const net = (v: number) => {
    let lo = 0
    let hi = existing.length
    while (lo < hi) {
      const m = (lo + hi) >> 1
      if (existing[m].t + existing[m].h <= v + 0.5) lo = m + 1
      else hi = m
    }
    return v - prefix[lo]
  }
  const netClient = (v: number) => net(toSheet(v))

  // note a piè di pagina, in ordine di altezza
  const doc = view.state.doc
  const refs: { pos: number; y: number; number: number; text: string }[] = []
  let counter = 0
  for (const pos of footnoteKey.getState(view.state) ?? []) {
    const node = doc.nodeAt(pos)
    if (!node || node.attrs.kind === "endnote") continue
    counter++
    const dom = view.nodeDOM(pos)
    if (!(dom instanceof HTMLElement)) continue
    const r = dom.getBoundingClientRect()
    refs.push({
      pos,
      y: netClient((r.top + r.bottom) / 2),
      number: counter,
      text: String(node.attrs.text ?? ""),
    })
  }
  refs.sort((a, b) => a.y - b.y)
  const width = view.dom.getBoundingClientRect().width / scale
  const measurer = refs.length ? noteMeasurer(sheet, width) : null
  const noteHeight = new Map<number, number>()
  for (const ref of refs) {
    noteHeight.set(ref.pos, measurer!.note(ref.number, ref.text))
  }
  measurer?.done()
  const cap = (H - mt - mb) / 2
  const area = (list: number[]) => {
    if (!list.length || !measurer) return 0
    let h = measurer.pad
    for (const pos of list) h += noteHeight.get(pos) ?? 0
    return Math.min(cap, h)
  }

  const { units, endsWithBreak } = collectUnits(view)
  // «Mantieni assieme le righe»: il paragrafo passa intero alla pagina dopo
  const isText = (u: Unit) =>
    Boolean(u.node?.isTextblock) && u.node?.attrs.keepLines !== true

  const gaps: PageGap[] = []
  const domGaps: DomGap[] = []
  const pageNotes: number[][] = [[]]
  let k = 0
  let shift = 0
  let ref = 0

  const top = (i: number) => i * P + mt
  const end = (i: number) => i * P + H - mb
  const fits = (bottom: number, extra: number[]) =>
    bottom <=
    end(k) -
      area(extra.length ? [...pageNotes[k], ...extra] : pageNotes[k]) +
      0.5
  const atTop = (t: number) => t <= top(k) + 1
  const reach = (y: number) => {
    while (y >= (k + 1) * P - 0.5) {
      k++
      pageNotes[k] ??= []
    }
  }
  const addGap = (
    pos: number,
    kind: GapKind,
    nested: boolean,
    t: number,
    item: Unit["item"] = null
  ) => {
    const h = top(k + 1) - t
    const base = Math.max(0, h - G)
    const edge = Math.max(0, k * P + H - t)
    // la prima voce di un blocco disegnato a mano sposta il blocco intero
    if (item && (item.index > 0 || pos < 0)) {
      domGaps.push({ ...item, base, edge })
    } else
      gaps.push({
        pos,
        kind,
        base,
        edge,
        nested: nested || kind !== "block",
      })
    shift += Math.max(h, G)
    k++
    pageNotes[k] ??= []
  }
  const notesUntil = (y: number) => {
    const out: number[] = []
    while (ref < refs.length && refs[ref].y <= y + 1) out.push(refs[ref++].pos)
    return out
  }

  type Placed = { unit: Unit; t: number; k: number; notes: number[] }
  // assegnato anche dentro alle funzioni qui sotto: niente restringimento a null
  let prev = null as Placed | null

  /**
   * Spezza un paragrafo fra due pagine. Restituisce false quando conviene
   * spostare tutto il blocco: la prima riga non entra, oppure resterebbe
   * orfana in fondo alla pagina.
   */
  const splitLines = (u: Unit, own: number[], onTop: boolean) => {
    const lines = measureLines(u.el, toSheet).map((l) => ({
      ...l,
      t: net(l.t),
      b: net(l.b),
    }))
    if (lines.length < 2) return false
    const yOf = new Map(refs.map((x) => [x.pos, x.y]))
    const lineNotes = lines.map((l) =>
      own.filter((pos) => {
        const y = yOf.get(pos) ?? 0
        return y >= l.t - 1 && y <= l.b + 1
      })
    )
    // le note che non cadono su nessuna riga vanno con la prima
    const placed = new Set(lineNotes.flat())
    lineNotes[0].push(...own.filter((p) => !placed.has(p)))

    let s = 0
    for (;;) {
      let acc: number[] = []
      let j = s
      for (; j < lines.length; j++) {
        const next = [...acc, ...lineNotes[j]]
        if (!fits(lines[j].b + shift, next)) break
        acc = next
      }
      if (j === lines.length) {
        pageNotes[k].push(...acc)
        reach(lines[lines.length - 1].b + shift)
        return true
      }
      if (j === s) {
        if (s === 0 && !onTop) return false
        // una riga sola più alta dello spazio libero: resta dov'è
        acc = [...lineNotes[j]]
        j++
        if (j === lines.length) {
          pageNotes[k].push(...acc)
          reach(lines[lines.length - 1].b + shift)
          return true
        }
      }
      // controllo righe isolate: mai una riga sola in fondo alla pagina…
      if (s === 0 && j === 1 && !onTop) return false
      // …né una sola in cima alla successiva
      if (j === lines.length - 1 && j - s >= 3) {
        j--
        acc = lineNotes.slice(s, j).flat()
      }
      const pos = lineStart(view, lines[j], u)
      if (pos === null) {
        if (s === 0 && !onTop) return false
        pageNotes[k].push(...lineNotes.slice(s).flat())
        reach(lines[lines.length - 1].b + shift)
        return true
      }
      pageNotes[k].push(...acc)
      addGap(pos, "inline", true, lines[j].t + shift)
      s = j
    }
  }

  for (let i = 0; i < units.length; i++) {
    const u = units[i]
    const r = u.el.getBoundingClientRect()
    const t0 = netClient(r.top)
    const b0 = netClient(r.bottom)
    const savedRef = ref
    const own = notesUntil(b0)
    const accept = () => {
      pageNotes[k].push(...own)
      prev = { unit: u, t: t0 + shift, k, notes: own }
      reach(b0 + shift)
    }

    reach(t0 + shift)
    // interruzione di pagina: quello che segue comincia sul foglio dopo
    if (u.forced && !atTop(t0 + shift)) {
      addGap(u.gapPos, u.gapKind, u.nested, t0 + shift, u.item)
    }
    if (fits(b0 + shift, own)) {
      accept()
      continue
    }
    if (atTop(t0 + shift)) {
      // non entra neanche in una pagina vuota: si spezza per righe o si lascia
      if (!(isText(u) && splitLines(u, own, true))) accept()
      else prev = { unit: u, t: t0 + shift, k, notes: [] }
      continue
    }
    if (isText(u) && splitLines(u, own, false)) {
      prev = { unit: u, t: t0 + shift, k, notes: [] }
      continue
    }
    // un titolo non resta mai da solo in fondo alla pagina
    const heading = prev
    if (
      heading &&
      heading.unit.keepWithNext &&
      heading.k === k &&
      !atTop(heading.t)
    ) {
      pageNotes[k] = pageNotes[k].filter((p) => !heading.notes.includes(p))
      const u2 = heading.unit
      addGap(u2.gapPos, u2.gapKind, u2.nested, heading.t, u2.item)
      pageNotes[k].push(...heading.notes)
      prev = null
      ref = savedRef
      i--
      continue
    }
    addGap(u.gapPos, u.gapKind, u.nested, t0 + shift, u.item)
    if (fits(b0 + shift, own) || !(isText(u) && splitLines(u, own, true))) {
      accept()
    } else {
      prev = { unit: u, t: t0 + shift, k, notes: [] }
    }
  }

  if (endsWithBreak) {
    k++
    pageNotes[k] ??= []
  }
  const pages = k + 1
  for (let i = 0; i < pages; i++) pageNotes[i] ??= []
  return {
    gaps,
    domGaps,
    pages,
    notes: pageNotes.slice(0, pages),
    noteHeights: pageNotes.slice(0, pages).map((list) => area(list)),
  }
}

function sameResult(a: Result, b: PaginationState) {
  if (a.pages !== b.pages || a.gaps.length !== b.gaps.length) return false
  for (let i = 0; i < a.gaps.length; i++) {
    const x = a.gaps[i]
    const y = b.gaps[i]
    if (
      x.pos !== y.pos ||
      x.kind !== y.kind ||
      x.nested !== y.nested ||
      Math.abs(x.base - y.base) > 0.5 ||
      Math.abs(x.edge - y.edge) > 0.5
    ) {
      return false
    }
  }
  if (a.notes.length !== b.notes.length) return false
  for (let i = 0; i < a.notes.length; i++) {
    if (a.notes[i].join() !== b.notes[i]?.join()) return false
    if (Math.abs(a.noteHeights[i] - (b.noteHeights[i] ?? 0)) > 0.5) return false
  }
  return true
}

/**
 * Riporta gli spaziatori dentro ai blocchi disegnati a mano (elenco delle note,
 * bibliografia); true se ha cambiato qualcosa.
 */
function syncDomGaps(view: EditorView, gaps: DomGap[]) {
  const hosts = Array.from(
    view.dom.querySelectorAll<HTMLElement>("[data-gap-host]")
  )
  let changed = false
  hosts.forEach((host, hostIndex) => {
    const mine = gaps.filter((g) => g.host === hostIndex)
    const sig = mine
      .map((g) => `${g.index}:${g.base.toFixed(1)}:${g.edge.toFixed(1)}`)
      .join(",")
    if ((host.getAttribute("data-gaps") ?? "") === sig) return
    host.querySelectorAll("[data-page-gap]").forEach((el) => el.remove())
    const items = Array.from(
      host.querySelectorAll<HTMLElement>("[data-gap-item]")
    )
    for (const g of mine) {
      const target = items[g.index]
      if (!target) continue
      const gap = document.createElement(target.tagName === "LI" ? "li" : "div")
      gap.className = "doc-page-gap doc-page-gap-nested"
      gap.setAttribute("data-page-gap", "")
      gap.style.height = `calc(${g.base.toFixed(2)}px + var(--page-gap, 0px))`
      gap.style.setProperty("--gap-edge", `${g.edge.toFixed(2)}px`)
      target.before(gap)
    }
    host.setAttribute("data-gaps", sig)
    changed = true
  })
  return changed
}

/* ----------------------------- elenco delle note ------------------------- */

type EndNote = { pos: number; label: string; text: string; kind: string }

function endNotes(state: EditorState, paginated: boolean): EndNote[] {
  const counters: Record<string, number> = { footnote: 0, endnote: 0 }
  const out: EndNote[] = []
  for (const pos of footnoteKey.getState(state) ?? []) {
    const node = state.doc.nodeAt(pos)
    if (!node) continue
    const kind = node.attrs.kind === "endnote" ? "endnote" : "footnote"
    counters[kind]++
    if (paginated && kind === "footnote") continue
    out.push({
      pos,
      kind,
      text: String(node.attrs.text ?? ""),
      label: noteLabel(kind, counters[kind]),
    })
  }
  return out
}

/**
 * Le note in fondo al documento: sempre quelle di chiusura, e anche quelle a
 * piè di pagina quando il documento non ha pagine. È una decorazione in coda
 * all'editor, così l'impaginazione la tratta come il resto del testo e finisce
 * in stampa e nelle esportazioni.
 */
function notesWidget(state: EditorState, paginated: boolean) {
  const notes = endNotes(state, paginated)
  if (!notes.length) return DecorationSet.empty
  const key = `notes:${paginated ? 1 : 0}:${notes
    .map((n) => `${n.kind}/${n.label}/${n.text}`)
    .join("|")}`
  const toDOM = (view: EditorView) => {
    const section = document.createElement("section")
    section.className = "doc-notes"
    section.setAttribute("data-gap-host", "")
    section.contentEditable = "false"
    section.setAttribute("aria-label", "Note")
    const title = document.createElement("p")
    title.className = "doc-notes-title"
    title.setAttribute("data-gap-item", "")
    title.textContent = translate("Note")
    const list = document.createElement("ol")
    notes.forEach((note, index) => {
      const li = document.createElement("li")
      li.setAttribute("data-note", String(index))
      li.setAttribute("data-gap-item", "")
      li.setAttribute("data-label", note.label)
      const button = document.createElement("button")
      button.type = "button"
      if (note.text) button.textContent = note.text
      else {
        const empty = document.createElement("span")
        empty.className = "doc-notes-empty"
        empty.textContent = translate("Nota vuota: scrivila nel pannello")
        button.appendChild(empty)
      }
      li.appendChild(button)
      list.appendChild(li)
    })
    section.append(title, list)
    section.addEventListener("mousedown", (e) => e.preventDefault())
    section.addEventListener("click", (e) => {
      const li = (e.target as HTMLElement).closest<HTMLElement>("li[data-note]")
      if (!li) return
      // le posizioni si rileggono al clic: nel frattempo il testo è cambiato
      const current = endNotes(view.state, paginated)[Number(li.dataset.note)]
      if (!current) return
      const tr = view.state.tr.setSelection(
        NodeSelection.create(view.state.doc, current.pos)
      )
      view.dispatch(tr.scrollIntoView())
      view.focus()
    })
    return section
  }
  return DecorationSet.create(state.doc, [
    Decoration.widget(state.doc.content.size, toDOM, {
      side: 1,
      key,
      ignoreSelection: true,
      stopEvent: () => true,
    }),
  ])
}

const notesKey = new PluginKey("endNotes")

/* --------------------------------- plugin -------------------------------- */

export const Pagination = Extension.create({
  name: "pagination",
  // dopo le note: il loro plugin deve aver già calcolato le posizioni
  priority: 10,

  addCommands() {
    return {
      setPageLayout:
        (layout) =>
        ({ tr, state, dispatch }) => {
          const current = paginationKey.getState(state)
          if (
            current &&
            current.layout.pageHeight === layout.pageHeight &&
            current.layout.marginTop === layout.marginTop &&
            current.layout.marginBottom === layout.marginBottom
          ) {
            return true
          }
          if (dispatch) {
            tr.setMeta(paginationKey, { layout })
            tr.setMeta("addToHistory", false)
          }
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<PaginationState>({
        key: paginationKey,
        state: {
          init: (_config, state) => ({
            ...EMPTY_INFO,
            layout: { pageHeight: 0, marginTop: 0, marginBottom: 0 },
            gaps: [],
            deco: DecorationSet.create(state.doc, []),
          }),
          apply: (tr, value, _old, state) => {
            let next = value
            if (tr.docChanged) {
              next = {
                ...value,
                gaps: value.gaps.map((g) => ({
                  ...g,
                  pos: tr.mapping.map(g.pos, -1),
                })),
                deco: value.deco.map(tr.mapping, tr.doc),
              }
            }
            const meta = tr.getMeta(paginationKey) as
              (Partial<Result> & { layout?: PageLayout }) | undefined
            if (!meta) return next
            next = { ...next, ...meta }
            if (meta.layout && !meta.layout.pageHeight) {
              next = {
                ...next,
                ...EMPTY_INFO,
                gaps: [],
                deco: DecorationSet.create(state.doc, []),
              }
            } else if (meta.gaps) {
              next.deco = buildDeco(state.doc, meta.gaps)
            }
            return next
          },
        },
        props: {
          decorations: (state) => paginationKey.getState(state)?.deco,
        },
        view: (view) => {
          let queued = false
          let frame = 0
          let rounds = 0
          // quanto è costato l'ultimo calcolo e quando è finito: su un
          // documento lungo rifare tutte le pagine a ogni tasto rallenta la
          // scrittura, e allora mentre si scrive si rifanno a intervalli
          let cost = 0
          let last = 0
          let timer: ReturnType<typeof setTimeout> | null = null

          // se due calcoli di fila si contraddicono ci si ferma fino alla
          // prossima modifica vera: meglio uno spazio imperfetto che un ciclo
          let stalled = false

          const run = () => {
            queued = false
            if (view.isDestroyed || view.composing || stalled) return
            const st = paginationKey.getState(view.state)
            if (!st || !st.layout.pageHeight) return
            const started = performance.now()
            const result = paginate(view, st.layout)
            last = performance.now()
            cost = last - started
            if (!result) return
            const domChanged = syncDomGaps(view, result.domGaps)
            if (sameResult(result, st)) {
              if (domChanged) schedule()
              else rounds = 0
              return
            }
            if (++rounds > 6) {
              rounds = 0
              stalled = true
              return
            }
            view.dispatch(
              view.state.tr
                .setMeta(paginationKey, result)
                .setMeta("addToHistory", false)
            )
          }
          const schedule = () => {
            if (queued) return
            queued = true
            queueMicrotask(run)
          }
          /**
           * Dopo una modifica del testo. Se impaginare è rapido si rifà
           * subito, come sempre; se costa più di un terzo di fotogramma si
           * rifà al più ogni sei volte il suo costo (fra 60 e 400 ms), così
           * i tasti restano pronti e le pagine si aggiustano mentre si scrive
           */
          const scheduleEdit = () => {
            if (cost < 6) {
              schedule()
              return
            }
            if (timer) return
            const gap = Math.min(400, Math.max(60, cost * 6))
            const wait = Math.max(0, last + gap - performance.now())
            timer = setTimeout(() => {
              timer = null
              schedule()
            }, wait)
          }
          // immagini che arrivano, font che si caricano, finestra che cambia;
          // anche una riga in più mentre si scrive cambia l'altezza, quindi
          // vale la stessa cadenza delle modifiche
          const later = () => {
            if (!frame) {
              frame = requestAnimationFrame(() => {
                frame = 0
                scheduleEdit()
              })
            }
          }
          const ro = new ResizeObserver(later)
          ro.observe(view.dom)
          document.fonts?.addEventListener("loadingdone", later)
          schedule()

          return {
            update: (v, prev) => {
              const a = paginationKey.getState(v.state)
              const b = paginationKey.getState(prev)
              if (a?.layout !== b?.layout) {
                rounds = 0
                stalled = false
                schedule()
              } else if (v.state.doc !== prev.doc) {
                rounds = 0
                stalled = false
                scheduleEdit()
              } else if (
                paginationKey.getState(v.state) !== paginationKey.getState(prev)
              ) {
                schedule()
              }
            },
            destroy: () => {
              if (timer) clearTimeout(timer)
              ro.disconnect()
              document.fonts?.removeEventListener("loadingdone", later)
              if (frame) cancelAnimationFrame(frame)
            },
          }
        },
      }),
      new Plugin<DecorationSet>({
        key: notesKey,
        state: {
          init: (_config, state) => notesWidget(state, false),
          apply: (tr, value, old, state) => {
            const was = Boolean(paginationKey.getState(old)?.layout.pageHeight)
            const is = Boolean(paginationKey.getState(state)?.layout.pageHeight)
            if (!tr.docChanged && was === is) return value
            return notesWidget(state, is)
          },
        },
        props: {
          decorations: (state) => notesKey.getState(state),
        },
      }),
    ]
  },
})
