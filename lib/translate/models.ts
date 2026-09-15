/**
 * Quali modelli OPUS-MT servono per tradurre da una lingua all'altra sul
 * dispositivo. Dove non c'è una coppia diretta si passa dall'inglese, come
 * fanno i traduttori veri. I modelli (licenza CC-BY 4.0, Helsinki-NLP) si
 * scaricano una volta da Hugging Face e restano nella cache del browser.
 */

export type TranslateStep = {
  model: string
  /** alcuni modelli multilingua vogliono la lingua d'arrivo in un prefisso */
  prefix?: string
}

const DIRECT: Record<string, TranslateStep> = {
  "it-en": { model: "Xenova/opus-mt-it-en" },
  "en-it": { model: "Xenova/opus-mt-en-it" },
  "it-fr": { model: "Xenova/opus-mt-it-fr" },
  "it-es": { model: "Xenova/opus-mt-it-es" },
  "es-it": { model: "Xenova/opus-mt-es-it" },
  "fr-en": { model: "Xenova/opus-mt-fr-en" },
  "en-fr": { model: "Xenova/opus-mt-en-fr" },
  "de-en": { model: "Xenova/opus-mt-de-en" },
  "en-de": { model: "Xenova/opus-mt-en-de" },
  "es-en": { model: "Xenova/opus-mt-es-en" },
  "en-es": { model: "Xenova/opus-mt-en-es" },
  "nl-en": { model: "Xenova/opus-mt-nl-en" },
  "en-nl": { model: "Xenova/opus-mt-en-nl" },
  "pl-en": { model: "Xenova/opus-mt-pl-en" },
  "en-ro": { model: "Xenova/opus-mt-en-ro" },
  "ja-en": { model: "Xenova/opus-mt-ja-en" },
  "en-ja": { model: "Xenova/opus-mt-en-jap" },
  "zh-en": { model: "Xenova/opus-mt-zh-en" },
  "en-zh": { model: "Xenova/opus-mt-en-zh", prefix: ">>cmn_Hans<< " },
  "en-pt": { model: "Xenova/opus-mt-en-ROMANCE", prefix: ">>pt<< " },
}

/** Tutte le lingue verso l'inglese, per quelle senza un modello dedicato */
const TO_ENGLISH: TranslateStep = { model: "Xenova/opus-mt-mul-en" }

export function translateRoute(
  source: string,
  target: string
): TranslateStep[] | null {
  if (source === target) return []
  const direct = DIRECT[`${source}-${target}`]
  if (direct) return [direct]
  const toEnglish =
    source === "en" ? null : (DIRECT[`${source}-en`] ?? TO_ENGLISH)
  const fromEnglish = target === "en" ? null : DIRECT[`en-${target}`]
  if (target === "en") return toEnglish ? [toEnglish] : null
  if (source === "en") return fromEnglish ? [fromEnglish] : null
  if (!toEnglish || !fromEnglish) return null
  return [toEnglish, fromEnglish]
}

/** Megabyte da scaricare la prima volta (encoder e decoder quantizzati) */
export const MODEL_DOWNLOAD_MB = 130
