/**
 * Palette dei contenuti: colori di forme, note, evidenziatori e grafici.
 * I neutri sono gli zinco del tema, così canvas, foglio e interfaccia hanno
 * la stessa temperatura di grigio.
 */

export const whim = {
  base: {
    0: "#fafafa",
    10: "#f7f7f8",
    50: "#f4f4f5",
    100: "#efeff1",
    200: "#e4e4e7",
    300: "#d4d4d8",
    400: "#c4c4cc",
    500: "#a1a1aa",
    600: "#71717a",
    700: "#52525b",
    750: "#3f3f46",
    800: "#18181b",
    900: "#09090b",
  },
  blue: {
    50: "#efedff",
    100: "#dcd9ff",
    200: "#b9b2ff",
    300: "#958bff",
    400: "#6759ff",
    500: "#4839e5",
    600: "#271bb2",
    700: "#0d0566",
    800: "#040033",
  },
  purple: {
    50: "#f7edff",
    100: "#efd9ff",
    200: "#dfb2ff",
    300: "#cf8bff",
    400: "#ba59ff",
    500: "#9e39e5",
    600: "#731bb2",
    700: "#3d0566",
    800: "#1e0033",
  },
  pink: {
    50: "#ffedfe",
    100: "#ffd9fc",
    200: "#ffb2f8",
    300: "#ff8bf5",
    400: "#ff59f1",
    500: "#e539d7",
    600: "#b21ba6",
    700: "#66055d",
    800: "#33002f",
  },
  hotPink: {
    50: "#ffedf5",
    100: "#ffd9e9",
    200: "#ffb2d2",
    300: "#ff8bbb",
    400: "#e53981",
    500: "#cc296d",
    600: "#a61954",
    700: "#800639",
    800: "#330015",
  },
  teal: {
    50: "#edf5ff",
    100: "#d9e9ff",
    200: "#b2d2ff",
    300: "#8bbbff",
    400: "#599fff",
    500: "#3981e5",
    600: "#1b5ab2",
    700: "#052d66",
    800: "#001533",
  },
  green: {
    50: "#f1ffed",
    100: "#e2ffd9",
    200: "#bcf2aa",
    300: "#8fd976",
    400: "#69cc47",
    500: "#4eb22c",
    600: "#389917",
    700: "#1d6605",
    800: "#0d3300",
  },
  yellow: {
    50: "#fff8d9",
    100: "#fff4bf",
    200: "#fae996",
    300: "#f2da61",
    400: "#f2d024",
    500: "#e5c317",
    600: "#ccac0a",
    700: "#8c7500",
    800: "#4d4000",
  },
  orange: {
    50: "#ffecd9",
    100: "#fad5af",
    200: "#f2bc85",
    300: "#e59b50",
    400: "#e5780b",
    500: "#bf6000",
    600: "#994d00",
    700: "#663300",
    800: "#331a00",
  },
} as const

export type SwatchKey =
  | "white"
  | "gray"
  | "blue"
  | "purple"
  | "pink"
  | "hotPink"
  | "teal"
  | "green"
  | "yellow"
  | "orange"

export type Swatch = {
  key: SwatchKey
  label: string
  fill: string
  border: string
  text: string
  solid: string
  soft: string
}

export const SWATCHES: Swatch[] = [
  {
    key: "white",
    label: "Bianco",
    fill: "#ffffff",
    border: whim.base[300],
    text: whim.base[800],
    solid: whim.base[600],
    soft: whim.base[50],
  },
  {
    key: "gray",
    label: "Grigio",
    fill: whim.base[100],
    border: whim.base[400],
    text: whim.base[800],
    solid: whim.base[700],
    soft: whim.base[50],
  },
  {
    key: "blue",
    label: "Blu",
    fill: whim.blue[100],
    border: whim.blue[300],
    text: whim.blue[700],
    solid: whim.blue[400],
    soft: whim.blue[50],
  },
  {
    key: "purple",
    label: "Viola",
    fill: whim.purple[100],
    border: whim.purple[300],
    text: whim.purple[700],
    solid: whim.purple[400],
    soft: whim.purple[50],
  },
  {
    key: "pink",
    label: "Rosa",
    fill: whim.pink[100],
    border: whim.pink[300],
    text: whim.pink[700],
    solid: whim.pink[400],
    soft: whim.pink[50],
  },
  {
    key: "hotPink",
    label: "Magenta",
    fill: whim.hotPink[100],
    border: whim.hotPink[300],
    text: whim.hotPink[700],
    solid: whim.hotPink[400],
    soft: whim.hotPink[50],
  },
  {
    key: "teal",
    label: "Azzurro",
    fill: whim.teal[100],
    border: whim.teal[300],
    text: whim.teal[700],
    solid: whim.teal[400],
    soft: whim.teal[50],
  },
  {
    key: "green",
    label: "Verde",
    fill: whim.green[100],
    border: whim.green[300],
    text: whim.green[700],
    solid: whim.green[500],
    soft: whim.green[50],
  },
  {
    key: "yellow",
    label: "Giallo",
    fill: whim.yellow[100],
    border: whim.yellow[300],
    text: whim.yellow[800],
    solid: whim.yellow[500],
    soft: whim.yellow[50],
  },
  {
    key: "orange",
    label: "Arancio",
    fill: whim.orange[100],
    border: whim.orange[300],
    text: whim.orange[700],
    solid: whim.orange[400],
    soft: whim.orange[50],
  },
]

const swatchMap: Record<SwatchKey, Swatch> = Object.fromEntries(
  SWATCHES.map((s) => [s.key, s])
) as Record<SwatchKey, Swatch>

export function getSwatch(key: string): Swatch {
  return swatchMap[key as SwatchKey] ?? swatchMap.white
}

/**
 * L'accento di un documento: una chiave della tavolozza oppure un colore
 * esadecimale scelto a mano, da cui si ricava la versione tenue
 */
export function docAccent(accent: string): { solid: string; fill: string } {
  if (/^#[0-9a-f]{6}$/i.test(accent)) {
    const [r, g, b] = hexToRgb(accent)
    const mix = (c: number) =>
      Math.round(c * 0.2 + 255 * 0.8)
        .toString(16)
        .padStart(2, "0")
    return { solid: accent, fill: `#${mix(r)}${mix(g)}${mix(b)}` }
  }
  const swatch = swatchMap[accent as SwatchKey] ?? swatchMap.blue
  return { solid: swatch.solid, fill: swatch.fill }
}

/** Colori linea/freccia disponibili */
export const LINE_COLORS: { label: string; value: string }[] = [
  { label: "Grafite", value: whim.base[700] },
  { label: "Nero", value: whim.base[900] },
  { label: "Grigio", value: whim.base[500] },
  { label: "Blu", value: whim.blue[400] },
  { label: "Viola", value: whim.purple[400] },
  { label: "Magenta", value: whim.hotPink[400] },
  { label: "Azzurro", value: whim.teal[400] },
  { label: "Verde", value: whim.green[500] },
  { label: "Giallo", value: whim.yellow[600] },
  { label: "Arancio", value: whim.orange[400] },
]

/** Sfondi predefiniti del canvas */
export const BACKGROUNDS: { label: string; value: string; dark?: boolean }[] = [
  { label: "Bianco", value: "#ffffff" },
  { label: "Carta", value: whim.base[0] },
  { label: "Nebbia", value: whim.base[100] },
  { label: "Blu", value: whim.blue[50] },
  { label: "Viola", value: whim.purple[50] },
  { label: "Rosa", value: whim.pink[50] },
  { label: "Azzurro", value: whim.teal[50] },
  { label: "Verde", value: whim.green[50] },
  { label: "Giallo", value: whim.yellow[50] },
  { label: "Arancio", value: whim.orange[50] },
  { label: "Notte", value: whim.base[800], dark: true },
  { label: "Inchiostro", value: whim.base[900], dark: true },
]

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim()
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("")
  const n = parseInt(h.slice(0, 6) || "000000", 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgba(hex: string, alpha: number) {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Luminanza relativa: serve a capire se lo sfondo è scuro */
export function isDark(hex: string) {
  const [r, g, b] = hexToRgb(hex)
  const srgb = [r, g, b].map((c) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  const l = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2]
  return l < 0.35
}
