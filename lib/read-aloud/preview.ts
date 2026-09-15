import { loadVoice, synthesize } from "./neural"
import { loadPhonemizer } from "./phonemizer"
import type { NeuralVoice } from "./voices"

/** Una frase di prova per ascoltare una voce prima di sceglierla */

const SAMPLES: Record<string, string> = {
  it: "Ciao! Sono la voce che leggerà il tuo documento.",
  en: "Hello! I am the voice that will read your document.",
  fr: "Bonjour ! Je suis la voix qui lira votre document.",
  de: "Hallo! Ich bin die Stimme, die dein Dokument vorliest.",
  es: "¡Hola! Soy la voz que leerá tu documento.",
  pt: "Olá! Eu sou a voz que vai ler o seu documento.",
  nl: "Hallo! Ik ben de stem die je document voorleest.",
  pl: "Cześć! Jestem głosem, który przeczyta twój dokument.",
  ro: "Bună! Eu sunt vocea care îți va citi documentul.",
}

export const sampleText = (lang: string) =>
  SAMPLES[lang.slice(0, 2)] ?? SAMPLES.en!

let stopCurrent: (() => void) | null = null

export function stopPreview() {
  stopCurrent?.()
  stopCurrent = null
}

export function previewSystemVoice(
  voice: SpeechSynthesisVoice | null,
  lang: string,
  rate: number
) {
  stopPreview()
  const utterance = new SpeechSynthesisUtterance(sampleText(lang))
  utterance.lang = voice?.lang ?? lang
  if (voice) utterance.voice = voice
  utterance.rate = rate
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
  stopCurrent = () => window.speechSynthesis.cancel()
}

export async function previewNeuralVoice(
  voice: NeuralVoice,
  rate: number,
  onProgress?: (fraction: number) => void
) {
  stopPreview()
  const context = new AudioContext()
  let stopped = false
  stopCurrent = () => {
    stopped = true
    void context.close()
  }
  await Promise.all([loadPhonemizer(), loadVoice(voice, onProgress)])
  const { pcm, sampleRate } = await synthesize(
    voice,
    sampleText(voice.lang),
    rate
  )
  if (stopped || !pcm.length) return
  const buffer = context.createBuffer(1, pcm.length, sampleRate)
  buffer.copyToChannel(pcm as Float32Array<ArrayBuffer>, 0)
  const source = context.createBufferSource()
  source.buffer = buffer
  source.connect(context.destination)
  source.onended = () => void context.close()
  source.start()
}
