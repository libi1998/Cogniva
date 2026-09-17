/**
 * Valori CSS che finiscono dentro a un attributo `style` o a un foglio di
 * stile costruito a mano.
 *
 * Il contenuto di un documento non arriva sempre da chi lo sta scrivendo: può
 * venire da un .docx o da un HTML importato, da uno spazio di lavoro .json
 * scritto altrove o dagli appunti. Un valore come
 * «1px;background:url(https://…)» scriverebbe regole che non gli competono e
 * farebbe partire una richiesta verso un sito esterno da un'app che promette
 * che i documenti non escono dal browser. Qui ogni valore passa da un filtro
 * solo, e chi lo usa non deve ricordarsene.
 */

/**
 * Caratteri che chiudono il valore e ne aprono un altro. Le virgolette
 * restano: a `font-feature-settings` e ai nomi dei caratteri servono, e dentro
 * a un attributo `style` non aprono niente (il valore ci arriva dal DOM, non
 * da una stringa di HTML).
 */
const BREAKOUT = /[;{}<>\\]/g

/**
 * Funzioni che scaricano qualcosa o eseguono codice. Tutto il resto (rgb,
 * hsl, color-mix, var, calc, i gradienti) serve davvero e resta.
 */
const FETCHING =
  /(?:url|image|image-set|-webkit-image-set|cross-fade|element|expression|-moz-binding)\s*\(/i

/** Una regola @ (per esempio @import) dentro a un valore */
const AT_RULE = /@[a-z]/i

const count = (text: string, ch: string) => {
  let n = 0
  for (const c of text) if (c === ch) n += 1
  return n
}

/**
 * Un valore CSS qualunque (lunghezze, ombre, varianti tipografiche…), oppure
 * null se non se ne può fare niente di sicuro.
 */
export function cssValue(value: unknown): string | null {
  if (typeof value === "number")
    return Number.isFinite(value) ? `${value}` : null
  if (typeof value !== "string") return null
  const clean = value.replace(BREAKOUT, "").trim()
  if (!clean) return null
  if (FETCHING.test(clean) || AT_RULE.test(clean)) return null
  // virgolette o parentesi spaiate: il valore resterebbe aperto e si
  // mangerebbe quello che viene dopo
  if (count(clean, "'") % 2 || count(clean, '"') % 2) return null
  let depth = 0
  for (const ch of clean) {
    if (ch === "(") depth++
    else if (ch === ")" && --depth < 0) return null
  }
  return depth === 0 ? clean : null
}

/** Colori nominali e parole chiave: `red`, `transparent`, `currentColor`… */
const COLOR_WORD = /^[a-z]+$/i
const COLOR_HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const COLOR_FN =
  /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark|var)\(/i

/**
 * Un colore. Più stretto di `cssValue`: qui si sa che cosa deve arrivare,
 * quindi passa solo quello.
 */
export function cssColor(value: unknown): string | null {
  const clean = cssValue(value)
  if (!clean) return null
  if (COLOR_HEX.test(clean) || COLOR_WORD.test(clean)) return clean
  return COLOR_FN.test(clean) ? clean : null
}

/** Una misura (`12px`, `1.5em`, `80%`, `1.4`), oppure null */
export function cssLength(value: unknown): string | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? `${value}px` : null
  }
  const clean = cssValue(value)
  return clean && /^-?(?:\d+\.?\d*|\.\d+)(?:[a-z]{1,4}|%)?$/i.test(clean)
    ? clean
    : null
}

/**
 * Un valore dentro a un attributo di un file XML o SVG scritto a mano: senza
 * questo, un colore con un apice chiuderebbe l'attributo e potrebbe
 * aggiungerne altri al file esportato.
 */
export function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
