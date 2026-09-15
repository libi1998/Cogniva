import { Extension } from "@tiptap/core"
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state"
import type { EditorState, Transaction } from "@tiptap/pm/state"
import type { Node as PMNode } from "@tiptap/pm/model"
import { Decoration, DecorationSet } from "@tiptap/pm/view"

type FindOptions = {
  term: string
  caseSensitive: boolean
  whole: boolean
}

export type Match = { from: number; to: number }

export type FindState = FindOptions & {
  matches: Match[]
  active: number
  decorations: DecorationSet
}

const findKey = new PluginKey<FindState>("findReplace")

const EMPTY: FindOptions = { term: "", caseSensitive: false, whole: false }

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * Cerca il testo un blocco alla volta: dentro un paragrafo le parole spezzate
 * in più nodi (per il grassetto, un colore…) tornano una stringa sola, ma una
 * corrispondenza non può mai scavalcare due paragrafi.
 */
function findMatches(doc: PMNode, opt: FindOptions): Match[] {
  if (!opt.term) return []
  let re: RegExp
  try {
    const body = escape(opt.term)
    re = new RegExp(
      opt.whole ? `(?<![\\p{L}\\p{N}_])${body}(?![\\p{L}\\p{N}_])` : body,
      opt.caseSensitive ? "gu" : "giu"
    )
  } catch {
    return []
  }

  const out: Match[] = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    let text = ""
    const map: number[] = []
    node.forEach((child, offset) => {
      if (child.isText && child.text) {
        for (let i = 0; i < child.text.length; i += 1) {
          map.push(pos + 1 + offset + i)
        }
        text += child.text
      } else {
        map.push(pos + 1 + offset)
        // un segnaposto che non combacia con nessuna lettera
        text += "￿"
      }
    })
    re.lastIndex = 0
    let m = re.exec(text)
    while (m) {
      if (m[0].length === 0) {
        re.lastIndex += 1
      } else {
        const from = map[m.index]
        const to = map[m.index + m[0].length - 1] + 1
        if (from !== undefined && to !== undefined) out.push({ from, to })
      }
      m = re.exec(text)
    }
    return false
  })
  return out
}

/** L'occorrenza più vicina al cursore, così «Trova» riparte da lì */
function nearest(matches: Match[], pos: number) {
  const i = matches.findIndex((m) => m.from >= pos)
  return i === -1 ? 0 : i
}

function build(
  doc: PMNode,
  opt: FindOptions,
  active: number,
  matches = findMatches(doc, opt)
): FindState {
  const index = matches.length
    ? Math.min(Math.max(active, 0), matches.length - 1)
    : 0
  const decorations = DecorationSet.create(
    doc,
    matches.map((m, i) =>
      Decoration.inline(m.from, m.to, {
        class: i === index ? "find-match find-match-active" : "find-match",
        // le esportazioni tolgono le classi: l'attributo le fa riconoscere
        "data-find-match": "",
      })
    )
  )
  return { ...opt, matches, active: index, decorations }
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    findReplace: {
      setSearch: (options: Partial<FindOptions>) => ReturnType
      clearSearch: () => ReturnType
      findNext: () => ReturnType
      findPrevious: () => ReturnType
      replaceCurrent: (replacement: string) => ReturnType
      replaceAll: (replacement: string) => ReturnType
    }
  }
}

export function getFindState(state: EditorState): FindState {
  return (
    findKey.getState(state) ?? {
      ...EMPTY,
      matches: [],
      active: 0,
      decorations: DecorationSet.empty,
    }
  )
}

/** Sostituisce un intervallo tenendo i marchi del testo che c'era */
function replaceRange(
  tr: Transaction,
  state: EditorState,
  { from, to }: Match,
  replacement: string
) {
  const marks = state.doc.resolve(from + 1).marks()
  if (replacement) {
    tr.replaceWith(
      tr.mapping.map(from),
      tr.mapping.map(to),
      state.schema.text(replacement, marks)
    )
  } else {
    tr.delete(tr.mapping.map(from), tr.mapping.map(to))
  }
}

export const FindReplace = Extension.create({
  name: "findReplace",

  addCommands() {
    const jump =
      (delta: number) =>
      ({
        state,
        dispatch,
      }: {
        state: EditorState
        dispatch?: (tr: Transaction) => void
      }) => {
        const find = getFindState(state)
        if (!find.matches.length) return false
        const next =
          (find.active + delta + find.matches.length) % find.matches.length
        if (dispatch) {
          const target = find.matches[next]
          const tr = state.tr
            .setMeta(findKey, { active: next })
            .setSelection(
              TextSelection.create(state.doc, target.from, target.to)
            )
            .scrollIntoView()
          dispatch(tr)
        }
        return true
      }

    return {
      setSearch:
        (options) =>
        ({ state, dispatch }) => {
          if (dispatch) {
            dispatch(state.tr.setMeta(findKey, { options }))
          }
          return true
        },
      clearSearch:
        () =>
        ({ state, dispatch }) => {
          if (dispatch) {
            dispatch(state.tr.setMeta(findKey, { options: EMPTY }))
          }
          return true
        },
      findNext: () => jump(1),
      findPrevious: () => jump(-1),
      replaceCurrent:
        (replacement) =>
        ({ state, dispatch }) => {
          const find = getFindState(state)
          const target = find.matches[find.active]
          if (!target) return false
          if (dispatch) {
            const tr = state.tr
            replaceRange(tr, state, target, replacement)
            tr.setMeta(findKey, { active: find.active }).scrollIntoView()
            dispatch(tr)
          }
          return true
        },
      replaceAll:
        (replacement) =>
        ({ state, dispatch }) => {
          const find = getFindState(state)
          if (!find.matches.length) return false
          if (dispatch) {
            const tr = state.tr
            // dall'ultima alla prima: così le posizioni restano valide
            for (let i = find.matches.length - 1; i >= 0; i -= 1) {
              replaceRange(tr, state, find.matches[i], replacement)
            }
            tr.setMeta(findKey, { active: 0 })
            dispatch(tr)
          }
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<FindState>({
        key: findKey,
        state: {
          init: (_config, state) => build(state.doc, EMPTY, 0, []),
          apply(tr, prev, _old, state) {
            const meta = tr.getMeta(findKey) as
              { options?: Partial<FindOptions>; active?: number } | undefined
            const opt = meta?.options
              ? ({ ...prev, ...meta.options } as FindOptions)
              : prev
            const changed = Boolean(meta?.options) || tr.docChanged
            if (!changed && meta?.active === undefined) return prev

            if (!opt.term) {
              return prev.term || prev.matches.length
                ? {
                    ...opt,
                    matches: [],
                    active: 0,
                    decorations: DecorationSet.empty,
                  }
                : prev
            }

            // dopo una sostituzione il testo è cambiato: le posizioni vecchie
            // non valgono più, quindi si ricerca prima di ridisegnare
            const matches = changed ? findMatches(tr.doc, opt) : prev.matches
            const active = meta?.options
              ? nearest(matches, state.selection.from)
              : (meta?.active ?? prev.active)
            return build(tr.doc, opt, active, matches)
          },
        },
        props: {
          decorations: (state) => getFindState(state).decorations,
        },
      }),
    ]
  },
})
