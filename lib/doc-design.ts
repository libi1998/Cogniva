import { BUILTIN_STYLES, type DocStyleDef } from "./doc-styles"
import { readStorage, STORAGE } from "./storage"
import { defaultDocTheme, type DocTheme, type DocWatermark } from "./types"

import { tr, currentRegion } from "@/lib/i18n/client"
/**
 * Le raccolte della scheda Progettazione: temi, tipi di carattere, colori,
 * spaziatura dei paragrafi e filigrane, più «Imposta come predefinito».
 */

export type DocDesignTheme = {
  id: string
  name: string
  font: string
  headingFont: string | null
  accent: string
  styleSet: string
}

/** «Temi»: carattere, titoli, accento e set di stili scelti insieme */
export const DESIGN_THEMES: DocDesignTheme[] = [
  {
    id: "cogniva",
    name: "Cogniva",
    font: "manrope",
    headingFont: null,
    accent: "blue",
    styleSet: "default",
  },
  {
    id: "office",
    name: "Office",
    font: "calibri",
    headingFont: "calibri",
    accent: "blue",
    styleSet: "word",
  },
  {
    id: "editorial",
    get name() {
      return tr("Editoriale")
    },
    font: "source-serif-4",
    headingFont: "playfair-display",
    accent: "orange",
    styleSet: "classic",
  },
  {
    id: "modern",
    get name() {
      return tr("Moderno")
    },
    font: "inter",
    headingFont: "plus-jakarta-sans",
    accent: "purple",
    styleSet: "minimal",
  },
  {
    id: "academic",
    get name() {
      return tr("Accademico")
    },
    font: "source-serif-4",
    headingFont: "libre-baskerville",
    accent: "gray",
    styleSet: "lines",
  },
  {
    id: "technical",
    get name() {
      return tr("Tecnico")
    },
    font: "ibm-plex-sans",
    headingFont: "space",
    accent: "teal",
    styleSet: "technical",
  },
  {
    id: "elegant",
    get name() {
      return tr("Elegante")
    },
    font: "lora",
    headingFont: "cormorant-garamond",
    accent: "hotPink",
    styleSet: "elegant",
  },
  {
    id: "fresh",
    get name() {
      return tr("Fresco")
    },
    font: "dm-sans",
    headingFont: "outfit",
    accent: "green",
    styleSet: "accent",
  },
  {
    id: "geometric",
    get name() {
      return tr("Geometrico")
    },
    font: "poppins",
    headingFont: "poppins",
    accent: "orange",
    styleSet: "boxed",
  },
  {
    id: "journal",
    get name() {
      return tr("Giornale")
    },
    font: "newsreader",
    headingFont: "fraunces",
    accent: "gray",
    styleSet: "classic",
  },
  {
    id: "clean",
    get name() {
      return tr("Essenziale")
    },
    font: "geist",
    headingFont: "geist",
    accent: "gray",
    styleSet: "compact",
  },
  {
    id: "soft",
    get name() {
      return tr("Morbido")
    },
    font: "figtree",
    headingFont: "sora",
    accent: "pink",
    styleSet: "accent",
  },
]

export function activeDesignTheme(theme: DocTheme) {
  return (
    DESIGN_THEMES.find(
      (t) =>
        t.font === theme.font &&
        (t.headingFont ?? null) === (theme.headingFont ?? null) &&
        t.accent === theme.accent &&
        t.styleSet === theme.styleSet
    ) ?? null
  )
}

/** «Tipi di carattere»: coppie titoli / corpo, come quelle di Word */
export const FONT_PAIRS: { name: string; heading: string; body: string }[] = [
  { name: "Cogniva", heading: "manrope", body: "manrope" },
  { name: "Office", heading: "calibri", body: "calibri" },
  {
    get name() {
      return tr("Office classico")
    },
    heading: "cambria",
    body: "calibri",
  },
  { name: "Arial", heading: "arial", body: "arial" },
  {
    get name() {
      return tr("Times New Roman")
    },
    heading: "times-new-roman",
    body: "times-new-roman",
  },
  { name: "Georgia", heading: "georgia", body: "georgia" },
  { name: "Inter", heading: "inter", body: "inter" },
  {
    get name() {
      return tr("Moderno")
    },
    heading: "plus-jakarta-sans",
    body: "inter",
  },
  { name: "Geist", heading: "geist", body: "geist" },
  { name: "Grotesk", heading: "bricolage-grotesque", body: "instrument-sans" },
  { name: "Instrument", heading: "instrument-serif", body: "instrument-sans" },
  {
    get name() {
      return tr("Editoriale")
    },
    heading: "playfair-display",
    body: "source-serif-4",
  },
  {
    get name() {
      return tr("Giornale")
    },
    heading: "fraunces",
    body: "newsreader",
  },
  {
    get name() {
      return tr("Accademico")
    },
    heading: "libre-baskerville",
    body: "source-serif-4",
  },
  {
    get name() {
      return tr("Elegante")
    },
    heading: "cormorant-garamond",
    body: "lora",
  },
  { name: "DM", heading: "dm-serif-display", body: "dm-sans" },
  {
    get name() {
      return tr("Geometrico")
    },
    heading: "poppins",
    body: "poppins",
  },
  {
    get name() {
      return tr("Fresco")
    },
    heading: "outfit",
    body: "dm-sans",
  },
  {
    get name() {
      return tr("Morbido")
    },
    heading: "sora",
    body: "figtree",
  },
  { name: "Montserrat", heading: "montserrat", body: "open-sans" },
  { name: "Roboto", heading: "roboto-slab", body: "roboto" },
  {
    get name() {
      return tr("Tecnico")
    },
    heading: "space",
    body: "ibm-plex-sans",
  },
  {
    get name() {
      return tr("Codice")
    },
    heading: "jetbrains",
    body: "inter",
  },
  { name: "Poster", heading: "bebas-neue", body: "work-sans" },
  {
    get name() {
      return tr("Leggibile")
    },
    heading: "lexend",
    body: "lexend",
  },
  {
    get name() {
      return tr("Accessibile")
    },
    heading: "atkinson-hyperlegible-next",
    body: "atkinson-hyperlegible-next",
  },
  {
    get name() {
      return tr("A mano")
    },
    heading: "caveat",
    body: "nunito",
  },
]

/** «Spaziatura paragrafo»: valori di «Normale» (punti e interlinea) */
export const SPACING_PRESETS: {
  id: string
  name: string
  hint: string
  props: { spaceBefore?: number; spaceAfter?: number; lineHeight?: number }
}[] = [
  {
    id: "default",
    get name() {
      return tr("Predefinita")
    },
    get hint() {
      return tr("Dello stile")
    },
    props: {},
  },
  {
    id: "none",
    get name() {
      return tr("Nessuna spaziatura paragrafo")
    },
    get hint() {
      return tr("Prima 0 · Dopo 0 · Interlinea 1")
    },
    props: { spaceBefore: 0, spaceAfter: 0, lineHeight: 1 },
  },
  {
    id: "compact",
    get name() {
      return tr("Compatta")
    },
    get hint() {
      return tr("Prima 0 · Dopo 4 pt · Interlinea 1")
    },
    props: { spaceBefore: 0, spaceAfter: 4, lineHeight: 1 },
  },
  {
    id: "tight",
    get name() {
      return tr("Stretta")
    },
    get hint() {
      return tr("Prima 0 · Dopo 6 pt · Interlinea 1,15")
    },
    props: { spaceBefore: 0, spaceAfter: 6, lineHeight: 1.15 },
  },
  {
    id: "open",
    get name() {
      return tr("Aperta")
    },
    get hint() {
      return tr("Prima 0 · Dopo 10 pt · Interlinea 1,15")
    },
    props: { spaceBefore: 0, spaceAfter: 10, lineHeight: 1.15 },
  },
  {
    id: "relaxed",
    get name() {
      return tr("Rilassata")
    },
    get hint() {
      return tr("Prima 0 · Dopo 6 pt · Interlinea 1,5")
    },
    props: { spaceBefore: 0, spaceAfter: 6, lineHeight: 1.5 },
  },
  {
    id: "double",
    get name() {
      return tr("Doppia")
    },
    get hint() {
      return tr("Prima 0 · Dopo 8 pt · Interlinea 2")
    },
    props: { spaceBefore: 0, spaceAfter: 8, lineHeight: 2 },
  },
]

const SPACING_KEYS = ["spaceBefore", "spaceAfter", "lineHeight"] as const

/** Il preset di spaziatura in uso, confrontando «Normale» salvato */
export function activeSpacing(theme: DocTheme) {
  const normal = theme.styles?.normal ?? {}
  return (
    SPACING_PRESETS.find((preset) =>
      SPACING_KEYS.every((key) => normal[key] === preset.props[key])
    )?.id ?? null
  )
}

/** Il tema con la spaziatura di «Normale» cambiata */
export function withSpacing(
  theme: DocTheme,
  props: (typeof SPACING_PRESETS)[number]["props"]
): Pick<DocTheme, "styles"> {
  const normal: DocStyleDef = { ...(theme.styles?.normal ?? {}) }
  for (const key of SPACING_KEYS) {
    if (props[key] === undefined) delete normal[key]
    else normal[key] = props[key]
  }
  const styles = { ...(theme.styles ?? {}) }
  if (Object.keys(normal).length) styles.normal = normal
  else delete styles.normal
  return { styles }
}

/**
 * Applicare un set di stili sostituisce le modifiche fatte a titoli e
 * citazioni, come in Word; «Normale» e gli stili creati restano
 */
export function withStyleSet(
  theme: DocTheme,
  styleSet: string
): Pick<DocTheme, "styles" | "styleSet"> {
  const styles: Record<string, DocStyleDef> = {}
  for (const [id, def] of Object.entries(theme.styles ?? {})) {
    if (!BUILTIN_STYLES[id] || id === "normal" || id === "no-spacing") {
      styles[id] = def
    }
  }
  return { styleSet, styles }
}

/* ------------------------------- filigrana ------------------------------- */

export const WATERMARK_PRESETS: { group: string; text: string }[] = [
  {
    get group() {
      return tr("Riservatezza")
    },
    get text() {
      return tr("RISERVATO")
    },
  },
  {
    get group() {
      return tr("Riservatezza")
    },
    get text() {
      return tr("CONFIDENZIALE")
    },
  },
  {
    get group() {
      return tr("Riservatezza")
    },
    get text() {
      return tr("NON COPIARE")
    },
  },
  {
    get group() {
      return tr("Stato")
    },
    get text() {
      return tr("BOZZA")
    },
  },
  {
    get group() {
      return tr("Stato")
    },
    get text() {
      return tr("ESEMPIO")
    },
  },
  {
    get group() {
      return tr("Stato")
    },
    get text() {
      return tr("APPROVATO")
    },
  },
  {
    get group() {
      return tr("Urgenza")
    },
    get text() {
      return tr("URGENTE")
    },
  },
  {
    get group() {
      return tr("Urgenza")
    },
    get text() {
      return tr("IMPORTANTE")
    },
  },
]

/**
 * Il corpo del testo di una filigrana, in unità del contenitore (la pagina):
 * in diagonale occupa circa l'80% della diagonale, in orizzontale l'85% della
 * larghezza. Un carattere largo in media 0,62 em.
 */
export function watermarkFontSize(
  text: string,
  layout: DocWatermark["layout"]
) {
  const n = Math.max(4, text.length)
  return layout === "diagonal"
    ? `min(${(120 / n).toFixed(2)}cqh, ${(165 / n).toFixed(2)}cqw)`
    : `${(110 / n).toFixed(2)}cqw`
}

export function newWatermark(patch: Partial<DocWatermark> = {}): DocWatermark {
  return {
    get text() {
      return tr("BOZZA")
    },
    font: null,
    color: "#a1a1aa",
    opacity: 0.35,
    layout: "diagonal",
    image: null,
    scale: 0.6,
    ...patch,
  }
}

/* ------------------------- imposta come predefinito ---------------------- */

/** Le impostazioni di progettazione che «Imposta come predefinito» ricorda */
const DESIGN_KEYS = [
  "font",
  "headingFont",
  "fontSize",
  "accent",
  "styleSet",
  "styles",
  "paper",
  "pageBorder",
  "pageBorderColor",
] as const satisfies readonly (keyof DocTheme)[]

type DesignDefaults = Partial<Pick<DocTheme, (typeof DESIGN_KEYS)[number]>>

export function saveDesignDefaults(theme: DocTheme) {
  const out: Record<string, unknown> = {}
  for (const key of DESIGN_KEYS) out[key] = theme[key]
  try {
    localStorage.setItem(STORAGE.docDefaults, JSON.stringify(out))
    return true
  } catch {
    return false
  }
}

export function clearDesignDefaults() {
  try {
    localStorage.removeItem(STORAGE.docDefaults)
  } catch {
    // niente da togliere
  }
}

function readDesignDefaults(): DesignDefaults {
  try {
    const raw = JSON.parse(readStorage(STORAGE.docDefaults) ?? "{}")
    if (!raw || typeof raw !== "object") return {}
    const out: Record<string, unknown> = {}
    for (const key of DESIGN_KEYS) {
      if (key in raw && typeof raw[key] === typeof defaultDocTheme[key]) {
        out[key] = raw[key]
      } else if (key === "headingFont" && typeof raw[key] === "string") {
        out[key] = raw[key]
      }
    }
    return out as DesignDefaults
  } catch {
    return {}
  }
}

export function hasDesignDefaults() {
  return Object.keys(readDesignDefaults()).length > 0
}

const CM = 96 / 2.54
const cm = (n: number) => Math.round(n * CM * 100) / 100

/** I margini «Normale» di Word: 2,5 cm sopra e sotto, 2 cm ai lati */
export const WORD_MARGINS = {
  top: cm(2.5),
  right: cm(2),
  bottom: cm(2.5),
  left: cm(2),
}

/**
 * Il tema di un documento nuovo: i valori iniziali più quelli predefiniti.
 * Come in Word si parte da un foglio A4 intero, anche vuoto: con il formato
 * «Schermo» il foglio era alto quanto il testo, cioè una striscia.
 */
export function newDocTheme(): DocTheme {
  // un documento nuovo è nella lingua di chi lo crea
  return {
    ...defaultDocTheme,
    format: "a4",
    margins: { ...WORD_MARGINS },
    language: currentRegion(),
    ...readDesignDefaults(),
  }
}
