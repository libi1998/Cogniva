import {
  Inter,
  Manrope,
  Space_Grotesk,
  Poppins,
  Lora,
  Caveat,
  Architects_Daughter,
  JetBrains_Mono,
} from "next/font/google"
import { FONT_CATALOG } from "./font-catalog"

// Inter è anche il carattere dell'interfaccia (tema scelto nel preset)
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
})
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
  // si scaricano solo se usati: non rallentano l'apertura
  preload: false,
})
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
  // si scaricano solo se usati: non rallentano l'apertura
  preload: false,
})
const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
  // si scaricano solo se usati: non rallentano l'apertura
  preload: false,
})
const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
  // si scaricano solo se usati: non rallentano l'apertura
  preload: false,
})
const architects = Architects_Daughter({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-architects",
  display: "swap",
  // si scaricano solo se usati: non rallentano l'apertura
  preload: false,
})
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
  // si scaricano solo se usati: non rallentano l'apertura
  preload: false,
})

export const fontClassNames = [
  inter.variable,
  manrope.variable,
  spaceGrotesk.variable,
  poppins.variable,
  lora.variable,
  caveat.variable,
  architects.variable,
  jetbrains.variable,
].join(" ")

/**
 * Chiave del carattere salvata nei file. Le prime otto famiglie arrivano da
 * next/font; le altre cento sono in fonts (vedi scripts/fetch-fonts.mjs).
 */
export type FontKey = string

export type FontGroup = "word" | "sans" | "serif" | "mono" | "display" | "hand"

export const FONT_GROUPS: { value: FontGroup; label: string }[] = [
  { value: "word", label: "Compatibili con Word" },
  { value: "sans", label: "Sans serif" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Monospazio" },
  { value: "display", label: "Decorativi" },
  { value: "hand", label: "Scritti a mano" },
]

export type FontOption = {
  key: FontKey
  label: string
  hint: string
  stack: string
  /** correzione di scala: i font manoscritti rendono più piccoli */
  scale: number
  group: FontGroup
  /** nome della @font-face, per incorporarla nelle esportazioni */
  family: string
}

const BUILT_IN: FontOption[] = [
  {
    key: "inter",
    label: "Inter",
    hint: "Neutro",
    stack: "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
    scale: 1,
    group: "sans",
    family: "Inter",
  },
  {
    key: "manrope",
    label: "Manrope",
    hint: "Classico",
    stack: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif",
    scale: 1,
    group: "sans",
    family: "Manrope",
  },
  {
    key: "space",
    label: "Space Grotesk",
    hint: "Tecnico",
    stack: "var(--font-space-grotesk), ui-sans-serif, system-ui, sans-serif",
    scale: 1,
    group: "sans",
    family: "Space Grotesk",
  },
  {
    key: "poppins",
    label: "Poppins",
    hint: "Geometrico",
    stack: "var(--font-poppins), ui-sans-serif, system-ui, sans-serif",
    scale: 0.97,
    group: "sans",
    family: "Poppins",
  },
  {
    key: "lora",
    label: "Lora",
    hint: "Serif",
    stack: "var(--font-lora), ui-serif, Georgia, serif",
    scale: 0.98,
    group: "serif",
    family: "Lora",
  },
  {
    key: "caveat",
    label: "Caveat",
    hint: "Manoscritto",
    stack: "var(--font-caveat), ui-serif, cursive",
    scale: 1.28,
    group: "hand",
    family: "Caveat",
  },
  {
    key: "architects",
    label: "Architects Daughter",
    hint: "Schizzo",
    stack: "var(--font-architects), ui-serif, cursive",
    scale: 0.94,
    group: "hand",
    family: "Architects Daughter",
  },
  {
    key: "jetbrains",
    label: "JetBrains Mono",
    hint: "Monospazio",
    stack: "var(--font-jetbrains), ui-monospace, monospace",
    scale: 0.94,
    group: "mono",
    family: "JetBrains Mono",
  },
]

const HINTS: Record<FontGroup, string> = {
  word: "",
  sans: "Sans serif",
  serif: "Serif",
  mono: "Monospazio",
  display: "Decorativo",
  hand: "A mano",
}

/** Tutti i caratteri, in ordine alfabetico dentro a ogni gruppo */
export const FONTS: FontOption[] = [
  ...BUILT_IN,
  ...FONT_CATALOG.map((f) => ({
    key: f.key,
    label: f.label,
    hint: f.group === "word" ? `come ${f.label}` : HINTS[f.group],
    stack: f.stack,
    scale: f.scale,
    group: f.group,
    family: f.family,
  })),
].sort((a, b) => {
  const ga = FONT_GROUPS.findIndex((g) => g.value === a.group)
  const gb = FONT_GROUPS.findIndex((g) => g.value === b.group)
  return ga - gb || a.label.localeCompare(b.label, "it")
})

export const fontMap: Record<string, FontOption> = Object.fromEntries(
  FONTS.map((f) => [f.key, f])
)

export function fontStack(key: string | undefined) {
  return (fontMap[key ?? ""] ?? fontMap.inter).stack
}

export function fontScale(key: string | undefined) {
  return (fontMap[key ?? ""] ?? fontMap.inter).scale
}

/** Il primo nome di una pila CSS, senza virgolette */
function firstFamily(css: string) {
  return (css.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "")
}

const byFirst = new Map(
  FONTS.map((f) => [firstFamily(f.stack).toLowerCase(), f])
)

/** Il carattere che corrisponde a una font-family CSS (per esempio da un marchio) */
export function fontFromCss(css: string | null | undefined): FontOption | null {
  if (!css) return null
  return byFirst.get(firstFamily(css).toLowerCase()) ?? null
}
