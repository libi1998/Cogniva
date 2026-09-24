import { currentRegion } from "@/lib/i18n/client"

/** Il separatore dei decimali di chi usa l'app: «,» in italiano, «.» in inglese */
export const decimalMark = () =>
  (1.5).toLocaleString(currentRegion()).includes(",") ? "," : "."

/**
 * Un numero scritto con i separatori di qualunque lingua: «1.234,5»,
 * «1,234.5», «3.5», «12,5», «10'000». Il separatore dei decimali è l'ultimo
 * dei due quando ci sono entrambi; con uno solo, un punto o una virgola
 * seguiti da tre cifre sono ambigui («1.234») e decide la lingua. `NaN` se il
 * testo non è un numero.
 */
export function parseLocaleNumber(text: string): number {
  const s = text
    .trim()
    // migliaia separate da apostrofi o da spazi (anche fissi)
    .replace(/['’\s]/g, "")
    .replace(/^[−–]/, "-")
  if (!/^[-+]?(?:\d[\d.,]*|[.,]\d+)$/.test(s)) return Number.NaN
  const dot = s.lastIndexOf(".")
  const comma = s.lastIndexOf(",")
  let decimal: number = -1
  if (dot >= 0 && comma >= 0) decimal = Math.max(dot, comma)
  else if (dot >= 0 || comma >= 0) {
    const mark = dot >= 0 ? "." : ","
    const at = Math.max(dot, comma)
    const once = s.indexOf(mark) === at
    const digitsAfter = s.length - at - 1
    if (once && (digitsAfter !== 3 || mark === decimalMark())) decimal = at
  }
  const whole = (decimal < 0 ? s : s.slice(0, decimal)).replace(/[.,]/g, "")
  const fraction = decimal < 0 ? "" : s.slice(decimal + 1)
  if (/[.,]/.test(fraction)) return Number.NaN
  return Number(`${whole || "0"}${fraction ? `.${fraction}` : ""}`)
}

/** Il primo numero dentro un testo («Voto: 8,5 su 10» → 8,5); `NaN` se non c'è */
export function firstNumber(text: string): number {
  const m = text.match(/[-−]?\d[\d.,'’\u00a0\u202f]*/)
  return m ? parseLocaleNumber(m[0].replace(/[.,]+$/, "")) : Number.NaN
}

/**
 * Un numero da mostrare con il separatore dei decimali della lingua: «2,5»
 * in italiano, «2.5» in inglese. Le caselle accettano comunque tutti e due.
 */
export const formatDecimal = (n: number | string) =>
  String(n).replace(".", decimalMark())
