/**
 * Le voci del sistema operativo e del browser, in ordine di qualità: prima
 * quelle neurali o «premium» (Siri, Microsoft Online, Google), poi le altre.
 * Le voci giocattolo di macOS non si propongono.
 */

const NOVELTY =
  /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Good News|Hysterical|Jester|Junior|Organ|Pipe Organ|Ralph|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Kathy)\b/i
const ELOQUENCE =
  /^(Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley|Nonna|Nonno)\b/i

export function voiceScore(voice: SpeechSynthesisVoice, lang: string) {
  const name = voice.name
  const vLang = voice.lang.replace("_", "-").toLowerCase()
  const wanted = lang.toLowerCase()
  let score = 0
  if (vLang === wanted) score += 4
  else if (vLang.slice(0, 2) === wanted.slice(0, 2)) score += 2
  if (/natural|neural|premium|enhanced|siri|wavenet|studio/i.test(name))
    score += 6
  if (/online/i.test(name) && /microsoft/i.test(name)) score += 6
  if (/^google/i.test(name)) score += 4
  if (!voice.localService) score += 1
  if (voice.default) score += 0.5
  if (ELOQUENCE.test(name)) score -= 4
  if (/compact/i.test(name)) score -= 2
  return score
}

export function isNaturalVoice(voice: SpeechSynthesisVoice) {
  return (
    /natural|neural|premium|enhanced|siri|wavenet|studio/i.test(voice.name) ||
    (/online/i.test(voice.name) && /microsoft/i.test(voice.name)) ||
    /^google/i.test(voice.name)
  )
}

export function systemVoicesFor(
  voices: SpeechSynthesisVoice[],
  lang: string
): SpeechSynthesisVoice[] {
  const base = lang.slice(0, 2).toLowerCase()
  const seen = new Set<string>()
  return voices
    .filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith(base))
    .filter((v) => !NOVELTY.test(v.name))
    .filter((v) => {
      const key = v.voiceURI || v.name
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => voiceScore(b, lang) - voiceScore(a, lang))
}

/** Le voci arrivano in ritardo in Chrome: si aspetta l'evento, con un limite */
export function loadSystemVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return Promise.resolve([])
  }
  const now = window.speechSynthesis.getVoices()
  if (now.length) return Promise.resolve(now)
  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", done)
      clearTimeout(timer)
      resolve(window.speechSynthesis.getVoices())
    }
    const timer = setTimeout(done, 1500)
    window.speechSynthesis.addEventListener("voiceschanged", done)
  })
}

/* La voce scelta, ricordata per ogni lingua */

export type VoiceChoice =
  { kind: "neural"; id: string } | { kind: "system"; uri: string }

const key = (lang: string) => `cogniva:voice:${lang.slice(0, 2).toLowerCase()}`

export function readVoiceChoice(lang: string): VoiceChoice | null {
  try {
    const raw = localStorage.getItem(key(lang))
    if (!raw) return null
    const parsed = JSON.parse(raw) as VoiceChoice
    return parsed.kind === "neural" || parsed.kind === "system" ? parsed : null
  } catch {
    return null
  }
}

export function saveVoiceChoice(lang: string, choice: VoiceChoice) {
  try {
    localStorage.setItem(key(lang), JSON.stringify(choice))
  } catch {
    // la scelta vale finché la pagina resta aperta
  }
}

export function readRate() {
  try {
    const n = Number(localStorage.getItem("cogniva:voice-rate"))
    return n >= 0.5 && n <= 2 ? n : 1
  } catch {
    return 1
  }
}

export function saveRate(rate: number) {
  try {
    localStorage.setItem("cogniva:voice-rate", String(rate))
  } catch {
    // resta per questa sessione
  }
}
