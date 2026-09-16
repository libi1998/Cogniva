"use client"

import * as React from "react"
import { nanoid } from "nanoid"
import { useEditorState, type Editor } from "@tiptap/react"
import type { Node as PMNode } from "@tiptap/pm/model"
import { Check, CornerDownRight, RotateCcw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Textarea } from "@/components/ui/textarea"
import { getAuthor } from "@/lib/author"
import { useStore } from "@/lib/store"
import { commentRanges } from "@/lib/tiptap-extensions"
import type { DocComment } from "@/lib/types"
import { cn } from "@/lib/utils"

import { useT, timeAgo } from "@/lib/i18n/client"
const NO_COMMENTS: DocComment[] = []

/* ------------------------------- posizioni -------------------------------- */

type Range = { from: number; to: number }
const rangeCache = new WeakMap<PMNode, Map<string, Range>>()

/** Le posizioni dei commenti, calcolate una volta per versione del documento */
function rangesOf(doc: PMNode) {
  let ranges = rangeCache.get(doc)
  if (!ranges) {
    ranges = commentRanges(doc)
    rangeCache.set(doc, ranges)
  }
  return ranges
}

/* ------------------------------- controllo -------------------------------- */

export type CommentsController = {
  /** i commenti presenti nel testo, nell'ordine in cui compaiono */
  list: DocComment[]
  /** il commento su cui si trova il cursore */
  active: string | null
  editing: string | null
  add: () => void
  remove: (id: string) => void
  removeAll: (onlyResolved: boolean) => void
  resolve: (id: string, value: boolean) => void
  edit: (id: string, text: string) => void
  reply: (id: string, text: string) => void
  select: (id: string, focus?: boolean) => void
  step: (dir: 1 | -1) => void
  setEditing: (id: string | null) => void
}

export function useComments(
  editor: Editor | null,
  fileId: string
): CommentsController {
  const t = useT()
  const stored = useStore((s) => {
    const f = s.files.find((x) => x.id === fileId)
    return f && f.kind === "doc"
      ? (f.data.comments ?? NO_COMMENTS)
      : NO_COMMENTS
  })
  const update = useStore((s) => s.updateDocComments)
  const [editing, setEditing] = React.useState<string | null>(null)
  const hasComments = stored.length > 0

  // ordine nel testo e commento sotto al cursore: si leggono dall'editor
  const snapshot = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e || !hasComments) return { order: [] as string[], active: null }
      const ranges = rangesOf(e.state.doc)
      const { $from, from, to } = e.state.selection
      let active: string | null = null
      const marks = [...$from.marks(), ...($from.nodeAfter?.marks ?? [])]
      for (const mark of marks) {
        if (mark.type.name === "comment" && mark.attrs.id) {
          active = String(mark.attrs.id)
          break
        }
      }
      if (!active) {
        for (const [id, r] of ranges) {
          if (from >= r.from && to <= r.to && from !== to) active = id
        }
      }
      return { order: [...ranges.keys()], active }
    },
  }) ?? { order: [], active: null }

  const byId = new Map(stored.map((c) => [c.id, c]))
  const list = snapshot.order
    .map((id) => byId.get(id))
    .filter((c): c is DocComment => Boolean(c))

  const removeMarks = (ids: Set<string>) => {
    if (!editor) return
    const { state } = editor
    const tr = state.tr
    state.doc.descendants((node, pos) => {
      if (!node.isText) return true
      for (const mark of node.marks) {
        if (mark.type.name === "comment" && ids.has(String(mark.attrs.id))) {
          tr.removeMark(pos, pos + node.nodeSize, mark)
        }
      }
      return false
    })
    // annullare non deve riportare un evidenziato senza conversazione
    tr.setMeta("addToHistory", false)
    if (tr.docChanged) editor.view.dispatch(tr)
  }

  return {
    list,
    active: snapshot.active,
    editing,
    setEditing,
    add: () => {
      if (!editor) return
      const { state } = editor
      let { from, to } = state.selection
      if (from === to) {
        // senza selezione si commenta la parola sotto al cursore, come Word
        const $pos = state.selection.$from
        const text = $pos.parent.textContent
        let start = $pos.parentOffset
        let end = start
        const word = /[\p{L}\p{N}_'’-]/u
        while (start > 0 && word.test(text[start - 1])) start--
        while (end < text.length && word.test(text[end])) end++
        if (start === end) {
          toast.info(t("Seleziona il testo da commentare"))
          return
        }
        from = $pos.start() + start
        to = $pos.start() + end
      }
      const id = nanoid(8)
      const tr = state.tr.addMark(
        from,
        to,
        state.schema.marks.comment.create({ id })
      )
      editor.view.dispatch(tr)
      update(fileId, (items) => [
        ...items,
        {
          id,
          author: getAuthor(),
          text: "",
          createdAt: Date.now(),
          resolved: false,
          replies: [],
        },
      ])
      setEditing(id)
    },
    remove: (id) => {
      removeMarks(new Set([id]))
      update(fileId, (items) => items.filter((c) => c.id !== id))
      if (editing === id) setEditing(null)
    },
    removeAll: (onlyResolved) => {
      const ids = new Set(
        stored.filter((c) => !onlyResolved || c.resolved).map((c) => c.id)
      )
      if (!ids.size) return
      removeMarks(ids)
      update(fileId, (items) => items.filter((c) => !ids.has(c.id)))
    },
    resolve: (id, value) =>
      update(fileId, (items) =>
        items.map((c) => (c.id === id ? { ...c, resolved: value } : c))
      ),
    edit: (id, text) =>
      update(fileId, (items) =>
        items.map((c) => (c.id === id ? { ...c, text } : c))
      ),
    reply: (id, text) =>
      update(fileId, (items) =>
        items.map((c) =>
          c.id === id
            ? {
                ...c,
                replies: [
                  ...c.replies,
                  {
                    id: nanoid(8),
                    author: getAuthor(),
                    text,
                    createdAt: Date.now(),
                  },
                ],
              }
            : c
        )
      ),
    select: (id, focus = true) => {
      if (!editor) return
      const range = rangesOf(editor.state.doc).get(id)
      if (!range) return
      const chain = editor.chain()
      ;(focus ? chain.focus() : chain)
        .setTextSelection(range)
        .scrollIntoView()
        .run()
    },
    step: (dir) => {
      if (!editor || !list.length) return
      const ranges = rangesOf(editor.state.doc)
      const from = editor.state.selection.from
      const sorted = list
        .map((c) => ({ id: c.id, at: ranges.get(c.id)?.from ?? 0 }))
        .sort((a, b) => a.at - b.at)
      const next =
        dir > 0
          ? (sorted.find((c) => c.at > from) ?? sorted[0])
          : ([...sorted].reverse().find((c) => c.at < from) ??
            sorted[sorted.length - 1])
      const range = ranges.get(next.id)
      if (range) {
        editor.chain().focus().setTextSelection(range).scrollIntoView().run()
      }
    },
  }
}

/**
 * Elimina i commenti rimasti senza testo commentato: capita quando si cancella
 * tutto il paragrafo. Si fa all'apertura del documento.
 */
export function pruneComments(editor: Editor, fileId: string) {
  const store = useStore.getState()
  const file = store.files.find((f) => f.id === fileId)
  if (!file || file.kind !== "doc" || !file.data.comments?.length) return
  const present = rangesOf(editor.state.doc)
  if (file.data.comments.every((c) => present.has(c.id))) return
  store.updateDocComments(fileId, (items) =>
    items.filter((c) => present.has(c.id))
  )
}

/* --------------------------------- colonna -------------------------------- */

const when = (time: number) => timeAgo(time)

const AVATAR_COLORS = [
  "#6759ff",
  "#e03177",
  "#12a071",
  "#f08c00",
  "#1c7ed6",
  "#ae3ec9",
]

function Avatar({ name }: { name: string }) {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return (
    <span
      aria-hidden
      className="flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
      style={{ background: AVATAR_COLORS[hash % AVATAR_COLORS.length] }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

/**
 * I commenti nel margine destro del foglio, ognuno all'altezza del suo testo
 * come in Word. Se due si sovrappongono, il secondo scivola sotto al primo.
 */
export function CommentsColumn({
  editor,
  ctl,
  sheet,
  stacked = false,
}: {
  editor: Editor | null
  ctl: CommentsController
  sheet: React.RefObject<HTMLDivElement | null>
  /**
   * sui telefoni non c'è posto accanto al foglio: le schede vanno in lista
   * sotto, nell'ordine del testo
   */
  stacked?: boolean
}) {
  const t = useT()
  const [anchors, setAnchors] = React.useState<Record<string, number>>({})
  const [heights, setHeights] = React.useState<Record<string, number>>({})
  const ids = ctl.list.map((c) => c.id).join(",")

  // altezza del testo commentato, ricalcolata a ogni modifica (una volta per
  // fotogramma) e quando il foglio cambia dimensione
  React.useEffect(() => {
    if (!editor || !ids) return
    let frame = 0
    const measure = () => {
      frame = 0
      const el = sheet.current
      if (!el || editor.isDestroyed) return
      const box = el.getBoundingClientRect()
      const scale = box.width / el.offsetWidth || 1
      const ranges = rangesOf(editor.state.doc)
      const next: Record<string, number> = {}
      for (const id of ids.split(",")) {
        const range = ranges.get(id)
        if (!range) continue
        try {
          const c = editor.view.coordsAtPos(range.from, 1)
          next[id] = Math.round((c.top - box.top) / scale)
        } catch {
          // posizione non ancora disegnata
        }
      }
      setAnchors((prev) => {
        const same =
          Object.keys(prev).length === Object.keys(next).length &&
          Object.entries(next).every(([k, v]) => prev[k] === v)
        return same ? prev : next
      })
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    schedule()
    editor.on("transaction", schedule)
    const ro = new ResizeObserver(schedule)
    if (sheet.current) ro.observe(sheet.current)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      editor.off("transaction", schedule)
      ro.disconnect()
    }
  }, [editor, ids, sheet])

  const observer = React.useRef<ResizeObserver | null>(null)
  const cardRef = React.useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    if (!observer.current) {
      observer.current = new ResizeObserver((entries) => {
        setHeights((prev) => {
          let changed = false
          const next = { ...prev }
          for (const entry of entries) {
            const id = (entry.target as HTMLElement).dataset.comment
            const h = Math.round((entry.target as HTMLElement).offsetHeight)
            if (id && next[id] !== h) {
              next[id] = h
              changed = true
            }
          }
          return changed ? next : prev
        })
      })
    }
    const ro = observer.current
    ro.observe(el)
    // una scheda che sparisce (commento eliminato o risolto) smette di essere
    // osservata: prima restava agganciata fino alla chiusura del documento
    return () => ro.unobserve(el)
  }, [])
  React.useEffect(() => () => observer.current?.disconnect(), [])

  if (!editor || !ctl.list.length) return null

  // posizione di ogni scheda: all'altezza del testo, ma mai sopra alla
  // precedente
  const sorted = [...ctl.list].sort(
    (a, b) => (anchors[a.id] ?? 0) - (anchors[b.id] ?? 0)
  )
  let bottom = 0
  const tops: Record<string, number> = {}
  for (const c of sorted) {
    const top = Math.max(anchors[c.id] ?? 0, bottom)
    tops[c.id] = top
    bottom = top + (heights[c.id] ?? 90) + 8
  }

  return (
    <aside
      aria-label={t("Commenti")}
      className={cn(
        "doc-comments shrink-0",
        stacked ? "flex w-full flex-col gap-2" : "relative w-[248px]"
      )}
    >
      {sorted.map((c) => (
        <CommentCard
          key={c.id}
          ref={cardRef}
          comment={c}
          top={stacked ? undefined : tops[c.id]}
          active={ctl.active === c.id}
          ctl={ctl}
        />
      ))}
    </aside>
  )
}

const CommentCard = React.forwardRef<
  HTMLDivElement,
  {
    comment: DocComment
    /** assente quando le schede sono in lista */
    top?: number
    active: boolean
    ctl: CommentsController
  }
>(function CommentCard({ comment: c, top, active, ctl }, ref) {
  const t = useT()
  const [draft, setDraft] = React.useState("")
  const editing = ctl.editing === c.id

  const finishEditing = () => {
    ctl.setEditing(null)
    // un commento lasciato vuoto non serve a nessuno
    if (!c.text.trim() && c.replies.length === 0) ctl.remove(c.id)
  }
  const sendReply = () => {
    const text = draft.trim()
    if (!text) return
    ctl.reply(c.id, text)
    setDraft("")
  }

  return (
    <div
      ref={ref}
      data-comment={c.id}
      className={cn(
        "rounded-lg border border-border bg-card p-2.5 text-xs text-card-foreground shadow-sm transition-[top,box-shadow] duration-150",
        top === undefined ? "relative" : "absolute inset-x-0",
        active && "shadow-md ring-2 ring-primary/50",
        c.resolved && !active && "opacity-60"
      )}
      style={{ top }}
      onMouseDown={(e) => {
        const target = e.target as HTMLElement
        if (target.closest("textarea, input, button")) return
        e.preventDefault()
        ctl.select(c.id)
      }}
    >
      <div className="flex items-center gap-2">
        <Avatar name={c.author} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{c.author}</div>
          <div className="text-[10px] text-muted-foreground">
            {when(c.createdAt)}
            {c.resolved ? ` ${t("· risolto")}` : ""}
          </div>
        </div>
        <button
          type="button"
          title={c.resolved ? t("Riapri") : t("Risolvi")}
          aria-label={c.resolved ? t("Riapri") : t("Risolvi")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => ctl.resolve(c.id, !c.resolved)}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {c.resolved ? (
            <RotateCcw className="size-3.5" />
          ) : (
            <Check className="size-3.5" />
          )}
        </button>
        <button
          type="button"
          title={t("Elimina commento")}
          aria-label={t("Elimina commento")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => ctl.remove(c.id)}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {editing ? (
        <Textarea
          autoFocus
          rows={3}
          value={c.text}
          placeholder={t("Scrivi un commento…")}
          className="mt-2 min-h-0 text-xs"
          onChange={(e) => ctl.edit(c.id, e.target.value)}
          onBlur={finishEditing}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              ;(e.target as HTMLTextAreaElement).blur()
            }
            if (e.key === "Escape") (e.target as HTMLTextAreaElement).blur()
          }}
        />
      ) : (
        <p
          className="mt-1.5 leading-relaxed break-words whitespace-pre-wrap"
          onDoubleClick={() => ctl.setEditing(c.id)}
          title={t("Doppio clic per modificare")}
        >
          {c.text || (
            <span className="text-muted-foreground">{t("Vuoto")}</span>
          )}
        </p>
      )}

      {c.replies.map((r) => (
        <div key={r.id} className="mt-2 border-t border-border/70 pt-2">
          <div className="flex items-center gap-1.5">
            <Avatar name={r.author} />
            <span className="truncate font-semibold">{r.author}</span>
            <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
              {when(r.createdAt)}
            </span>
          </div>
          <p className="mt-1 leading-relaxed break-words whitespace-pre-wrap">
            {r.text}
          </p>
        </div>
      ))}

      {active && !editing ? (
        <div className="mt-2 flex items-center gap-1 border-t border-border/70 pt-2">
          <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            value={draft}
            placeholder={t("Rispondi…")}
            aria-label={t("Rispondi")}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                sendReply()
              }
            }}
            className="h-7 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-ring"
          />
        </div>
      ) : null}
    </div>
  )
})
