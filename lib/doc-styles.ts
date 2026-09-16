import { fontMap, fontStack } from "./fonts"
import type { DocTheme } from "./types"

import { tr } from "@/lib/i18n/client"
/**
 * Stili di paragrafo come in Word: «Normale», «Titolo 1», «Citazione»… e
 * quelli creati da chi scrive.
 *
 * Ogni stile ha un tipo di blocco (paragrafo, titolo, citazione…) e delle
 * proprietà. Quelle non impostate si ereditano dallo stile su cui è basato,
 * fino a «Normale». Gli stili predefiniti hanno valori relativi al corpo di
 * «Normale»: ingrandendo il testo crescono anche i titoli, finché non si fissa
 * a mano un corpo.
 *
 * Nel documento un blocco porta solo l'id dello stile (`data-style`); l'aspetto
 * lo decide il CSS generato qui, quindi modificare uno stile aggiorna al volo
 * tutti i paragrafi che lo usano. La formattazione diretta (un colore dato a
 * una parola, un'interlinea data a un paragrafo) resta sopra allo stile.
 */

export type StyleKind = "paragraph" | "title" | "heading" | "quote" | "code"
export type StyleCaps = "none" | "small" | "all"
export type StyleBorder =
  "none" | "bottom" | "top" | "left" | "box" | "topBottom"
export type StyleAlign = "left" | "center" | "right" | "justify"

/** Le proprietà di uno stile, già risolte. Misure in punti come in Word */
export type StyleProps = {
  /** chiave del carattere, oppure "+body" / "+heading" (caratteri del tema) */
  font: string
  size: number
  bold: boolean
  italic: boolean
  underline: boolean
  caps: StyleCaps
  /** "" automatico, "accent", "muted" o un colore CSS */
  color: string
  /** "" nessuno, "accent-soft" o un colore CSS */
  background: string
  align: StyleAlign
  lineHeight: number
  spaceBefore: number
  spaceAfter: number
  indentLeft: number
  firstLine: number
  letterSpacing: number
  border: StyleBorder
}

/** Come è salvato uno stile nel tema: solo quello che è stato cambiato */
export type DocStyleDef = Partial<StyleProps> & {
  name?: string
  kind?: StyleKind
  level?: 1 | 2 | 3
  basedOn?: string | null
  /** lo stile del paragrafo che segue quando si preme Invio */
  next?: string | null
  /** non compare nella raccolta della barra (resta nel riquadro Stili) */
  hidden?: boolean
}

export type DocStyle = {
  id: string
  name: string
  kind: StyleKind
  level?: 1 | 2 | 3
  basedOn: string | null
  next: string | null
  builtin: boolean
  hidden: boolean
  /** proprietà impostate dallo stile stesso (le altre si ereditano) */
  own: Partial<StyleProps>
  props: StyleProps
}

type Builtin = {
  name: string
  kind: StyleKind
  level?: 1 | 2 | 3
  basedOn: string | null
  next: string | null
  hidden?: boolean
  /** valori propri, a partire da «Normale» già risolto */
  props: (normal: StyleProps) => Partial<StyleProps>
}

const r1 = (n: number) => Math.round(n * 10) / 10

export const BUILTIN_STYLES: Record<string, Builtin> = {
  normal: {
    get name() {
      return tr("Normale")
    },
    kind: "paragraph",
    basedOn: null,
    next: "normal",
    props: () => ({}),
  },
  "no-spacing": {
    get name() {
      return tr("Nessuna spaziatura")
    },
    kind: "paragraph",
    basedOn: "normal",
    next: "no-spacing",
    props: () => ({ spaceBefore: 0, spaceAfter: 0, lineHeight: 1.15 }),
  },
  title: {
    get name() {
      return tr("Titolo")
    },
    kind: "title",
    basedOn: "normal",
    next: "normal",
    props: (n) => ({
      font: "+heading",
      size: r1(n.size * 2.1),
      bold: true,
      lineHeight: 1.14,
      letterSpacing: r1(-0.022 * n.size * 2.1),
      spaceBefore: r1(n.size * 2.9),
      spaceAfter: r1(n.size * 1.15),
    }),
  },
  subtitle: {
    get name() {
      return tr("Sottotitolo")
    },
    kind: "paragraph",
    basedOn: "normal",
    next: "normal",
    props: (n) => ({
      size: r1(n.size * 1.3),
      color: "muted",
      lineHeight: 1.35,
      spaceAfter: r1(n.size * 1.1),
    }),
  },
  heading1: {
    get name() {
      return tr("Titolo 1")
    },
    kind: "heading",
    level: 1,
    basedOn: "normal",
    next: "normal",
    props: (n) => ({
      font: "+heading",
      size: r1(n.size * 1.85),
      bold: true,
      lineHeight: 1.22,
      letterSpacing: r1(-0.018 * n.size * 1.85),
      spaceBefore: r1(n.size * 2.2),
      spaceAfter: r1(n.size * 0.6),
    }),
  },
  heading2: {
    get name() {
      return tr("Titolo 2")
    },
    kind: "heading",
    level: 2,
    basedOn: "normal",
    next: "normal",
    props: (n) => ({
      font: "+heading",
      size: r1(n.size * 1.42),
      bold: true,
      lineHeight: 1.22,
      letterSpacing: r1(-0.018 * n.size * 1.42),
      spaceBefore: r1(n.size * 1.8),
      spaceAfter: r1(n.size * 0.55),
    }),
  },
  heading3: {
    get name() {
      return tr("Titolo 3")
    },
    kind: "heading",
    level: 3,
    basedOn: "normal",
    next: "normal",
    props: (n) => ({
      font: "+heading",
      size: r1(n.size * 1.16),
      bold: true,
      lineHeight: 1.25,
      spaceBefore: r1(n.size * 1.4),
      spaceAfter: r1(n.size * 0.5),
    }),
  },
  quote: {
    get name() {
      return tr("Citazione")
    },
    kind: "quote",
    basedOn: "normal",
    next: "normal",
    props: () => ({ background: "accent-soft", border: "left" }),
  },
  "intense-quote": {
    get name() {
      return tr("Citazione intensa")
    },
    kind: "quote",
    basedOn: "quote",
    next: "normal",
    props: () => ({
      italic: true,
      color: "accent",
      align: "center",
      background: "",
      border: "topBottom",
    }),
  },
  caption: {
    get name() {
      return tr("Didascalia")
    },
    kind: "paragraph",
    basedOn: "normal",
    next: "normal",
    props: (n) => ({
      size: r1(n.size * 0.8),
      italic: true,
      color: "muted",
      spaceAfter: r1(n.size * 0.8),
    }),
  },
  code: {
    get name() {
      return tr("Codice")
    },
    kind: "code",
    basedOn: "normal",
    next: "normal",
    hidden: true,
    props: (n) => ({
      font: "jetbrains",
      size: r1(n.size * 0.86),
      lineHeight: 1.5,
    }),
  },
}

/* ----------------------------- set di stili ----------------------------- */

type SetProps = (normal: StyleProps) => Partial<StyleProps>

export type StyleSet = {
  id: string
  name: string
  /** proprietà degli stili predefiniti, sopra ai valori di base */
  styles: Partial<Record<string, SetProps>>
}

/**
 * I «set di stili» della scheda Progettazione: cambiano insieme l'aspetto di
 * titolo, titoli e citazioni. Come gli stili predefiniti sono relativi al
 * corpo di «Normale».
 */
export const STYLE_SETS: StyleSet[] = [
  { id: "default", name: "Cogniva", styles: {} },
  {
    id: "word",
    name: "Word",
    styles: {
      title: (n) => ({
        bold: false,
        size: r1(n.size * 2.55),
        lineHeight: 1.05,
        letterSpacing: -0.5,
        spaceAfter: r1(n.size * 0.4),
      }),
      subtitle: (n) => ({ letterSpacing: 0.5, size: r1(n.size * 1.25) }),
      heading1: (n) => ({
        bold: false,
        size: r1(n.size * 1.45),
        color: "accent",
        letterSpacing: 0,
        spaceBefore: r1(n.size * 1.6),
        spaceAfter: r1(n.size * 0.35),
      }),
      heading2: (n) => ({
        bold: false,
        size: r1(n.size * 1.2),
        color: "accent",
        letterSpacing: 0,
        spaceBefore: r1(n.size * 1.2),
        spaceAfter: r1(n.size * 0.3),
      }),
      heading3: (n) => ({
        bold: false,
        size: r1(n.size * 1.1),
        color: "accent",
        spaceBefore: r1(n.size * 1),
      }),
    },
  },
  {
    id: "classic",
    get name() {
      return tr("Classico")
    },
    styles: {
      title: (n) => ({
        align: "center",
        size: r1(n.size * 2.4),
        letterSpacing: 0,
        spaceAfter: r1(n.size * 0.5),
      }),
      subtitle: () => ({ align: "center", italic: true }),
      heading1: (n) => ({
        letterSpacing: 0,
        border: "bottom",
        spaceBefore: r1(n.size * 2),
      }),
      heading2: () => ({ letterSpacing: 0, italic: true, bold: false }),
      heading3: () => ({ caps: "small", letterSpacing: 0.4 }),
      quote: () => ({
        background: "",
        border: "none",
        italic: true,
        indentLeft: 28,
      }),
    },
  },
  {
    id: "minimal",
    get name() {
      return tr("Minimale")
    },
    styles: {
      title: (n) => ({
        size: r1(n.size * 2),
        bold: false,
        letterSpacing: r1(-0.01 * n.size * 2),
      }),
      heading1: (n) => ({
        size: r1(n.size * 0.95),
        caps: "all",
        letterSpacing: 1.2,
        spaceBefore: r1(n.size * 2.2),
      }),
      heading2: (n) => ({
        size: r1(n.size * 0.9),
        caps: "all",
        letterSpacing: 1,
        color: "muted",
      }),
      heading3: () => ({ bold: false, italic: true }),
      quote: () => ({ background: "", border: "left", color: "muted" }),
    },
  },
  {
    id: "lines",
    get name() {
      return tr("Righe||set di stili con linee sotto i titoli")
    },
    styles: {
      title: (n) => ({
        border: "bottom",
        spaceAfter: r1(n.size * 1.4),
      }),
      heading1: () => ({ border: "bottom" }),
      heading2: () => ({ color: "accent" }),
      quote: () => ({ background: "", border: "topBottom" }),
    },
  },
  {
    id: "accent",
    get name() {
      return tr("Accento")
    },
    styles: {
      title: () => ({ color: "accent" }),
      subtitle: () => ({ color: "accent" }),
      heading1: () => ({ color: "accent" }),
      heading2: () => ({ color: "accent" }),
      heading3: () => ({ color: "muted" }),
    },
  },
  {
    id: "elegant",
    get name() {
      return tr("Elegante")
    },
    styles: {
      title: (n) => ({
        align: "center",
        bold: false,
        italic: true,
        size: r1(n.size * 2.7),
        letterSpacing: 0,
      }),
      subtitle: () => ({ align: "center", caps: "small", letterSpacing: 1 }),
      heading1: () => ({ bold: false, caps: "small", letterSpacing: 0.8 }),
      heading2: () => ({ bold: false, italic: true, letterSpacing: 0 }),
      heading3: () => ({ italic: true }),
      quote: () => ({
        background: "",
        border: "none",
        italic: true,
        align: "center",
      }),
    },
  },
  {
    id: "compact",
    get name() {
      return tr("Compatto")
    },
    styles: {
      normal: (n) => ({ lineHeight: 1.4, spaceAfter: r1(n.size * 0.45) }),
      title: (n) => ({
        size: r1(n.size * 1.75),
        spaceBefore: r1(n.size * 1.5),
        spaceAfter: r1(n.size * 0.6),
      }),
      heading1: (n) => ({
        size: r1(n.size * 1.45),
        spaceBefore: r1(n.size * 1.3),
        spaceAfter: r1(n.size * 0.3),
      }),
      heading2: (n) => ({
        size: r1(n.size * 1.2),
        spaceBefore: r1(n.size * 1),
        spaceAfter: r1(n.size * 0.25),
      }),
      heading3: (n) => ({
        size: r1(n.size * 1.05),
        spaceBefore: r1(n.size * 0.8),
      }),
    },
  },
  {
    id: "technical",
    get name() {
      return tr("Tecnico")
    },
    styles: {
      title: () => ({ font: "jetbrains", letterSpacing: -0.5 }),
      heading1: () => ({
        font: "jetbrains",
        color: "accent",
        letterSpacing: 0,
      }),
      heading2: () => ({ font: "jetbrains", letterSpacing: 0 }),
      heading3: () => ({ font: "jetbrains", color: "muted" }),
      quote: () => ({ border: "left", background: "", font: "jetbrains" }),
    },
  },
  {
    id: "boxed",
    get name() {
      return tr("Riquadro")
    },
    styles: {
      title: (n) => ({
        background: "accent-soft",
        spaceAfter: r1(n.size * 1.2),
      }),
      heading1: () => ({ background: "accent-soft" }),
      heading2: () => ({ border: "left" }),
    },
  },
]

const setMap = new Map(STYLE_SETS.map((set) => [set.id, set]))

/** L'ordine della raccolta: prima i predefiniti, poi quelli creati */
export const BUILTIN_ORDER = [
  "normal",
  "no-spacing",
  "title",
  "subtitle",
  "heading1",
  "heading2",
  "heading3",
  "quote",
  "intense-quote",
  "caption",
  "code",
]

/** Lo stile predefinito di ogni tipo di blocco: il nodo non porta un id */
export function defaultStyleFor(kind: StyleKind, level?: number) {
  switch (kind) {
    case "title":
      return "title"
    case "heading":
      return `heading${level ?? 1}`
    case "quote":
      return "quote"
    case "code":
      return "code"
    default:
      return "normal"
  }
}

/** La radice: il carattere e il corpo del tema, come «Normale» senza modifiche */
function rootProps(theme: DocTheme): StyleProps {
  const size = r1((theme.fontSize || 17) * 0.75)
  return {
    font: "+body",
    size,
    bold: false,
    italic: false,
    underline: false,
    caps: "none",
    color: "",
    background: "",
    align: "left",
    lineHeight: 1.62,
    spaceBefore: 0,
    spaceAfter: r1(size * 0.7),
    indentLeft: 0,
    firstLine: 0,
    letterSpacing: 0,
    border: "none",
  }
}

const SAMPLE = rootProps({ fontSize: 17 } as DocTheme)
const PROP_KEYS = Object.keys(SAMPLE) as (keyof StyleProps)[]

/**
 * I valori salvati, controllati: un file importato può contenere di tutto, e
 * finiscono in un foglio di stile (niente `;` o `}` che aprano altre regole)
 */
function definedProps(def: DocStyleDef | undefined): Partial<StyleProps> {
  const out: Partial<StyleProps> = {}
  if (!def) return out
  for (const key of PROP_KEYS) {
    let value: unknown = def[key]
    if (value === undefined || value === null) continue
    if (typeof value !== typeof SAMPLE[key]) continue
    if (typeof value === "number" && !Number.isFinite(value)) continue
    if (typeof value === "string") value = value.replace(/[;{}<>\\]/g, "")
    ;(out as Record<string, unknown>)[key] = value
  }
  return out
}

// il tema non si modifica mai sul posto (ogni cambio ne crea uno nuovo): si
// può risolvere una volta per oggetto
const cache = new WeakMap<DocTheme, Map<string, DocStyle>>()

/** Uno stile risolto: proprietà proprie più quelle ereditate */
export function resolveStyle(theme: DocTheme, id: string): DocStyle {
  let map = cache.get(theme)
  if (!map) {
    map = new Map()
    cache.set(theme, map)
  }
  return compute(theme, id, new Set(), map)
}

function compute(
  theme: DocTheme,
  id: string,
  seen: Set<string>,
  map: Map<string, DocStyle>
): DocStyle {
  const hit = map.get(id)
  if (hit) return hit
  const builtin = BUILTIN_STYLES[id]
  const def = theme.styles?.[id]
  if (!builtin && !def) {
    // un id sconosciuto (stile eliminato): il blocco torna «Normale»
    return compute(theme, "normal", seen, map)
  }
  seen.add(id)
  const kind: StyleKind = def?.kind ?? builtin?.kind ?? "paragraph"
  const level = def?.level ?? builtin?.level
  let basedOn =
    def?.basedOn !== undefined ? def.basedOn : (builtin?.basedOn ?? "normal")
  if (id === "normal") basedOn = null
  if (basedOn && seen.has(basedOn)) basedOn = "normal"
  const parent =
    basedOn && basedOn !== id
      ? compute(theme, basedOn, seen, map).props
      : rootProps(theme)
  const normal =
    id === "normal" ? parent : compute(theme, "normal", seen, map).props
  const set = builtin ? setMap.get(theme.styleSet)?.styles[id] : undefined
  const own = {
    ...(builtin ? builtin.props(normal) : {}),
    ...(set ? set(normal) : {}),
    ...definedProps(def),
  }
  const style: DocStyle = {
    id,
    name: def?.name ?? builtin?.name ?? id,
    kind,
    level: kind === "heading" ? (level ?? 1) : undefined,
    basedOn,
    next: def?.next !== undefined ? def.next : (builtin?.next ?? id),
    builtin: Boolean(builtin),
    hidden: def?.hidden ?? builtin?.hidden ?? false,
    own,
    props: { ...parent, ...own },
  }
  map.set(id, style)
  seen.delete(id)
  return style
}

/** Tutti gli stili del documento, nell'ordine della raccolta */
export function listStyles(theme: DocTheme): DocStyle[] {
  const user = Object.keys(theme.styles ?? {}).filter(
    (id) => !BUILTIN_STYLES[id]
  )
  return [...BUILTIN_ORDER, ...user].map((id) => resolveStyle(theme, id))
}

export function isUserStyle(id: string) {
  return !BUILTIN_STYLES[id]
}

/* -------------------------------- CSS ----------------------------------- */

const PT = 96 / 72

export function styleFontStack(theme: DocTheme, font: string) {
  if (font === "+body") return fontStack(theme.font)
  if (font === "+heading") return fontStack(theme.headingFont || theme.font)
  return fontStack(fontMap[font] ? font : theme.font)
}

/** Il nome del carattere come lo mostra Word: «Inter (Corpo)» */
export function styleFontLabel(theme: DocTheme, font: string) {
  if (font === "+body")
    return tr("{font} (Corpo)", {
      font: fontMap[theme.font]?.label ?? theme.font,
    })
  if (font === "+heading") {
    const key = theme.headingFont || theme.font
    return tr("{font} (Titoli)", { font: fontMap[key]?.label ?? key })
  }
  return fontMap[font]?.label ?? font
}

export function cssColor(value: string) {
  if (!value) return ""
  if (value === "accent") return "var(--doc-accent)"
  if (value === "muted") return "var(--doc-muted)"
  if (value === "accent-soft") return "var(--doc-accent-soft)"
  return value
}

/** Un valore dentro `[attr="…"]` */
const cssString = (value: string) =>
  value.replace(/["\\\n\r]/g, (c) => `\\${c.charCodeAt(0).toString(16)} `)

const px = (pt: number) => `${Math.round(pt * PT * 100) / 100}px`

function borderCss(border: StyleBorder) {
  const line = "1px solid color-mix(in srgb, currentColor 45%, transparent)"
  switch (border) {
    case "bottom":
      return `border-bottom:${line};padding-bottom:0.2em;`
    case "top":
      return `border-top:${line};padding-top:0.2em;`
    case "left":
      return "border-left:3px solid var(--doc-accent);padding-left:0.9em;"
    case "box":
      return `border:${line};padding:0.35em 0.7em;`
    case "topBottom":
      return "border-top:1px solid var(--doc-accent);border-bottom:1px solid var(--doc-accent);padding:0.6em 1em;"
    default:
      return ""
  }
}

/** Le dichiarazioni tipografiche (ereditabili dai figli) */
function typography(theme: DocTheme, p: StyleProps) {
  return [
    `font-family:${styleFontStack(theme, p.font)};`,
    `font-size:${px(p.size)};`,
    `font-weight:${p.bold ? 700 : 400};`,
    `font-style:${p.italic ? "italic" : "normal"};`,
    `line-height:${p.lineHeight};`,
    `letter-spacing:${p.letterSpacing ? px(p.letterSpacing) : "normal"};`,
    `text-decoration-line:${p.underline ? "underline" : "none"};`,
    `text-transform:${p.caps === "all" ? "uppercase" : "none"};`,
    `font-variant-caps:${p.caps === "small" ? "small-caps" : "normal"};`,
    `text-align:${p.align};`,
    p.color ? `color:${cssColor(p.color)};` : "",
  ].join("")
}

/** Le dichiarazioni del blocco: spazi, rientri, bordo e sfondo */
function box(p: StyleProps) {
  return [
    `margin-top:${px(p.spaceBefore)};`,
    `margin-bottom:${px(p.spaceAfter)};`,
    p.indentLeft ? `margin-left:${px(p.indentLeft)};` : "",
    p.firstLine ? `text-indent:${px(p.firstLine)};` : "",
    p.background
      ? `background:${cssColor(p.background)};border-radius:calc(var(--doc-radius) * 0.5);padding:0.55em 0.9em;`
      : "",
    borderCss(p.border),
  ].join("")
}

/**
 * Il foglio di stile di un documento. `scope` limita le regole al suo foglio:
 * con Cache Components più documenti possono restare montati insieme.
 */
export function stylesCss(theme: DocTheme, scope: string) {
  const root = `${scope} .doc-prose`
  const rules: string[] = []
  const styles = listStyles(theme)
  const normal = resolveStyle(theme, "normal").props

  // «Normale» sta sulla radice: liste, tabelle e celle lo ereditano
  rules.push(`${root}{${typography(theme, normal)}}`)
  rules.push(
    `${root} > p:not([data-style]),${root} > p[data-style="normal"],${root} > ul,${root} > ol{${box(normal)}}`
  )

  for (const style of styles) {
    if (style.id === "normal") continue
    const p = style.props
    const selectors: string[] = [
      `${root} [data-style="${cssString(style.id)}"]`,
    ]
    if (
      style.builtin &&
      style.id === defaultStyleFor(style.kind, style.level)
    ) {
      if (style.kind === "title") {
        selectors.push(`${root} h1[data-doc-title]:not([data-style])`)
      } else if (style.kind === "heading") {
        selectors.push(
          `${root} h${style.level}:not([data-doc-title]):not([data-style])`
        )
      } else if (style.kind === "quote") {
        selectors.push(`${root} blockquote:not([data-style])`)
      } else if (style.kind === "code") {
        selectors.push(`${root} pre:not([data-style])`)
      }
    }
    rules.push(`${selectors.join(",")}{${typography(theme, p)}${box(p)}}`)
  }
  // i paragrafi dentro una citazione prendono l'aspetto della citazione
  rules.push(
    `${root} blockquote p{font:inherit;color:inherit;letter-spacing:inherit;text-transform:inherit;text-align:inherit;margin:0}`
  )
  rules.push(`${root} blockquote p + p{margin-top:0.5em}`)
  // il primo blocco non si stacca dal margine della pagina; `:not(#_)` vale
  // quanto un id e vince sugli spazi degli stili
  rules.push(`${root} > :first-child:not(#_){margin-top:0}`)
  return rules.join("\n")
}

/* --------------------------- stato del cursore -------------------------- */

type PMNodeLike = {
  type: { name: string }
  attrs: Record<string, unknown>
}

/** L'id dello stile di un blocco dell'editor */
export function styleIdOfNode(node: PMNodeLike): string {
  const own = node.attrs.styleId
  if (typeof own === "string" && own) return own
  switch (node.type.name) {
    case "docTitle":
      return "title"
    case "heading":
      return `heading${Number(node.attrs.level) || 1}`
    case "blockquote":
      return "quote"
    case "codeBlock":
      return "code"
    default:
      return "normal"
  }
}

/** Il nome del tipo di nodo che porta lo stile */
export function nodeTypeForKind(kind: StyleKind) {
  switch (kind) {
    case "title":
      return "docTitle"
    case "heading":
      return "heading"
    case "quote":
      return "blockquote"
    case "code":
      return "codeBlock"
    default:
      return "paragraph"
  }
}

/** Genera un id per uno stile nuovo, leggibile nel file */
export function newStyleId(name: string, theme: DocTheme) {
  const base =
    name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32) || "stile"
  let id = `user-${base}`
  let n = 2
  while (theme.styles?.[id] || BUILTIN_STYLES[id]) {
    id = `user-${base}-${n}`
    n += 1
  }
  return id
}

export function stylePropKeys() {
  return PROP_KEYS
}
