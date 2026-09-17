import { Extension } from "@tiptap/core"
import { Fragment, type Node as PMNode } from "@tiptap/pm/model"
import { TextSelection, type EditorState } from "@tiptap/pm/state"
import { cssValue } from "./css"

import { tr as translate, currentLocale } from "@/lib/i18n/client"
/**
 * Tipografia della scheda Home che Word ha e lo starter kit no: effetti del
 * testo (ombra, contorno, bagliore, riempimento sfumato), stili di
 * sottolineatura, maiuscoletto, numeri, legature e set stilistici; raccolte di
 * elenchi puntati e numerati, elenchi a più livelli e «Ordina».
 */

/**
 * Le parole di «Articolo 1 · Sezione 1.01» e «Capitolo 1» nella lingua del
 * documento. Le stesse sono in app/globals.css (--doc-article…).
 */
export const NUMBERING_WORDS: Record<
  string,
  { article: string; section: string; chapter: string }
> = {
  it: { article: "Articolo", section: "Sezione", chapter: "Capitolo" },
  en: { article: "Article", section: "Section", chapter: "Chapter" },
  es: { article: "Artículo", section: "Sección", chapter: "Capítulo" },
  fr: { article: "Article", section: "Section", chapter: "Chapitre" },
  de: { article: "Artikel", section: "Abschnitt", chapter: "Kapitel" },
  pt: { article: "Artigo", section: "Seção", chapter: "Capítulo" },
}

export const numberingWords = (language: string) =>
  NUMBERING_WORDS[language.slice(0, 2).toLowerCase()] ?? NUMBERING_WORDS.en

/* ----------------------------- effetti testo ----------------------------- */

export type TextEffectAttrs = {
  textShadow: string | null
  textStroke: string | null
  /** "hollow" (solo contorno) oppure un gradiente CSS */
  textFill: string | null
  /** text-decoration completa: «underline wavy #e11d48» */
  decoration: string | null
  smallCaps: boolean | null
  numeric: string | null
  ligatures: string | null
  stylistic: string | null
}

export const TEXT_EFFECT_KEYS: (keyof TextEffectAttrs)[] = [
  "textShadow",
  "textStroke",
  "textFill",
  "decoration",
  "smallCaps",
  "numeric",
  "ligatures",
  "stylistic",
]

/** Un valore CSS sicuro dentro `style` (vedi lib/css.ts) */
const clean = cssValue

export const TEXT_EFFECT_PRESETS: {
  id: string
  label: string
  attrs: Partial<TextEffectAttrs>
}[] = [
  {
    id: "soft-shadow",
    get label() {
      return translate("Ombra morbida")
    },
    attrs: { textShadow: "0 1px 3px rgba(0,0,0,0.35)" },
  },
  {
    id: "offset-shadow",
    get label() {
      return translate("Ombra spostata")
    },
    attrs: {
      textShadow:
        "0.06em 0.06em 0 color-mix(in srgb, currentColor 28%, transparent)",
    },
  },
  {
    id: "accent-glow",
    get label() {
      return translate("Bagliore accento")
    },
    attrs: { textShadow: "0 0 0.3em var(--doc-accent, #6366f1)" },
  },
  {
    id: "neon",
    get label() {
      return translate("Neon")
    },
    attrs: {
      textShadow:
        "0 0 1px #fff, 0 0 0.25em var(--doc-accent, #6366f1), 0 0 0.6em var(--doc-accent, #6366f1)",
    },
  },
  {
    id: "outline",
    get label() {
      return translate("Contorno")
    },
    attrs: { textFill: "hollow", textStroke: "1px currentColor" },
  },
  {
    id: "accent-outline",
    get label() {
      return translate("Contorno accento")
    },
    attrs: { textStroke: "0.6px var(--doc-accent, #6366f1)" },
  },
  {
    id: "emboss",
    get label() {
      return translate("Rilievo")
    },
    attrs: {
      textShadow: "0 -1px 0 rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.5)",
    },
  },
  {
    id: "engrave",
    get label() {
      return translate("Incisione")
    },
    attrs: {
      textShadow: "0 1px 0 rgba(255,255,255,0.5), 0 -1px 0 rgba(0,0,0,0.35)",
    },
  },
  {
    id: "gradient-accent",
    get label() {
      return translate("Sfumato accento")
    },
    attrs: {
      textFill:
        "linear-gradient(90deg, var(--doc-accent, #6366f1), color-mix(in srgb, var(--doc-accent, #6366f1) 40%, #ec4899))",
    },
  },
  {
    id: "gradient-sunset",
    get label() {
      return translate("Tramonto")
    },
    attrs: { textFill: "linear-gradient(90deg, #f97316, #e11d48, #9333ea)" },
  },
  {
    id: "gradient-ocean",
    get label() {
      return translate("Oceano")
    },
    attrs: { textFill: "linear-gradient(90deg, #0ea5e9, #6366f1)" },
  },
  {
    id: "long-shadow",
    get label() {
      return translate("Ombra lunga")
    },
    attrs: {
      textShadow:
        "1px 1px 0 color-mix(in srgb, currentColor 20%, transparent), 2px 2px 0 color-mix(in srgb, currentColor 16%, transparent), 3px 3px 0 color-mix(in srgb, currentColor 12%, transparent)",
    },
  },
]

export const SHADOW_PRESETS: { label: string; value: string | null }[] = [
  {
    get label() {
      return translate("Nessuna")
    },
    value: null,
  },
  {
    get label() {
      return translate("Esterna in basso")
    },
    value: "0 2px 3px rgba(0,0,0,0.35)",
  },
  {
    get label() {
      return translate("Esterna a destra")
    },
    value: "2px 1px 2px rgba(0,0,0,0.35)",
  },
  {
    get label() {
      return translate("Diffusa")
    },
    value: "0 0 6px rgba(0,0,0,0.45)",
  },
  {
    get label() {
      return translate("Netta")
    },
    value: "0.06em 0.06em 0 rgba(0,0,0,0.3)",
  },
  {
    get label() {
      return translate("Interna")
    },
    value: "0 1px 1px rgba(255,255,255,0.4), 0 -1px 1px rgba(0,0,0,0.3)",
  },
]

export const GLOW_COLORS: { label: string; value: string | null }[] = [
  {
    get label() {
      return translate("Nessuno")
    },
    value: null,
  },
  {
    get label() {
      return translate("Accento")
    },
    value: "var(--doc-accent, #6366f1)",
  },
  {
    get label() {
      return translate("Giallo")
    },
    value: "#facc15",
  },
  {
    get label() {
      return translate("Verde")
    },
    value: "#22c55e",
  },
  {
    get label() {
      return translate("Azzurro")
    },
    value: "#38bdf8",
  },
  {
    get label() {
      return translate("Rosa")
    },
    value: "#f472b6",
  },
  {
    get label() {
      return translate("Bianco")
    },
    value: "#ffffff",
  },
]

export const glowShadow = (color: string) =>
  `0 0 0.18em ${color}, 0 0 0.45em ${color}`

export const UNDERLINE_STYLES: { label: string; value: string }[] = [
  {
    get label() {
      return translate("Singola")
    },
    value: "underline solid",
  },
  {
    get label() {
      return translate("Doppia")
    },
    value: "underline double",
  },
  {
    get label() {
      return translate("Spessa")
    },
    value: "underline solid 0.12em",
  },
  {
    get label() {
      return translate("Punteggiata")
    },
    value: "underline dotted",
  },
  {
    get label() {
      return translate("Tratteggiata")
    },
    value: "underline dashed",
  },
  {
    get label() {
      return translate("Ondulata")
    },
    value: "underline wavy",
  },
  {
    get label() {
      return translate("Barrato doppio")
    },
    value: "line-through double",
  },
]

export const NUMERIC_STYLES: { label: string; value: string | null }[] = [
  {
    get label() {
      return translate("Predefiniti")
    },
    value: null,
  },
  {
    get label() {
      return translate("Allineati proporzionali")
    },
    value: "lining-nums proportional-nums",
  },
  {
    get label() {
      return translate("Allineati tabulari")
    },
    value: "lining-nums tabular-nums",
  },
  {
    get label() {
      return translate("Non allineati (old style)")
    },
    value: "oldstyle-nums",
  },
  {
    get label() {
      return translate("Frazioni")
    },
    value: "diagonal-fractions",
  },
  {
    get label() {
      return translate("Zero barrato")
    },
    value: "slashed-zero",
  },
]

export const LIGATURE_STYLES: { label: string; value: string | null }[] = [
  {
    get label() {
      return translate("Standard")
    },
    value: null,
  },
  {
    get label() {
      return translate("Standard e contestuali")
    },
    value: "common-ligatures contextual",
  },
  {
    get label() {
      return translate("Storiche e discrezionali")
    },
    value: "historical-ligatures discretionary-ligatures",
  },
  {
    get label() {
      return translate("Tutte")
    },
    value:
      "common-ligatures discretionary-ligatures historical-ligatures contextual",
  },
  {
    get label() {
      return translate("Nessuna")
    },
    value: "none",
  },
]

export const STYLISTIC_SETS: { label: string; value: string | null }[] = [
  {
    get label() {
      return translate("Predefinito")
    },
    value: null,
  },
  ...[1, 2, 3, 4, 5, 6].map((n) => ({
    label: translate("Set stilistico {n}", { n }),
    value: `'ss0${n}' 1`,
  })),
  {
    get label() {
      return translate("Alternative contestuali")
    },
    value: `'salt' 1`,
  },
]

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    textEffects: {
      setTextEffects: (attrs: Partial<TextEffectAttrs>) => ReturnType
      clearTextEffects: () => ReturnType
    }
    listStyles: {
      setListStyle: (
        kind: "bullet" | "ordered",
        style: string | null
      ) => ReturnType
      setListLevels: (
        kind: "bullet" | "ordered",
        levels: string | null
      ) => ReturnType
      setListStart: (start: number) => ReturnType
    }
    sortBlocks: {
      sortBlocks: (options: SortOptions) => ReturnType
    }
  }
}

export const TextEffects = Extension.create({
  name: "textEffects",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          textShadow: {
            default: null,
            parseHTML: (el) => clean(el.style.textShadow),
            renderHTML: (a) =>
              a.textShadow
                ? { style: `text-shadow:${clean(a.textShadow)}` }
                : {},
          },
          textStroke: {
            default: null,
            parseHTML: (el) =>
              clean(el.style.getPropertyValue("-webkit-text-stroke")),
            renderHTML: (a) =>
              a.textStroke
                ? {
                    style: `-webkit-text-stroke:${clean(a.textStroke)};paint-order:stroke fill`,
                  }
                : {},
          },
          textFill: {
            default: null,
            parseHTML: (el) => {
              if (el.getAttribute("data-fill") === "hollow") return "hollow"
              const image = clean(el.style.backgroundImage)
              return image?.includes("gradient") ? image : null
            },
            renderHTML: (a) => {
              const fill = clean(a.textFill)
              if (!fill) return {}
              if (fill === "hollow") {
                return {
                  "data-fill": "hollow",
                  style: "-webkit-text-fill-color:transparent",
                }
              }
              return {
                style: `background-image:${fill};-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;-webkit-box-decoration-break:clone;box-decoration-break:clone`,
              }
            },
          },
          decoration: {
            default: null,
            parseHTML: (el) => {
              const style = el.style.textDecorationStyle
              const line = el.style.textDecorationLine
              if (!line || line === "none" || !style || style === "solid") {
                return el.getAttribute("data-decoration")
              }
              return clean(
                [line, style, el.style.textDecorationThickness]
                  .filter(Boolean)
                  .join(" ")
              )
            },
            renderHTML: (a) => {
              const value = clean(a.decoration)
              return value
                ? {
                    "data-decoration": value,
                    style: `text-decoration:${value};text-underline-offset:0.18em`,
                  }
                : {}
            },
          },
          smallCaps: {
            default: null,
            parseHTML: (el) =>
              el.style.fontVariantCaps === "small-caps" ? true : null,
            renderHTML: (a) =>
              a.smallCaps ? { style: "font-variant-caps:small-caps" } : {},
          },
          numeric: {
            default: null,
            parseHTML: (el) => clean(el.style.fontVariantNumeric),
            renderHTML: (a) =>
              a.numeric
                ? { style: `font-variant-numeric:${clean(a.numeric)}` }
                : {},
          },
          ligatures: {
            default: null,
            parseHTML: (el) => clean(el.style.fontVariantLigatures),
            renderHTML: (a) =>
              a.ligatures
                ? { style: `font-variant-ligatures:${clean(a.ligatures)}` }
                : {},
          },
          stylistic: {
            default: null,
            parseHTML: (el) => clean(el.style.fontFeatureSettings),
            renderHTML: (a) =>
              a.stylistic
                ? { style: `font-feature-settings:${clean(a.stylistic)}` }
                : {},
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setTextEffects:
        (attrs) =>
        ({ chain }) =>
          chain().setMark("textStyle", attrs).removeEmptyTextStyle().run(),
      clearTextEffects:
        () =>
        ({ chain }) =>
          chain()
            .setMark(
              "textStyle",
              Object.fromEntries(TEXT_EFFECT_KEYS.map((k) => [k, null]))
            )
            .removeEmptyTextStyle()
            .run(),
    }
  },
})

/* -------------------------------- elenchi -------------------------------- */

export const BULLET_STYLES: {
  value: string | null
  label: string
  glyph: string
}[] = [
  {
    value: null,
    get label() {
      return translate("Punto")
    },
    glyph: "•",
  },
  {
    value: "circle",
    get label() {
      return translate("Cerchio")
    },
    glyph: "○",
  },
  {
    value: "square",
    get label() {
      return translate("Quadrato")
    },
    glyph: "▪",
  },
  {
    value: "diamond",
    get label() {
      return translate("Rombo")
    },
    glyph: "◆",
  },
  {
    value: "arrow",
    get label() {
      return translate("Freccia")
    },
    glyph: "➢",
  },
  {
    value: "check",
    get label() {
      return translate("Segno di spunta")
    },
    glyph: "✓",
  },
  {
    value: "dash",
    get label() {
      return translate("Trattino")
    },
    glyph: "–",
  },
  {
    value: "star",
    get label() {
      return translate("Stella")
    },
    glyph: "★",
  },
]

export const NUMBER_STYLES: {
  value: string | null
  label: string
  sample: string[]
}[] = [
  { value: null, label: "1. 2. 3.", sample: ["1.", "2.", "3."] },
  { value: "decimal-paren", label: "1) 2) 3)", sample: ["1)", "2)", "3)"] },
  { value: "upper-roman", label: "I. II. III.", sample: ["I.", "II.", "III."] },
  {
    value: "lower-roman",
    get label() {
      return translate("i. ii. iii.")
    },
    sample: ["i.", "ii.", "iii."],
  },
  { value: "upper-alpha", label: "A. B. C.", sample: ["A.", "B.", "C."] },
  {
    value: "lower-alpha",
    get label() {
      return translate("a. b. c.")
    },
    sample: ["a.", "b.", "c."],
  },
  {
    value: "alpha-paren",
    get label() {
      return translate("a) b) c)")
    },
    sample: ["a)", "b)", "c)"],
  },
  {
    value: "leading-zero",
    label: "01. 02. 03.",
    sample: ["01.", "02.", "03."],
  },
]

export const LIST_LEVELS: {
  value: string | null
  kind: "bullet" | "ordered"
  label: string
  sample: string[]
}[] = [
  {
    value: null,
    kind: "ordered",
    label: "1. · a. · i.",
    sample: ["1.", "a.", "i."],
  },
  {
    value: "legal",
    kind: "ordered",
    label: "1. · 1.1. · 1.1.1.",
    sample: ["1.", "1.1.", "1.1.1."],
  },
  {
    value: "outline",
    kind: "ordered",
    get label() {
      return translate("I. · A. · 1.")
    },
    sample: ["I.", "A.", "1."],
  },
  {
    value: "article",
    kind: "ordered",
    get label() {
      return translate("Articolo 1 · Sezione 1.01")
    },
    get sample() {
      return [translate("Articolo 1"), translate("Sezione 1.01"), "(a)"]
    },
  },
  {
    value: "chapter",
    kind: "ordered",
    get label() {
      return translate("Capitolo 1 · 1.1")
    },
    get sample() {
      return [translate("Capitolo 1"), "1.1", "a)"]
    },
  },
  { value: null, kind: "bullet", label: "• · ○ · ▪", sample: ["•", "○", "▪"] },
  {
    value: "arrows",
    kind: "bullet",
    label: "➢ · • · –",
    sample: ["➢", "•", "–"],
  },
  {
    value: "checks",
    kind: "bullet",
    label: "✓ · ◆ · •",
    sample: ["✓", "◆", "•"],
  },
]

/** Il nodo elenco più vicino (o il più esterno) intorno al cursore */
function findList(
  state: EditorState,
  types: string[],
  outermost: boolean
): { node: PMNode; pos: number } | null {
  const { $from } = state.selection
  let found: { node: PMNode; pos: number } | null = null
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (types.includes(node.type.name)) {
      found = { node, pos: $from.before(depth) }
      if (!outermost) break
    }
  }
  return found
}

const LIST_TYPE = { bullet: "bulletList", ordered: "orderedList" } as const

export const ListStyles = Extension.create({
  name: "listStyles",
  addGlobalAttributes() {
    return [
      {
        types: ["bulletList", "orderedList"],
        attributes: {
          listStyle: {
            default: null,
            parseHTML: (el) => el.getAttribute("data-list-style"),
            renderHTML: (a) =>
              a.listStyle ? { "data-list-style": clean(a.listStyle) } : {},
          },
          levels: {
            default: null,
            parseHTML: (el) => el.getAttribute("data-levels"),
            renderHTML: (a) =>
              a.levels ? { "data-levels": clean(a.levels) } : {},
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setListStyle:
        (kind, style) =>
        ({ state, chain, tr, dispatch }) => {
          const type = LIST_TYPE[kind]
          const list = findList(state, [type], false)
          if (!list) {
            // fuori da un elenco: lo si crea con lo stile scelto
            const toggle =
              kind === "bullet"
                ? chain().toggleBulletList()
                : chain().toggleOrderedList()
            return toggle
              .command(({ state: next, tr: t }) => {
                const created = findList(next, [type], false)
                if (!created) return false
                t.setNodeMarkup(created.pos, undefined, {
                  ...created.node.attrs,
                  listStyle: style,
                })
                return true
              })
              .run()
          }
          if (dispatch) {
            tr.setNodeMarkup(list.pos, undefined, {
              ...list.node.attrs,
              listStyle: style,
            })
          }
          return true
        },
      setListLevels:
        (kind, levels) =>
        ({ state, chain, tr, dispatch }) => {
          const type = LIST_TYPE[kind]
          const list = findList(state, ["bulletList", "orderedList"], true)
          if (!list || list.node.type.name !== type) {
            const toggle = list
              ? chain().toggleList(type, "listItem")
              : kind === "bullet"
                ? chain().toggleBulletList()
                : chain().toggleOrderedList()
            return toggle
              .command(({ state: next, tr: t }) => {
                const created = findList(next, [type], true)
                if (!created) return false
                t.setNodeMarkup(created.pos, undefined, {
                  ...created.node.attrs,
                  levels,
                  listStyle: null,
                })
                return true
              })
              .run()
          }
          if (dispatch) {
            tr.setNodeMarkup(list.pos, undefined, {
              ...list.node.attrs,
              levels,
              listStyle: null,
            })
          }
          return true
        },
      setListStart:
        (start) =>
        ({ state, tr, dispatch }) => {
          const list = findList(state, ["orderedList"], false)
          if (!list) return false
          if (dispatch) {
            tr.setNodeMarkup(list.pos, undefined, {
              ...list.node.attrs,
              start: Math.max(0, Math.round(start)),
            })
          }
          return true
        },
    }
  },
})

/* -------------------------------- ordina -------------------------------- */

export type SortOptions = {
  by: "text" | "number" | "date"
  direction: "asc" | "desc"
  /** tabelle: la colonna su cui ordinare (0 = prima) */
  column?: number
  /** tabelle: la prima riga resta in cima */
  header?: boolean
}

const collator = new Intl.Collator(currentLocale(), {
  numeric: true,
  sensitivity: "base",
})

function parseDateText(text: string): number {
  const t = text.trim()
  // 31/12/2025, 31-12-25, 31.12.2025
  const m = t.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (m) {
    const year = Number(m[3].length === 2 ? `20${m[3]}` : m[3])
    return new Date(year, Number(m[2]) - 1, Number(m[1])).getTime()
  }
  const parsed = Date.parse(t)
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed
}

function parseNumberText(text: string): number {
  const m = text
    .replace(/\./g, "")
    .replace(",", ".")
    .match(/-?\d+(\.\d+)?/)
  return m ? Number(m[0]) : Number.POSITIVE_INFINITY
}

export function compareSortText(a: string, b: string, options: SortOptions) {
  let result: number
  if (options.by === "number") {
    result = parseNumberText(a) - parseNumberText(b)
  } else if (options.by === "date") {
    result = parseDateText(a) - parseDateText(b)
  } else {
    result = collator.compare(a.trim(), b.trim())
  }
  if (!Number.isFinite(result)) result = 0
  return options.direction === "asc" ? result : -result
}

/** Dove agisce «Ordina»: righe di tabella, voci di elenco o paragrafi */
export function sortTarget(state: EditorState) {
  const { $from, $to, empty } = state.selection
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (node.type.name === "table") {
      return { kind: "table" as const, node, pos: $from.before(depth), depth }
    }
    if (["bulletList", "orderedList", "taskList"].includes(node.type.name)) {
      return { kind: "list" as const, node, pos: $from.before(depth), depth }
    }
  }
  // paragrafi di primo livello: quelli selezionati, oppure il gruppo di
  // paragrafi consecutivi intorno al cursore
  const doc = state.doc
  const indexFrom = $from.index(0)
  const indexTo = $to.index(0)
  // un paragrafo vuoto separa i gruppi, come una riga bianca fra due elenchi
  const isText = (n: PMNode | null) =>
    Boolean(
      n &&
      (n.type.name === "paragraph" || n.type.name === "heading") &&
      n.textContent.trim()
    )
  let start = indexFrom
  let end = indexTo
  if (empty) {
    while (start > 0 && isText(doc.maybeChild(start - 1))) start -= 1
    while (end < doc.childCount - 1 && isText(doc.maybeChild(end + 1))) end += 1
  }
  return { kind: "blocks" as const, start, end }
}

export const SortBlocks = Extension.create({
  name: "sortBlocks",
  addCommands() {
    return {
      sortBlocks:
        (options) =>
        ({ state, tr, dispatch }) => {
          const target = sortTarget(state)
          if (target.kind === "table") {
            const rows: PMNode[] = []
            target.node.forEach((row) => rows.push(row))
            const head = options.header ? rows.slice(0, 1) : []
            const body = options.header ? rows.slice(1) : rows
            const cellText = (row: PMNode) =>
              row.maybeChild(options.column ?? 0)?.textContent ?? ""
            const sorted = [...body].sort((a, b) =>
              compareSortText(cellText(a), cellText(b), options)
            )
            if (!dispatch) return body.length > 1
            tr.replaceWith(
              target.pos,
              target.pos + target.node.nodeSize,
              target.node.copy(Fragment.from([...head, ...sorted]))
            )
            return true
          }
          if (target.kind === "list") {
            const items: PMNode[] = []
            target.node.forEach((item) => items.push(item))
            const sorted = [...items].sort((a, b) =>
              compareSortText(
                a.firstChild?.textContent ?? "",
                b.firstChild?.textContent ?? "",
                options
              )
            )
            if (!dispatch) return items.length > 1
            tr.replaceWith(
              target.pos,
              target.pos + target.node.nodeSize,
              target.node.copy(Fragment.from(sorted))
            )
            return true
          }
          const blocks: PMNode[] = []
          let from = 0
          state.doc.forEach((node, offset, index) => {
            if (index === target.start) from = offset
            if (index >= target.start && index <= target.end) blocks.push(node)
          })
          // il titolo del documento non si sposta
          const movable = blocks.filter((b) => b.type.name !== "docTitle")
          if (movable.length < 2) return false
          if (!dispatch) return true
          const fixed = blocks.length - movable.length
          const start =
            from + blocks.slice(0, fixed).reduce((s, b) => s + b.nodeSize, 0)
          const size = movable.reduce((s, b) => s + b.nodeSize, 0)
          const sorted = [...movable].sort((a, b) =>
            compareSortText(a.textContent, b.textContent, options)
          )
          tr.replaceWith(start, start + size, sorted)
          tr.setSelection(
            TextSelection.near(
              tr.doc.resolve(Math.min(start + 1, tr.doc.content.size))
            )
          )
          return true
        },
    }
  },
})
