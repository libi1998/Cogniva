import type { PiperRequest, PiperResponse } from "./piper.worker"
import { phonemize } from "./phonemizer"
import { VOICE_CACHE, type NeuralVoice } from "./voices"

/**
 * Il lato «pagina» delle voci neurali: configurazione della voce, fonemi con
 * espeak-ng e sintesi nel worker. Un worker solo, riusato fra una lettura e
 * l'altra (il modello resta in memoria).
 */

type VoiceConfig = {
  audio: { sample_rate: number }
  espeak: { voice: string }
  inference: { noise_scale: number; length_scale: number; noise_w: number }
}

let worker: Worker | null = null
let nextId = 1
const pending = new Map<
  number,
  {
    resolve: (value: Float32Array | null) => void
    reject: (error: Error) => void
    progress?: (fraction: number) => void
  }
>()

function getWorker() {
  if (worker) return worker
  worker = new Worker(new URL("./piper.worker.ts", import.meta.url), {
    type: "module",
    name: "cogniva-voice",
  })
  worker.addEventListener("message", (event: MessageEvent<PiperResponse>) => {
    const message = event.data
    const job = pending.get(message.id)
    if (!job) return
    if (message.type === "progress") {
      job.progress?.(message.total ? message.loaded / message.total : 0)
    } else if (message.type === "loaded") {
      pending.delete(message.id)
      job.resolve(null)
    } else if (message.type === "audio") {
      pending.delete(message.id)
      job.resolve(message.pcm)
    } else {
      pending.delete(message.id)
      job.reject(new Error(message.message))
    }
  })
  worker.addEventListener("error", (event) => {
    for (const [id, job] of pending) {
      job.reject(new Error(event.message || "La voce si è fermata"))
      pending.delete(id)
    }
    worker?.terminate()
    worker = null
  })
  return worker
}

type Outgoing = PiperRequest extends infer R
  ? R extends { id: number }
    ? Omit<R, "id">
    : never
  : never

function send(message: Outgoing, progress?: (fraction: number) => void) {
  const id = nextId++
  return new Promise<Float32Array | null>((resolve, reject) => {
    pending.set(id, { resolve, reject, progress })
    getWorker().postMessage({ ...message, id } as PiperRequest)
  })
}

const configs = new Map<string, Promise<VoiceConfig>>()

async function fetchConfig(voice: NeuralVoice): Promise<VoiceConfig> {
  const cache = await caches.open(VOICE_CACHE).catch(() => null)
  const hit = await cache?.match(voice.config)
  if (hit) return (await hit.json()) as VoiceConfig
  const response = await fetch(voice.config)
  if (!response.ok) throw new Error("Configurazione della voce non trovata")
  await cache?.put(voice.config, response.clone()).catch(() => undefined)
  return (await response.json()) as VoiceConfig
}

function config(voice: NeuralVoice) {
  let hit = configs.get(voice.id)
  if (!hit) {
    hit = fetchConfig(voice)
    hit.catch(() => configs.delete(voice.id))
    configs.set(voice.id, hit)
  }
  return hit
}

/** Scarica (se serve) e prepara la voce; `onProgress` va da 0 a 1 */
export async function loadVoice(
  voice: NeuralVoice,
  onProgress?: (fraction: number) => void
) {
  await Promise.all([
    config(voice),
    send(
      { type: "load", model: voice.model, sha256: voice.sha256 },
      onProgress
    ),
  ])
}

export type Speech = { pcm: Float32Array; sampleRate: number }

/** L'audio di una frase; `rate` 1 è la velocità naturale della voce */
export async function synthesize(
  voice: NeuralVoice,
  text: string,
  rate: number
): Promise<Speech> {
  const cfg = await config(voice)
  const ids = await phonemize(text, cfg.espeak.voice)
  if (!ids.length)
    return { pcm: new Float32Array(0), sampleRate: cfg.audio.sample_rate }
  const pcm = await send({
    type: "synth",
    model: voice.model,
    ids,
    scales: [
      cfg.inference.noise_scale,
      cfg.inference.length_scale / rate,
      cfg.inference.noise_w,
    ],
    speaker: voice.speaker,
  })
  return { pcm: pcm ?? new Float32Array(0), sampleRate: cfg.audio.sample_rate }
}

/** Libera memoria quando nessuno legge più */
export function releaseVoices() {
  worker?.terminate()
  worker = null
  for (const [id, job] of pending) {
    job.reject(new DOMException("Lettura interrotta", "AbortError"))
    pending.delete(id)
  }
}
