import { Extension, Mark, mergeAttributes } from "@tiptap/core"
import type { Mark as PMMark, Node as PMNode } from "@tiptap/pm/model"
import {
  AddMarkStep,
  RemoveMarkStep,
  ReplaceStep,
  type Step,
} from "@tiptap/pm/transform"
import {
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
  type Transaction,
} from "@tiptap/pm/state"

/**
 * «Revisioni» come in Word. Con il rilevamento attivo il testo scritto porta
 * il marchio «inserito» e quello cancellato non sparisce: prende il marchio
 * «eliminato» e resta visibile barrato finché qualcuno non accetta o rifiuta.
 *
 * Il lavoro lo fa `dispatchTransaction`: ogni modifica dell'utente viene
 * riscritta prima di arrivare all'editor. Si tracciano scrittura, cancellazione
 * e incolla dentro ai paragrafi; le operazioni sulla struttura (unire due
 * paragrafi, spostare blocchi) passano come sono.
 */

export type ChangeKind = "insertion" | "deletion"

export type TrackSettings = { enabled: boolean; author: string }

declare module "@tiptap/core" {
  interface Storage {
    trackChanges: TrackSettings
  }
  interface Commands<ReturnType> {
    trackChanges: {
      acceptChange: () => ReturnType
      rejectChange: () => ReturnType
      acceptAllChanges: () => ReturnType
      rejectAllChanges: () => ReturnType
      goToChange: (direction: 1 | -1) => ReturnType
    }
  }
}

/** Un colore stabile per autore, come i colori delle revisioni di Word */
export function authorColor(author: string) {
  let hash = 0
  for (const c of author) hash = (hash * 31 + c.charCodeAt(0)) | 0
  const hues = [350, 210, 140, 30, 280, 180, 50, 320]
  return `hsl(${hues[Math.abs(hash) % hues.length]} 70% 45%)`
}

const changeMark = (name: ChangeKind, tag: "ins" | "del") =>
  Mark.create({
    name,
    inclusive: false,
    excludes: "",
    spanning: true,
    addAttributes() {
      return {
        author: {
          default: "",
          parseHTML: (el) => el.getAttribute("data-author") ?? "",
          renderHTML: (a) => ({
            "data-author": a.author,
            style: `--change-color:${authorColor(String(a.author ?? ""))}`,
          }),
        },
        date: {
          default: 0,
          parseHTML: (el) => Number(el.getAttribute("data-date")) || 0,
          renderHTML: (a) => ({ "data-date": a.date }),
        },
      }
    },
    parseHTML() {
      return [{ tag: `${tag}[data-author]` }]
    },
    renderHTML({ HTMLAttributes }) {
      return [
        tag,
        mergeAttributes({ class: `doc-change doc-${name}` }, HTMLAttributes),
        0,
      ]
    },
  })

export const Insertion = changeMark("insertion", "ins")
export const Deletion = changeMark("deletion", "del")

/* ----------------------------- riscrittura ------------------------------- */

/**
 * Gli attributi da usare per un marchio: quelli della revisione accanto dello
 * stesso autore, così lettere scritte una alla volta restano una revisione
 * sola invece di cento pezzi con date diverse
 */
function joinAttrs(
  doc: PMNode,
  from: number,
  to: number,
  type: PMMark["type"],
  attrs: { author: string; date: number }
) {
  const near = [doc.resolve(from).nodeBefore, doc.resolve(to).nodeAfter]
  for (const node of near) {
    const mark = node?.marks.find(
      (m) => m.type === type && m.attrs.author === attrs.author
    )
    if (mark) return mark.attrs as { author: string; date: number }
  }
  return attrs
}

/** Una parte già cancellata che resta nel documento nuovo */
type Kept = { at: number; len: number }

function toNew(pos: number, kept: Kept[], assoc: -1 | 1 = 1) {
  let out = pos
  for (const k of kept) {
    if (k.at < pos || (assoc === 1 && k.at === pos)) out += k.len
  }
  return out
}

function trackable(step: Step, doc: PMNode) {
  if (!(step instanceof ReplaceStep)) return false
  const { from, to, slice } = step as ReplaceStep & { from: number; to: number }
  if (from === to && slice.size === 0) return false
  const $from = doc.resolve(from)
  const $to = doc.resolve(to)
  if (from < to) {
    if ($from.sameParent($to)) return $from.parent.isTextblock
    // su più paragrafi si traccia il testo selezionato; unire due paragrafi
    // (⌫ a inizio riga) non ha testo da segnare e passa com'è
    let inline = false
    doc.nodesBetween(from, to, (node) => {
      if (node.isInline) inline = true
      return !inline
    })
    return inline
  }
  return $from.parent.isTextblock || slice.content.firstChild?.isInline === true
}

/** La modifica dell'utente riscritta come revisione */
export function trackTransaction(
  state: EditorState,
  tr: Transaction,
  settings: TrackSettings
): Transaction | null {
  if (!tr.docChanged) return null
  const schema = state.schema
  const insertion = schema.marks.insertion
  const deletion = schema.marks.deletion
  if (!insertion || !deletion) return null
  const attrs = { author: settings.author || "Autore", date: Date.now() }
  const out = state.tr
  const kept: Kept[] = []
  let tracked = false
  let caret: number | null = null

  tr.steps.forEach((step, i) => {
    const before = tr.docs[i]
    // le parti tenute seguono le modifiche successive del documento originale
    if (i > 0) {
      const map = tr.steps[i - 1].getMap()
      for (const k of kept) k.at = map.map(k.at, -1)
    }
    if (step instanceof AddMarkStep || step instanceof RemoveMarkStep) {
      const s = step as unknown as { from: number; to: number; mark: PMMark }
      const from = toNew(s.from, kept, -1)
      const to = toNew(s.to, kept)
      if (step instanceof AddMarkStep) out.addMark(from, to, s.mark)
      else out.removeMark(from, to, s.mark)
      return
    }
    if (!trackable(step, before)) {
      // struttura: si applica com'è, spostata nel documento nuovo
      const mapped = step.map({
        map: (pos: number, assoc = 1) => toNew(pos, kept, assoc < 0 ? -1 : 1),
        mapResult: (pos: number, assoc = 1) => ({
          pos: toNew(pos, kept, assoc < 0 ? -1 : 1),
          deleted: false,
          deletedBefore: false,
          deletedAfter: false,
          deletedAcross: false,
        }),
      } as never)
      if (mapped) out.step(mapped)
      return
    }
    tracked = true
    const { from, to, slice } = step as ReplaceStep & {
      from: number
      to: number
    }
    // una cancellazione salta il testo già eliminato che le sta davanti (tasto
    // Canc ripetuto); una scrittura va prima di quello (come in Word)
    const nf = toNew(from, kept, to > from ? 1 : -1)
    const nt = to > from ? toNew(to, kept, -1) : nf

    // cancellato: il testo inserito dallo stesso autore sparisce davvero, il
    // resto diventa «eliminato»
    let removed = 0
    if (to > from) {
      const ranges: { from: number; to: number; own: boolean }[] = []
      out.doc.nodesBetween(nf, nt, (node, pos) => {
        if (!node.isInline) return true
        const start = Math.max(nf, pos)
        const end = Math.min(nt, pos + node.nodeSize)
        if (end <= start) return false
        const ins = node.marks.find((m) => m.type === insertion)
        const own = Boolean(ins && ins.attrs.author === attrs.author)
        const already = node.marks.some((m) => m.type === deletion)
        if (!already || own) ranges.push({ from: start, to: end, own })
        return false
      })
      for (const r of [...ranges].reverse()) {
        if (r.own) {
          out.delete(r.from, r.to)
          removed += r.to - r.from
        } else {
          out.addMark(
            r.from,
            r.to,
            deletion.create(joinAttrs(out.doc, r.from, r.to, deletion, attrs))
          )
        }
      }
    }
    const keptLen = to - from - removed
    const insertAt = nt - removed
    if (slice.size > 0) {
      out.replace(insertAt, insertAt, slice)
      const end = insertAt + slice.size
      out.removeMark(insertAt, end, deletion)
      out.addMark(
        insertAt,
        end,
        insertion.create(joinAttrs(out.doc, insertAt, end, insertion, attrs))
      )
    }
    if (keptLen > 0) kept.push({ at: from, len: keptLen })
    // il cursore: dopo il testo scritto; con ⌫ prima del testo eliminato,
    // con Canc dopo, così il tasto successivo prosegue nella stessa direzione
    const backwards = state.selection.head >= to
    caret =
      slice.size > 0 ? insertAt + slice.size : backwards ? nf : nt - removed
  })

  if (!tracked) return null
  const head = tr.selection.head
  const target =
    caret !== null && tr.steps.length === 1 ? caret : toNew(head, kept, 1)
  out.setSelection(
    TextSelection.near(out.doc.resolve(Math.min(target, out.doc.content.size)))
  )
  if (tr.storedMarks)
    out.setStoredMarks(tr.storedMarks.filter((m) => m.type !== deletion))
  if (tr.scrolledIntoView) out.scrollIntoView()
  return out
}

/* ------------------------------ composizione ------------------------------ */

/**
 * Tastiere con composizione (giapponese, cinese, accenti morti, e su Android
 * praticamente tutte): mentre si compone il testo non si può riscrivere, il
 * browser perderebbe la parola a metà. Si lascia fare e alla fine si confronta
 * il paragrafo com'era e com'è: la parte nuova diventa «inserita», quella
 * sostituita torna come «eliminata».
 */
type Composition = { pos: number; block: PMNode }

const compositions = new WeakMap<object, Composition>()

export function startComposition(view: { state: EditorState }): void {
  const { $from } = view.state.selection
  let depth = $from.depth
  while (depth > 0 && !$from.node(depth).isTextblock) depth -= 1
  if (depth === 0) return
  compositions.set(view, { pos: $from.before(depth), block: $from.node(depth) })
}

export function mapComposition(view: object, tr: Transaction) {
  const comp = compositions.get(view)
  if (comp) comp.pos = tr.mapping.map(comp.pos, -1)
}

/** La transazione che segna le modifiche fatte durante la composizione */
export function finishComposition(
  view: { state: EditorState },
  settings: TrackSettings
): Transaction | null {
  const comp = compositions.get(view)
  compositions.delete(view)
  if (!comp) return null
  const { state } = view
  const block = state.doc.nodeAt(comp.pos)
  if (!block || !block.isTextblock) return null
  const oldContent = comp.block.content
  const newContent = block.content
  const start = oldContent.findDiffStart(newContent)
  if (start === null) return null
  const end = oldContent.findDiffEnd(newContent)
  if (!end) return null
  let { a: endA, b: endB } = end
  // caratteri ripetuti: le due estremità si possono sovrapporre
  const overlap = start - Math.min(endA, endB)
  if (overlap > 0) {
    endA += overlap
    endB += overlap
  }
  const insertion = state.schema.marks.insertion
  const deletion = state.schema.marks.deletion
  const attrs = { author: settings.author || "Autore", date: Date.now() }
  const base = comp.pos + 1
  const tr = state.tr
  if (endB > start) {
    const a = base + start
    const b = base + endB
    tr.removeMark(a, b, deletion)
    tr.addMark(
      a,
      b,
      insertion.create(joinAttrs(tr.doc, a, b, insertion, attrs))
    )
  }
  if (endA > start) {
    const removed = oldContent.cut(start, endA)
    let own = true
    removed.descendants((node) => {
      if (!node.isInline) return true
      const ins = node.marks.find((m) => m.type === insertion)
      if (!ins || ins.attrs.author !== attrs.author) own = false
      return false
    })
    // il testo scritto prima dallo stesso autore sparisce e basta
    if (!own) {
      const at = base + start
      tr.insert(at, removed)
      tr.addMark(
        at,
        at + removed.size,
        deletion.create(
          joinAttrs(tr.doc, at, at + removed.size, deletion, attrs)
        )
      )
      tr.removeMark(at, at + removed.size, insertion)
      const head = tr.mapping.map(state.selection.head)
      tr.setSelection(TextSelection.near(tr.doc.resolve(head)))
    }
  }
  if (!tr.docChanged) return null
  tr.setMeta("trackChanges", "skip")
  return tr
}

/* ------------------------------ accetta/rifiuta --------------------------- */

export type ChangeInfo = {
  kind: ChangeKind
  author: string
  date: number
  from: number
  to: number
  text: string
}

/** Le revisioni del documento, unendo i pezzi vicini dello stesso tipo */
export function listChanges(doc: PMNode): ChangeInfo[] {
  const out: ChangeInfo[] = []
  doc.descendants((node, pos) => {
    if (!node.isInline) return true
    for (const mark of node.marks) {
      const kind = mark.type.name
      if (kind !== "insertion" && kind !== "deletion") continue
      const last = out[out.length - 1]
      const text = node.isText ? (node.text ?? "") : "▪"
      if (
        last &&
        last.kind === kind &&
        last.author === mark.attrs.author &&
        last.to === pos
      ) {
        last.to = pos + node.nodeSize
        last.text += text
      } else {
        out.push({
          kind,
          author: String(mark.attrs.author ?? ""),
          date: Number(mark.attrs.date ?? 0),
          from: pos,
          to: pos + node.nodeSize,
          text,
        })
      }
    }
    return true
  })
  return out
}

function resolveChanges(
  state: EditorState,
  tr: Transaction,
  changes: ChangeInfo[],
  accept: boolean
) {
  for (const change of [...changes].sort((a, b) => b.from - a.from)) {
    const type = state.schema.marks[change.kind]
    const removeText = accept
      ? change.kind === "deletion"
      : change.kind === "insertion"
    if (removeText) tr.delete(change.from, change.to)
    else tr.removeMark(change.from, change.to, type)
  }
  tr.setMeta("trackChanges", "skip")
}

function changesAtSelection(state: EditorState) {
  const { from, to } = state.selection
  return listChanges(state.doc).filter((c) =>
    from === to ? c.from <= from && c.to >= from : c.from < to && c.to > from
  )
}

export const TrackChanges = Extension.create<
  Record<string, never>,
  TrackSettings
>({
  name: "trackChanges",

  addStorage() {
    return { enabled: false, author: "" }
  },

  addExtensions() {
    return [Insertion, Deletion]
  },

  addProseMirrorPlugins() {
    const settings = this.storage
    const editor = this.editor
    return [
      new Plugin({
        key: new PluginKey("trackComposition"),
        props: {
          handleDOMEvents: {
            compositionstart: (view) => {
              if (settings.enabled) startComposition(view)
              return false
            },
            compositionend: (view) => {
              if (!settings.enabled) return false
              // ProseMirror applica l'ultima parte della composizione subito
              // dopo l'evento: si aspetta che abbia finito
              let tries = 0
              const finish = () => {
                if (editor.isDestroyed) return
                if (view.composing && tries++ < 20) {
                  window.setTimeout(finish, 25)
                  return
                }
                const tr = finishComposition(view, settings)
                if (tr) view.dispatch(tr)
              }
              window.setTimeout(finish, 0)
              return false
            },
          },
        },
      }),
    ]
  },

  dispatchTransaction({ transaction, next }) {
    const settings = this.storage
    // durante la composizione la modifica passa com'è (vedi sopra)
    if (
      settings.enabled &&
      (this.editor.view.composing || compositions.has(this.editor.view))
    ) {
      mapComposition(this.editor.view, transaction)
      if (transaction.getMeta("trackChanges") !== "skip") {
        next(transaction)
        return
      }
    }
    if (
      !settings.enabled ||
      !transaction.docChanged ||
      transaction.getMeta("trackChanges") === "skip" ||
      // Annulla e Ripristina rimettono il documento com'era: non sono revisioni
      transaction.getMeta("history$") !== undefined ||
      transaction.getMeta("addToHistory") === false ||
      transaction.getMeta("preventUpdate")
    ) {
      next(transaction)
      return
    }
    try {
      const rewritten = trackTransaction(
        this.editor.state,
        transaction,
        settings
      )
      next(rewritten ?? transaction)
    } catch {
      // una modifica che non si riesce a tracciare non deve andare persa
      next(transaction)
    }
  },

  addCommands() {
    return {
      acceptChange:
        () =>
        ({ state, tr, dispatch }) => {
          const changes = changesAtSelection(state)
          if (!changes.length) return false
          if (dispatch) resolveChanges(state, tr, changes, true)
          return true
        },
      rejectChange:
        () =>
        ({ state, tr, dispatch }) => {
          const changes = changesAtSelection(state)
          if (!changes.length) return false
          if (dispatch) resolveChanges(state, tr, changes, false)
          return true
        },
      acceptAllChanges:
        () =>
        ({ state, tr, dispatch }) => {
          const changes = listChanges(state.doc)
          if (!changes.length) return false
          if (dispatch) resolveChanges(state, tr, changes, true)
          return true
        },
      rejectAllChanges:
        () =>
        ({ state, tr, dispatch }) => {
          const changes = listChanges(state.doc)
          if (!changes.length) return false
          if (dispatch) resolveChanges(state, tr, changes, false)
          return true
        },
      goToChange:
        (direction) =>
        ({ state, tr, dispatch }) => {
          const changes = listChanges(state.doc)
          if (!changes.length) return false
          const { from, to } = state.selection
          const target =
            direction > 0
              ? (changes.find(
                  (c) => c.from >= to && !(c.from === from && c.to === to)
                ) ?? changes[0])
              : ([...changes].reverse().find((c) => c.to <= from) ??
                changes[changes.length - 1])
          if (dispatch) {
            tr.setSelection(
              TextSelection.create(tr.doc, target.from, target.to)
            )
            tr.scrollIntoView()
            tr.setMeta("trackChanges", "skip")
          }
          return true
        },
    }
  },
})

/** Il rilevamento acceso o spento e l'autore delle revisioni */
export function setTrackSettings(
  editor: { storage: { trackChanges?: TrackSettings }; isDestroyed: boolean },
  next: TrackSettings
) {
  const storage = editor.storage.trackChanges
  if (!storage || editor.isDestroyed) return
  storage.enabled = next.enabled
  storage.author = next.author
}
