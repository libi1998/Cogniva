import { tr } from "@/lib/i18n/client"
/**
 * Le voci neurali che Cogniva fa parlare sul dispositivo (Piper, VITS).
 * Solo voci addestrate su dati liberi (CC0, pubblico dominio, CC-BY): i
 * crediti si mostrano accanto a ogni voce. I file sono fissati a una revisione
 * del repository e verificati con SHA-256 prima di usarli.
 */

const REVISION = "1162a9173d0ce503555aed757976b7a9912eae4c"
const BASE = `https://huggingface.co/rhasspy/piper-voices/resolve/${REVISION}`

export type NeuralVoice = {
  id: string
  /** BCP 47, come la lingua del documento */
  lang: string
  name: string
  gender: "F" | "M"
  model: string
  config: string
  sha256: string
  bytes: number
  /** voce di un modello con più parlanti */
  speaker?: number
  license: string
  credit: string
}

function voice(
  path: string,
  file: string,
  meta: Omit<NeuralVoice, "id" | "model" | "config"> & { id?: string }
): NeuralVoice {
  return {
    ...meta,
    id: meta.id ?? file,
    model: `${BASE}/${path}/${file}.onnx`,
    config: `${BASE}/${path}/${file}.onnx.json`,
  }
}

export const NEURAL_VOICES: NeuralVoice[] = [
  voice("it/it_IT/paola/medium", "it_IT-paola-medium", {
    lang: "it-IT",
    name: "Paola",
    gender: "F",
    sha256: "6fc918b5a0ea6137382833dddfa567bffbe6a5060c02043c87192ee59c04210c",
    bytes: 63511038,
    license: "CC0 1.0",
    credit: "Paola Persico (dataset)",
  }),
  voice("en/en_US/kristin/medium", "en_US-kristin-medium", {
    lang: "en-US",
    name: "Kristin",
    gender: "F",
    sha256: "5849957f929cbf720c258f8458692d6103fff2f0e3d3b19c8259474bb06a18d4",
    bytes: 63531379,
    get license() {
      return tr("Pubblico dominio")
    },
    credit: "LibriVox",
  }),
  voice("en/en_US/john/medium", "en_US-john-medium", {
    lang: "en-US",
    name: "John",
    gender: "M",
    sha256: "789c6c875726e627ddee93d51d8727859abe9c091c3d141591f4b83c2072e988",
    bytes: 63531379,
    get license() {
      return tr("Pubblico dominio")
    },
    credit: "LibriVox",
  }),
  voice("en/en_GB/alba/medium", "en_GB-alba-medium", {
    lang: "en-GB",
    name: "Alba",
    gender: "F",
    sha256: "401369c4a81d09fdd86c32c5c864440811dbdcc66466cde2d64f7133a66ad03b",
    bytes: 63201294,
    license: "CC BY 4.0",
    credit: "University of Edinburgh, CSTR",
  }),
  voice("fr/fr_FR/siwis/medium", "fr_FR-siwis-medium", {
    lang: "fr-FR",
    name: "Siwis",
    gender: "F",
    sha256: "641d1ab097da2b81128c076810edb052b385decc8be3381814802a64a73baf99",
    bytes: 63201294,
    license: "CC BY 4.0",
    credit: "SIWIS, University of Edinburgh",
  }),
  voice("fr/fr_FR/gilles/low", "fr_FR-gilles-low", {
    lang: "fr-FR",
    name: "Gilles",
    gender: "M",
    sha256: "5cd711846720e261c2a176f6924c198a7424d0a75dd4b0a5357a5fb9cb739285",
    bytes: 63104526,
    license: "CC0 1.0",
    credit: "Gilles",
  }),
  voice("de/de_DE/thorsten/medium", "de_DE-thorsten-medium", {
    lang: "de-DE",
    name: "Thorsten",
    gender: "M",
    sha256: "7e64762d8e5118bb578f2eea6207e1a35a8e0c30595010b666f983fc87bb7819",
    bytes: 63201294,
    license: "CC0 1.0",
    credit: "Thorsten Müller, Thorsten-Voice",
  }),
  voice("de/de_DE/kerstin/low", "de_DE-kerstin-low", {
    lang: "de-DE",
    name: "Kerstin",
    gender: "F",
    sha256: "d352a7641892cebf2903859af94e9ba81a141110215fe3943bcda7f7da401b7a",
    bytes: 63104526,
    license: "CC0 1.0",
    credit: "Kerstin, Rhasspy",
  }),
  voice("es/es_ES/davefx/medium", "es_ES-davefx-medium", {
    lang: "es-ES",
    name: "David",
    gender: "M",
    sha256: "6658b03b1a6c316ee4c265a9896abc1393353c2d9e1bca7d66c2c442e222a917",
    bytes: 63201294,
    license: "CC0 1.0",
    credit: "DaveFX, Open Home Foundation",
  }),
  voice("es/es_ES/sharvard/medium", "es_ES-sharvard-medium", {
    id: "es_ES-sharvard-medium-F",
    lang: "es-ES",
    get name() {
      return tr("Sharvard (femminile)")
    },
    gender: "F",
    speaker: 1,
    sha256: "40febfb1679c69a4505ff311dc136e121e3419a13a290ef264fdf43ddedd0fb1",
    bytes: 76733615,
    license: "CC BY 3.0",
    credit: "Sharvard corpus, University of Edinburgh",
  }),
  voice("pt/pt_BR/faber/medium", "pt_BR-faber-medium", {
    lang: "pt-BR",
    name: "Faber",
    gender: "M",
    sha256: "858555e3a064209c57088fe6bd70c4c3dc54d03eaa00c45d5ecaf43a33f95aa7",
    bytes: 63201294,
    license: "CC0 1.0",
    credit: "Faber, Open Home Foundation",
  }),
  voice("nl/nl_BE/nathalie/medium", "nl_BE-nathalie-medium", {
    lang: "nl-BE",
    name: "Nathalie",
    gender: "F",
    sha256: "49cf48023861f9fd42e13a8632f068fee67d1ce244a6ee38f29595afbf0a6be4",
    bytes: 63201294,
    license: "CC0 1.0",
    credit: "Nathalie, Rhasspy",
  }),
  voice("pl/pl_PL/gosia/medium", "pl_PL-gosia-medium", {
    lang: "pl-PL",
    name: "Gosia",
    gender: "F",
    sha256: "38f66464240ed74f186e6b7dc13c6e3b22e023426299f25c2b3cc9dfa9373fbc",
    bytes: 63201294,
    license: "CC0 1.0",
    credit: "Gosia, Open Home Foundation",
  }),
  voice("pl/pl_PL/darkman/medium", "pl_PL-darkman-medium", {
    lang: "pl-PL",
    name: "Darkman",
    gender: "M",
    sha256: "db505438a5364e8e2e0242c4324130a873ed660dfbe8d9689cef428ffb1b645f",
    bytes: 63201294,
    license: "CC0 1.0",
    credit: "Darkman, Open Home Foundation",
  }),
  voice("ro/ro_RO/mihai/medium", "ro_RO-mihai-medium", {
    lang: "ro-RO",
    name: "Mihai",
    gender: "M",
    sha256: "e0608bbbd53c80267c09ece681b09f5199f54e792356684c8073738e5f15d29f",
    bytes: 63201294,
    license: "CC0 1.0",
    credit: "Mihai, Open Home Foundation",
  }),
]

/** Le voci per una lingua: prima quelle della stessa variante (it-IT, en-GB…) */
export function neuralVoicesFor(lang: string) {
  const base = lang.slice(0, 2).toLowerCase()
  return NEURAL_VOICES.filter((v) => v.lang.slice(0, 2) === base).sort(
    (a, b) =>
      Number(b.lang.toLowerCase() === lang.toLowerCase()) -
      Number(a.lang.toLowerCase() === lang.toLowerCase())
  )
}

export const VOICE_CACHE = "cogniva-voices-v1"

export async function downloadedVoices(): Promise<Set<string>> {
  try {
    const cache = await caches.open(VOICE_CACHE)
    const urls = new Set((await cache.keys()).map((r) => r.url))
    return new Set(
      NEURAL_VOICES.filter((v) => urls.has(v.model)).map((v) => v.id)
    )
  } catch {
    return new Set()
  }
}

export async function deleteVoice(voice: NeuralVoice) {
  try {
    const cache = await caches.open(VOICE_CACHE)
    await cache.delete(voice.model)
    await cache.delete(voice.config)
  } catch {
    // niente da liberare
  }
}

export const megabytes = (bytes: number) => Math.round(bytes / 1_000_000)
